import { useMemo } from 'react';

/**
 * A little pixel face for the account.
 *
 * It is drawn from the name of the player, so everybody gets their own face
 * and it never changes. No picture is needed, which keeps the site light.
 */

const HAIR = ['#3b2410', '#8b5a2b', '#1a0500', '#c68b59', '#f4c58a', '#2b2b2b', '#d94f4f'];
const SKIN = ['#f4c58a', '#e0ac69', '#c68642', '#8d5524', '#ffd9a0'];
const SHIRT = ['#4fb3ff', '#7ed957', '#ffd21f', '#e35d5d', '#9b6bff', '#ff9f43', '#2b9cf2'];

/** The same name always gives the same face. */
function hashOf(text) {
  let hash = 2166136261;
  for (const ch of String(text)) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export default function PixelAvatar({ name = '', size = null }) {
  const colors = useMemo(() => {
    const hash = hashOf(name || 'player');
    return {
      hair: HAIR[hash % HAIR.length],
      skin: SKIN[(hash >> 3) % SKIN.length],
      shirt: SHIRT[(hash >> 6) % SHIRT.length],
    };
  }, [name]);

  // The 8 by 8 face. The eyes and the mouth are always in the same place.
  const cells = useMemo(() => {
    const grid = [];
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        let color = colors.skin;

        if (row < 3) color = colors.hair;                       // the hair
        else if (row >= 6) color = colors.shirt;                // the shirt
        else if (row === 3 && (column === 2 || column === 5)) color = '#1a0500'; // the eyes
        else if (row === 3 && (column === 1 || column === 6)) color = colors.hair; // the sides
        else if (row === 5 && (column === 3 || column === 4)) color = '#8a4b3a'; // the mouth

        grid.push(color);
      }
    }
    return grid;
  }, [colors]);

  return (
    <div
      className="pixel-avatar"
      style={size ? { '--avatar-size': `${size}px` } : undefined}
      role="img"
      aria-label={`The face of ${name || 'the player'}`}
    >
      {cells.map((color, index) => (
        <span key={index} style={{ background: color }} />
      ))}
    </div>
  );
}
