import { POWER_TRACK_MAX } from '../game/game';

function PowerTrack({ value, color }) {
  const atMax = value >= POWER_TRACK_MAX;
  return (
    <span className={`power-track${atMax ? ' power-track-max' : ''}`}>
      {Array.from({ length: POWER_TRACK_MAX }, (_, i) => (
        <span key={i} className={`power-pip${i < value ? ' power-pip-filled' : ''}`} />
      ))}
      {atMax && <span className="power-skip-label">SKIP</span>}
    </span>
  );
}

export default function ScorePanel({ scores, charges, power, myColor, currentColor, gameover }) {
  function label(color) {
    return color === myColor ? ' (you)' : '';
  }

  return (
    <div className="score-panel">
      <div className={`score-pill red${currentColor === 'red' ? ' active' : ''}`}>
        Red{label('red')}: <strong>{scores.red}</strong>
        {charges.red > 0 && <span className="charge-badge">⚡{charges.red}</span>}
        <PowerTrack value={power.red} color="red" />
      </div>
      <div className={`score-pill blue${currentColor === 'blue' ? ' active' : ''}`}>
        Blue{label('blue')}: <strong>{scores.blue}</strong>
        {charges.blue > 0 && <span className="charge-badge">⚡{charges.blue}</span>}
        <PowerTrack value={power.blue} color="blue" />
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
