export default function ScorePanel({ scores, myColor, currentColor, gameover }) {
  function label(color) {
    return color === myColor ? ' (you)' : '';
  }

  return (
    <div className="score-panel">
      <div className={`score-pill red${currentColor === 'red' ? ' active' : ''}`}>
        Red{label('red')}: <strong>{scores.red}</strong>
      </div>
      <div className={`score-pill blue${currentColor === 'blue' ? ' active' : ''}`}>
        Blue{label('blue')}: <strong>{scores.blue}</strong>
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
