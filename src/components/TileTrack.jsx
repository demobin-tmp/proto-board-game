import { getShape } from '../game/shapes';
import { COLOR_HEX } from './colors';
import MiniShape from './MiniShape';

// A 1x1 filler used to drop the selected tile and place this instead, for
// turns where none of the offer's actual shapes can legally go anywhere.
const FILLER_CELL = [[0, 0]];


function tileMeta(tile, shape, useFiller) {
  if (useFiller) return '1 cell · dropped for a 1×1';
  return `${shape.size} cell${shape.size > 1 ? 's' : ''} · ${tile.kind === 'grey' ? 'grey' : 'colored'}`;
}

function StaticTile({ tile, className, currentColor }) {
  const shape = getShape(tile.shapeId);
  const cells = tile.kind === 'color' && currentColor === 'blue'
    ? shape.mirroredRotations[0]
    : shape.rotations[0];
  const color = tile.kind === 'grey' ? COLOR_HEX.grey : COLOR_HEX[currentColor];
  return (
    <div className={className}>
      <MiniShape cells={cells} color={color} />
      <span className="tile-meta">{tileMeta(tile, shape)}</span>
    </div>
  );
}

// Single row showing the ring around the token: tiles previously offered
// but skipped (left, dimmed), the current selectable offer (middle), and a
// preview of what's coming up next (right, dimmed).
// For colored tiles, the current active player's color determines which face
// is shown — red sees normal, blue sees mirror. Grey tiles flip only when
// the player explicitly chooses via the flip button.
function tileRotations(tile, shape, currentColor, isSelected, flipped) {
  if (tile.kind === 'color') {
    return currentColor === 'blue' ? shape.mirroredRotations : shape.rotations;
  }
  return isSelected && flipped ? shape.mirroredRotations : shape.rotations;
}

export default function TileTrack({
  offer,
  upcoming,
  myColor,
  currentColor,
  isActive,
  selectedIndex,
  rotationIndex,
  flipped,
  useFiller,
  powerUp,
  canExpand,
  canExtraTurn,
  canPlaceTokens,
  canIgnoreColor,
  canDisrupt,
  powerUpsLeft,
  onSelect,
  onRotate,
  onFlip,
  onToggleFiller,
  onTogglePowerUp,
}) {
  const selectedTile = selectedIndex != null ? offer[selectedIndex] : null;

  return (
    <div className="tile-track">
<div className="tile-row">
{offer.map((tile, index) => {
          const shape = getShape(tile.shapeId);
          const isSelected = index === selectedIndex;
          const rotations = tileRotations(tile, shape, currentColor, isSelected, flipped);
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
          <StaticTile key={tile.tileId} tile={tile} className="offer-tile upcoming-tile" currentColor={currentColor} />
        ))}
      </div>
      {selectedIndex != null && (
        <div className="tile-controls">
          {!useFiller && (
            <button type="button" className="rotate-button" onClick={onRotate}>
              Rotate ↻
            </button>
          )}
          {/* Colored tiles are drawn already committed to one handedness
              (the supply has separate normal/mirrored entries for chiral
              shapes), so only grey tiles offer a flip side. */}
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
      {isActive && (
        <div className="tile-controls">
          <span className="power-ups-left">{powerUpsLeft} power-up{powerUpsLeft === 1 ? '' : 's'} left</span>
          <button
            type="button"
            className={`empower-button${powerUp === 'expand' ? ' active' : ''}`}
            onClick={() => onTogglePowerUp('expand')}
            disabled={!canExpand && powerUp !== 'expand'}
          >
            ⚡ select from 6{powerUp === 'expand' ? ' ✕' : ''}
          </button>
          <button
            type="button"
            className={`empower-button${powerUp === 'extra-turn' ? ' active' : ''}`}
            onClick={() => onTogglePowerUp('extra-turn')}
            disabled={!canExtraTurn && powerUp !== 'extra-turn'}
          >
            ⚡⚡ Extra turn{powerUp === 'extra-turn' ? ' ✕' : ''}
          </button>
          <button
            type="button"
            className={`empower-button${powerUp === 'tokens' ? ' active' : ''}`}
            onClick={() => onTogglePowerUp('tokens')}
            disabled={!canPlaceTokens && powerUp !== 'tokens'}
          >
            ⚡ 4 tokens{powerUp === 'tokens' ? ' ✕' : ''}
          </button>
          <button
            type="button"
            className={`empower-button${powerUp === 'ignore-color' ? ' active' : ''}`}
            onClick={() => onTogglePowerUp('ignore-color')}
            disabled={!canIgnoreColor && powerUp !== 'ignore-color'}
          >
            ⚡⚡ Override color{powerUp === 'ignore-color' ? ' ✕' : ''}
          </button>
          <button
            type="button"
            className="empower-button"
            onClick={() => onTogglePowerUp('disrupt')}
            disabled={!canDisrupt}
          >
            ⚡⚡ Disrupt
          </button>
        </div>
      )}
    </div>
  );
}
