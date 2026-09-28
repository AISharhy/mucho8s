import React from "react";
import { ExternalLink, Radio } from "lucide-react";

const normalizeChannel = (value) => {
  let channel = String(value || "").trim().replace(/^@+/, "");
  if (!channel) return "";

  try {
    if (/^https?:\/\//i.test(channel)) {
      const url = new URL(channel);
      channel = url.pathname.split("/").filter(Boolean)[0] || "";
    } else {
      channel = channel
        .replace(/^(?:www\.)?twitch\.tv\//i, "")
        .split(/[/?#]/)[0];
    }
  } catch {
    return "";
  }

  return /^[A-Za-z0-9_]{2,25}$/.test(channel) ? channel.toLowerCase() : "";
};

export default function TwitchEmbed({
  channel,
  playerName = "Player",
  className = "",
}) {
  const normalizedChannel = normalizeChannel(channel);

  if (!normalizedChannel) return null;

  return (
    <section
      className={`m8-panel overflow-hidden rounded-2xl border border-[#9146FF]/25 bg-[#0E0B14] ${className}`}
      data-testid="player-twitch-embed"
    >
      <div className="min-h-12 px-4 py-3 flex items-center justify-between gap-3 bg-[#9146FF]/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-lg border border-[#9146FF]/25 bg-[#9146FF]/10 text-[#B88CFF] flex items-center justify-center shrink-0">
            <Radio size={15} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-black tracking-[0.18em] uppercase text-[#A77BFF]">
              Twitch
            </div>
            <div className="text-sm font-bold truncate">
              {playerName} · @{normalizedChannel}
            </div>
          </div>
        </div>

        <a
          href={`https://www.twitch.tv/${encodeURIComponent(normalizedChannel)}`}
          target="_blank"
          rel="noreferrer"
          className="h-8 px-3 rounded-lg border border-[#9146FF]/25 bg-[#9146FF]/10 text-[#C7A6FF] hover:text-white hover:bg-[#9146FF]/20 inline-flex items-center gap-1.5 text-[11px] font-bold shrink-0 transition-colors"
        >
          Open Twitch
          <ExternalLink size={12} />
        </a>
      </div>
    </section>
  );
}
