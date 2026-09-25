# Mucho8s — attivare il database condiviso gratuito con Supabase

Il sito funziona anche senza Supabase: in quel caso usa il localStorage del singolo browser.
Per avere gli stessi player, match, Elo e statistiche su PC e telefono, attiva Supabase.

## 1. Crea un progetto Supabase
Crea un progetto gratuito su Supabase.

## 2. Crea la tabella
Apri SQL Editor nel progetto Supabase e incolla il contenuto di:

`Mucho8s_clean/supabase/schema.sql`

Esegui lo script.

## 3. Pubblica la Edge Function
La funzione pronta è in:

`Mucho8s_clean/supabase/functions/mucho8s-write/index.ts`

Distribuiscila con il nome:

`mucho8s-write`

Imposta inoltre il secret della funzione:

`ADMIN_PASSWORD`

con la password scelta per l'Admin Panel.

## 4. Recupera URL e anon key
In Supabase > Project Settings > API copia:
- Project URL
- anon public key

## 5. Inserisci le variabili su GitHub
Nel repository GitHub vai in:

Settings > Secrets and variables > Actions > Variables

Crea:
- `REACT_APP_SUPABASE_URL` = Project URL
- `REACT_APP_SUPABASE_ANON_KEY` = anon public key

Il workflow GitHub Pages è già predisposto per leggerle.

## 6. Ridistribuisci il sito
Avvia di nuovo il workflow GitHub Pages oppure fai un nuovo commit.

Quando entrambe le variabili sono presenti, Mucho8s passa automaticamente da modalità `local` a modalità `supabase`.

## Sicurezza
La tabella consente lettura pubblica dei dati della ladder, ma non scrittura anonima.
Le modifiche passano dalla Edge Function, che richiede la password admin lato server.
La service role key non deve mai essere inserita nel frontend o nel repository.
