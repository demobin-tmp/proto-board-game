import { useState, useEffect } from 'react';
import { LobbyClient } from 'boardgame.io/client';
import { GAME_NAME, SERVER_URL } from '../config';

const lobbyClient = new LobbyClient({ server: SERVER_URL });

export default function Lobby({ onJoined }) {
  const [matchCode, setMatchCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [seat, setSeat] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Joining an existing match: auto-pick whichever seat is still open, so
  // the second player doesn't have to remember to choose the opposite color.
  useEffect(() => {
    const matchID = matchCode.trim();
    if (!matchID) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const match = await lobbyClient.getMatch(GAME_NAME, matchID);
        if (cancelled) return;
        const openSeats = match.players.filter((p) => !p.name).map((p) => String(p.id));
        if (openSeats.length === 1) {
          setSeat(openSeats[0]);
        }
      } catch {
        // Unknown/invalid match code so far — leave the seat choice as-is.
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [matchCode]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let matchID = matchCode.trim();
      if (!matchID) {
        const created = await lobbyClient.createMatch(GAME_NAME, { numPlayers: 2 });
        matchID = created.matchID;
      }
      const { playerCredentials } = await lobbyClient.joinMatch(GAME_NAME, matchID, {
        playerID: seat,
        playerName: playerName.trim() || `Player ${seat}`,
      });
      onJoined({ matchID, playerID: seat, credentials: playerCredentials });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="lobby" onSubmit={handleSubmit}>
      <h1>Stacking Tiles — prototype</h1>
      <p className="hint">
        One of you creates a match (leave the code blank) and shares the generated
        code with the other, who then joins using that code and the other seat.
      </p>

      <label>
        Your name
        <input
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="optional"
        />
      </label>

      <label>
        Seat
        <select value={seat} onChange={(event) => setSeat(event.target.value)}>
          <option value="0">Red</option>
          <option value="1">Blue</option>
        </select>
      </label>

      <label>
        Match code
        <input
          value={matchCode}
          onChange={(event) => setMatchCode(event.target.value)}
          placeholder="leave blank to create a new match"
        />
      </label>

      <button type="submit" disabled={busy}>
        {busy ? 'Connecting…' : matchCode.trim() ? 'Join match' : 'Create match'}
      </button>

      {error && <p className="error">{error}</p>}
    </form>
  );
}
