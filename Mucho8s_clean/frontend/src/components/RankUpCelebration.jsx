import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useData } from "@/context/DataContext";
import { RANKS, tierOf } from "@/lib/elo";
import { RankArtwork } from "@/components/shared";
import { captureEvent } from "@/lib/analytics";

const rankIndex = (rank) => Math.max(0, RANKS.findIndex((item) => item.id === rank?.id));

export default function RankUpCelebration() {
  const { discordPlayer, loaded } = useData();
  const previousRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (!loaded || !discordPlayer?.id) return;

    const currentRank = tierOf(discordPlayer.currentElo);
    const snapshot = {
      playerId: String(discordPlayer.id),
      elo: Number(discordPlayer.currentElo || 0),
      rank: currentRank,
      rankIndex: rankIndex(currentRank),
    };

    const previous = previousRef.current;

    if (!previous || previous.playerId !== snapshot.playerId) {
      previousRef.current = snapshot;
      return;
    }

    if (snapshot.rankIndex > previous.rankIndex) {
      const nextEvent = {
        id: `${snapshot.playerId}-${previous.rank.id}-${snapshot.rank.id}-${Date.now()}`,
        playerName: discordPlayer.name || "Player",
        oldRank: previous.rank,
        newRank: snapshot.rank,
        oldElo: previous.elo,
        newElo: snapshot.elo,
        eloGain: Math.max(0, snapshot.elo - previous.elo),
      };

      setEvent(nextEvent);
      captureEvent("rank_up", {
        player_id: snapshot.playerId,
        old_rank: previous.rank.id,
        new_rank: snapshot.rank.id,
        old_elo: previous.elo,
        new_elo: snapshot.elo,
      });
    }

    previousRef.current = snapshot;
  }, [
    loaded,
    discordPlayer?.id,
    discordPlayer?.name,
    discordPlayer?.currentElo,
  ]);

  useEffect(() => {
    if (!event) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeTimerRef.current = window.setTimeout(() => {
      setEvent(null);
    }, 4600);

    return () => {
      document.body.style.overflow = previousOverflow;
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [event]);

  const close = () => setEvent(null);

  if (!event) return null;

  const { oldRank, newRank } = event;

  return (
    <div
      className="m8-rankup-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Rank up: ${newRank.name}`}
      style={{
        "--rankup-color": newRank.color,
        "--rankup-accent": newRank.accent,
        "--rankup-old-color": oldRank.color,
      }}
      data-testid="rank-up-celebration"
    >
      <button
        type="button"
        className="m8-rankup-skip"
        onClick={close}
        aria-label="Skip rank up animation"
      >
        <span>SKIP</span>
        <X size={14} />
      </button>

      <div className="m8-rankup-vignette" aria-hidden="true" />
      <div className="m8-rankup-rays" aria-hidden="true" />
      <div className="m8-rankup-grid" aria-hidden="true" />
      <div className="m8-rankup-flash" aria-hidden="true" />

      <div className="m8-rankup-content">
        <div className="m8-rankup-kicker">MUCHO RANK SYSTEM</div>

        <div className="m8-rankup-stage" aria-hidden="true">
          <span className="m8-rankup-ring ring-one" />
          <span className="m8-rankup-ring ring-two" />
          <span className="m8-rankup-ring ring-three" />

          <div className="m8-rankup-rank m8-rankup-old">
            <div className="m8-rankup-art-shell">
              <RankArtwork rank={oldRank} size={176} className="m8-rankup-artwork" />
              <span className="m8-rankup-division">{oldRank.roman}</span>
            </div>
            <div className="m8-rankup-old-name">{oldRank.name}</div>
          </div>

          <div className="m8-rankup-core">
            <span />
          </div>

          <div className="m8-rankup-rank m8-rankup-new">
            <div className="m8-rankup-art-shell">
              <RankArtwork rank={newRank} size={210} className="m8-rankup-artwork" />
              <span className="m8-rankup-division">{newRank.roman}</span>
            </div>
          </div>
        </div>

        <div className="m8-rankup-copy">
          <div className="m8-rankup-label">RANK UP</div>
          <h2>{newRank.name}</h2>
          <div className="m8-rankup-meta">
            <span>{event.playerName}</span>
            <i />
            <strong>{event.newElo.toLocaleString("it-IT")} ELO</strong>
            {event.eloGain > 0 && (
              <>
                <i />
                <em>+{event.eloGain}</em>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
