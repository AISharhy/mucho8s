import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useData } from "@/context/DataContext";
import { RANKS, tierOf } from "@/lib/elo";
import { RankArtwork } from "@/components/shared";
import { rankFamilyFromId } from "@/lib/rankVisuals";
import { captureEvent } from "@/lib/analytics";

const MAJOR_RANK_FAMILIES = ["iron", "bronze", "silver", "gold", "platinum", "diamond", "masters"];

const familyIndex = (rankOrFamily) => {
  const family = typeof rankOrFamily === "string"
    ? rankFamilyFromId(rankOrFamily)
    : rankFamilyFromId(rankOrFamily?.id);
  return Math.max(0, MAJOR_RANK_FAMILIES.indexOf(family));
};

const familyLabel = (rankOrFamily) => {
  const family = typeof rankOrFamily === "string"
    ? rankFamilyFromId(rankOrFamily)
    : rankFamilyFromId(rankOrFamily?.id);
  return family.charAt(0).toUpperCase() + family.slice(1);
};

const firstRankInFamily = (family) =>
  RANKS.find((rank) => rankFamilyFromId(rank.id) === family) || RANKS[0];

const lastRankInFamily = (family) => {
  const matches = RANKS.filter((rank) => rankFamilyFromId(rank.id) === family);
  return matches[matches.length - 1] || RANKS[0];
};

export default function RankUpCelebration() {
  const { discordPlayer, loaded } = useData();
  const previousRef = useRef(null);
  const previewHandledRef = useRef(false);
  const closeTimerRef = useRef(null);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (!loaded || previewHandledRef.current || typeof window === "undefined") return;

    const queryString = String(window.location.hash || "").split("?")[1] || "";
    const previewId = new URLSearchParams(queryString).get("rankupPreview");
    if (!previewId) return;

    const requestedFamily = MAJOR_RANK_FAMILIES.includes(previewId)
      ? previewId
      : rankFamilyFromId(previewId);
    const newFamilyIndex = MAJOR_RANK_FAMILIES.indexOf(requestedFamily);
    if (newFamilyIndex <= 0) return;

    previewHandledRef.current = true;
    const previousFamily = MAJOR_RANK_FAMILIES[newFamilyIndex - 1];
    const newRank = firstRankInFamily(requestedFamily);
    const oldRank = lastRankInFamily(previousFamily);

    setEvent({
      id: `preview-${previousFamily}-${requestedFamily}`,
      playerName: discordPlayer?.name || "MUCHO PLAYER",
      oldRank,
      newRank,
      oldFamily: previousFamily,
      newFamily: requestedFamily,
      oldElo: Math.max(oldRank.min, newRank.min - 25),
      newElo: newRank.min,
      eloGain: 25,
      preview: true,
    });
  }, [loaded, discordPlayer?.name]);

  useEffect(() => {
    if (!loaded || !discordPlayer?.id) return;

    const currentRank = tierOf(discordPlayer.currentElo);
    const currentFamily = rankFamilyFromId(currentRank.id);
    const snapshot = {
      playerId: String(discordPlayer.id),
      elo: Number(discordPlayer.currentElo || 0),
      rank: currentRank,
      family: currentFamily,
      familyIndex: familyIndex(currentFamily),
    };

    const previous = previousRef.current;

    if (!previous || previous.playerId !== snapshot.playerId) {
      previousRef.current = snapshot;
      return;
    }

    const isMajorPromotion =
      snapshot.familyIndex > previous.familyIndex &&
      snapshot.family !== previous.family;

    if (isMajorPromotion) {
      const nextEvent = {
        id: `${snapshot.playerId}-${previous.family}-${snapshot.family}-${Date.now()}`,
        playerName: discordPlayer.name || "Player",
        oldRank: previous.rank,
        newRank: snapshot.rank,
        oldFamily: previous.family,
        newFamily: snapshot.family,
        oldElo: previous.elo,
        newElo: snapshot.elo,
        eloGain: Math.max(0, snapshot.elo - previous.elo),
      };

      setEvent(nextEvent);
      captureEvent("major_rank_up", {
        player_id: snapshot.playerId,
        old_rank: previous.rank.id,
        new_rank: snapshot.rank.id,
        old_family: previous.family,
        new_family: snapshot.family,
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
  const oldFamilyName = familyLabel(event.oldFamily || oldRank);
  const newFamilyName = familyLabel(event.newFamily || newRank);

  return (
    <div
      className="m8-rankup-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Major rank up: ${newFamilyName}`}
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
            </div>
            <div className="m8-rankup-old-name">{oldFamilyName}</div>
          </div>

          <div className="m8-rankup-core">
            <span />
          </div>

          <div className="m8-rankup-rank m8-rankup-new">
            <div className="m8-rankup-art-shell">
              <RankArtwork rank={newRank} size={210} className="m8-rankup-artwork" />
            </div>
          </div>
        </div>

        <div className="m8-rankup-copy">
          <div className="m8-rankup-label">MAJOR RANK UP</div>
          <h2>{newFamilyName}</h2>
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
