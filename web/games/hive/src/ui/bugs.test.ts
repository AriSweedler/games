import { describe, expect, test } from 'vitest';

import { BUGS } from '../engine/pieces.ts';
import { BUG_SPRITE_SVG, symbolId } from './bugs.ts';

describe('the bug sprite', () => {
  test('the sprite carries every bug once, by id, with the tiles’ gradients and filters', () => {
    BUGS.forEach((bug) => {
      expect(BUG_SPRITE_SVG.split(`id="${symbolId(bug)}"`)).toHaveLength(2);
    });
    expect(BUG_SPRITE_SVG).not.toContain('<!--');
    ['hive-sheen', 'hive-edge', 'hive-shadow', 'hive-lift'].forEach((id) => {
      expect(BUG_SPRITE_SVG).toContain(`id="${id}"`);
    });
    expect(BUG_SPRITE_SVG).toContain('width="0" height="0"');
  });
});
