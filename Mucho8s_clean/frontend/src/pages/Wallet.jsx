import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Clock3, FlaskConical, History, LockKeyhole, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatWalletMoney as money, parseWalletAmount, walletRequest } from "@/lib/wallet";

const statusNames={pending:"In attesa",completed:"Completata",rejected:"Rifiutata",cancelled:"Annullata"};
const movementNames={deposit:"Ricarica di prova",withdrawal_hold:"Importo bloccato",withdrawal_release:"Importo sbloccato",withdrawal:"Prelievo di prova"};
const providerNames={paypal:"PayPal",revolut:"Revolut"};
const date=(value)=>new Date(value).toLocaleString("it-IT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const emptyWallet={balance_cents:0,reserved_cents:0};

function Status({value}) {
  return <span className={`text-xs rounded-full px-2.5 py-1 border ${value==="completed" ? "text-emerald-300 border-emerald-500/25 bg-emerald-500/10" : value==="pending" ? "text-amber-300 border-amber-500/25 bg-amber-500/10" : "text-muted-foreground border-white/10"}`}>{statusNames[value] || value}</span>;
}

export default function Wallet() {
  const {discordSession,discordAccount,discordPlayer,discordLoading,signInWithDiscord,isAdmin,admin}=useData();
  const [data,setData]=useState(null);
  const [adminRows,setAdminRows]=useState([]);
  const [adminError,setAdminError]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [dialog,setDialog]=useState("");
  const [provider,setProvider]=useState("paypal");
  const [amount,setAmount]=useState("10");
  const [destination,setDestination]=useState("");
  const [review,setReview]=useState(null);
  const [note,setNote]=useState("");
  const retry=useRef(null);
  const eligible=Boolean(discordSession?.user?.id && discordAccount?.player_id);
  const identity=useRef("");
  const currentIdentity=eligible ? `${discordAccount.id}:${isAdmin ? admin?.sessionToken : ""}` : "";
  identity.current=currentIdentity;

  const refresh=useCallback(async (silent=false)=>{
    if (!eligible) return;
    const owner=currentIdentity;
    if (!silent) setLoading(true);
    try {
      const result=await walletRequest({action:"get"});
      if (identity.current!==owner) return;
      setData(result);setError("");
      if (isAdmin) {
        try {
          const result=await walletRequest({action:"admin_list"},admin.sessionToken);
          if (identity.current===owner) {setAdminRows(result.requests || []);setAdminError("");}
        } catch (e) {if (identity.current===owner) setAdminError(e.message);}
      }
    } catch (e) {if (identity.current===owner) setError(e.message);}
    finally {if (identity.current===owner && !silent) setLoading(false);}
  },[eligible,currentIdentity,isAdmin,admin?.sessionToken]);

  useEffect(()=>{
    setData(null);setAdminRows([]);setError("");setAdminError("");setDialog("");setReview(null);retry.current=null;
    if (!eligible) return;
    void refresh();
    const timer=setInterval(()=>{if (document.visibilityState==="visible") void refresh(true);},15000);
    return ()=>clearInterval(timer);
  },[eligible,currentIdentity,refresh]);

  const open=(kind)=>{
    setProvider("paypal");setAmount("10");setDestination(discordAccount?.paypal_url || "");retry.current=null;setDialog(kind);
  };
  const changeProvider=(value)=>{setProvider(value);setDestination(discordAccount?.[`${value}_url`] || "");};
  const submit=async (event)=>{
    event.preventDefault();if (busy) return;
    try {
      const cents=parseWalletAmount(amount);
      if (destination.trim().length<2) throw new Error("Inserisci il nome, l’email o il tag del conto.");
      if (dialog==="withdrawal" && cents>available) throw new Error("Saldo disponibile insufficiente.");
      const payload={action:"request",kind:dialog,provider,amount_cents:cents,destination:destination.trim()};
      const fingerprint=JSON.stringify(payload);
      if (retry.current?.fingerprint!==fingerprint) retry.current={fingerprint,key:crypto.randomUUID()};
      setBusy(true);
      await walletRequest({...payload,key:retry.current.key});
      retry.current=null;setDialog("");toast.success("Richiesta di prova inviata. Nessun denaro trasferito.");await refresh(true);
    } catch (e) {toast.error(e.message);} finally {setBusy(false);}
  };
  const cancel=async (id)=>{
    if (busy) return;setBusy(true);
    try {await walletRequest({action:"cancel",id});toast.success("Richiesta annullata.");await refresh(true);}
    catch(e){toast.error(e.message);}finally{setBusy(false);}
  };
  const handleReview=async ()=>{
    if (busy || !review) return;setBusy(true);
    try {
      await walletRequest({action:"admin_review",id:review.row.id,decision:review.decision,note},admin.sessionToken);
      setReview(null);toast.success("Richiesta di prova aggiornata.");await refresh(true);
    }catch(e){toast.error(e.message);}finally{setBusy(false);}
  };
  const wallet=data?.wallet || emptyWallet;
  const available=wallet.balance_cents-wallet.reserved_cents;
  const requests=data?.requests || [];
  const pending=adminRows.filter(row=>row.status==="pending");

  return <div className="space-y-6 max-w-6xl mx-auto" data-testid="wallet-page">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="brand-kicker text-emerald-400 mb-2">MUCHO WALLET</div><h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3"><WalletCards className="text-emerald-400"/>Il tuo wallet</h1><p className="text-sm text-muted-foreground mt-2">Saldo, richieste e movimenti in un unico posto.</p></div>
      <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-200 text-xs font-bold"><FlaskConical size={15}/>MODALITÀ PROVA</span>
    </header>
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100 flex gap-3"><FlaskConical size={20} className="shrink-0 mt-0.5"/><p><strong>Il saldo è virtuale.</strong> PayPal e Revolut sono metodi di prova: ricariche e prelievi simulano il flusso con conferma admin. Non inviare denaro. Le chall continuano a usare il loro pagamento attuale.</p></div>
    {discordLoading ? <p role="status" className="text-muted-foreground">Controllo accesso…</p> : !eligible ? <section className="m8-panel rounded-2xl p-8 text-center space-y-4"><LockKeyhole className="mx-auto text-emerald-400" size={32}/><h2 className="text-xl font-bold">Il wallet è riservato al Circle</h2><p className="text-sm text-muted-foreground">Accedi con Discord e usa il tuo profilo approvato per visualizzare il saldo personale.</p>{!discordSession ? <Button onClick={signInWithDiscord}>Accedi con Discord</Button> : <Link to="/" className="inline-block text-emerald-300 underline">Vai al tuo profilo e verifica l’accesso</Link>}</section> : <>
      {error && <div role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-200 flex flex-wrap gap-3 justify-between"><span>{error}</span><Button size="sm" variant="outline" disabled={loading} onClick={()=>refresh()}>Riprova</Button></div>}
      <div className="grid sm:grid-cols-3 gap-4" aria-busy={loading}>
        {[{label:"Disponibile",value:available,icon:WalletCards,color:"text-emerald-300"},{label:"Bloccato per prelievi",value:wallet.reserved_cents,icon:LockKeyhole,color:"text-amber-300"},{label:"Saldo totale",value:wallet.balance_cents,icon:History,color:"text-white"}].map(({label,value,icon:Icon,color})=><section key={label} className="m8-panel rounded-2xl p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><Icon size={18}/></div><div className={`text-3xl sm:text-4xl font-black mt-4 tabular-nums ${color}`}>{data ? money(value) : "—"}</div><div className="text-xs text-muted-foreground mt-2">Saldo virtuale · EUR</div></section>)}
      </div>
      <div className="flex flex-wrap gap-3 items-center"><Button className="bg-emerald-500 text-black hover:bg-emerald-400 gap-2" disabled={!data || busy} onClick={()=>open("deposit")}><ArrowDownLeft size={17}/>Ricarica di prova</Button><Button variant="outline" className="gap-2" disabled={!data || busy || available<100} onClick={()=>open("withdrawal")}><ArrowUpRight size={17}/>Prelievo di prova</Button><Button variant="ghost" size="sm" disabled={loading || busy} onClick={()=>refresh()} aria-label="Aggiorna wallet"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/></Button><span className="text-xs text-muted-foreground">{discordPlayer?.name || "Il tuo conto"} · {requests.filter(row=>row.status==="pending").length} richieste in attesa</span></div>
      <div className="grid sm:grid-cols-2 gap-4">{["paypal","revolut"].map(method=><section key={method} className="m8-panel rounded-2xl p-5 flex items-center justify-between gap-3"><div><h2 className="font-bold text-lg">{providerNames[method]}</h2><p className="text-xs text-muted-foreground mt-1">Nome, email o {method==="revolut" ? "Revtag" : "PayPal.me"} · flusso simulato</p></div><span className="text-xs text-amber-200 border border-amber-400/20 rounded-full px-3 py-1">Prova</span></section>)}</div>
      <Tabs defaultValue="requests" className="m8-panel rounded-2xl p-4 sm:p-6">
        <TabsList className="flex flex-wrap h-auto justify-start gap-1"><TabsTrigger value="requests"><Clock3 size={15} className="mr-2"/>Richieste</TabsTrigger><TabsTrigger value="transactions"><History size={15} className="mr-2"/>Movimenti</TabsTrigger>{isAdmin && <TabsTrigger value="admin"><ShieldCheck size={15} className="mr-2"/>Gestione admin {pending.length>0 && `(${pending.length})`}</TabsTrigger>}</TabsList>
        <TabsContent value="requests" className="mt-5"><h2 className="font-bold mb-4">Le tue ultime richieste</h2>{requests.length===0 ? <p className="text-sm text-muted-foreground py-8 text-center">{loading ? "Caricamento…" : "Nessuna richiesta. Inizia con una ricarica di prova."}</p> : <div className="divide-y divide-white/5">{requests.map(row=><div key={row.id} className="py-4 flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold text-sm">{row.kind==="deposit" ? "Ricarica" : "Prelievo"} · {providerNames[row.provider]}</div><div className="text-xs text-muted-foreground mt-1">{date(row.created_at)} · {row.destination}</div>{row.review_note && <p className="text-xs text-muted-foreground mt-1">Nota admin: {row.review_note}</p>}</div><div className="flex flex-wrap items-center gap-3"><strong className="tabular-nums">{money(row.amount_cents)}</strong><Status value={row.status}/>{row.status==="pending" && <Button size="sm" variant="ghost" disabled={busy} onClick={()=>cancel(row.id)}>Annulla</Button>}</div></div>)}</div>}</TabsContent>
        <TabsContent value="transactions" className="mt-5"><h2 className="font-bold mb-4">Ultimi movimenti di prova</h2>{!data?.transactions?.length ? <p className="text-sm text-muted-foreground py-8 text-center">Nessun movimento registrato.</p> : <div className="divide-y divide-white/5">{data.transactions.map(row=><div key={row.id} className="py-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{movementNames[row.kind]}</p><p className="text-xs text-muted-foreground mt-1">{date(row.created_at)} · Saldo {money(row.balance_cents)} · Bloccato {money(row.reserved_cents)}</p></div><strong className={`tabular-nums whitespace-nowrap ${row.amount_cents>0 ? "text-emerald-300" : "text-amber-300"}`}>{row.amount_cents>0 ? "+" : ""}{money(row.amount_cents)}</strong></div>)}</div>}</TabsContent>
        {isAdmin && <TabsContent value="admin" className="mt-5"><h2 className="font-bold mb-2">Richieste dei membri</h2><p className="text-xs text-muted-foreground mb-4">Le conferme modificano esclusivamente il saldo virtuale.</p>{adminError && <p role="alert" className="text-red-200 text-sm mb-4">{adminError}</p>}{adminRows.length===0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nessuna richiesta da gestire.</p> : <div className="divide-y divide-white/5">{adminRows.map(row=><div key={row.id} className="py-4 flex flex-wrap justify-between items-center gap-3"><div><div className="font-semibold text-sm">{row.player_accounts?.display_name || "Membro"} · {row.kind==="deposit" ? "Ricarica" : "Prelievo"} · {providerNames[row.provider]}</div><p className="text-xs text-muted-foreground mt-1">{row.destination} · {date(row.created_at)}</p></div><div className="flex flex-wrap items-center gap-2"><strong className="mr-2 tabular-nums">{money(row.amount_cents)}</strong><Status value={row.status}/>{row.status==="pending" && <><Button size="sm" disabled={busy} className="bg-emerald-600 hover:bg-emerald-500" onClick={()=>{setNote("");setReview({row,decision:"completed"});}}>Conferma prova</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>{setNote("");setReview({row,decision:"rejected"});}}>Rifiuta</Button></>}</div></div>)}</div>}</TabsContent>}
      </Tabs>
    </>}
    <Dialog open={Boolean(dialog)} onOpenChange={(value)=>{if (!value && !busy) setDialog("");}}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{dialog==="deposit" ? "Ricarica di prova" : "Prelievo di prova"}</DialogTitle><DialogDescription>Simula una richiesta tramite PayPal o Revolut. Nessun pagamento verrà eseguito.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5 mt-2"><div><Label>Metodo</Label><div className="grid grid-cols-2 gap-2 mt-2" role="group" aria-label="Metodo di pagamento">{["paypal","revolut"].map(method=><Button key={method} type="button" variant={provider===method ? "default" : "outline"} aria-pressed={provider===method} disabled={busy} onClick={()=>changeProvider(method)}>{providerNames[method]}</Button>)}</div></div><div><Label htmlFor="wallet-amount">Importo virtuale (€)</Label><Input id="wallet-amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy} maxLength={7} required className="mt-2"/><p className="text-xs text-muted-foreground mt-2">Da 1 € a 1.000 €{dialog==="withdrawal" ? ` · Disponibile ${money(available)}` : ""}</p></div><div><Label htmlFor="wallet-destination">{dialog==="withdrawal" ? "Conto destinatario di prova" : "Conto mittente di prova"}</Label><Input id="wallet-destination" value={destination} onChange={e=>setDestination(e.target.value)} disabled={busy} minLength={2} maxLength={200} placeholder={provider==="paypal" ? "Nome, email o PayPal.me" : "Nome o @Revtag"} required className="mt-2"/></div><p className="text-xs text-amber-200 bg-amber-400/10 rounded-xl p-3">{dialog==="withdrawal" ? "L’importo virtuale viene bloccato fino alla conferma admin. Se annulli o la richiesta viene rifiutata, torna disponibile." : "Il saldo virtuale aumenta solo dopo la conferma admin. Non inviare denaro."}</p><Button type="submit" className="w-full" disabled={busy}>{busy ? "Invio…" : "Invia richiesta di prova"}</Button></form></DialogContent></Dialog>
    <Dialog open={Boolean(review)} onOpenChange={value=>{if (!value && !busy) setReview(null);}}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{review?.decision==="completed" ? "Conferma operazione di prova" : "Rifiuta richiesta"}</DialogTitle><DialogDescription>{review?.row && `${money(review.row.amount_cents)} · ${providerNames[review.row.provider]} · ${review.row.player_accounts?.display_name || "Membro"}. Solo saldo virtuale; nessun trasferimento di denaro.`}</DialogDescription></DialogHeader><Label htmlFor="wallet-review-note">Nota facoltativa</Label><Input id="wallet-review-note" maxLength={300} value={note} onChange={e=>setNote(e.target.value)} disabled={busy}/><Button disabled={busy} onClick={handleReview}>{busy ? "Aggiornamento…" : review?.decision==="completed" ? "Conferma prova" : "Rifiuta richiesta"}</Button></DialogContent></Dialog>
  </div>;
}
