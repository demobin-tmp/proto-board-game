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

export default function App() {
  const [session, setSession] = useState(null);
  const [bothJoined, setBothJoined] = useState(false);

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
    return <Lobby onJoined={setSession} />;
  }

  return (
    <div className="app">
      {!bothJoined && (
        <header className="match-banner">
          Match code: <strong>{session.matchID}</strong> — share this with the other player
        </header>
      )}
      <StackingClient matchID={session.matchID} playerID={session.playerID} credentials={session.credentials} />
    </div>
  );
}
