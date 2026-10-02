// Flip 7's fixtures (docs/design/flip7.md): a hand-made position through the documented hook
// (`window.__flip7.game()` read, `setup()` written: the shell's `position/load`, pass and play
// only). The seeded play-through and the table's view keys live where they are used
// (e2e/flip7-local.spec.ts, e2e/fixtures/online-games.ts).
import { expect, type Page } from '@playwright/test';

/**
 * The seat to move holds a 5 and a 9, every other seat a 3, the next card another 5: its Hit
 * busts it (the card and the fourteen points lost), and the pause holds the table until Continue
 * (the owner, 2026-10-02). The phone is left with that seat (seat 0), no curtain up.
 */
export const flip7RigBust = async (page: Page): Promise<void> => {
  // The harness has no DOM types (tsconfig.node.json): the hook is called by source, as backgammon's is.
  await page.evaluate(`(() => {
    const f = window.__flip7;
    const g = f.game();
    const n = (id, value) => ({ id, kind: 'number', value });
    const used = ['n5-1', 'n9-1', 'n5-2', 'n3-1'];
    f.setup({
      ...g,
      opening: 0,
      turn: 0,
      phase: { kind: 'turn' },
      flip3: null,
      pending: [],
      seats: g.seats.map((s, i) => ({ ...s, status: 'active', line: i === 0 ? [n('n5-1', 5), n('n9-1', 9)] : [n('n3-1', 3)] })),
      draw: [...g.draw.filter((c) => !used.includes(c.id)), n('n5-2', 5)],
    });
  })()`);
  await expect(page.locator('#curtainOverlay')).toBeHidden();
  await expect(page.locator('#mySeat .tile')).toHaveCount(2);
};
