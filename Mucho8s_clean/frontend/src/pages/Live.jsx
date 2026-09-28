import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Twitch } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";

const LiveCard = ({ entry, playerAvatars }) => {
  const { player, channel, startedAt } = entry;

  return (
    <section className="m8-live-page-hero">
      <div className="m8-live-page-glow" aria-hidden="true" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div>
          <Link
            to={`/players/${player.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#8E97A5] hover:text-white"
          >
            <ArrowLeft size={14} />
            Back to profile
          </Link>

          <div className="flex items-center gap-4 mt-5">
            <div className="m8-live-page-avatar">
              <PlayerAvatar
                name={player.name}
                elo={player.currentElo}
                size={68}
                avatarUrl={playerAvatars?.[player.id]}
              />
              <span className="m8-live-page-avatar-dot" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="brand-kicker text-[#B88CFF]">Twitch Live</div>
                <span className="m8-twitch-live-status">
                  <span />
                  LIVE NOW
                </span>
              </div>

              <h2 className="font-display text-3xl sm:text-5xl font-black tracking-[-0.045em] mt-1 truncate">
                {player.name}
              </h2>

              <div className="flex flex-wrap items-center gap-2 text-sm text-[#8D95A4] mt-1">
                <span>@{channel}</span>
                {startedAt && (
                  <>
                    <span className="text-[#444C59]">·</span>
                    <span>
                      Live since {new Date(startedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <a
          href={`https://www.twitch.tv/${encodeURIComponent(channel)}`}
          target="_blank"
          rel="noreferrer"
          className="m8-live-open-twitch"
        >
          <Twitch size={16} />
          Open Twitch
          <ExternalLink size={13} />
        </a>
      </div>
    </section>
  );
};

export default function Live() {
  const { id } = useParams();
  const {
    playerMap,
    playerProfiles,
    playerAvatars,
    discordPlayer,
    dashboardData,
  } = useData();

  const liveEntries = useMemo(() => {
    const rows = Array.isArray(dashboardData?.twitchLivePlayers)
      ? dashboardData.twitchLivePlayers
      : [];

    return rows
      .map((row) => {
        const playerId = String(row?.player_id || "").trim();
        const player = playerMap?.[playerId];
        const profile = playerProfiles?.[playerId] || {};
        const channel = String(
          row?.twitch_channel || profile?.twitchChannel || ""
        ).trim();

        if (!player || !channel) return null;

        return {
          player,
          channel,
          startedAt: row?.started_at || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aStarted = Date.parse(String(a?.startedAt || "")) || Number.MAX_SAFE_INTEGER;
        const bStarted = Date.parse(String(b?.startedAt || "")) || Number.MAX_SAFE_INTEGER;
        return aStarted - bStarted;
      });
  }, [dashboardData?.twitchLivePlayers, playerMap, playerProfiles]);

  const fallbackEntry = useMemo(() => {
    const playerId = id || discordPlayer?.id || "";
    const player = playerMap?.[playerId] || null;
    const profile = playerProfiles?.[playerId] || {};
    const channel = String(profile?.twitchChannel || "").trim();

    if (!player || !channel) return null;
    return { player, channel, startedAt: null };
  }, [id, discordPlayer?.id, playerMap, playerProfiles]);

  const entries = liveEntries.length ? liveEntries : (fallbackEntry ? [fallbackEntry] : []);

  if (!entries.length) {
    return (
      <section className="m8-panel rounded-[22px] p-8 min-h-[360px] flex flex-col items-center justify-center text-center">
        <Twitch size={30} className="text-[#9146FF] mb-3" />
        <h1 className="font-display text-2xl font-black">No Twitch live right now</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Live channels will appear here automatically when a linked player starts streaming.
        </p>
      </section>
    );
  }

  return (
    <div className="m8-page-stack">
      {entries.map((entry) => (
        <LiveCard
          key={entry.player.id}
          entry={entry}
          playerAvatars={playerAvatars}
        />
      ))}
    </div>
  );
}
