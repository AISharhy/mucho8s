import {isConfirmedMatch} from '@/lib/playerAnalytics';
export function clubStats(matches,clubId){
 const seen=new Set();let wins=0,losses=0;const history=[];
 for(const m of matches||[]){if(!isConfirmedMatch(m)||!m.id||seen.has(m.id))continue;seen.add(m.id);
 const side=String(m.clubAId||'')===String(clubId)?'A':String(m.clubBId||'')===String(clubId)?'B':null;if(!side)continue;
 if(m.winner===side)wins++;else losses++;history.push(m);
 }
 return {wins,losses,played:wins+losses,winRate:wins+losses?Math.round(wins/(wins+losses)*100):0,history:history.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))};
}
