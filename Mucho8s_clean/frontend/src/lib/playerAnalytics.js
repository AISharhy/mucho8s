export const isConfirmedMatch = m => Boolean(m && !['pending','disputed','cancelled'].includes(m.resultStatus || m.status) && ['A','B'].includes(m.winner) && (m.locked === true || ['locked','verified','completed'].includes(m.resultStatus)) && !m.demo && !m.simulation);
export function confirmedPlayerMatches(matches, playerId, {season='all',game='all'}={}) {
 const seen=new Set();
 return (matches||[]).filter(isConfirmedMatch).filter(m=>{
  if(!m.id||seen.has(String(m.id)))return false;seen.add(String(m.id));
  return [...(m.teamA||[]),...(m.teamB||[])].map(String).includes(String(playerId)) && (season==='all'||String(m.season ?? m.seasonNumber ?? '')===String(season)) && (game==='all'||m.game===game);
 }).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
}
export function playerAnalytics(matches, playerId) {
 const rows=confirmedPlayerMatches(matches,playerId), modes={}, opponents={};
 let wins=0,mvp=0,bestWinStreak=0,bestLossStreak=0,streak=0;
 const won=m=>(m.winner==='A'?m.teamA:m.teamB).map(String).includes(String(playerId));
 for(const m of [...rows].reverse()) {
  const win=won(m);wins+=Number(win);streak=win?(streak>0?streak+1:1):(streak<0?streak-1:-1);
  bestWinStreak=Math.max(bestWinStreak,streak);bestLossStreak=Math.max(bestLossStreak,-streak);
  const key=m.mode||'Modalità non registrata';modes[key] ||= {mode:key,played:0,wins:0};modes[key].played++;modes[key].wins+=Number(win);
  if((m.mvpIds||[m.mvpId]).map(String).includes(String(playerId)))mvp++;
  const other=(m.teamA||[]).map(String).includes(String(playerId))?m.teamB:m.teamA;
  for(const id of other||[]){opponents[id] ||= {id,played:0,wins:0};opponents[id].played++;opponents[id].wins+=Number(win);}
 }
 return {played:rows.length,wins,losses:rows.length-wins,winRate:rows.length?Math.round(wins/rows.length*1000)/10:0,mvp,streak,bestWinStreak,bestLossStreak,modes:Object.values(modes),rivals:Object.values(opponents).sort((a,b)=>b.played-a.played),last10:rows.slice(0,10).map(m=>({...m,won:won(m)}))};
}
