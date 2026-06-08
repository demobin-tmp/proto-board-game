import { useMemo } from 'react';
import { BOARD_SIZE } from '../game/shapes';

// --- Layout constants ---
const CW   = 44;   // cell width
const CH   = 44;   // cell height
const GAP  = 2;    // gap between cells
const STEP = CW + GAP;
const DX   = 4;    // shift right per layer
const DY   = 6;    // shift up per layer
const PAD  = 8;
const MAX_LAYERS = 10;

// Top of SVG needs extra room so stacks on row 0 don't shift above the canvas
const PAD_TOP = PAD + MAX_LAYERS * DY;

// Top-left corner of cell (col, row) at the given layer
function tx(col, layer) { return PAD + col * STEP + layer * DX; }
function ty(row, layer) { return PAD_TOP + row * STEP - layer * DY; }

// SVG canvas
const SVG_W = PAD * 2 + BOARD_SIZE * STEP - GAP + MAX_LAYERS * DX;
const SVG_H = PAD_TOP + PAD + BOARD_SIZE * STEP - GAP;

// --- Colour palette ---
const FACE = {
  red:  { fill: '#c0392b', edge: '#7b241c' },
  blue: { fill: '#2980b9', edge: '#154360' },
  grey: { fill: '#95a5a6', edge: '#4b5657' },
};
const GROUND_FILL   = '#ece7da';
const GROUND_STROKE = '#cfc6b0';

// Right-side parallelogram: the DX-wide strip that sticks out when a tile
// is shifted right relative to the tile below it.
function RightFace({ x, y, color }) {
  // goes: (x+CW, y) → (x+CW+DX, y-DY) → (x+CW+DX, y+CH-DY) → (x+CW, y+CH)
  const pts = `${x+CW},${y} ${x+CW+DX},${y-DY} ${x+CW+DX},${y+CH-DY} ${x+CW},${y+CH}`;
  return <polygon points={pts} fill={color} />;
}

// Top-side parallelogram: the DY-tall strip visible above the tile below.
function TopFace({ x, y, color }) {
  // goes: (x, y) → (x+DX, y-DY) → (x+CW+DX, y-DY) → (x+CW, y)
  const pts = `${x},${y} ${x+DX},${y-DY} ${x+CW+DX},${y-DY} ${x+CW},${y}`;
  return <polygon points={pts} fill={color} />;
}

export default function StackedBoard({
  board, heights, preview, inspectedCell, onHoverCell, onClickCell,
}) {
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
    // Draw lower layers first so higher layers paint on top
    items.sort((a, b) => a.layer - b.layer);
    return items;
  }, [board, heights]);

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="stacked-board"
      style={{ display: 'block' }}
      onMouseLeave={() => onHoverCell(null)}
    >
      {/* ── Visual tiles (no pointer events — hit targets are separate) ── */}
      {elements.map((el) => {
        const x = tx(el.col, el.layer);
        const y = ty(el.row, el.layer);
        const key = `${el.kind}-${el.row}-${el.col}-${el.layer}`;

        if (el.kind === 'ground') {
          return (
            <rect key={key} x={x} y={y} width={CW} height={CH}
              fill={GROUND_FILL} stroke={GROUND_STROKE} strokeWidth={1}
              pointerEvents="none" />
          );
        }

        const { fill, edge } = FACE[el.color] ?? FACE.grey;
        return (
          <g key={key} pointerEvents="none">
            {/* side faces visible below this tile */}
            <RightFace x={x} y={y} color={edge} />
            <TopFace   x={x} y={y} color={edge} />
            {/* main face */}
            <rect x={x} y={y} width={CW} height={CH}
              fill={fill}
              stroke={edge} strokeWidth={0.75} />
          </g>
        );
      })}

      {/* ── Preview ghost tiles ── */}
      {preview?.cells.map(([row, col]) => {
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
        const layer = heights[row][col];
        const x = tx(col, layer);
        const y = ty(row, layer);
        const ok = preview.legal;
        const ghostFill = ok ? 'rgba(46,139,87,0.5)'  : 'rgba(192,57,43,0.5)';
        const ghostEdge = ok ? 'rgba(22,80,40,0.6)'   : 'rgba(100,18,10,0.6)';
        const stroke    = ok ? '#2e8b57' : '#c0392b';
        return (
          <g key={`prev-${row}-${col}`} pointerEvents="none">
            <RightFace x={x} y={y} color={ghostEdge} />
            <TopFace   x={x} y={y} color={ghostEdge} />
            <rect x={x} y={y} width={CW} height={CH}
              fill={ghostFill} stroke={stroke} strokeWidth={1.5} />
          </g>
        );
      })}

      {/* ── Inspected-cell outline ── */}
      {inspectedCell && (() => {
        const { row, col } = inspectedCell;
        const layer = heights[row][col];
        const x = tx(col, layer === 0 ? 0 : layer);
        const y = ty(row, layer === 0 ? 0 : layer);
        return (
          <rect x={x} y={y} width={CW} height={CH}
            fill="rgba(43,42,38,0.18)" stroke="#2b2a26" strokeWidth={2}
            pointerEvents="none" />
        );
      })()}

      {/* ── Hit targets: transparent rects at base position, always on top ── */}
      {Array.from({ length: BOARD_SIZE }, (_, row) =>
        Array.from({ length: BOARD_SIZE }, (_, col) => (
          <rect
            key={`hit-${row}-${col}`}
            x={PAD + col * STEP}
            y={PAD_TOP + row * STEP}
            width={CW}
            height={CH}
            fill="transparent"
            stroke="none"
            style={{ cursor: 'pointer' }}
            data-row={row}
            data-col={col}
            onMouseEnter={() => onHoverCell({ row, col })}
            onClick={() => onClickCell(row, col)}
          />
        ))
      )}
    </svg>
  );
}
