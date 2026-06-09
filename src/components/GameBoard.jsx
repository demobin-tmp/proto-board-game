import { useMemo, useState } from 'react';
import StackedBoard from './StackedBoard';
import ShapeOffer from './ShapeOffer';
import UpcomingShapes from './UpcomingShapes';
import ScorePanel from './ScorePanel';
import { absoluteCells, validatePlacement } from '../game/rules';
import { getShape } from '../game/shapes';
import { PLAYER_COLORS, OFFER_SIZE, PREVIEW_SIZE, ringWindow } from '../game/game';

// This is the `board` component handed to boardgame.io's Client. It receives
// the synced game state (G, ctx) plus a `moves` object whose calls are sent to
// the server and replicated back to both players.
export default function GameBoard({ G, ctx, moves, playerID, isActive }) {
  const [selectedOfferIndex, setSelectedOfferIndex] = useState(null);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [hoveredCell, setHoveredCell] = useState(null);

  const myColor = PLAYER_COLORS[playerID];
  const currentColor = PLAYER_COLORS[ctx.currentPlayer];

  const ringEntries = useMemo(
    () => ringWindow(G.ring, G.tokenIndex, OFFER_SIZE + PREVIEW_SIZE),
    [G.ring, G.tokenIndex]
  );
  const offer = useMemo(() => ringEntries.slice(0, OFFER_SIZE).map((entry) => entry.tile), [ringEntries]);
  const upcoming = useMemo(() => ringEntries.slice(OFFER_SIZE).map((entry) => entry.tile), [ringEntries]);

  const selectedTile = selectedOfferIndex != null ? offer[selectedOfferIndex] : null;
  const rotations = selectedTile ? getShape(selectedTile.shapeId).rotations : null;
  const activeRotation = rotations ? rotationIndex % rotations.length : 0;

  const preview = useMemo(() => {
    if (!selectedTile || !hoveredCell || !isActive) return null;
    const cells = absoluteCells(selectedTile.shapeId, activeRotation, hoveredCell.row, hoveredCell.col);
    const legal = validatePlacement(G.board, G.heights, cells, selectedTile.kind, currentColor).legal;
    return { cells, legal };
  }, [selectedTile, hoveredCell, activeRotation, isActive, G.board, G.heights, currentColor]);

  function selectOffer(index) {
    if (!isActive) return;
    setSelectedOfferIndex((current) => (current === index ? null : index));
    setRotationIndex(0);
    setHoveredCell(null);
  }

  function rotateSelection() {
    if (!rotations) return;
    setRotationIndex((index) => (index + 1) % rotations.length);
  }

  function clickCell(row, col) {
    if (!isActive || selectedOfferIndex == null || !preview?.legal) return;
    moves.placeShape(selectedOfferIndex, activeRotation, row, col);
    setSelectedOfferIndex(null);
    setRotationIndex(0);
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

      <ShapeOffer
        offer={offer}
        currentColor={currentColor}
        isActive={isActive}
        selectedIndex={selectedOfferIndex}
        rotationIndex={activeRotation}
        onSelect={selectOffer}
        onRotate={rotateSelection}
      />

      <UpcomingShapes tiles={upcoming} />
    </div>
  );
}
