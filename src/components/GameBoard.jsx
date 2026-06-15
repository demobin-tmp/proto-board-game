import { useMemo, useState } from 'react';
import StackedBoard from './StackedBoard';
import TileTrack from './TileTrack';
import ScorePanel from './ScorePanel';
import { absoluteCells, validatePlacement, validateFillerPlacement } from '../game/rules';
import { getShape, BOARD_SIZE } from '../game/shapes';
import { PLAYER_COLORS, OFFER_SIZE, PREVIEW_SIZE, SKIP_SIZE, ringWindow, ringWindowBackward } from '../game/game';

// A rotation's cells are normalized so the shape's bounding box starts at
// (0,0), but for some rotations (chiefly mirrored ones) the hovered cell
// itself isn't part of the shape — it sits at the empty corner of that
// bounding box. Near the bottom/right edges that pushes every cell of the
// shape off-board, leaving no preview at all. Clamping the anchor keeps the
// shape's bounding box on the board, so the preview "sticks" to the edge
// instead of vanishing.
function clampAnchor(row, col, rotation) {
  const maxDr = Math.max(...rotation.map(([dr]) => dr));
  const maxDc = Math.max(...rotation.map(([, dc]) => dc));
  return {
    row: Math.min(row, BOARD_SIZE - 1 - maxDr),
    col: Math.min(col, BOARD_SIZE - 1 - maxDc),
  };
}

const FILLER_ROTATION = [[0, 0]];

// This is the `board` component handed to boardgame.io's Client. It receives
// the synced game state (G, ctx) plus a `moves` object whose calls are sent to
// the server and replicated back to both players.
export default function GameBoard({ G, ctx, moves, playerID, isActive }) {
  const [selectedOfferIndex, setSelectedOfferIndex] = useState(null);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [useFiller, setUseFiller] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);

  const myColor = PLAYER_COLORS[playerID];
  const currentColor = PLAYER_COLORS[ctx.currentPlayer];

  const ringEntries = useMemo(
    () => ringWindow(G.ring, G.tokenIndex, OFFER_SIZE + PREVIEW_SIZE),
    [G.ring, G.tokenIndex]
  );
  const offer = useMemo(() => ringEntries.slice(0, OFFER_SIZE).map((entry) => entry.tile), [ringEntries]);
  const upcoming = useMemo(() => ringEntries.slice(OFFER_SIZE).map((entry) => entry.tile), [ringEntries]);
  const skipped = useMemo(
    () => ringWindowBackward(G.ring, G.seen, G.tokenIndex, SKIP_SIZE).map((entry) => entry.tile),
    [G.ring, G.seen, G.tokenIndex]
  );

  const selectedTile = selectedOfferIndex != null ? offer[selectedOfferIndex] : null;
  const rotations = selectedTile
    ? (flipped ? getShape(selectedTile.shapeId).mirroredRotations : getShape(selectedTile.shapeId).rotations)
    : null;
  const activeRotation = rotations ? rotationIndex % rotations.length : 0;

  const preview = useMemo(() => {
    if (!selectedTile || !hoveredCell || !isActive) return null;
    if (useFiller) {
      const anchor = clampAnchor(hoveredCell.row, hoveredCell.col, FILLER_ROTATION);
      const cells = [[anchor.row, anchor.col]];
      const legal = validateFillerPlacement(G.board, G.heights, anchor.row, anchor.col, 'color', currentColor).legal;
      return { cells, legal };
    }
    const anchor = clampAnchor(hoveredCell.row, hoveredCell.col, rotations[activeRotation]);
    const cells = absoluteCells(selectedTile.shapeId, activeRotation, anchor.row, anchor.col, flipped);
    const legal = validatePlacement(G.board, G.heights, cells, selectedTile.kind, currentColor).legal;
    return { cells, legal };
  }, [selectedTile, hoveredCell, activeRotation, isActive, G.board, G.heights, currentColor, flipped, useFiller, rotations]);

  function selectOffer(index) {
    if (!isActive) return;
    const next = selectedOfferIndex === index ? null : index;
    setSelectedOfferIndex(next);
    setRotationIndex(0);
    setFlipped(false);
    setUseFiller(false);
    setHoveredCell(null);
  }

  function rotateSelection() {
    if (!rotations) return;
    setRotationIndex((index) => (index + 1) % rotations.length);
  }

  function flipSelection() {
    if (!selectedTile) return;
    setFlipped((current) => !current);
  }

  function toggleFiller() {
    if (!selectedTile) return;
    setUseFiller((current) => !current);
  }

  function clickCell(row, col) {
    if (!isActive || selectedOfferIndex == null || !preview?.legal) return;
    const rotation = useFiller ? FILLER_ROTATION : rotations[activeRotation];
    const anchor = clampAnchor(row, col, rotation);
    moves.placeShape(selectedOfferIndex, activeRotation, anchor.row, anchor.col, flipped, useFiller);
    setSelectedOfferIndex(null);
    setRotationIndex(0);
    setFlipped(false);
    setUseFiller(false);
    setHoveredCell(null);
  }

  const gameover = ctx.gameover;
  const turnMessage = gameover
    ? null
    : isActive
      ? 'Your turn — pick a shape, then click the board to place it.'
      : `Waiting for ${currentColor} to move…`;

  return (
    <div className="game-board">
      <ScorePanel scores={G.scores} myColor={myColor} currentColor={currentColor} gameover={gameover} />

      {turnMessage && <p className="turn-indicator">{turnMessage}</p>}

      <div className="board-area">
        <StackedBoard
          board={G.board}
          heights={G.heights}
          preview={preview}
          onHoverCell={setHoveredCell}
          onClickCell={clickCell}
        />
      </div>

      <TileTrack
        skipped={skipped}
        offer={offer}
        upcoming={upcoming}
        currentColor={currentColor}
        isActive={isActive}
        selectedIndex={selectedOfferIndex}
        rotationIndex={activeRotation}
        flipped={flipped}
        useFiller={useFiller}
        onSelect={selectOffer}
        onRotate={rotateSelection}
        onFlip={flipSelection}
        onToggleFiller={toggleFiller}
      />
    </div>
  );
}
