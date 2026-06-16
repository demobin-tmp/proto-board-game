import { useState } from 'react';
import { getShape } from '../game/shapes';
import { OFFER_SIZE, PREVIEW_SIZE, ringWindow } from '../game/game';
import { COLOR_HEX } from './colors';
import MiniShape from './MiniShape';

function slotStatus(ring, seen, tokenIndex, index) {
  if (ring[index] === null) return 'taken';
  if (index === tokenIndex) return 'token';

  // Walk forward from token to find offer + upcoming positions
  const n = ring.length;
  let offerCount = 0;
  let previewCount = 0;
  for (let step = 1; step <= n; step++) {
    const idx = (((tokenIndex + step) % n) + n) % n;
    if (ring[idx] === null) continue;
    if (offerCount < OFFER_SIZE) {
      if (idx === index) return 'offer';
      offerCount++;
    } else if (previewCount < PREVIEW_SIZE) {
      if (idx === index) return 'upcoming';
      previewCount++;
    } else {
      break;
    }
  }

  if (seen[index]) return 'skipped';
  return 'unseen';
}

const STATUS_LABEL = {
  taken:    { text: 'taken',    color: '#b8b4ab' },
  token:    { text: 'token',    color: '#2b2a26' },
  offer:    { text: 'offer',    color: '#2e8b57' },
  upcoming: { text: 'next',     color: '#2f6fb0' },
  skipped:  { text: 'skipped',  color: '#c0392b' },
  unseen:   { text: 'unseen',   color: '#9a9a93' },
};

export default function RingInspector({ ring, seen, tokenIndex, currentColor }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="ring-inspector-button" onClick={() => setOpen(true)}>
        All tiles ↓
      </button>

      {open && (
        <div className="ring-inspector-overlay" onClick={() => setOpen(false)}>
          <div className="ring-inspector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ring-inspector-header">
              <span>Ring — {ring.filter(Boolean).length} of {ring.length} remaining</span>
              <button type="button" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="ring-inspector-grid">
              {ring.map((tile, i) => {
                const status = slotStatus(ring, seen, tokenIndex, i);
                const { text, color } = STATUS_LABEL[status];
                return (
                  <div key={i} className={`ring-slot ring-slot-${status}`}>
                    <span className="ring-slot-index">{i}</span>
                    {tile ? (
                      <>
                        <MiniShape
                          cells={
                            tile.kind === 'color' && currentColor === 'blue'
                              ? getShape(tile.shapeId).mirroredRotations[0]
                              : getShape(tile.shapeId).rotations[0]
                          }
                          color={tile.kind === 'grey' ? COLOR_HEX.grey : COLOR_HEX[currentColor]}
                        />
                        <span className="ring-slot-name">{tile.shapeId}</span>
                      </>
                    ) : (
                      <span className="ring-slot-name">—</span>
                    )}
                    <span className="ring-slot-status" style={{ color }}>{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
