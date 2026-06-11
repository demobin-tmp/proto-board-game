import { getShape } from '../game/shapes';
import { COLOR_HEX } from './colors';
import MiniShape from './MiniShape';
import { SKIP_SIZE } from '../game/game';

// A 1x1 filler used to drop the selected tile and place this instead, for
// turns where none of the offer's actual shapes can legally go anywhere.
const FILLER_CELL = [[0, 0]];

// Color-kind tiles haven't been claimed by a player yet, so anything that
// isn't the live offer (skipped / upcoming) shows in a neutral tone.
function previewColor(tile) {
  return tile.kind === 'grey' ? COLOR_HEX.grey : COLOR_HEX.neutral;
}

function tileMeta(tile, shape, useFiller) {
  if (useFiller) return '1 cell · dropped for a 1×1';
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
  useFiller,
  onSelect,
  onRotate,
  onFlip,
  onToggleFiller,
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
          const rotation = isSelected && useFiller ? FILLER_CELL : rotations[isSelected ? rotationIndex % rotations.length : 0];
          const color = isSelected && useFiller ? COLOR_HEX[currentColor] : tile.kind === 'grey' ? COLOR_HEX.grey : COLOR_HEX[currentColor];

          return (
            <button
              type="button"
              key={tile.tileId}
              className={`offer-tile${isSelected ? ' selected' : ''}`}
              onClick={() => onSelect(index)}
              disabled={!isActive}
            >
              <MiniShape cells={rotation} color={color} />
              <span className="tile-meta">{tileMeta(tile, shape, isSelected && useFiller)}</span>
            </button>
          );
        })}

        {upcoming.map((tile) => (
          <StaticTile key={tile.tileId} tile={tile} className="offer-tile upcoming-tile" />
        ))}
      </div>
      {selectedIndex != null && (
        <div className="tile-controls">
          {!useFiller && (
            <button type="button" className="rotate-button" onClick={onRotate}>
              Rotate ↻
            </button>
          )}
          {/* Flipping a colored tile would change its shape but not its
              color, which doesn't match a real flip — only grey tiles
              (same on both sides) can be flipped. */}
          {!useFiller && selectedTile.kind === 'grey' && (
            <button type="button" className="flip-button" onClick={onFlip}>
              Flip ⇄
            </button>
          )}
          <button type="button" className="filler-button" onClick={onToggleFiller}>
            {useFiller ? 'Place full shape' : 'Place 1×1 instead'}
          </button>
        </div>
      )}
      <label className="auto-flip-toggle">
        <input type="checkbox" checked disabled />
        Auto-flip colored tiles to my color
      </label>
    </div>
  );
}
