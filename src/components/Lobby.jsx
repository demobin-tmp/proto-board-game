import { useState, useEffect } from 'react';
import { LobbyClient } from 'boardgame.io/client';
import { GAME_NAME, SERVER_URL } from '../config';
import { getShape, BASE_SHAPES } from '../game/shapes';
import { COLOR_HEX } from './colors';
import MiniShape from './MiniShape';

const lobbyClient = new LobbyClient({ server: SERVER_URL });

export default function Lobby({ onJoined }) {
  const [matchCode, setMatchCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [seat, setSeat] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [profileName, setProfileName] = useState('default');
  const [editingProfile, setEditingProfile] = useState(false);
  const [customCounts, setCustomCounts] = useState(null);

  // Tile-supply profiles (which shapes are in play and how many of each) are
  // configured server-side in data/profiles.json, so they can be tweaked
  // without a code change. Only relevant when creating a new match.
  useEffect(() => {
    let cancelled = false;
    fetch(`${SERVER_URL}/profiles`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setProfiles(data);
        const name = data['default'] ? 'default' : Object.keys(data)[0];
        if (name) {
          setProfileName(name);
          setCustomCounts(JSON.parse(JSON.stringify(data[name])));
        }
      })
      .catch(() => {
        // No profiles endpoint reachable — fall back to the game's built-in default.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function updateCount(shapeId, field, raw) {
    const value = Math.max(0, Number.parseInt(raw, 10) || 0);
    setCustomCounts((current) => ({
      ...current,
      [shapeId]: { ...current[shapeId], [field]: value },
    }));
  }

  function updateBoard(value) {
    setCustomCounts((current) => ({ ...current, board: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let matchID = matchCode.trim();
      if (!matchID) {
        const setupData = customCounts ? { profile: customCounts } : undefined;
        const created = await lobbyClient.createMatch(GAME_NAME, { numPlayers: 2, setupData });
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

      {!matchCode.trim() && profiles && (
        <>
          <label>
            Base settings
            <select
              value={profileName}
              onChange={(event) => {
                const name = event.target.value;
                setProfileName(name);
                setCustomCounts(JSON.parse(JSON.stringify(profiles[name])));
              }}
            >
              {Object.keys(profiles).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="edit-profile-button" onClick={() => setEditingProfile((current) => !current)}>
            {editingProfile ? 'Hide game settings' : 'Edit game'}
          </button>

          {editingProfile && customCounts && (
            <div className="profile-editor">
              <label>
                Board
                <select
                  value={customCounts.board || 'default'}
                  onChange={(event) => updateBoard(event.target.value)}
                >
                  <option value="default">Default (neutral ground)</option>
                  <option value="colored">Colored (red/blue halves)</option>
                  <option value="diagonal">Diagonal (red/blue triangles, grey divider)</option>
                </select>
              </label>

              <div className="profile-editor-header">
                <span />
                <span>Colored</span>
                <span>Grey</span>
              </div>
              {BASE_SHAPES.map(({ id: shapeId }) => {
                const counts = customCounts[shapeId] ?? { colorCount: 0, greyCount: 0 };
                return (
                  <div className="profile-editor-row" key={shapeId}>
                    <span className="shape-id">
                      <MiniShape cells={getShape(shapeId).rotations[0]} color={COLOR_HEX.neutral} />
                      {shapeId}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={counts.colorCount}
                      onChange={(event) => updateCount(shapeId, 'colorCount', event.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      value={counts.greyCount}
                      onChange={(event) => updateCount(shapeId, 'greyCount', event.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <button type="submit" disabled={busy}>
        {busy ? 'Connecting…' : matchCode.trim() ? 'Join match' : 'Create match'}
      </button>

      {error && <p className="error">{error}</p>}
    </form>
  );
}
