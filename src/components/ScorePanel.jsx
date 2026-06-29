export default function ScorePanel({ scores, charges, powerUpsLeft, myColor, currentColor, gameover }) {
  function label(color) {
    return color === myColor ? ' (you)' : '';
  }

  return (
    <div className="score-panel">
      <div className={`score-pill red${currentColor === 'red' ? ' active' : ''}`}>
        Red{label('red')}: <strong>{scores.red}</strong> {'🔋'.repeat(charges.red)} {'⚡'.repeat(powerUpsLeft.red)}
      </div>
      <div className={`score-pill blue${currentColor === 'blue' ? ' active' : ''}`}>
        Blue{label('blue')}: <strong>{scores.blue}</strong> {'🔋'.repeat(charges.blue)} {'⚡'.repeat(powerUpsLeft.blue)}
      </div>

      {gameover && (
        <div className="gameover-banner">
          {gameover.draw
            ? "It's a draw!"
            : gameover.winner === myColor
              ? 'You win!'
              : `${gameover.winner} wins.`}
        </div>
      )}
    </div>
  );
}
