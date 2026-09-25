import React, { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import ChallengeCenter from "@/components/ChallengeCenter";
import { Bell, Swords, Trophy, ShieldAlert, WalletCards, X, Shield } from "lucide-react";
import { useData } from "@/context/DataContext";

const TITLES = {
  "/": "Dashboard",
  "/players": "Players",
  "/balancer": "Team Balancer",
  "/matches": "Matches",
  "/ranking": "Ranking",
  "/leaderboard": "Ranking",
  "/statistics": "Ranking",
  "/admin": "Admin Panel",
  "/challenges": "Challenge Inbox",
  "/challenge-ranking": "Chall Ranking",
};

export const Layout = () => {
  const loc = useLocation();
  const {
    discordPlayer,
    discordAccount,
    challengeNotificationCount,
    adminChallengeAlertCount,
    isAdmin,
    challenges,
    playerMap,
  } = useData();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notifications = useMemo(() => {
    if (!discordAccount?.id) return [];

    return challenges
      .map((challenge) => {
        const isChallenger = challenge.challenger_account_id === discordAccount.id;
        const opponentId = isChallenger ? challenge.challenged_player_id : challenge.challenger_player_id;
        const opponent = playerMap[opponentId];
        const iWon = challenge.status === "completed" && challenge.reported_winner_player_id === discordPlayer?.id;

        let title = "Challenge updated";
        let tone = "neutral";
        if (challenge.status === "pending" && !isChallenger) {
          title = `New chall from ${opponent?.name || "player"}`;
          tone = "magma";
        } else if (challenge.last_event === "accepted") {
          title = `${opponent?.name || "Player"} accepted the chall`;
          tone = "green";
        } else if (challenge.status === "result_pending") {
          title = "Result waiting for verification";
          tone = "gold";
        } else if (challenge.status === "disputed" || challenge.last_event === "payout_disputed") {
          title = "Challenge dispute opened";
          tone = "orange";
        } else if (challenge.status === "completed") {
          title = iWon ? "Challenge won" : "Challenge lost";
          tone = iWon ? "green" : "red";
        } else if (challenge.last_event === "payout_sent") {
          title = "Payout marked as sent";
          tone = "gold";
        } else if (challenge.last_event === "payout_received") {
          title = "Payout confirmed";
          tone = "green";
        }

        return { challenge, title, opponent, tone };
      })
      .sort((a, b) => new Date(b.challenge.created_at) - new Date(a.challenge.created_at))
      .slice(0, 8);
  }, [challenges, discordAccount, discordPlayer, playerMap]);
  const title = TITLES[loc.pathname] || (loc.pathname.startsWith("/players/") ? "Player Profile" : loc.pathname.startsWith("/challenges/") ? "Challenge Match" : "MuchoMoney8s");

  return (
    <div className="min-h-screen bg-[#0B0D12]">
      <ChallengeCenter />
      <Sidebar />
      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 h-16 flex items-center px-4 sm:px-6 bg-[#0D1016]/88 backdrop-blur-xl border-b border-[#1D222C]">
          <MobileNav />
          <div className="hidden lg:flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-magma" />
            <h1 className="font-display text-[18px] font-bold tracking-tight">{title}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2 relative">
            {isAdmin && (
              <Link
                to="/admin"
                data-testid="header-admin-alerts"
                title={adminChallengeAlertCount > 0 ? `${adminChallengeAlertCount} Admin disputes need review` : "Admin Control Room"}
                className={`relative w-10 h-10 rounded-xl border transition-all flex items-center justify-center ${
                  adminChallengeAlertCount > 0
                    ? "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/15"
                    : "border-[#242A35] bg-[#12151C] text-[#AAB1BE] hover:text-white"
                }`}
              >
                <Shield size={18} />
                {adminChallengeAlertCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-orange-500 border-2 border-[#0D1016] text-black text-[9px] font-extrabold flex items-center justify-center">
                    {adminChallengeAlertCount > 99 ? "99+" : adminChallengeAlertCount}
                  </span>
                )}
              </Link>
            )}
            {discordPlayer && (
              <>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  aria-label={challengeNotificationCount > 0 ? `${challengeNotificationCount} challenge notifications` : "Challenge notifications"}
                  title="Challenge notifications"
                  data-testid="header-challenge-bell"
                  className="relative w-10 h-10 rounded-xl border border-[#242A35] bg-[#12151C] hover:bg-white/[0.05] hover:border-[#343B48] transition-all flex items-center justify-center text-[#AAB1BE] hover:text-white"
                >
                  <Bell size={19} />
                  {challengeNotificationCount > 0 && (
                    <span
                      data-testid="header-challenge-badge"
                      className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-magma border-2 border-[#0D1016] text-white text-[9px] font-extrabold leading-none flex items-center justify-center shadow-[0_0_14px_rgba(255,42,59,0.45)]"
                    >
                      {challengeNotificationCount > 99 ? "99+" : challengeNotificationCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-12 w-[min(92vw,380px)] rounded-2xl border border-[#242A35] bg-[#101319] shadow-2xl overflow-hidden z-50">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#1D222C]">
                      <div>
                        <div className="brand-kicker mb-0.5">Notifications</div>
                        <div className="font-display font-bold">Challenge Center</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="w-8 h-8 rounded-lg bg-[#171B23] border border-[#2A303B] flex items-center justify-center text-muted-foreground hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto p-2">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">No challenge notifications yet.</div>
                      ) : notifications.map(({ challenge, title, opponent, tone }) => {
                        const Icon =
                          tone === "green" ? Trophy :
                          tone === "orange" ? ShieldAlert :
                          tone === "gold" ? WalletCards :
                          Swords;
                        const toneClass =
                          tone === "green" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                          tone === "red" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                          tone === "orange" ? "text-orange-400 bg-orange-500/10 border-orange-500/20" :
                          tone === "gold" ? "text-[#D5A33A] bg-[#D5A33A]/10 border-[#D5A33A]/20" :
                          "text-magma bg-magma/10 border-magma/20";
                        return (
                          <Link
                            key={challenge.id}
                            to={`/challenges/${challenge.id}`}
                            onClick={() => setNotificationsOpen(false)}
                            className="flex items-start gap-3 rounded-xl p-3 hover:bg-white/[0.035] transition-colors"
                          >
                            <div className={`w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center ${toneClass}`}>
                              <Icon size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                vs {opponent?.name || "Player"} · €{(Number(challenge.amount_cents || 0) / 100).toFixed(2)}
                              </div>
                            </div>
                            <span className="text-[10px] text-[#697181] shrink-0">
                              {new Date(challenge.created_at).toLocaleDateString()}
                            </span>
                          </Link>
                        );
                      })}
                    </div>

                    <Link
                      to="/challenges"
                      onClick={() => setNotificationsOpen(false)}
                      className="h-11 border-t border-[#1D222C] flex items-center justify-center text-sm font-semibold text-[#AAB1BE] hover:text-white hover:bg-white/[0.03]"
                    >
                      Open Challenge Inbox
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </header>
        <main className="page-shell p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
