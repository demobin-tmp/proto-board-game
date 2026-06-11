// Both the lobby client and the multiplayer transport need to agree on where
// the boardgame.io server lives. Override VITE_SERVER_URL (e.g. in a .env.local
// file) when pointing the client at a tunnel or a separately-hosted server.
// In production builds, the server serves this app itself, so an empty
// string (same origin) is the right default.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
export const GAME_NAME = 'stacking-tiles';
