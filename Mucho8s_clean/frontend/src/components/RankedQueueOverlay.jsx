import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Trophy, X, Zap, Users } from 'lucide-react';
import { tierOf, rankProgress } from '@/lib/elo';
import './RankedQueueOverlay.css';

export function RankedProfileCard({ player }) {
  const elo = Number(player?.currentElo);
  const valid = Number.isFinite(elo);
  const rank = valid ? tierOf(elo) : null;
  const progress = valid ? rankProgress(elo) : null;
  const wins = Number(player?.wins ?? 0);
  const losses = Number(player?.losses ?? 0);
  const games = Number(player?.totalMatches ?? wins + losses);
  return (
    <section className="rq-profile" style={{'--rq-rank': rank?.color || '#70a6ff'}}>
      <div className="rq-eyebrow"><Trophy size={15}/> IL TUO PROFILO COMPETITIVO</div>
      <div className="rq-player">{player?.name || 'Giocatore'}</div>
      <div className="rq-emblem"><ShieldCheck size={58} strokeWidth={1.3}/><span>{rank?.roman || '—'}</span></div>
      <div className="rq-tier">{rank?.name || 'Non classificato'}</div>
      <div className="rq-elo">{valid ? Math.round(elo).toLocaleString('it-IT') : '—'} <span>ELO</span></div>
      <div className="rq-progress-caption"><span>PROSSIMA DIVISIONE</span><strong>{progress?.next?.name || 'RANK MASSIMO'}</strong></div>
      <div className="rq-progress"><div style={{width:`${progress?.progress || 0}%`}}/></div>
      <div className="rq-needed">{progress?.next ? `${progress.eloNeeded} Elo mancanti` : 'Divisione massima raggiunta'}</div>
      <div className="rq-stats">
        <div><strong>{Number.isFinite(wins) ? wins : '—'}</strong><span>VITTORIE</span></div>
        <div><strong>{Number.isFinite(losses) ? losses : '—'}</strong><span>SCONFITTE</span></div>
        <div><strong>{games > 0 ? Math.round(100 * wins / games) + '%' : '—'}</strong><span>WIN RATE</span></div>
      </div>
    </section>
  );
}

export default function RankedQueueOverlay({ queue, queuedPlayers, player, busy, onLeave }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((old) => old + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = previous;};
  }, []);
  const total = Number(queue?.team_size) * 2 || 8;
  const count = Math.max(0, Math.min(total, Number(queuedPlayers) || 0));
  const duration = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  return createPortal(
    <div className="rq-overlay" role="dialog" aria-modal="true" aria-label="Ricerca partita Mucho Ranked" data-testid="ranked-fullscreen-queue">
      <div className="rq-overlay-top"><div className="rq-brand"><ShieldCheck size={21}/> MUCHO<span>RANKED</span></div><div className="rq-private">CIRCLE MUCHO8S · PRIVATE</div></div>
      <div className="rq-overlay-grid">
        <RankedProfileCard player={player}/>
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
      </div>
    </div>,
    document.body
  );
}
