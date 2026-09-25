import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { winRate, tierOf } from "@/lib/elo";
import { PlayerAvatar, EloBadge, Last10, StreakBadge, MvpBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Crown,
  Gamepad2,
  Target,
  Trophy,
  TrendingUp,
  ExternalLink,
  Save,
  Link2,
  Swords,
  CreditCard,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";

export default function PlayerProfile() {
  const { id } = useParams();
  const {
    players,
    matches,
    playerMap,
    playerAvatars,
    playerProfiles,
    discordPlayer,
    discordSession,
    saveMyChallengeLinks,
    challenges,
    createChallenge,
    reportChallengeResult,
  } = useData();

  const player = players.find((p) => p.id === id);
  const publicProfile = playerProfiles?.[id] || {};
  const isOwnProfile = Boolean(discordSession && discordPlayer?.id === id);

  const [links, setLinks] = useState({
    paypalUrl: "",
    revolutUrl: "",
    cmgUrl: "",
  });
  const [savingLinks, setSavingLinks] = useState(false);
  const [sendingChallenge, setSendingChallenge] = useState("");

  useEffect(() => {
    setLinks({
      paypalUrl: publicProfile.paypalUrl || "",
      revolutUrl: publicProfile.revolutUrl || "",
      cmgUrl: publicProfile.cmgUrl || "",
    });
  }, [id, publicProfile.paypalUrl, publicProfile.revolutUrl, publicProfile.cmgUrl]);

  const playerMatches = useMemo(() => {
    if (!player) return [];
    return matches
      .filter((m) => m.teamA.includes(player.id) || m.teamB.includes(player.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [matches, player]);

  if (!player) {
    return (
      <div className="card-surface rounded-xl p-10 text-center">
        <div className="text-xl font-display font-bold mb-2">Player not found</div>
        <Link to="/players" className="text-magma hover:underline">Back to players</Link>
      </div>
    );
  }

  const tier = tierOf(player.currentElo);
  const stats = [
    { label: "Current Elo", value: player.currentElo, icon: TrendingUp },
    { label: "Peak Elo", value: player.peakElo, icon: Trophy },
    { label: "Matches", value: player.totalMatches, icon: Gamepad2 },
    { label: "Win Rate", value: `${winRate(player)}%`, icon: Target },
    { label: "Wins", value: player.wins },
    { label: "Losses", value: player.losses },
    { label: "MVP", value: player.mvpCount, icon: Crown },
  ];

  const challengeLinks = [
    { key: "paypal", label: "PayPal", url: publicProfile.paypalUrl, className: "bg-[#0070BA] hover:bg-[#0a7bc7]", icon: CreditCard },
    { key: "revolut", label: "Revolut", url: publicProfile.revolutUrl, className: "bg-white hover:bg-[#eceef2] text-black", icon: CreditCard },
    { key: "cmg", label: "CMG", url: publicProfile.cmgUrl, className: "bg-magma hover:bg-[#ff3c4c]", icon: Swords },
  ].filter((item) => item.url);

  const saveLinks = async () => {
    setSavingLinks(true);
    const ok = await saveMyChallengeLinks(links);
    setSavingLinks(false);
    if (ok) toast.success("Challenge links updated");
  };

  const sendChallenge = async (platform) => {
    if (!discordSession || !discordPlayer) {
      toast.error("Login with Discord and link your player before sending a challenge");
      return;
    }

    setSendingChallenge(platform);
    const created = await createChallenge(player.id, platform);
    setSendingChallenge("");

    if (created) {
      toast.success(`Challenge sent to ${player.name} — waiting for acceptance`);
    }
  };

  const myChallenges = isOwnProfile
    ? challenges.filter(
        (challenge) =>
          challenge.challenger_player_id === player.id ||
          challenge.challenged_player_id === player.id
      )
    : [];

  const reportWinner = async (challenge, winnerPlayerId) => {
    const updated = await reportChallengeResult(challenge.id, winnerPlayerId);
    if (updated) {
      toast.success("Result submitted — the other player must verify it");
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/players" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white">
        <ArrowLeft size={16} /> Back to Players
      </Link>

      <div className="brand-card rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <PlayerAvatar
            name={player.name}
            elo={player.currentElo}
            size={82}
            avatarUrl={playerAvatars[player.id]}
          />
          <div className="min-w-0 flex-1">
            <div className="brand-kicker mb-1">{isOwnProfile ? "My Profile" : "Player Profile"}</div>
            <h2 className="font-display text-3xl font-extrabold truncate">{player.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: tier.color }}>{tier.name}</span>
              <EloBadge elo={player.currentElo} />
              <StreakBadge streak={player.currentStreak} />
            </div>
          </div>

          {!isOwnProfile && challengeLinks.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-11 px-5 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-extrabold tracking-wide magma-glow"
                  data-testid="challenge-me-btn"
                >
                  <Swords size={17} className="mr-2" /> CHALL ME
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-56 rounded-xl border-[#2A303B] bg-[#101319] p-2 shadow-2xl"
              >
                <DropdownMenuLabel className="px-2 py-2">
                  <div className="brand-kicker mb-1">Challenge {player.name}</div>
                  <div className="text-sm font-semibold text-white">Choose platform</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#242A35]" />
                {challengeLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.key}
                      onSelect={() => sendChallenge(item.key)}
                      disabled={Boolean(sendingChallenge)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#D7DBE2] focus:bg-white/[0.05] focus:text-white cursor-pointer"
                      data-testid={`challenge-link-${item.key}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#171B23] border border-[#2A303B] flex items-center justify-center">
                        <Icon size={15} />
                      </div>
                      <span className="flex-1">
                        {sendingChallenge === item.key ? "Sending..." : item.label}
                      </span>
                      <Swords size={13} className="text-[#697181]" />
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
          {stats.map((item) => (
            <div key={item.label} className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
              <div className="font-mono font-bold text-lg mt-1">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Last 10</span>
          <Last10 record={player.last10} />
          <MvpBadge count={player.mvpCount} />
        </div>
      </div>

      {isOwnProfile && (
        <div className="card-surface rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="brand-kicker mb-1">Challenge</div>
              <h3 className="font-display font-bold text-lg">Your Challenge Links</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add the pages other players should use when they press CHALL ME.
              </p>
            </div>
            <Link2 size={18} className="text-[#697181] shrink-0 mt-1" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">PayPal link</Label>
              <Input
                value={links.paypalUrl}
                onChange={(e) => setLinks((prev) => ({ ...prev, paypalUrl: e.target.value }))}
                placeholder="https://paypal.me/..."
                className="mt-1 bg-[#0F1218] border-[#222834]"
                data-testid="my-paypal-link"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Revolut link</Label>
              <Input
                value={links.revolutUrl}
                onChange={(e) => setLinks((prev) => ({ ...prev, revolutUrl: e.target.value }))}
                placeholder="https://revolut.me/..."
                className="mt-1 bg-[#0F1218] border-[#222834]"
                data-testid="my-revolut-link"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">CMG profile / challenge link</Label>
              <Input
                value={links.cmgUrl}
                onChange={(e) => setLinks((prev) => ({ ...prev, cmgUrl: e.target.value }))}
                placeholder="https://..."
                className="mt-1 bg-[#0F1218] border-[#222834]"
                data-testid="my-cmg-link"
              />
            </div>

            <div className="lg:col-span-3 flex justify-end">
              <Button
                onClick={saveLinks}
                disabled={savingLinks}
                className="w-full sm:w-auto bg-magma hover:bg-[#ff3c4c] text-white rounded-xl"
                data-testid="save-challenge-links"
              >
                <Save size={15} className="mr-1.5" />
                {savingLinks ? "Saving..." : "Save Challenge Links"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isOwnProfile && (
        <div className="card-surface rounded-2xl p-4 sm:p-5" data-testid="my-challenges-panel">
          <div className="mb-4">
            <div className="brand-kicker mb-1">Challenge Center</div>
            <h3 className="font-display font-bold text-lg">My Challenges</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Results become official only after the other player verifies them.
            </p>
          </div>

          {myChallenges.length === 0 ? (
            <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-8 px-4 text-center text-sm text-muted-foreground">
              No challenges yet.
            </div>
          ) : (
            <div className="space-y-2">
              {myChallenges.slice(0, 12).map((challenge) => {
                const opponentId =
                  challenge.challenger_player_id === player.id
                    ? challenge.challenged_player_id
                    : challenge.challenger_player_id;
                const opponent = playerMap[opponentId];
                const winner = playerMap[challenge.reported_winner_player_id];
                const iReported = challenge.reporter_account_id === discordSession?.user?.id;
                const isChallenger = challenge.challenger_player_id === player.id;

                return (
                  <div key={challenge.id} className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <PlayerAvatar
                        name={opponent?.name || "Player"}
                        elo={opponent?.currentElo || 1000}
                        size={40}
                        avatarUrl={playerAvatars[opponentId]}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">vs {opponent?.name || "Player"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {String(challenge.platform || "").toUpperCase()} · {new Date(challenge.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="text-xs font-bold uppercase tracking-wider">
                        {challenge.status === "pending" && <span className="text-[#D5A33A]">Pending</span>}
                        {challenge.status === "accepted" && <span className="text-emerald-400">Accepted</span>}
                        {challenge.status === "result_pending" && <span className="text-[#8E98FF]">Verification</span>}
                        {challenge.status === "completed" && <span className="text-emerald-400">Verified</span>}
                        {challenge.status === "declined" && <span className="text-red-400">Declined</span>}
                        {challenge.status === "disputed" && <span className="text-orange-400">Disputed</span>}
                        {challenge.status === "cancelled" && <span className="text-muted-foreground">Cancelled</span>}
                      </div>
                    </div>

                    {challenge.status === "accepted" && (
                      <div className="mt-3 pt-3 border-t border-[#1D222C]">
                        <div className="text-xs text-muted-foreground mb-2">Report the result after the challenge is finished:</div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            onClick={() => reportWinner(challenge, player.id)}
                            className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                          >
                            I WON
                          </Button>
                          <Button
                            onClick={() => reportWinner(challenge, opponentId)}
                            className="flex-1 rounded-xl bg-[#171B23] border border-[#2A303B] text-white hover:bg-white/[0.05]"
                          >
                            {opponent?.name || "Opponent"} WON
                          </Button>
                          {isChallenger && challenge.target_url && (
                            <a
                              href={challenge.target_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-10 px-4 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                            >
                              Open {String(challenge.platform || "").toUpperCase()} <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {challenge.status === "result_pending" && (
                      <div className="mt-3 pt-3 border-t border-[#1D222C] text-sm">
                        <span className="text-muted-foreground">Reported winner: </span>
                        <span className="font-semibold text-white">{winner?.name || "Unknown"}</span>
                        <span className="text-muted-foreground">
                          {iReported ? " · waiting for opponent verification" : " · verify the result in the popup"}
                        </span>
                      </div>
                    )}

                    {challenge.status === "completed" && (
                      <div className="mt-3 pt-3 border-t border-[#1D222C] text-sm">
                        <span className="text-muted-foreground">Verified winner: </span>
                        <span className="font-bold text-emerald-400">{winner?.name || "Unknown"}</span>
                      </div>
                    )}

                    {challenge.status === "disputed" && (
                      <div className="mt-3 pt-3 border-t border-[#1D222C] text-sm text-orange-300">
                        Result disputed. The challenge is not counted as completed.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card-surface rounded-2xl p-4 sm:p-5">
        <h3 className="font-display font-bold text-lg mb-4">Elo History</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={player.eloHistory || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1D222C" vertical={false} />
              <XAxis dataKey="match" stroke="#4B5563" fontSize={11} />
              <YAxis domain={["dataMin - 30", "dataMax + 30"]} stroke="#4B5563" fontSize={11} width={45} />
              <Tooltip
                contentStyle={{ background: "#101319", border: "1px solid #242A35", borderRadius: 8 }}
                labelStyle={{ color: "#9CA3AF" }}
              />
              <Line type="monotone" dataKey="elo" stroke="#FF2A3B" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-surface rounded-2xl p-4 sm:p-5">
        <h3 className="font-display font-bold text-lg mb-4">Recent Matches</h3>
        <div className="space-y-2">
          {playerMatches.slice(0, 10).map((m) => {
            const winners = m.winner === "A" ? m.teamA : m.teamB;
            const won = winners.includes(player.id);
            const teammates = (m.teamA.includes(player.id) ? m.teamA : m.teamB)
              .filter((pid) => pid !== player.id)
              .map((pid) => playerMap[pid]?.name)
              .filter(Boolean);
            const delta = Number(m.eloChanges?.[player.id] || 0);

            return (
              <div key={m.id} className="interactive-row flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl p-3">
                <div className={`font-bold text-sm ${won ? "text-emerald-400" : "text-red-400"}`}>
                  {won ? "WIN" : "LOSS"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{m.game || "Game"} · {m.mode || "Mode"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    With {teammates.length ? teammates.join(", ") : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {m.mvpId === player.id && <Crown size={15} className="text-[#D5A33A]" />}
                  <span className={`font-mono text-sm ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {delta >= 0 ? "+" : ""}{delta} Elo
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}

          {playerMatches.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">No matches recorded for this player yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
