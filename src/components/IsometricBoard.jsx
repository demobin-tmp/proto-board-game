import { useMemo } from 'react';
import { BOARD_SIZE } from '../game/shapes';

// --- Geometry ---
const CW = 56;          // diamond width
const CH = CW / 2;      // diamond height (= 28, true isometric ratio)
const BH = 18;          // vertical pixel height of one stacked layer
const MAX_LAYERS = 10;  // upper bound used only for viewBox sizing
const PAD = 12;

// Translate grid (col, row, layer) → SVG local coords (top vertex of diamond)
function iso(col, row, layer = 0) {
  return {
    x: (col - row) * (CW / 2),
    y: (col + row) * (CH / 2) - layer * BH,
  };
}

// Diamond / top face
function top(x, y) {
  return `${x},${y} ${x + CW / 2},${y + CH / 2} ${x},${y + CH} ${x - CW / 2},${y + CH / 2}`;
}

// Left (south-west) face — goes straight down BH from the diamond's left edge
function left(x, y) {
  return `${x - CW / 2},${y + CH / 2}  ${x},${y + CH}  ${x},${y + CH + BH}  ${x - CW / 2},${y + CH / 2 + BH}`;
}

// Right (south-east) face
function right(x, y) {
  return `${x},${y + CH}  ${x + CW / 2},${y + CH / 2}  ${x + CW / 2},${y + CH / 2 + BH}  ${x},${y + CH + BH}`;
}

// Painter's sort key — back to front: low (row+col) = further away = drawn first.
// Within a column, draw lower layers first.
function sortKey(row, col, layer) {
  return (row + col) * (MAX_LAYERS + 1) + layer;
}

// --- Colour palette (top face is lightest, right face is darkest) ---
const FACE = {
  red:  { t: '#c0392b', l: '#922b21', r: '#641e16' },
  blue: { t: '#2980b9', l: '#1f618d', r: '#154360' },
  grey: { t: '#95a5a6', l: '#6d7b7c', r: '#4b5657' },
};
const GROUND_FILL   = '#ece7da';
const GROUND_STROKE = '#cfc6b0';

// --- Fixed SVG dimensions for BOARD_SIZE=8 ---
// x range in local coords: -(N*CW/2) … +(N*CW/2)
// y range: -(MAX_LAYERS*BH) … N*CH + BH  (ground bottom)
const ORIGIN_X = BOARD_SIZE * (CW / 2) + PAD;              // 236
const ORIGIN_Y = MAX_LAYERS * BH + PAD;                     // 192
const SVG_W    = BOARD_SIZE * CW + PAD * 2;                 // 472
const SVG_H    = ORIGIN_Y + BOARD_SIZE * CH + BH + PAD;     // 446

export default function IsometricBoard({
  board, heights, preview, inspectedCell, onHoverCell, onClickCell,
}) {
  // Build all renderable elements and sort back→front so SVG painter ordering is correct.
  const elements = useMemo(() => {
    const items = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const h = heights[row][col];
        if (h === 0) {
          items.push({ kind: 'ground', row, col, layer: 0 });
        } else {
          for (let layer = 0; layer < h; layer++) {
            items.push({
              kind: 'tile',
              row, col, layer,
              color: board[row][col][layer].color,
              isTop: layer === h - 1,
            });
          }
        }
      }
    }
    items.sort((a, b) => sortKey(a.row, a.col, a.layer) - sortKey(b.row, b.col, b.layer));
    return items;
  }, [board, heights]);

  const previewSet = preview
    ? new Set(preview.cells.map(([r, c]) => `${r},${c}`))
    : null;

  // Shared interaction handlers — same interface as the old Board component.
  const on = (row, col) => ({
    onMouseEnter: () => onHoverCell({ row, col }),
    onClick: () => onClickCell(row, col),
  });

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="iso-board"
      onMouseLeave={() => onHoverCell(null)}
      style={{ display: 'block' }}
    >
      <g transform={`translate(${ORIGIN_X}, ${ORIGIN_Y})`}>

        {/* ── Main grid (sorted back→front) ── */}
        {elements.map((el) => {
          const { x, y } = iso(el.col, el.row, el.layer);
          const key = `${el.kind}-${el.row}-${el.col}-${el.layer}`;

          if (el.kind === 'ground') {
            return (
              <polygon
                key={key}
                points={top(x, y)}
                fill={GROUND_FILL}
                stroke={GROUND_STROKE}
                strokeWidth={0.75}
                style={{ cursor: 'pointer' }}
                data-row={el.row}
                data-col={el.col}
                {...on(el.row, el.col)}
              />
            );
          }

          // tile block: left + right faces for every layer; top face only on the topmost.
          const c = FACE[el.color] ?? FACE.grey;
          return (
            <g key={key} style={{ cursor: 'pointer' }} data-row={el.row} data-col={el.col} {...on(el.row, el.col)}>
              <polygon points={left(x, y)}  fill={c.l} />
              <polygon points={right(x, y)} fill={c.r} />
              {el.isTop && (
                <polygon points={top(x, y)} fill={c.t} stroke="rgba(0,0,0,0.1)" strokeWidth={0.5} />
              )}
            </g>
          );
        })}

        {/* ── Placement preview (ghost blocks, rendered above everything) ── */}
        {preview?.cells.map(([row, col]) => {
          const layer = heights[row][col]; // land on top of existing stack
          const { x, y } = iso(col, row, layer);
          const legalColor = preview.legal;
          return (
            <g key={`prev-${row}-${col}`} pointerEvents="none">
              <polygon
                points={left(x, y)}
                fill={legalColor ? 'rgba(34,113,68,0.45)' : 'rgba(140,30,18,0.4)'}
              />
              <polygon
                points={right(x, y)}
                fill={legalColor ? 'rgba(22,80,48,0.45)' : 'rgba(100,18,10,0.4)'}
              />
              <polygon
                points={top(x, y)}
                fill={legalColor ? 'rgba(46,139,87,0.5)' : 'rgba(192,57,43,0.5)'}
                stroke={legalColor ? '#2e8b57' : '#c0392b'}
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {/* ── Inspected-cell highlight ── */}
        {inspectedCell && (() => {
          const { row, col } = inspectedCell;
          const layer = heights[row][col];
          const { x, y } = iso(col, row, layer === 0 ? 0 : layer);
          return (
            <polygon
              points={top(x, y)}
              fill="rgba(43,42,38,0.2)"
              stroke="#2b2a26"
              strokeWidth={2}
              pointerEvents="none"
            />
          );
        })()}

      </g>
    </svg>
  );
}
