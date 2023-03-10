/*
 * Copyright 2017 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { Random } from './random';
import { makeMove } from '../../core/action-creators';
import { CreateGameReducer } from '../../core/reducer';
import { InitializeGame } from '../../core/initialize';
import { Client } from '../../client/client';
import type { Game } from '../../types';
import { PlayerView } from '../main';

function Init(seed) {
  return new Random({ seed });
}

test('random', () => {
  const r = Init('hi there');
  // make sure that subsequent calls are different.
  expect(r._random()).toBe(0.573445922927931);
  expect(r._random()).toBe(0.4695413049776107);
  expect(r._random()).toBe(0.5943194630090147);
});

test('predefined dice values', () => {
  const r = Init(0);

  const rfns = [4, 6, 8, 10, 12, 20].map((v) => {
    return { fn: r.api()[`D${v}`], highest: v };
  });

  rfns.forEach((pair) => {
    const result = pair.fn();
    expect(result).toBeDefined();
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(pair.highest);
    expect(r.state.prngstate).toBeDefined();

    const multiple = pair.fn(5);
    expect(multiple).toBeDefined();
    expect(multiple).toHaveLength(5);
    multiple.forEach((m) => {
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(pair.highest);
    });
  });
});

test('Random.Die', () => {
  const r = Init(0);
  const api = r.api();

  {
    const result = api.Die(123);
    expect(result).toBeDefined();
    expect(result).toBe(74);
    expect(r.state.prngstate).toBeDefined();
  }

  {
    const result = api.Die();
    expect(result).toBeDefined();
    expect(result).toBeLessThanOrEqual(6);
    expect(r.state.prngstate).toBeDefined();
  }

  {
    const multiple = api.Die(6, 3);
    expect(multiple).toBeDefined();
    expect(multiple).toHaveLength(3);
    multiple.forEach((m) => {
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(6);
    });
    expect(r.state.prngstate).toBeDefined();
  }
});

test('Random.Number', () => {
  const r = Init(0);
  const result = r.api().Number();
  expect(result).toBeDefined();
  expect(result).toBeGreaterThanOrEqual(0);
  expect(result).toBeLessThanOrEqual(1);
  expect(r.state.prngstate).toBeDefined();
});

test('Random.Shuffle', () => {
  const r = Init(0);
  const initialTiles = ['A', 'B', 'C', 'D', 'E'];
  const tiles = [...initialTiles];
  const result = r.api().Shuffle(tiles);
  expect(result).toHaveLength(initialTiles.length);
  expect(result).toEqual(expect.arrayContaining(initialTiles));
  expect(result.sort()).toEqual(initialTiles);
  expect(r.state.prngstate).toBeDefined();
});

test('Random API is not executed optimisitically', () => {
  const game: Game = {
    seed: 0,
    moves: {
      rollDie: ({ G, random }) => ({ ...G, die: random.D6() }),
    },
  };

  {
    const reducer = CreateGameReducer({ game });
    let state = InitializeGame({ game });
    expect(state.G.die).not.toBeDefined();
    state = reducer(state, makeMove('rollDie'));
    expect(state.G).toMatchObject({ die: 4 });
  }

  {
    const reducer = CreateGameReducer({ game, isClient: true });
    let state = InitializeGame({ game });
    expect(state.G.die).not.toBeDefined();
    state = reducer(state, makeMove('rollDie'));
    expect(state.G.die).not.toBeDefined();
  }
});

test('Random API works when its state is redacted by playerView', () => {
  const game = {
    seed: 0,
    moves: {
      rollDie: ({ G, random }) => ({ ...G, die: random.D6() }),
    },
  };

  const opts = { game, isClient: true };
  const reducer = CreateGameReducer(opts);
  let state = InitializeGame({ game });
  state.plugins = PlayerView(state, { ...opts, playerID: '0' });
  expect(state.plugins.random.data).not.toBeDefined();
  expect(state.G.die).not.toBeDefined();
  state = reducer(state, makeMove('rollDie'));
  expect(state.G.die).not.toBeDefined();
});

test('turn.onBegin has ctx APIs at the beginning of the game', () => {
  let random = null;
  let events = null;

  const game: Game = {
    turn: {
      onBegin: (context) => {
        random = context.random;
        events = context.events;
      },
    },
  };

  InitializeGame({ game });
  expect(random).not.toBe(null);
  expect(events).not.toBe(null);
});

test('PRNG state is not sent to the client', () => {
  const client = Client({ game: {} });
  expect(client.getState().plugins.random.data).toBeUndefined();
});
