import { getShape } from '../game/shapes';
import { COLOR_HEX } from './colors';

function MiniShape({ cells, color }) {
  const maxRow = Math.max(...cells.map(([row]) => row));
  const maxCol = Math.max(...cells.map(([, col]) => col));
  const filled = new Set(cells.map(([row, col]) => `${row},${col}`));

  const rows = [];
  for (let row = 0; row <= maxRow; row++) {
    const cols = [];
    for (let col = 0; col <= maxCol; col++) {
      const isFilled = filled.has(`${row},${col}`);
      cols.push(
        <span
          key={col}
          className="mini-cell"
          style={{ backgroundColor: isFilled ? color : 'transparent' }}
        />
      );
    }
    rows.push(
      <div className="mini-row" key={row}>
        {cols}
      </div>
    );
  }
  return <div className="mini-shape">{rows}</div>;
}

export default function ShapeOffer({
  offer,
  currentColor,
  isActive,
  selectedIndex,
  rotationIndex,
  onSelect,
  onRotate,
}) {
  return (
    <div className="shape-offer">
      <h2>{isActive ? 'Choose a shape, then click the board' : 'Available shapes'}</h2>
      <div className="offer-tiles">
        {offer.map((tile, index) => {
          const shape = getShape(tile.shapeId);
          const isSelected = index === selectedIndex;
          const rotation = shape.rotations[isSelected ? rotationIndex % shape.rotations.length : 0];
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
              <span className="tile-meta">
                {shape.size} cell{shape.size > 1 ? 's' : ''} · {tile.kind === 'grey' ? 'grey' : 'colored'}
              </span>
            </button>
          );
        })}
      </div>
      {selectedIndex != null && (
        <button type="button" className="rotate-button" onClick={onRotate}>
          Rotate ↻
        </button>
      )}
    </div>
  );
}
