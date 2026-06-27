import { useMemo, useRef, useState } from 'react';
import StackedBoard from './StackedBoard';
import TileTrack from './TileTrack';
import ScorePanel from './ScorePanel';
import RingInspector from './RingInspector';
import { absoluteCells, validatePlacement, validateFillerPlacement } from '../game/rules';
import { getShape, BOARD_SIZE } from '../game/shapes';
import { PLAYER_COLORS, OFFER_SIZE, EMPOWERED_OFFER_SIZE, POWER_TRACK_MAX, POWER_UP_LIMIT, PREVIEW_SIZE, ringWindow } from '../game/game';

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
  const [powerUp, setPowerUp] = useState(null);
  const [tokenCells, setTokenCells] = useState([]);
  const [hoveredCell, setHoveredCell] = useState(null);
  // A coarse pointer (touch) has no real hover before a tap, so a tap there
  // only sets the preview — placing requires a separate, explicit Confirm
  // button. A fine pointer (mouse) keeps the original single-click-to-place
  // flow, since hover already previews continuously as the cursor moves.
  const [isTouchDevice] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  );
  // Mirrors hoveredCell but updates synchronously, independent of React's
  // render/batching timing — used so confirmPlacement (the Confirm button)
  // always reads the latest hovered cell even right after a tap.
  const hoveredCellRef = useRef(null);

  function hoverCell(cell) {
    hoveredCellRef.current = cell;
    setHoveredCell(cell);
  }

  const myColor = PLAYER_COLORS[playerID];
  const currentColor = PLAYER_COLORS[ctx.currentPlayer];
  const charges = G.charges ?? { red: 0, blue: 0 };
  const power = G.power ?? { red: 0, blue: 0 };
  const powerUpsUsed = G.powerUpsUsed ?? { red: 0, blue: 0 };
  const myCharges = charges[myColor];
  const myPower = power[myColor];
  const myPowerUpsLeft = POWER_UP_LIMIT - powerUpsUsed[myColor];
  const underLimit = isActive && myPowerUpsLeft > 0;
  const canExpand = underLimit && myCharges >= 1 && myPower < POWER_TRACK_MAX;
  const canExtraTurn = underLimit && myCharges >= 2 && myPower < POWER_TRACK_MAX;
  const canPlaceTokens = underLimit && myCharges >= 1 && myPower < POWER_TRACK_MAX;
  const canIgnoreColor = underLimit && myCharges >= 2 && myPower < POWER_TRACK_MAX;
  const canDisrupt = underLimit && myCharges >= 2 && myPower < POWER_TRACK_MAX;

  const offerSize = powerUp === 'expand' ? EMPOWERED_OFFER_SIZE : OFFER_SIZE;
  const ringEntries = useMemo(
    () => ringWindow(G.ring, G.tokenIndex, offerSize + PREVIEW_SIZE),
    [G.ring, G.tokenIndex, offerSize]
  );
  const offer = useMemo(() => ringEntries.slice(0, offerSize).map((entry) => entry.tile), [ringEntries, offerSize]);
  const upcoming = useMemo(() => ringEntries.slice(offerSize).map((entry) => entry.tile), [ringEntries, offerSize]);

  const selectedTile = selectedOfferIndex != null ? offer[selectedOfferIndex] : null;
  // Colored tiles are two-sided physical pieces: blue always plays the mirror face.
  // Grey tiles let the player choose which face to use via the flip button.
  const effectiveFlipped = selectedTile
    ? (selectedTile.kind === 'color' ? myColor === 'blue' : flipped)
    : false;
  const rotations = selectedTile
    ? (effectiveFlipped ? getShape(selectedTile.shapeId).mirroredRotations : getShape(selectedTile.shapeId).rotations)
    : null;
  const activeRotation = rotations ? rotationIndex % rotations.length : 0;

  // Plain function (not a memo) so clickCell can compute legality fresh for
  // the cell it's confirming, instead of trusting `preview` — which is keyed
  // off `hoveredCell` state and can still reflect the *previous* cell when a
  // fast click fires its mouseenter and click in the same React batch.
  function computePreviewAt(row, col) {
    if (powerUp === 'tokens') {
      const alreadyPicked = tokenCells.some(([r, c]) => r === row && c === col);
      const atBase = G.heights[row][col] === 0;
      const gc = G.groundColors?.[row]?.[col];
      const colorOk = !gc || gc === 'grey' || gc === currentColor;
      return { cells: [[row, col]], legal: atBase && colorOk && !alreadyPicked };
    }

    if (!selectedTile) return null;
    if (useFiller) {
      const anchor = clampAnchor(row, col, FILLER_ROTATION);
      const cells = [[anchor.row, anchor.col]];
      const legal = validateFillerPlacement(G.board, G.heights, G.groundColors, anchor.row, anchor.col, 'color', currentColor).legal;
      return { cells, legal };
    }
    const anchor = clampAnchor(row, col, rotations[activeRotation]);
    const cells = absoluteCells(selectedTile.shapeId, activeRotation, anchor.row, anchor.col, effectiveFlipped);
    const legal = validatePlacement(G.board, G.heights, G.groundColors, cells, selectedTile.kind, currentColor, powerUp === 'ignore-color').legal;
    return { cells, legal };
  }

  const preview = useMemo(() => {
    if (!isActive || !hoveredCell) return null;
    return computePreviewAt(hoveredCell.row, hoveredCell.col);
  }, [selectedTile, hoveredCell, activeRotation, isActive, G.board, G.heights, G.groundColors, currentColor, effectiveFlipped, useFiller, rotations, powerUp, tokenCells]);

  function selectOffer(index) {
    if (!isActive) return;
    const next = selectedOfferIndex === index ? null : index;
    setSelectedOfferIndex(next);
    setRotationIndex(0);
    setFlipped(false);
    setUseFiller(false);
    hoverCell(null);
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

  function togglePowerUp(type) {
    if (type === 'disrupt') {
      moves.disrupt();
      return;
    }
    setPowerUp((current) => (current === type ? null : type));
    setSelectedOfferIndex(null);
    setRotationIndex(0);
    setFlipped(false);
    setUseFiller(false);
    setTokenCells([]);
  }

  // Actually performs a placement at (row, col) — called directly on click
  // for mouse users, or via the Confirm button for touch users. Computes
  // legality fresh rather than trusting `preview`, since that's a memo keyed
  // off `hoveredCell` state and can lag behind within the same fast event.
  function commitPlacement(row, col) {
    const confirmedPreview = computePreviewAt(row, col);

    if (powerUp === 'tokens') {
      if (!confirmedPreview?.legal) return;
      const next = [...tokenCells, [row, col]];
      if (next.length === 4) {
        moves.placeTokens(next);
        setTokenCells([]);
        setPowerUp(null);
        hoverCell(null);
      } else {
        setTokenCells(next);
      }
      return;
    }

    if (selectedOfferIndex == null || !confirmedPreview?.legal) return;
    const rotation = useFiller ? FILLER_ROTATION : rotations[activeRotation];
    const anchor = clampAnchor(row, col, rotation);
    // For colored tiles the server derives the flip from player color; only send flipped for grey.
    const sendFlipped = selectedTile.kind === 'color' ? false : flipped;
    moves.placeShape(selectedOfferIndex, activeRotation, anchor.row, anchor.col, sendFlipped, useFiller, powerUp);
    setSelectedOfferIndex(null);
    setRotationIndex(0);
    setFlipped(false);
    setUseFiller(false);
    setPowerUp(null);
    hoverCell(null);
  }

  function clickCell(row, col) {
    if (!isActive) return;
    hoverCell({ row, col });
    // Touch: a tap only updates the preview — placing needs the Confirm button.
    // Mouse: hover already previews continuously, so a click commits directly.
    if (isTouchDevice) return;
    commitPlacement(row, col);
  }

  function confirmPlacement() {
    if (!isActive || !hoveredCellRef.current) return;
    commitPlacement(hoveredCellRef.current.row, hoveredCellRef.current.col);
  }

  const canConfirm = isTouchDevice && isActive && (selectedOfferIndex != null || powerUp === 'tokens');

  const gameover = ctx.gameover;
  const turnMessage = gameover
    ? null
    : !isActive
      ? `Waiting for ${currentColor} to move…`
      : powerUp === 'tokens'
        ? isTouchDevice
          ? `Tap a cell to preview token ${tokenCells.length + 1} of 4, then tap Confirm.`
          : `Pick token ${tokenCells.length + 1} of 4 — click any empty base-level cell.`
        : isTouchDevice
          ? 'Tap a cell to preview, then tap Confirm to place it.'
          : 'Your turn — pick a shape, then click the board to place it.';

  return (
    <div className="game-board">
      <ScorePanel scores={G.scores} charges={charges} power={power} myColor={myColor} currentColor={currentColor} gameover={gameover} />

      {turnMessage && <p className="turn-indicator">{turnMessage}</p>}

      <div className="board-area">
        <StackedBoard
          board={G.board}
          heights={G.heights}
          groundColors={G.groundColors}
          preview={preview}
          tokenSelections={tokenCells}
          onHoverCell={hoverCell}
          onClickCell={clickCell}
          onLeaveBoard={isTouchDevice ? undefined : () => hoverCell(null)}
        />
      </div>

      {canConfirm && (
        <button
          type="button"
          className="confirm-placement-button"
          onClick={confirmPlacement}
          disabled={!preview?.legal}
        >
          {powerUp === 'tokens' ? `Confirm token ${tokenCells.length + 1} of 4` : 'Confirm placement'}
        </button>
      )}

      <RingInspector ring={G.ring} seen={G.seen} tokenIndex={G.tokenIndex} currentColor={currentColor} />

      <TileTrack
        offer={offer}
        upcoming={upcoming}
        currentColor={currentColor}
        isActive={isActive}
        selectedIndex={selectedOfferIndex}
        rotationIndex={activeRotation}
        flipped={effectiveFlipped}
        useFiller={useFiller}
        powerUp={powerUp}
        canExpand={canExpand}
        canExtraTurn={canExtraTurn}
        canPlaceTokens={canPlaceTokens}
        canIgnoreColor={canIgnoreColor}
        canDisrupt={canDisrupt}
        powerUpsLeft={myPowerUpsLeft}
        onSelect={selectOffer}
        onRotate={rotateSelection}
        onFlip={flipSelection}
        onToggleFiller={toggleFiller}
        onTogglePowerUp={togglePowerUp}
      />
    </div>
  );
}
