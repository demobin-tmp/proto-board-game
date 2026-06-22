import { useState, useEffect } from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { LobbyClient } from 'boardgame.io/client';
import { StackingGame } from './game/game';
import { SERVER_URL, GAME_NAME } from './config';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import './App.css';

const StackingClient = Client({
  game: StackingGame,
  board: GameBoard,
  multiplayer: SocketIO({ server: SERVER_URL }),
  debug: false,
});

const lobbyClient = new LobbyClient({ server: SERVER_URL });

// Persisting the session means an accidental refresh (easy to trigger on
// mobile) reconnects to the same seat instead of being bounced back to the
// Lobby — boardgame.io's SocketIO transport already re-syncs current state
// for a known (matchID, playerID, credentials) triple, so rehydrating here
// is enough to make that happen automatically.
const SESSION_KEY = 'stacking-tiles-session';

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [bothJoined, setBothJoined] = useState(false);

  function handleJoined(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    setSession(data);
  }

  async function leaveMatch() {
    if (!window.confirm('Leave this match? You can rejoin later using the match code.')) return;
    try {
      // Frees the seat server-side (clears name/credentials), so a later
      // joinMatch with this match code can claim it again. Without this,
      // boardgame.io still treats the seat as taken and rejecting rejoin.
      await lobbyClient.leaveMatch(GAME_NAME, session.matchID, {
        playerID: session.playerID,
        credentials: session.credentials,
      });
    } catch {
      // Match may already be gone or unreachable — still clear locally.
    }
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setBothJoined(false);
  }

  // Once the other player has joined, the match code is no longer useful —
  // poll until both seats are filled, then drop the banner.
  useEffect(() => {
    if (!session || bothJoined) return undefined;

    let cancelled = false;
    const checkJoined = async () => {
      try {
        const match = await lobbyClient.getMatch(GAME_NAME, session.matchID);
        if (!cancelled && match.players.every((p) => p.name)) {
          setBothJoined(true);
        }
      } catch {
        // Match not reachable yet — keep polling.
      }
    };
    checkJoined();
    const interval = setInterval(checkJoined, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session, bothJoined]);

  if (!session) {
    return <Lobby onJoined={handleJoined} />;
  }

  return (
    <div className="app">
      {!bothJoined && (
        <header className="match-banner">
          Match code: <strong>{session.matchID}</strong> — share this with the other player
        </header>
      )}
      <StackingClient matchID={session.matchID} playerID={session.playerID} credentials={session.credentials} />
      <button type="button" className="leave-match-button" onClick={leaveMatch}>
        Leave match
      </button>
    </div>
  );
}
