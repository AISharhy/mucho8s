import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import PlayDemos from './PlayDemos';
import RankedDemo from './RankedDemo';
import TourneyDemo from './TourneyDemo';
import MatchRoom from '@/pages/MatchRoom';
import {SimulationDataProvider} from '@/context/DataContext';
jest.mock('@/lib/uiAudio',()=>({playUiSound:jest.fn(),isUiSoundEnabled:()=>false,setUiSoundEnabled:jest.fn()}));
jest.mock('@/lib/tourneyLive',()=>({fetchTourney:jest.fn(()=>{throw Error('Simulation must not fetch real tournament')}),subscribeTourney:jest.fn(()=>{throw Error('Simulation must not subscribe to real tournament')}),saveTourney:jest.fn(()=>{throw Error('Simulation must not save real tournament')}),requestTourneyEntryPayment:jest.fn(()=>{throw Error('Real payment called')}),requestTourneyPayment:jest.fn(()=>{throw Error('Real payment called')})}));
jest.mock('@/components/MapPreviewCard',()=>function Preview({mapName}){return <span>{mapName}</span>});
let container,root;
beforeEach(()=>{container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);global.fetch=jest.fn(()=>Promise.reject(Error('Unexpected network request')));window.HTMLElement.prototype.scrollIntoView=jest.fn();});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();jest.clearAllMocks();});
async function render(node){await act(async()=>root.render(<MemoryRouter>{node}</MemoryRouter>));}
async function click(node){expect(node).toBeTruthy();await act(async()=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));}
test('8s simulation mounts the original manual TeamBuilder without network writes',async()=>{await render(<PlayDemos kind="8s" onClose={()=>{}}/>);expect(container.querySelector('[data-testid="mucho8s-wizard"]')).toBeTruthy();expect(container.querySelectorAll('[data-testid^="simulate-"]')).toHaveLength(0);expect(global.fetch).not.toHaveBeenCalled();});
test('1v1 simulation uses the original Play challenge card and original ChallengeMatch',async()=>{
 await render(<PlayDemos kind="1v1" onClose={()=>{}}/>);
 expect(container.querySelector('[data-testid="play-money-chall-card"]')).toBeTruthy();
 expect(container.querySelector('[data-testid="play-8s-card"]')).toBeNull();
 await click(container.querySelector('[data-testid="quick-chall-player-demo-bot-1"]'));
 await click(container.querySelector('[data-testid="quick-chall-send"]'));
 expect(container.textContent).toContain('Waiting for Bot 2');
 expect(global.fetch).not.toHaveBeenCalled();
});
test('Ranked demo mounts the same shared room and isolates all data',async()=>{
 await render(<RankedDemo onClose={()=>{}}/>);
 await click([...container.querySelectorAll('button')].find(b=>b.textContent.includes('Trova 8 bot')));
 expect(container.querySelector('[data-testid="ranked-shared-room"]')).toBeTruthy();expect(container.textContent).toContain('Snake A-B-B-A-A-B');expect(global.fetch).not.toHaveBeenCalled();
});
test('tournament demo mounts the original setup and never calls remote tournament APIs',async()=>{
 await render(<TourneyDemo onClose={()=>{}}/>);
 expect(container.textContent).toContain('MuchoTourney');
 expect(container.textContent).toContain('Classic');
 expect(global.fetch).not.toHaveBeenCalled();
});
async function choose(selector,value){const node=container.querySelector(selector);expect(node).toBeTruthy();await act(async()=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));});}
test.each([2,3,4])('manual builder enforces complete teams of %s players and supports direct transfers',async(size)=>{
 await render(<PlayDemos kind="8s" onClose={()=>{}}/>);
 await choose('[aria-label="Formato lobby manuale"]',String(size));
 await choose('[data-testid="wizard-game-select"]','BO7');
 await choose('[data-testid="wizard-mode-select"]','Search & Destroy');
 await click([...container.querySelectorAll('button')].find(b=>b.textContent.trim()==='Continue'));
 for(let i=0;i<size;i++)await click(container.querySelector(`[title="Assign Bot ${i+1} to ALPHA"]`));
 for(let i=size;i<size*2;i++)await click(container.querySelector(`[title="Assign Bot ${i+1} to BRAVO"]`));
 expect(container.textContent).toContain(`${size}/${size}`);
 const confirm=container.querySelector('[data-testid="manual-teams-confirm"]');
 expect(confirm).toBeTruthy();expect(confirm.disabled).toBe(false);
 await click(container.querySelector(`[title="Remove Bot ${size+1} from BRAVO"]`));
 expect(container.querySelector('[data-testid="manual-teams-confirm"]').disabled).toBe(true);
 await click(container.querySelector('[title="Assign Bot 1 to BRAVO"]'));
 await click(container.querySelector(`[title="Assign Bot ${size+1} to ALPHA"]`));
 expect(container.querySelector('[data-testid="manual-teams-confirm"]').disabled).toBe(false);
 await click(container.querySelector('[data-testid="manual-teams-confirm"]'));
 await click([...container.querySelectorAll('button')].find(b=>b.textContent.trim()==='Confirm Mucho8s'));
 expect(container.textContent).toContain('Lobby condivisa');
 expect(container.textContent).toContain(`${size}v${size}`);
 expect(global.fetch).not.toHaveBeenCalled();
});

test('an admin playing in a shared room can confirm their own readiness',async()=>{
 const ids=['one','two','three','four'],players=ids.map(id=>({id,name:id,currentElo:1000}));
 const value={players,playerMap:Object.fromEntries(players.map(p=>[p.id,p])),playerAvatars:{},matches:[],challenges:[],liveMatches:[{id:'room',match_id:'match',team_a:ids.slice(0,2),team_b:ids.slice(2),maps:['Den','Raid','Scar'],game:'BO7',mode:'Search & Destroy',captain_player_id:'one',created_at:new Date().toISOString(),lobby_code:'PLAYER_CODE',ready_player_ids:[]}],matchReports:[],discordPlayer:players[0],isAdmin:true,setLiveRoomCode:async()=>true,setLiveRoomReady:async()=>true,requestCancelLiveMatch:async()=>true,cancelLiveMatch:async()=>true,listLiveMatchMessages:async()=>[],sendLiveMatchMessage:async()=>null};
 await render(<SimulationDataProvider value={value}><MatchRoom matchId="room"/></SimulationDataProvider>);
 const ready=[...container.querySelectorAll('button')].find(b=>b.textContent==='Sono pronto');expect(ready).toBeTruthy();expect(ready.disabled).toBe(false);
});
