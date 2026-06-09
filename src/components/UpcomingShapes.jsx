import { getShape } from '../game/shapes';
import { COLOR_HEX } from './colors';
import MiniShape from './MiniShape';

// Read-only preview of the shapes that will enter the offer next, in draw
// order. Colored tiles take whichever player places them, so they're shown
// in a neutral tone here rather than red/blue.
export default function UpcomingShapes({ tiles }) {
  if (tiles.length === 0) return null;

  return (
    <div className="upcoming-shapes">
      <h2>Next up</h2>
      <div className="offer-tiles">
        {tiles.map((tile) => {
          const shape = getShape(tile.shapeId);
          const color = tile.kind === 'grey' ? COLOR_HEX.grey : COLOR_HEX.neutral;

          return (
            <div key={tile.tileId} className="offer-tile upcoming-tile">
              <MiniShape cells={shape.rotations[0]} color={color} />
              <span className="tile-meta">
                {shape.size} cell{shape.size > 1 ? 's' : ''} · {tile.kind === 'grey' ? 'grey' : 'colored'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
