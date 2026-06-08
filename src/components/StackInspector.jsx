import { COLOR_HEX } from './colors';

// Shows a column's full stack bottom-to-top as a vertical cross-section —
// this is what makes "how tall is this and whose tiles are in it" legible,
// since the top-down board only shows the topmost tile per cell.
export default function StackInspector({ board, cell }) {
  if (!cell) {
    return (
      <aside className="stack-inspector">
        <h2>Stack inspector</h2>
        <p className="hint">Click any board cell to see its full stack, bottom to top.</p>
      </aside>
    );
  }

  const stack = board[cell.row][cell.col];

  return (
    <aside className="stack-inspector">
      <h2>
        Cell ({cell.row}, {cell.col}) — height {stack.length}
      </h2>
      {stack.length === 0 ? (
        <p className="hint">Empty — ground level.</p>
      ) : (
        <div className="cross-section">
          {[...stack].reverse().map((tile, indexFromTop) => {
            const layer = stack.length - indexFromTop;
            return (
              <div key={layer} className="cross-section-layer" style={{ backgroundColor: COLOR_HEX[tile.color] }}>
                layer {layer} · {tile.color}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
