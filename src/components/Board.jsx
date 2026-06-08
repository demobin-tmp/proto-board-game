import { useMemo } from 'react';
import { COLOR_HEX, EMPTY_CELL_COLOR } from './colors';

// `preview` is { cells: [[row, col], ...], legal: boolean } | null — the
// footprint of the shape the active player is currently hovering over.
export default function Board({ board, heights, preview, inspectedCell, onHoverCell, onClickCell }) {
  const previewSet = useMemo(() => {
    if (!preview) return null;
    return new Set(preview.cells.map(([row, col]) => `${row},${col}`));
  }, [preview]);

  return (
    <div className="board-grid" onMouseLeave={() => onHoverCell(null)}>
      {board.map((boardRow, row) => (
        <div className="board-row" key={row}>
          {boardRow.map((stack, col) => {
            const height = heights[row][col];
            const top = stack[stack.length - 1];
            const key = `${row},${col}`;
            const isPreview = previewSet?.has(key);
            const isInspected = inspectedCell?.row === row && inspectedCell?.col === col;

            const classNames = ['board-cell'];
            if (isPreview) classNames.push(preview.legal ? 'preview-legal' : 'preview-illegal');
            if (isInspected) classNames.push('inspected');

            return (
              <button
                type="button"
                key={key}
                className={classNames.join(' ')}
                style={{ backgroundColor: top ? COLOR_HEX[top.color] : EMPTY_CELL_COLOR }}
                onMouseEnter={() => onHoverCell({ row, col })}
                onClick={() => onClickCell(row, col)}
              >
                {height > 0 && <span className="height-badge">{height}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
