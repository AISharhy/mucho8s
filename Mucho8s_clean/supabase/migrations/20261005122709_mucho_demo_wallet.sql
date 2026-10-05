-- Demo wallet only: no payment provider calls, real deposits or match payouts.
create table public.mucho_wallets (
  account_id uuid primary key references public.player_accounts(id),
  balance_cents integer not null default 0 check (balance_cents >= 0),
  reserved_cents integer not null default 0 check (reserved_cents >= 0 and reserved_cents <= balance_cents),
  currency text not null default 'EUR' check (currency = 'EUR'),
  mode text not null default 'demo' check (mode = 'demo'),
  updated_at timestamptz not null default now()
);
create table public.mucho_wallet_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mucho_wallets(account_id),
  idempotency_key uuid not null,
  kind text not null check (kind in ('deposit','withdrawal')),
  provider text not null check (provider in ('paypal','revolut')),
  amount_cents integer not null check (amount_cents between 100 and 100000),
  destination text not null check (length(destination) between 2 and 200),
  status text not null default 'pending' check (status in ('pending','completed','rejected','cancelled')),
  mode text not null default 'demo' check (mode = 'demo'),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text not null default '' check (length(review_note) <= 300),
  unique (account_id,idempotency_key)
);
create index mucho_wallet_requests_account_date on public.mucho_wallet_requests(account_id,created_at desc);
create index mucho_wallet_requests_pending on public.mucho_wallet_requests(created_at) where status = 'pending';
create table public.mucho_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mucho_wallets(account_id),
  request_id uuid not null references public.mucho_wallet_requests(id),
  kind text not null check (kind in ('deposit','withdrawal_hold','withdrawal_release','withdrawal')),
  amount_cents integer not null,
  balance_cents integer not null,
  reserved_cents integer not null,
  created_at timestamptz not null default now(),
  unique (request_id,kind)
);
create index mucho_wallet_transactions_account_date on public.mucho_wallet_transactions(account_id,created_at desc);
-- Only the authenticated Edge Function's service role can access this data.
alter table public.mucho_wallets enable row level security;
alter table public.mucho_wallet_requests enable row level security;
alter table public.mucho_wallet_transactions enable row level security;
revoke all on public.mucho_wallets, public.mucho_wallet_requests, public.mucho_wallet_transactions from public, anon, authenticated;
grant select,insert,update on public.mucho_wallets, public.mucho_wallet_requests to service_role;
grant select,insert on public.mucho_wallet_transactions to service_role;

create function public.mucho_wallet_request(p_account_id uuid, p_key uuid, p_kind text, p_provider text, p_amount integer, p_destination text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare w public.mucho_wallets; r public.mucho_wallet_requests;
begin
  if p_kind not in ('deposit','withdrawal') or p_provider not in ('paypal','revolut') or p_amount is null or p_amount not between 100 and 100000 or p_key is null or p_destination is null or length(trim(p_destination)) not between 2 and 200 then
    raise exception 'Richiesta non valida';
  end if;
  if not exists (select 1 from public.player_accounts where id=p_account_id and player_id is not null) then
    raise exception 'Accesso al Circle richiesto';
  end if;
  insert into public.mucho_wallets(account_id) values(p_account_id) on conflict do nothing;
  select * into w from public.mucho_wallets where account_id=p_account_id for update;
  select * into r from public.mucho_wallet_requests where account_id=p_account_id and idempotency_key=p_key;
  if found then
    if r.kind <> p_kind or r.provider <> p_provider or r.amount_cents <> p_amount or r.destination <> trim(p_destination) then
      raise exception 'La richiesta esiste con dati diversi';
    end if;
    return to_jsonb(r);
  end if;
  if (select count(*) from public.mucho_wallet_requests where account_id=p_account_id and status='pending') >= 20 then
    raise exception 'Hai troppe richieste in attesa';
  end if;
  if p_kind='withdrawal' and w.balance_cents-w.reserved_cents < p_amount then
    raise exception 'Saldo disponibile insufficiente';
  end if;
  insert into public.mucho_wallet_requests(account_id,idempotency_key,kind,provider,amount_cents,destination)
  values(p_account_id,p_key,p_kind,p_provider,p_amount,trim(p_destination)) returning * into r;
  if p_kind='withdrawal' then
    update public.mucho_wallets set reserved_cents=reserved_cents+p_amount,updated_at=now() where account_id=p_account_id returning * into w;
    insert into public.mucho_wallet_transactions(account_id,request_id,kind,amount_cents,balance_cents,reserved_cents)
    values(p_account_id,r.id,'withdrawal_hold',-p_amount,w.balance_cents,w.reserved_cents);
  end if;
  return to_jsonb(r);
end;
$$;

create function public.mucho_wallet_review(p_request_id uuid,p_decision text,p_actor text,p_owner uuid default null,p_note text default '')
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare w public.mucho_wallets; r public.mucho_wallet_requests; account uuid; movement text;
begin
  if p_decision is null or p_decision not in ('completed','rejected','cancelled') or p_actor is null or length(p_actor)=0 or length(coalesce(p_note,''))>300 then raise exception 'Decisione non valida'; end if;
  select account_id into account from public.mucho_wallet_requests where id=p_request_id;
  if account is null then raise exception 'Richiesta non trovata'; end if;
  if p_decision='cancelled' and (p_owner is null or account<>p_owner) then raise exception 'Accesso negato'; end if;
  -- Both operations lock the wallet before the request, including retries.
  select * into w from public.mucho_wallets where account_id=account for update;
  select * into r from public.mucho_wallet_requests where id=p_request_id for update;
  if r.status=p_decision then return to_jsonb(r); end if;
  if r.status<>'pending' then raise exception 'Richiesta già gestita'; end if;
  if r.kind='deposit' and p_decision='completed' then
    update public.mucho_wallets set balance_cents=balance_cents+r.amount_cents,updated_at=now() where account_id=account returning * into w;
    movement := 'deposit';
  elsif r.kind='withdrawal' then
    update public.mucho_wallets set reserved_cents=reserved_cents-r.amount_cents,
      balance_cents=balance_cents-case when p_decision='completed' then r.amount_cents else 0 end,updated_at=now()
    where account_id=account returning * into w;
    movement := case when p_decision='completed' then 'withdrawal' else 'withdrawal_release' end;
  end if;
  if movement is not null then
    insert into public.mucho_wallet_transactions(account_id,request_id,kind,amount_cents,balance_cents,reserved_cents)
    values(account,r.id,movement,case when movement='withdrawal' then -r.amount_cents else r.amount_cents end,w.balance_cents,w.reserved_cents);
  end if;
  update public.mucho_wallet_requests set status=p_decision,reviewed_at=now(),reviewed_by=p_actor,review_note=coalesce(p_note,'') where id=r.id returning * into r;
  return to_jsonb(r);
end;
$$;
revoke all on function public.mucho_wallet_request(uuid,uuid,text,text,integer,text), public.mucho_wallet_review(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.mucho_wallet_request(uuid,uuid,text,text,integer,text), public.mucho_wallet_review(uuid,text,text,uuid,text) to service_role;
