// The seat-name inputs over the fake page: the paint shows the first `n` seats past the second and
// fills each with its remembered name or the game's default (marked), the binder reports typing and
// clears a default once, the reader hands back seats 3+ in order.
import { describe, expect, test } from 'vitest';

import { fakeEl, fakePage, type FakePage } from '../edge/page.fake.ts';
import { seatNameInputId } from '../markup/seatNames.ts';
import { DEFAULT_MARK } from './home.ts';
import { bindSeatNames, paintSeatNames, readSeatNames, type SeatNamesSpec } from './seatNames.ts';

const SPEC: SeatNamesSpec = { max: 5, names: ['Ari', 'Lavi', 'Sandro'] };

const page = (): FakePage =>
  fakePage(
    Array.from({ length: SPEC.max }, (_, seat) =>
      fakeEl(seatNameInputId(seat), { classes: seat >= 2 ? ['grow', 'hidden'] : ['grow'] }),
    ),
  );

describe('paintSeatNames', () => {
  test('shows the seats up to n and fills each with the remembered name, else the marked default', () => {
    const p = page();
    paintSeatNames(p.doc, SPEC, 4, [null, 'Dan', null]);
    expect(p.get('p3NameInput').hasClass('hidden')).toBe(false);
    expect(p.get('p4NameInput').hasClass('hidden')).toBe(false);
    expect(p.get('p5NameInput').hasClass('hidden')).toBe(true);
    expect(p.get('p3NameInput').value()).toBe('Sandro');
    expect(p.get('p3NameInput').attr(DEFAULT_MARK)).toBe('1');
    expect(p.get('p4NameInput').value()).toBe('Dan');
    expect(p.get('p4NameInput').attr(DEFAULT_MARK)).toBeNull();
    // Past the game's list the default is numbered; a short memory counts as nothing typed.
    expect(p.get('p5NameInput').value()).toBe('Player 5');
    // A cleared seat ('') stays empty and unmarked: the repaint after the tap must not refill it.
    paintSeatNames(p.doc, SPEC, 4, ['', 'Dan', null]);
    expect(p.get('p3NameInput').value()).toBe('');
    expect(p.get('p3NameInput').attr(DEFAULT_MARK)).toBeNull();
    paintSeatNames(p.doc, SPEC, 2, []);
    expect(p.get('p3NameInput').hasClass('hidden')).toBe(true);
    // The shell's two seats are never touched here.
    expect(p.get('p1NameInput').value()).toBe('');
  });
});

describe('bindSeatNames', () => {
  test('typing reaches onTyped with the seat; a default clears once on focus or tap and is reported empty', () => {
    const p = page();
    const seen: (readonly [number, string])[] = [];
    paintSeatNames(p.doc, SPEC, 5, [null, 'Dan', null]);
    bindSeatNames(p.doc, SPEC, (seat, value) => {
      seen.push([seat, value]);
    });
    const p3 = p.get('p3NameInput');
    p3.fire('focus');
    expect(p3.value()).toBe('');
    expect(p3.attr(DEFAULT_MARK)).toBeNull();
    p3.fire('pointerdown');
    expect(seen).toEqual([[2, '']]);
    // The repaint with the reported '' leaves the cleared seat alone, so the keystroke is the whole name.
    paintSeatNames(p.doc, SPEC, 5, ['', 'Dan', null]);
    expect(p3.value()).toBe('');
    expect(p3.attr(DEFAULT_MARK)).toBeNull();
    (p3.el as HTMLInputElement).value = 'Q';
    p3.fire('input');
    expect(seen).toEqual([
      [2, ''],
      [2, 'Q'],
    ]);
    p.get('p4NameInput').fire('focus');
    expect(p.get('p4NameInput').value()).toBe('Dan');
    (p.get('p5NameInput').el as HTMLInputElement).value = 'Eve';
    p.get('p5NameInput').fire('input');
    expect(seen).toEqual([
      [2, ''],
      [2, 'Q'],
      [4, 'Eve'],
    ]);
    expect(p.get('p1NameInput').listenerTypes()).toEqual([]);
  });
});

describe('readSeatNames', () => {
  test('the raw values of seats 3 to max in order', () => {
    const p = page();
    paintSeatNames(p.doc, SPEC, 5, ['Cy', null, 'Eve']);
    expect(readSeatNames(p.doc, SPEC)).toEqual(['Cy', 'Player 4', 'Eve']);
    expect(readSeatNames(p.doc, { ...SPEC, max: 2 })).toEqual([]);
  });
});
