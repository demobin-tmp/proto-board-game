import { getShape } from '../game/shapes';
import { COLOR_HEX } from './colors';
import MiniShape from './MiniShape';
import { SKIP_SIZE } from '../game/game';

// Color-kind tiles haven't been claimed by a player yet, so anything that
// isn't the live offer (skipped / upcoming) shows in a neutral tone.
function previewColor(tile) {
  return tile.kind === 'grey' ? COLOR_HEX.grey : COLOR_HEX.neutral;
}

function tileMeta(tile, shape) {
  return `${shape.size} cell${shape.size > 1 ? 's' : ''} · ${tile.kind === 'grey' ? 'grey' : 'colored'}`;
}

function StaticTile({ tile, className }) {
  const shape = getShape(tile.shapeId);
  return (
    <div className={className}>
      <MiniShape cells={shape.rotations[0]} color={previewColor(tile)} />
      <span className="tile-meta">{tileMeta(tile, shape)}</span>
    </div>
  );
}

function EmptySlot() {
  return <div className="offer-tile empty-slot" aria-hidden="true" />;
}

// Single row showing the ring around the token: tiles previously offered
// but skipped (left, dimmed), the current selectable offer (middle), and a
// preview of what's coming up next (right, dimmed).
export default function TileTrack({
  skipped,
  offer,
  upcoming,
  currentColor,
  isActive,
  selectedIndex,
  rotationIndex,
  flipped,
  onSelect,
  onRotate,
  onFlip,
}) {
  const skipSlots = [...Array(SKIP_SIZE - skipped.length).fill(null), ...skipped];
  const selectedTile = selectedIndex != null ? offer[selectedIndex] : null;

  return (
    <div className="tile-track">
      <h2>{isActive ? 'Choose a shape, then click the board' : 'Available shapes'}</h2>
      <div className="tile-row">
        {skipSlots.map((tile, i) =>
          tile ? (
            <StaticTile key={tile.tileId} tile={tile} className="offer-tile skipped-tile" />
          ) : (
            <EmptySlot key={`skip-empty-${i}`} />
          )
        )}

        <div className="token-marker" title="Token — the offer is drawn from here">
          <span className="token-line" />
          <span className="token-label">pick</span>
        </div>

        {offer.map((tile, index) => {
          const shape = getShape(tile.shapeId);
          const isSelected = index === selectedIndex;
          // Colored tiles default to the mirror image on the blue side of
          // the piece; the selected tile reflects whatever side the player
          // has flipped it to.
          const mirrored = isSelected ? flipped : tile.kind === 'color' && currentColor === 'blue';
          const rotations = mirrored ? shape.mirroredRotations : shape.rotations;
          const rotation = rotations[isSelected ? rotationIndex % rotations.length : 0];
          const color = tile.kind === 'grey' ? COLOR_HEX.grey : COLOR_HEX[currentColor];

          return (
            <button
              type="button"
              key={tile.tileId}
              className={`offer-tile${isSelected ? ' selected' : ''}`}
              onClick={() => onSelect(index)}
              disabled={!isActive}
            >
              <MiniShape cells={rotation} color={color} />
              <span className="tile-meta">{tileMeta(tile, shape)}</span>
            </button>
          );
        })}

        {upcoming.map((tile) => (
          <StaticTile key={tile.tileId} tile={tile} className="offer-tile upcoming-tile" />
        ))}
      </div>
      {selectedIndex != null && (
        <div className="tile-controls">
          <button type="button" className="rotate-button" onClick={onRotate}>
            Rotate ↻
          </button>
          {/* Flipping a colored tile would change its shape but not its
              color, which doesn't match a real flip — only grey tiles
              (same on both sides) can be flipped. */}
          {selectedTile.kind === 'grey' && (
            <button type="button" className="flip-button" onClick={onFlip}>
              Flip ⇄
            </button>
          )}
        </div>
      )}
      <label className="auto-flip-toggle">
        <input type="checkbox" checked disabled />
        Auto-flip colored tiles to my color
      </label>
    </div>
  );
}
