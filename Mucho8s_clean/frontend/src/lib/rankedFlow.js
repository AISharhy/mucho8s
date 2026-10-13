export const SNAKE_DRAFT = ['A', 'B', 'B', 'A', 'A', 'B'];
export const RANKED_MAPS = {
 hp: ['Den', 'Gridlock', 'Frequency', 'Scar', 'Hacienda'],
 snd: ['Den', 'Frequency', 'Gridlock', 'Raid', 'Scar', 'Hacienda', 'Fringe'],
};
export const rankedModeLabel = mode => mode === 'snd' ? 'Search & Destroy' : 'Hardpoint';
export function rankedSeconds(deadline, serverNow, receivedAt, now = Date.now()) {
 if (!deadline || !serverNow) return 0;
 return Math.max(0, Math.ceil((Date.parse(deadline) - (Date.parse(serverNow) + Math.max(0, now - receivedAt))) / 1000));
}
export function draftSide(pick) { return SNAKE_DRAFT[pick] || null; }
export const validLobbyCode = code => /^[A-Z0-9_-]{3,32}$/.test(String(code || '').trim().toUpperCase());
