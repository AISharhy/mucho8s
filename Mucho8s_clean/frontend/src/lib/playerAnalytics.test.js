import {confirmedPlayerMatches,playerAnalytics} from './playerAnalytics';
import {clubStats} from './clubAnalytics';
const match=(id,winner='A',extra={})=>({id,date:`2026-10-${String(id).padStart(2,'0')}T12:00:00Z`,teamA:['one','two'],teamB:['three','four'],winner,game:'BO7',mode:'Hardpoint',season:2,locked:true,resultStatus:'locked',...extra});
test('analytics exclude pending, disputed, bots and duplicates',()=>{
 const rows=[match(1),match(1),match(2,'B'),match(3,'A',{locked:false,resultStatus:'pending'}),match(4,'A',{demo:true})];
 expect(confirmedPlayerMatches(rows,'one')).toHaveLength(2);
 const stats=playerAnalytics(rows,'one');expect(stats.wins).toBe(1);expect(stats.losses).toBe(1);expect(stats.winRate).toBe(50);
});
test('season/game filters and player membership apply together',()=>{
 const rows=[match(1),match(2,'B',{season:1}),match(3,'A',{game:'BO6'})];
 expect(confirmedPlayerMatches(rows,'one',{season:'2',game:'BO7'}).map(m=>m.id)).toEqual([1]);
 expect(confirmedPlayerMatches(rows,'unknown')).toEqual([]);
});
test('streaks, recorded MVP and rivalries derive from confirmed games',()=>{
 const stats=playerAnalytics([match(1),match(2,'A',{mvpIds:['one']}),match(3),match(4,'B')],'one');
 expect(stats.bestWinStreak).toBe(3);expect(stats.streak).toBe(-1);expect(stats.mvp).toBe(1);expect(stats.rivals[0].played).toBe(4);
});
test('club standings require recorded identity instead of inferring current rosters',()=>{
 const rows=[match(1),match(2,'A',{clubAId:'alpha',clubBId:'bravo'}),match(3,'B',{clubAId:'alpha',clubBId:'bravo',resultStatus:'pending',locked:false})];
 expect(clubStats(rows,'alpha')).toMatchObject({played:1,wins:1,losses:0});
 expect(clubStats(rows,'bravo')).toMatchObject({played:1,wins:0,losses:1});
});
