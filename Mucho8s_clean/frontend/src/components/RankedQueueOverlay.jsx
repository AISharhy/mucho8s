import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X, Zap, Users } from 'lucide-react';
import './RankedQueueOverlay.css';

export default function RankedQueueOverlay({ queue, queuedPlayers, busy, onLeave }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((previous) => previous + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  const size = Number(queue?.team_size);
  const total = [2, 3, 4].includes(size) ? size * 2 : 8;
  const count = Math.max(0, Math.min(total, Number(queuedPlayers) || 0));
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return createPortal(
    <div className="rq-overlay" role="dialog" aria-modal="true" aria-label="Ricerca partita Mucho Ranked" data-testid="ranked-fullscreen-queue">
      <div className="rq-overlay-top">
        <div className="rq-brand"><ShieldCheck size={21}/> MUCHO<span>RANKED</span></div>
        <div className="rq-private">CIRCLE MUCHO8S · PRIVATE</div>
      </div>
      <main className="rq-search">
        <div className="rq-label"><span className="rq-live-dot"/> MATCHMAKING ATTIVO</div>
        <h1>RICERCA <span>PARTITA</span></h1>
        <div className="rq-radar">
          <div className="rq-radar-ring rq-radar-ring-outer"/>
          <div className="rq-radar-ring rq-radar-ring-mid"/>
          <div className="rq-radar-sweep"/>
          <div className="rq-radar-center">
            <Users size={25}/>
            <strong aria-live="polite">{count}<small>/{total}</small></strong>
            <span>GIOCATORI</span>
          </div>
        </div>
        <div className="rq-mode"><Zap size={17}/> HARDPOINT <i/> BO1 <i/> {total / 2}V{total / 2}</div>
        <p className="rq-status">Ricerca avversari e compagni di squadra...</p>
        <div className="rq-timer">TEMPO IN CODA <strong>{duration}</strong></div>
        <button type="button" disabled={busy} onClick={onLeave} className="rq-cancel"><X size={17}/> ESCI DALLA CODA</button>
        <div className="rq-footnote">Mantieni la pagina aperta per conservare il posto in coda.</div>
      </main>
    </div>,
    document.body
  );
}
