import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, Check, Sparkles, X } from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { getSeasonAwards } from "@/lib/seasonAwards";

const rarityClass = {
  legendary: "border-[#D5A33A]/55 shadow-[0_0_90px_rgba(213,163,58,.16)]",
  epic: "border-[#9B67FF]/45 shadow-[0_0_90px_rgba(145,70,255,.14)]",
  rare: "border-[#4F8BC9]/40 shadow-[0_0_80px_rgba(79,139,201,.11)]",
};

export default function SeasonAwardReveal() {
  const { competitionData, discordPlayer, playerAvatars, publicChallenges } = useData();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const latestArchive = useMemo(
    () =>
      [...(Array.isArray(competitionData?.archives) ? competitionData.archives : [])]
        .sort((a, b) => Number(b?.season_number || 0) - Number(a?.season_number || 0))[0] || null,
    [competitionData?.archives]
  );

  const awards = useMemo(() => {
    if (!latestArchive || !discordPlayer?.id) return [];
    return getSeasonAwards(latestArchive, publicChallenges).filter((award) =>
      (Array.isArray(award?.playerIds) ? award.playerIds : []).map(String).includes(String(discordPlayer.id))
    );
  }, [latestArchive, discordPlayer?.id, publicChallenges]);

  const storageKey = latestArchive && discordPlayer?.id
    ? `mucho8s_season_awards_seen_${latestArchive.season_number}_${discordPlayer.id}`
    : "";

  useEffect(() => {
    if (!storageKey || awards.length === 0) {
      setOpen(false);
      return;
    }

    try {
      if (localStorage.getItem(storageKey) === "1") return;
    } catch {}

    setIndex(0);
    setShowAll(false);
    setOpen(true);
  }, [storageKey, awards.length]);

  const close = () => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, "1");
      } catch {}
    }
    setOpen(false);
  };

  if (!open || !discordPlayer || !latestArchive || awards.length === 0) return null;

  const current = awards[Math.min(index, awards.length - 1)];
  const rarity = String(current?.rarity || "rare").toLowerCase();
  const last = index >= awards.length - 1;

  return (
    <div className="m8-season-reveal" role="dialog" aria-modal="true" aria-label="Season awards">
      <div className="m8-season-reveal-noise" />
      <button
        type="button"
        onClick={close}
        className="absolute right-4 top-4 z-20 w-10 h-10 rounded-xl border border-white/10 bg-black/30 text-white/70 hover:text-white flex items-center justify-center"
        aria-label="Close season awards"
      >
        <X size={18} />
      </button>

      <div className="relative z-10 w-full max-w-5xl px-4 py-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-black text-[#D5A33A]">
            <Sparkles size={13} />
            {latestArchive.season_name || `Season ${latestArchive.season_number}`} Complete
          </div>
          <h2 className="font-display text-3xl sm:text-5xl font-black tracking-[-0.045em] mt-2">
            Your Season Trophies
          </h2>
          <p className="text-sm text-[#8D95A4] mt-2">
            {discordPlayer.name}, you earned {awards.length} permanent Hall of Fame card{awards.length === 1 ? "" : "s"}.
          </p>
        </div>

        {!showAll ? (
          <div className="mt-8 flex justify-center">
            <div
              key={`${current.id}-${index}`}
              className={`m8-season-reveal-card w-full max-w-[470px] rounded-[30px] border bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,.06),rgba(12,16,22,.98)_58%)] p-6 sm:p-8 text-center ${rarityClass[rarity] || rarityClass.rare}`}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-[#AAB1BE]">
                Trophy {index + 1} / {awards.length}
              </div>

              <div className="mt-6 mx-auto w-28 h-28 rounded-[30px] border border-white/10 bg-black/25 flex items-center justify-center text-7xl">
                {current.emoji || "🏆"}
              </div>

              <div className="mt-6 font-display text-2xl sm:text-3xl font-black">{current.title}</div>
              <div className="mt-2 text-sm text-muted-foreground">{current.detail}</div>
              <div className="mt-5 font-mono text-2xl font-black text-white">{current.value || "Award unlocked"}</div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#2A303B] bg-black/20 pr-3">
                <PlayerAvatar
                  name={discordPlayer.name}
                  elo={discordPlayer.currentElo}
                  size={36}
                  avatarUrl={playerAvatars?.[discordPlayer.id]}
                />
                <span className="text-xs font-black">{discordPlayer.name}</span>
              </div>

              <div className="mt-7">
                <Button
                  type="button"
                  onClick={() => {
                    if (last) setShowAll(true);
                    else setIndex((value) => value + 1);
                  }}
                  className="w-full h-12 rounded-xl bg-white hover:bg-[#E8E8E8] text-black font-black"
                >
                  {last ? (
                    <>
                      <Award size={16} className="mr-2" />
                      View All Trophies
                    </>
                  ) : (
                    <>
                      Next Trophy
                      <ArrowRight size={16} className="ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {awards.map((award) => (
                <div key={award.id} className="rounded-[20px] border border-white/10 bg-[#0F1218]/90 p-4 text-center">
                  <div className="text-4xl">{award.emoji || "🏆"}</div>
                  <div className="font-display font-black mt-3">{award.title}</div>
                  <div className="font-mono text-sm font-black mt-1">{award.value || "—"}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{award.detail}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-6">
              <Link
                to="/bacheca/hall-of-fame"
                onClick={close}
                className="h-11 px-5 rounded-xl bg-[#D5A33A] hover:bg-[#E0B247] text-black font-black text-sm inline-flex items-center justify-center"
              >
                <Award size={16} className="mr-2" />
                Open Hall of Fame
              </Link>
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                className="h-11 px-5 border border-[#2A303B]"
              >
                <Check size={16} className="mr-2" />
                Continue
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
