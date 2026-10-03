import { describe, expect, test } from 'vitest';

import { fakeEl, fakePage, type FakePage } from '../edge/page.fake.ts';
import { bindCurtain, curtainText, paintCurtain, type CurtainText } from './curtain.ts';
import type { Intent, ShellTypes } from './shell.ts';

const page = (): FakePage =>
  fakePage([
    fakeEl('curtainOverlay', { classes: ['overlay', 'hidden'] }),
    fakeEl('curtainTitle', { text: 'Pass the phone' }),
    fakeEl('curtainSub'),
    fakeEl('curtainLast'),
    fakeEl('curtainBtn', { text: 'Show my cards' }),
    fakeEl('curtainHandoffBtn', { classes: ['hidden'] }),
  ]);

const TEXT: CurtainText = {
  title: 'Pass the phone to Bob',
  sub: 'Ann, look away 👀',
  last: 'Ann passed on the upcard.',
};

describe('curtainText', () => {
  test('spells the title once for every game; the button rides along only where a game names it', () => {
    expect(curtainText({ to: 'Bob', sub: 'Ann, look away 👀', last: 'Ann passed.' })).toEqual({
      title: 'Pass the phone to Bob',
      sub: 'Ann, look away 👀',
      last: 'Ann passed.',
    });
    expect(
      curtainText({ to: 'Bob', sub: '', last: '', button: "I'm Bob — show my cards" }),
    ).toEqual({
      title: 'Pass the phone to Bob',
      sub: '',
      last: '',
      button: "I'm Bob — show my cards",
    });
  });
});

describe('paintCurtain', () => {
  test('shows the curtain with its texts, the button keeping the markup`s words; hides it, texts untouched, for null', () => {
    const p = page();
    paintCurtain(p.doc, TEXT);
    expect(p.get('curtainOverlay').hidden()).toBe(false);
    expect(p.get('curtainTitle').text()).toBe('Pass the phone to Bob');
    expect(p.get('curtainSub').text()).toBe('Ann, look away 👀');
    expect(p.get('curtainLast').text()).toBe('Ann passed on the upcard.');
    expect(p.get('curtainBtn').text()).toBe('Show my cards');
    paintCurtain(p.doc, null);
    expect(p.get('curtainOverlay').hidden()).toBe(true);
    expect(p.get('curtainTitle').text()).toBe('Pass the phone to Bob');
  });

  test('the handoff button shows only while the curtain is up and the game says the hand-over can go online', () => {
    const p = page();
    paintCurtain(p.doc, TEXT);
    expect(p.get('curtainHandoffBtn').hidden()).toBe(true);
    paintCurtain(p.doc, TEXT, true);
    expect(p.get('curtainHandoffBtn').hidden()).toBe(false);
    paintCurtain(p.doc, TEXT, false);
    expect(p.get('curtainHandoffBtn').hidden()).toBe(true);
    // The curtain down puts the button away whatever the game says: the overlay hides it anyway,
    // and the next curtain up decides afresh.
    paintCurtain(p.doc, TEXT, true);
    paintCurtain(p.doc, null, true);
    expect(p.get('curtainOverlay').hidden()).toBe(true);
    expect(p.get('curtainHandoffBtn').hidden()).toBe(true);
  });

  test('a game whose button follows the view (gin, backgammon) paints its words', () => {
    const p = page();
    paintCurtain(p.doc, { ...TEXT, button: "I'm Bob — show my cards" });
    expect(p.get('curtainBtn').text()).toBe("I'm Bob — show my cards");
    paintCurtain(p.doc, TEXT);
    expect(p.get('curtainBtn').text()).toBe("I'm Bob — show my cards");
  });
});

describe('bindCurtain', () => {
  test('one tap dispatches the shell`s reveal by default', () => {
    const p = page();
    const intents: Intent<ShellTypes>[] = [];
    bindCurtain<ShellTypes>(p.doc, (i) => {
      intents.push(i);
    });
    p.get('curtainBtn').fire('click');
    expect(intents).toEqual([{ type: 'curtain/reveal' }]);
  });

  test('the handoff button dispatches the shell`s handoff/click', () => {
    const p = page();
    const intents: Intent<ShellTypes>[] = [];
    bindCurtain<ShellTypes>(p.doc, (i) => {
      intents.push(i);
    });
    p.get('curtainHandoffBtn').fire('click');
    expect(intents).toEqual([{ type: 'handoff/click' }]);
  });

  test('with onReveal, one tap dispatches what it returns, in order, at that moment', () => {
    const p = page();
    const intents: Intent<ShellTypes>[] = [];
    bindCurtain<ShellTypes>(
      p.doc,
      (i) => {
        intents.push(i);
      },
      // Asked at each tap, not at bind time: the second tap sees the first's intent dispatched.
      () =>
        intents.length === 0
          ? [{ type: 'curtain/reveal' }]
          : [{ type: 'curtain/reveal' }, { type: 'escape' }],
    );
    p.get('curtainBtn').fire('click');
    expect(intents).toEqual([{ type: 'curtain/reveal' }]);
    p.get('curtainBtn').fire('click');
    expect(intents).toEqual([
      { type: 'curtain/reveal' },
      { type: 'curtain/reveal' },
      { type: 'escape' },
    ]);
  });
});
