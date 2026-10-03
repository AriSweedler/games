import { describe, expect, test } from 'vitest';

import { handoffLabel, listNames, normaliseName, resumeLabel, type NameRule } from './name.ts';

// Fidice's rule (domain/types.ts NAME_RULE), the first consumer; the legacy lobby's
// `cleanName('  abcdefghijklmnopqrstuvwxyz ')` is 'abcdefghijklmnop' (test/parity/fidice.legacy).
const RULE: NameRule = { max: 16, fallback: 'Player' };

describe('normaliseName', () => {
  test.each([
    ['trims', '  Ari  ', 'Ari'],
    ['cuts at max after trimming', '  abcdefghijklmnopqrstuvwxyz ', 'abcdefghijklmnop'],
    ['keeps a name of exactly max whole', 'abcdefghijklmnop', 'abcdefghijklmnop'],
    ['cuts one over max', 'abcdefghijklmnopq', 'abcdefghijklmnop'],
    ['an empty name takes the fallback', '', 'Player'],
    ['a whitespace-only name takes the fallback', '   ', 'Player'],
    ['inner spaces stay', 'Big  Al', 'Big  Al'],
  ])('%s', (_, raw, expected) => {
    expect(normaliseName(raw, RULE)).toBe(expected);
  });

  test('an empty fallback yields the cut name or the empty string (the filter sites)', () => {
    const clean: NameRule = { max: 16, fallback: '' };
    expect(normaliseName('  Ziggy  ', clean)).toBe('Ziggy');
    expect(normaliseName('   ', clean)).toBe('');
  });
});

// The label strings every game pinned (uno, flip7, briscola, fidice, hive, gin, backgammon); the
// shell e2e specs read the resume box and the handoff bar by these bytes.
type Game = Readonly<{ names: ReadonlyArray<string> }>;
const namesOf = (game: Game): ReadonlyArray<string> => game.names;
const two: Game = { names: ['Ann', 'Bob'] };
const three: Game = { names: ['Ann', 'Bob', 'Cara'] };
const host = { kind: 'host', code: 'KQZM', handoff: false, game: two } as const;

describe('listNames', () => {
  test.each([
    [[], ''],
    [['Ann'], 'Ann'],
    [['Ann', 'Bob'], 'Ann and Bob'],
    [['Ann', 'Bob', 'Cara'], 'Ann, Bob and Cara'],
    [['Ann', 'Bob', 'Cara', 'Dan'], 'Ann, Bob, Cara and Dan'],
  ])('%j', (names, list) => {
    expect(listNames(names)).toBe(list);
  });
});

describe('handoffLabel', () => {
  test('seat 0 hosts, seat 1 joins by invite', () => {
    expect(handoffLabel(['Ann', 'Bob'])).toBe('Continue online: Ann hosts, Bob joins by invite');
    expect(handoffLabel(['Ann', 'Bob', 'Cara'])).toBe(
      'Continue online: Ann hosts, Bob joins by invite',
    );
  });

  test('a missing seat reads as the empty name', () => {
    expect(handoffLabel([])).toBe('Continue online:  hosts,  joins by invite');
  });
});

describe('resumeLabel', () => {
  test('local: "vs" at two seats, the list past two', () => {
    expect(resumeLabel({ kind: 'local', game: two }, namesOf)).toBe(
      'Resume pass & play: Ann vs Bob',
    );
    expect(resumeLabel({ kind: 'local', game: three }, namesOf)).toBe(
      'Resume pass & play: Ann, Bob and Cara',
    );
  });

  test('host: the room, or the handoff offer once a game is handed off', () => {
    expect(resumeLabel(host, namesOf)).toBe('Resume hosting room KQZM');
    expect(resumeLabel({ ...host, handoff: true }, namesOf)).toBe(handoffLabel(two.names));
    // A room still waiting for its first guest has no game to hand off (lobby-resume.md D3).
    expect(resumeLabel({ ...host, handoff: true, game: null }, namesOf)).toBe(
      'Resume hosting room KQZM',
    );
  });

  test('guest: rejoin the room', () => {
    expect(resumeLabel({ kind: 'guest', code: 'KQZM' }, namesOf)).toBe('Rejoin room KQZM');
  });
});
