import { describe, expect, test } from 'vitest';

import { fakeEl, fakePage, type FakePage } from '../edge/page.fake.ts';
import { seatedHostFields, stepperHtml, stepperIds } from '../markup/stepper.ts';
import { bindStepper, paintStepper, stepped, type StepperSpec } from './stepper.ts';

const SPEC: StepperSpec = { id: 'players', min: 2, max: 4 };

const page = (value: string): FakePage =>
  fakePage([
    fakeEl('players', { value }),
    fakeEl('playersNum', { text: value }),
    fakeEl('playersDec'),
    fakeEl('playersInc'),
  ]);

describe('stepped', () => {
  test('moves by the delta inside the bounds and stops at each bound', () => {
    expect(stepped(2, 1, SPEC)).toBe(3);
    expect(stepped(4, 1, SPEC)).toBe(4);
    expect(stepped(2, -1, SPEC)).toBe(2);
    expect(stepped(9, 0, SPEC)).toBe(4);
  });

  test('a value that is no number counts as the minimum', () => {
    expect(stepped(Number.NaN, 0, SPEC)).toBe(2);
    expect(stepped(Number.NaN, 1, SPEC)).toBe(3);
  });
});

describe('paintStepper', () => {
  test('writes the number and the field; disables − at the minimum and + at the maximum', () => {
    const p = page('3');
    paintStepper(p.doc, SPEC, 2);
    expect(p.get('playersNum').text()).toBe('2');
    expect(p.get('players').value()).toBe('2');
    expect(p.get('playersDec').disabled()).toBe(true);
    expect(p.get('playersInc').disabled()).toBe(false);
    paintStepper(p.doc, SPEC, 4);
    expect(p.get('playersDec').disabled()).toBe(false);
    expect(p.get('playersInc').disabled()).toBe(true);
    paintStepper(p.doc, SPEC, 7);
    expect(p.get('playersNum').text()).toBe('4');
  });
});

describe('bindStepper', () => {
  test('+ and − step the field by one and hand the new value over; a tap at a bound hands nothing', () => {
    const p = page('2');
    const seen: number[] = [];
    bindStepper(p.doc, SPEC, (v) => {
      seen.push(v);
    });
    p.get('playersDec').fire('click');
    expect(seen).toEqual([]);
    p.get('playersInc').fire('click');
    p.get('playersInc').fire('click');
    p.get('playersInc').fire('click');
    expect(seen).toEqual([3, 4]);
    expect(p.get('players').value()).toBe('4');
    expect(p.get('playersNum').text()).toBe('4');
    p.get('playersDec').fire('click');
    expect(seen).toEqual([3, 4, 3]);
  });
});

describe('stepperHtml', () => {
  test('the hidden field, the shown number and the two buttons, each bound shipped disabled', () => {
    expect(stepperIds('players')).toEqual({
      dec: 'playersDec',
      num: 'playersNum',
      inc: 'playersInc',
    });
    const html = stepperHtml(
      { id: 'players', label: 'Players', min: 2, max: 4, value: 2, noun: 'players' },
      '  ',
    );
    expect(html.split('\n').every((line) => line.startsWith('  '))).toBe(true);
    expect(html).toContain('<input type="hidden" id="players" value="2" />');
    expect(html).toContain('id="playersDec" aria-label="Fewer players" disabled>−</button>');
    expect(html).toContain('id="playersInc" aria-label="More players">+</button>');
    const top = stepperHtml({ id: 'n', label: 'N', min: 1, max: 3, value: 3, noun: 'seats' });
    expect(top).toContain('id="nDec" aria-label="Fewer seats">−</button>');
    expect(top).toContain('id="nInc" aria-label="More seats" disabled>+</button>');
  });

  test("seatedHostFields: the players stepper over the host button, the shell's label unless the page says", () => {
    const players = { label: 'Players', min: 2, max: 12, value: 2, noun: 'players' } as const;
    const fields = seatedHostFields(players);
    expect(fields).toBe(
      `${stepperHtml({ id: 'playersCount', ...players }, '              ')}
              <button class="btn btn-go btn-block" id="hostBtn">Open a table</button>`,
    );
    expect(fields.split('\n').every((line) => line.startsWith('              '))).toBe(true);
    expect(seatedHostFields(players, 'Host')).toContain('id="hostBtn">Host</button>');
  });
});
