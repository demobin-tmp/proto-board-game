import { useState } from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { StackingGame } from './game/game';
import { SERVER_URL } from './config';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import './App.css';

const StackingClient = Client({
  game: StackingGame,
  board: GameBoard,
  multiplayer: SocketIO({ server: SERVER_URL }),
  debug: false,
});

export default function App() {
  const [session, setSession] = useState(null);

  if (!session) {
    return <Lobby onJoined={setSession} />;
  }

  return (
    <div className="app">
      <header className="match-banner">
        Match code: <strong>{session.matchID}</strong> — share this with the other player
      </header>
      <StackingClient matchID={session.matchID} playerID={session.playerID} credentials={session.credentials} />
    </div>
  );
}
