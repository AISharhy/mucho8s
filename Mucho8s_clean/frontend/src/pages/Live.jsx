import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Twitch } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";

export default function Live() {
  const { id } = useParams();
  const {
    playerMap,
    playerProfiles,
    playerAvatars,
    discordPlayer,
    twitchLive,
    twitchStatusCheckedAt,
  } = useData();

  const playerId = id || discordPlayer?.id || "";
  const player = playerMap?.[playerId] || null;
  const profile = playerProfiles?.[playerId] || {};
  const channel = String(profile?.twitchChannel || "").trim();
  const isOwn = Boolean(discordPlayer?.id && discordPlayer.id === playerId);
  const liveNow = isOwn ? Boolean(twitchLive) : null;

  if (!player) {
    return (
      <section className="m8-panel rounded-[22px] p-8 min-h-[360px] flex flex-col items-center justify-center text-center">
        <Twitch size={30} className="text-[#9146FF] mb-3" />
        <h1 className="font-display text-2xl font-black">Live page unavailable</h1>
        <p className="text-sm text-muted-foreground mt-2">
          This player could not be found.
        </p>
      </section>
    );
  }

  return (
    <div className="m8-page-stack">
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
                {liveNow && <span className="m8-live-page-avatar-dot" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="brand-kicker text-[#B88CFF]">Twitch Live</div>
                  {liveNow === true && (
                    <span className="m8-twitch-live-status">
                      <span />
                      LIVE NOW
                    </span>
                  )}
                  {liveNow === false && channel && (
                    <span className="m8-twitch-offline-status">OFFLINE</span>
                  )}
                </div>

                <h1 className="font-display text-3xl sm:text-5xl font-black tracking-[-0.045em] mt-1 truncate">
                  {player.name}
                </h1>

                {channel && (
                  <div className="text-sm text-[#8D95A4] mt-1">
                    @{channel}
                  </div>
                )}
              </div>
            </div>
          </div>

          {channel && (
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
          )}
        </div>

        {isOwn && twitchStatusCheckedAt && (
          <div className="relative z-10 text-[9px] uppercase tracking-[0.14em] text-[#626B78] mt-5">
            Live status auto-checks every minute
          </div>
        )}
      </section>

    </div>
  );
}
