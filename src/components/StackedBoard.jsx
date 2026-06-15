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
const BASE_COLOR = {
  red:  { fill: '#c0392b', edge: '#7b241c' },
  blue: { fill: '#2980b9', edge: '#154360' },
  grey: { fill: '#95a5a6', edge: '#4b5657' },
};

function darkenHex(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.round(((n >> 8)  & 0xff) * factor));
  const b = Math.max(0, Math.round((n & 0xff)         * factor));
  return `rgb(${r},${g},${b})`;
}

function tileColor(color, layer) {
  const base = BASE_COLOR[color] ?? BASE_COLOR.grey;
  const f = 1 - layer * 0.1; // ~10% darker per layer
  return { fill: darkenHex(base.fill, f), edge: darkenHex(base.edge, f) };
}
const GROUND_FILL   = '#ece7da';
const GROUND_STROKE = '#cfc6b0';

// Tinted ground for the "colored"/"diagonal" board variants: a light wash of
// the player's color, distinct from both neutral ground and a placed tile.
// "grey" marks the diagonal divider on the "diagonal" board.
const GROUND_TINT = {
  red:  { fill: '#e8cfc9', stroke: '#d3a99e' },
  blue: { fill: '#cfdbe8', stroke: '#a9c0d3' },
  grey: { fill: '#dcd9d2', stroke: '#b8b4ab' },
};

function groundFill(groundColors, row, col) {
  const tint = groundColors?.[row]?.[col];
  return tint ? GROUND_TINT[tint] : { fill: GROUND_FILL, stroke: GROUND_STROKE };
}

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

// Returns true if the neighbour cell at (row,col) has a tile at `layer`
// belonging to the same tileId.
function sameId(board, heights, row, col, layer, id) {
  return row >= 0 && row < BOARD_SIZE &&
         col >= 0 && col < BOARD_SIZE &&
         heights[row][col] > layer &&
         board[row][col][layer].tileId === id;
}

export default function StackedBoard({
  board, heights, groundColors, preview, onHoverCell, onClickCell,
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

  // Perimeter outlines grouped by layer so they can be interleaved with tile rendering
  const outlinesByLayer = useMemo(() => {
    const byLayer = {};
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const h = heights[row][col];
        for (let layer = 0; layer < h; layer++) {
          const { tileId } = board[row][col][layer];
          const x = tx(col, layer), y = ty(row, layer);
          const segs = [];
          if (!sameId(board, heights, row,   col-1, layer, tileId)) segs.push([x,    y,    x,    y+CH]);
          if (!sameId(board, heights, row,   col+1, layer, tileId)) segs.push([x+CW, y,    x+CW, y+CH]);
          if (!sameId(board, heights, row-1, col,   layer, tileId)) segs.push([x,    y,    x+CW, y   ]);
          if (!sameId(board, heights, row+1, col,   layer, tileId)) segs.push([x,    y+CH, x+CW, y+CH]);
          if (segs.length) {
            if (!byLayer[layer]) byLayer[layer] = [];
            byLayer[layer].push(...segs);
          }
        }
      }
    }
    return byLayer;
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
      {(() => {
        // Render tiles and their outlines interleaved by layer so outlines
        // from layer N don't bleed through tiles at layer N+1.
        const rendered = [];
        let prevLayer = null;
        elements.forEach((el) => {
          // After finishing a tile layer, inject its outlines before the next layer starts
          if (el.kind === 'tile' && prevLayer !== null && el.layer !== prevLayer) {
            (outlinesByLayer[prevLayer] ?? []).forEach(([x1,y1,x2,y2], i) => {
              rendered.push(<line key={`ol-${prevLayer}-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(0,0,0,0.5)" strokeWidth={1.5} pointerEvents="none" />);
            });
          }

          const x = tx(el.col, el.layer);
          const y = ty(el.row, el.layer);
          const key = `${el.kind}-${el.row}-${el.col}-${el.layer}`;

          if (el.kind === 'ground') {
            const { fill, stroke } = groundFill(groundColors, el.row, el.col);
            rendered.push(
              <rect key={key} x={gx(el.col)} y={gy(el.row)} width={CW} height={CH}
                fill={fill} stroke={stroke} strokeWidth={1}
                pointerEvents="none" />
            );
          } else {
            const { fill, edge } = tileColor(el.color, el.layer);
            rendered.push(
              <g key={key} pointerEvents="none">
                <LeftFace   x={x} y={y} color={edge} />
                <BottomFace x={x} y={y} color={edge} />
                <rect x={x} y={y} width={CW} height={CH} fill={fill} />
              </g>
            );
            prevLayer = el.layer;
          }
        });
        // Flush outlines for the last tile layer
        (outlinesByLayer[prevLayer] ?? []).forEach(([x1,y1,x2,y2], i) => {
          rendered.push(<line key={`ol-${prevLayer}-last-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(0,0,0,0.5)" strokeWidth={1.5} pointerEvents="none" />);
        });
        return rendered;
      })()}

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
