import { useMemo } from 'react';
import { BOARD_SIZE } from '../game/shapes';

// --- Layout constants ---
const CW   = 44;   // cell width
const CH   = 44;   // cell height
const GAP  = 0;    // no gap — pieces render as one connected shape
const STEP = CW + GAP;
const DX   = 4;    // shift right per layer
const DY   = 6;    // shift up per layer
const PAD  = 8;
const MAX_LAYERS = 10;

// Ground sits at the base. Tiles start one step above (layer+1) so that
// layer-0 depth faces connect down to the ground plane, not below it.
const PAD_LEFT = PAD;
const PAD_TOP  = PAD + (MAX_LAYERS + 1) * DY;  // +1 for the extra tile-above-ground step

// Ground position (no layer shift)
function gx(col) { return PAD_LEFT + col * STEP; }
function gy(row) { return PAD_TOP  + row * STEP; }

// Tile position: layer 0 is one step above ground, layer 1 two steps, etc.
function tx(col, layer) { return gx(col) + (layer + 1) * DX; }
function ty(row, layer) { return gy(row) - (layer + 1) * DY; }

// SVG canvas
const SVG_W = PAD_LEFT + (BOARD_SIZE - 1) * STEP + (MAX_LAYERS + 1) * DX + CW + PAD;
const SVG_H = PAD_TOP  + BOARD_SIZE * STEP - GAP + PAD;

// --- Colour palette ---
const FACE = {
  red:  { fill: '#c0392b', edge: '#7b241c' },
  blue: { fill: '#2980b9', edge: '#154360' },
  grey: { fill: '#95a5a6', edge: '#4b5657' },
};
const GROUND_FILL   = '#ece7da';
const GROUND_STROKE = '#cfc6b0';

// Left face: the strip visible to the left because the tile is shifted right.
// Connects the tile's left edge to the equivalent position one layer down.
function LeftFace({ x, y, color }) {
  // (x,y) → (x-DX, y+DY) → (x-DX, y+CH+DY) → (x, y+CH)
  const pts = `${x},${y} ${x-DX},${y+DY} ${x-DX},${y+CH+DY} ${x},${y+CH}`;
  return <polygon points={pts} fill={color} />;
}

// Bottom face: the strip visible below because the tile is shifted up.
// Connects the tile's bottom edge to the equivalent position one layer down.
function BottomFace({ x, y, color }) {
  // (x,y+CH) → (x-DX, y+CH+DY) → (x+CW-DX, y+CH+DY) → (x+CW, y+CH)
  const pts = `${x},${y+CH} ${x-DX},${y+CH+DY} ${x+CW-DX},${y+CH+DY} ${x+CW},${y+CH}`;
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
    // Ground always renders before any tile (ground cells share layer=0 with
    // first-layer tiles, but must be below them). Then tiles low→high layer,
    // bottom-left first within each layer.
    items.sort((a, b) => {
      const la = a.kind === 'ground' ? -1 : a.layer;
      const lb = b.kind === 'ground' ? -1 : b.layer;
      if (la !== lb) return la - lb;
      if (a.row !== b.row) return a.row - b.row;
      return b.col - a.col;
    });
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
            <rect key={key} x={gx(el.col)} y={gy(el.row)} width={CW} height={CH}
              fill={GROUND_FILL} stroke={GROUND_STROKE} strokeWidth={1}
              pointerEvents="none" />
          );
        }

        const { fill, edge } = FACE[el.color] ?? FACE.grey;
        return (
          <g key={key} pointerEvents="none">
            {/* side faces visible below this tile */}
            <LeftFace   x={x} y={y} color={edge} />
            <BottomFace x={x} y={y} color={edge} />
            {/* main face */}
            <rect x={x} y={y} width={CW} height={CH} fill={fill} stroke="rgba(0,0,0,0.15)" strokeWidth={0.75} />
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
            <LeftFace   x={x} y={y} color={ghostEdge} />
            <BottomFace x={x} y={y} color={ghostEdge} />
            <rect x={x} y={y} width={CW} height={CH}
              fill={ghostFill} stroke={stroke} strokeWidth={1.5} />
          </g>
        );
      })}

      {/* ── Inspected-cell outline ── */}
      {inspectedCell && (() => {
        const { row, col } = inspectedCell;
        const layer = heights[row][col];
        // highlight ground cell when empty, top tile when stacked
        const x = layer === 0 ? gx(col) : tx(col, layer - 1);
        const y = layer === 0 ? gy(row) : ty(row, layer - 1);
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
            x={gx(col)}
            y={gy(row)}
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
