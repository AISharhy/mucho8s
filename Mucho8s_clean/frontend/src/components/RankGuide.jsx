import React from "react";
import { RANKS, rankProgress } from "@/lib/elo";
import {
  Shield,
  Star,
  Crown,
  Gem,
  Swords,
  TrendingUp,
  Trophy,
  Flame,
  Scale,
  CheckCircle2,
} from "lucide-react";

const iconFor = (index) => {
  if (index >= 5) return Crown;
  if (index >= 3) return Gem;
  if (index >= 2) return Star;
  return Shield;
};

export const RankEmblem = ({ elo = 1000, compact = false }) => {
  const info = rankProgress(elo);
  const rank = info.rank;
  const rankIndex = RANKS.findIndex((item) => item.id === rank.id);
  const Icon = iconFor(rankIndex);

  return (
    <div
      className={`relative overflow-hidden border bg-[#0D1016] ${compact ? "rounded-xl px-3 py-2" : "rounded-2xl p-4"}`}
      style={{
        borderColor:
          rankIndex >= 5 ? "#FF2A3B" :
          rankIndex >= 3 ? "#D5A33A" :
          "#343B48",
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-magma to-transparent opacity-80" />
      <div className="flex items-center gap-3">
        <div
          className={`${compact ? "w-10 h-10" : "w-14 h-14"} shrink-0 rotate-45 rounded-xl border flex items-center justify-center bg-[#151923]`}
          style={{ borderColor: rankIndex >= 3 ? "#D5A33A" : "#4A5363" }}
        >
          <div className="-rotate-45 flex flex-col items-center justify-center">
            <Icon
              size={compact ? 18 : 24}
              className={rankIndex >= 3 ? "text-[#D5A33A]" : "text-white"}
            />
            <span className="text-[8px] font-black tracking-tighter">
              {rank.id === "masters" ? "M" : rank.roman}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Divisione {rank.roman}
          </div>
          <div className={`font-display font-black uppercase tracking-wide ${compact ? "text-sm" : "text-xl"}`}>
            {rank.name}
          </div>
          {!compact && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {info.next
                ? `${info.eloNeeded} Elo mancanti per ${info.next.name}`
                : "Hai raggiunto la divisione massima"}
            </div>
          )}
        </div>

        <div className="font-mono font-black text-sm">{elo}</div>
      </div>

      {!compact && (
        <div className="mt-3 h-1.5 rounded-full bg-[#1D222C] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D5A33A] to-[#FF2A3B]"
            style={{ width: `${info.progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

const RuleCard = ({ icon: Icon, title, children, accent = "text-magma" }) => (
  <div className="m8-panel rounded-2xl p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#11151C] border border-[#2A303B] flex items-center justify-center shrink-0">
        <Icon size={18} className={accent} />
      </div>
      <div>
        <div className="font-display font-black text-base">{title}</div>
        <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{children}</div>
      </div>
    </div>
  </div>
);

export default function RankGuide() {
  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">Guida competitiva</div>
        <h1 className="font-display text-3xl font-black tracking-[-0.03em]">Guide</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
          Qui trovi tutto il funzionamento della classifica: come guadagni o perdi Elo,
          come incidono il valore della sfida, l'MVP, la MERDA e quali soglie servono
          per salire di divisione.
        </p>
      </section>

      <section>
        <div className="brand-kicker mb-2">Come cambia l'Elo</div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          <RuleCard icon={Swords} title="Risultato della partita">
            Ogni risultato verificato parte da <strong className="text-white">+25 Elo</strong> per chi vince
            e <strong className="text-white">-25 Elo</strong> per chi perde.
          </RuleCard>

          <RuleCard icon={TrendingUp} title="Valore della sfida" accent="text-emerald-400">
            Il valore virtuale si somma al risultato. Con valore 5 il totale base diventa
            <strong className="text-white"> +30 / -30</strong>; con valore 20 diventa
            <strong className="text-white"> +45 / -45</strong>.
          </RuleCard>

          <RuleCard icon={Trophy} title="MVP 🏆" accent="text-[#D5A33A]">
            L'MVP vale <strong className="text-white">+3 Elo</strong> aggiuntivi.
            Esempio: vittoria con valore 5 e MVP = <strong className="text-white">+33 Elo</strong>.
          </RuleCard>

          <RuleCard icon={Flame} title="MERDA 💩" accent="text-[#C79A6B]">
            La MERDA non toglie Elo. Ogni <strong className="text-white">4 sconfitte consecutive</strong>
            ricevi 1 💩; ogni <strong className="text-white">4 vittorie consecutive</strong>
            elimini 1 💩 attiva.
          </RuleCard>

          <RuleCard icon={CheckCircle2} title="Solo risultati verificati" accent="text-emerald-400">
            La classifica cambia soltanto quando il risultato è verificato e bloccato.
            Modifiche tecniche dell'Admin non generano notifiche ai giocatori.
          </RuleCard>

          <RuleCard icon={Scale} title="Limite minimo">
            L'Elo non può scendere sotto <strong className="text-white">500</strong>.
            Non esistono bonus sorpresa o bonus upset: il calcolo resta leggibile e prevedibile.
          </RuleCard>
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">Esempi rapidi</div>
        <h2 className="font-display text-xl font-black">Quanto guadagni o perdi</h2>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          {[
            { value: 1, win: 26, loss: -26 },
            { value: 5, win: 30, loss: -30 },
            { value: 12, win: 37, loss: -37 },
            { value: 20, win: 45, loss: -45 },
          ].map((row) => (
            <div key={row.value} className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Valore {row.value}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="font-mono font-black text-emerald-400">+{row.win}</span>
                <span className="text-xs text-muted-foreground">vittoria</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="font-mono font-black text-red-400">{row.loss}</span>
                <span className="text-xs text-muted-foreground">sconfitta</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-3">
                Con MVP aggiungi altri +3 Elo.
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">Bilanciamento squadre</div>
        <h2 className="font-display text-xl font-black">Come funziona il bilanciamento automatico</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Il bilanciamento automatico serve soltanto a creare squadre più equilibrate: non modifica direttamente
          l'Elo. Tiene conto soprattutto del picco Elo, poi dell'Elo attuale e della percentuale di
          vittorie. Quando scegli gioco o modalità, usa anche lo storico specifico di quel contesto;
          più partite hai in quel contesto, più quel dato pesa.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
            <div className="font-mono font-black text-lg">60%</div>
            <div className="text-xs text-muted-foreground mt-1">Picco Elo</div>
          </div>
          <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
            <div className="font-mono font-black text-lg">25%</div>
            <div className="text-xs text-muted-foreground mt-1">Elo attuale</div>
          </div>
          <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
            <div className="font-mono font-black text-lg">15%</div>
            <div className="text-xs text-muted-foreground mt-1">Percentuale vittorie</div>
          </div>
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">Encomi</div>
        <h2 className="font-display text-xl font-black">Premi partita separati dall'Elo</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Gli encomi premiano situazioni particolari e danno punti encomio, ma
          <strong className="text-white"> non modificano l'Elo</strong>. Sono stati
          bilanciati per essere più rari dei normali risultati, senza pesare sulla classifica.
        </p>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
          {[
            ["Spezza serie", "3–6 punti", "Interrompi una serie di almeno 3 vittorie"],
            ["Spezza duo", "6 punti", "Batti un duo imbattuto con almeno 3 partite"],
            ["Ammazzagrandi", "5 punti", "Vinci partendo da sfavoriti"],
            ["Rivincita", "2 punti", "Batti chi ti aveva appena sconfitto"],
            ["Rivalità", "2 punti", "Vinci uno scontro testa a testa equilibrato"],
          ].map(([title, points, detail]) => (
            <div key={title} className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
              <div className="font-display font-black text-sm">{title}</div>
              <div className="font-mono text-xs text-[#D5A33A] mt-2">{points}</div>
              <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="brand-kicker mb-2">Divisioni</div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {RANKS.map((rank, index) => {
            const Icon = iconFor(index);
            const next = RANKS[index + 1];

            return (
              <div
                key={rank.name}
                className="m8-panel rounded-2xl p-5 relative overflow-hidden"
                style={{ borderColor: rank.color + "38" }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-[2px] opacity-85"
                  style={{ background: "linear-gradient(90deg, transparent, " + rank.color + ", transparent)" }}
                />

                <div
                  className="w-16 h-16 mx-auto rotate-45 rounded-2xl border bg-[#0F1218] flex items-center justify-center"
                  style={{
                    borderColor: rank.color + "66",
                    boxShadow: "0 10px 28px " + rank.color + "18",
                  }}
                >
                  <div className="-rotate-45 text-center">
                    <Icon size={26} className="mx-auto" style={{ color: rank.color }} />
                    <div className="text-[9px] font-black mt-0.5">
                      {rank.id === "masters" ? "M" : rank.roman}
                    </div>
                  </div>
                </div>

                <div className="text-center mt-5">
                  <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                    Divisione {rank.roman}
                  </div>
                  <div
                    className="font-display text-xl font-black uppercase mt-1"
                    style={{ color: rank.color }}
                  >
                    {rank.name}
                  </div>
                  <div className="font-mono text-sm mt-2" style={{ color: rank.color }}>
                    {next ? `${rank.min} – ${rank.max} ELO` : `${rank.min}+ ELO`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {next
                      ? `Raggiungi ${next.min} Elo per ${next.name}`
                      : "Divisione più alta"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">In sintesi</div>
        <h2 className="font-display text-xl font-black">Come salire</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Vinci partite verificate, mantieni serie positive e prova a conquistare l'MVP.
          Il valore virtuale della sfida aumenta allo stesso modo sia il guadagno sia la perdita.
          La MERDA è invece un indicatore di serie negativa e non modifica l'Elo.
        </p>
      </section>
    </div>
  );
}
