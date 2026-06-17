<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# Coach Tri — Agent Knowledge Base

**Application** : Coach Tri est une web app de coaching triathlon pilotée par IA. Elle génère des programmes d'entraînement personnalisés, propose un coach IA conversationnel, et synchronise les données Garmin Connect.

---

## Méthode de travail (réflexion attendue)

> Ces principes priment sur la vitesse. L'objectif est un code **pro, durable et vérifié**, pas une correction qui « passe ».

1. **Comprendre avant d'agir.** Lire le code concerné et identifier la **cause racine** avant de proposer un correctif. Ne pas se fier aux apparences : un symptôme (erreur de lint, bug) a presque toujours une origine structurelle (ex. les casts `as any` partout venaient des clients Supabase non typés — la vraie correction était de typer les factories, pas de masquer chaque appel).

2. **Corriger la racine, jamais le symptôme.** Bannir les rustines qui font taire l'outil sans régler le fond : `as any`, `@ts-ignore`, `eslint-disable`, `try/catch` vides. Si une exception est réellement justifiée (ex. types Supabase générés incomplets), elle doit être **scopée et commentée** avec la raison — jamais globale ni silencieuse.

3. **Ne jamais masquer un problème.** Quand une correction en révèle une autre (ex. retirer un cast fait apparaître un vrai désaccord de types), corriger ce nouveau problème pour de vrai. Un warning/erreur supprimé doit l'être parce qu'il est **résolu**, pas caché.

4. **Vérifier systématiquement, preuves à l'appui.** Après tout changement, lancer la chaîne complète et lire la sortie avant de conclure :

   ```bash
   npm run typecheck && npm run lint && npm test && npm run format:check
   ```

   Ne **jamais** affirmer « c'est corrigé / terminé » sans avoir exécuté ces commandes et constaté le résultat. Énoncer les preuves (sortie réelle), pas des suppositions.

5. **Distinguer l'intentionnel de l'accidentel.** Avant de supprimer ou réécrire, lire les commentaires, le contexte et l'historique git. Un délai de 350 ms, un cast scopé, un `eslint-disable` justifié peuvent être voulus — vérifier avant de toucher.

6. **Changements minimaux et cohérents.** Respecter le style existant (Prettier : guillemets simples, pas de point-virgule). Pas de refactor opportuniste hors périmètre. Le diff doit rester lisible et focalisé.

7. **Garder ce document synchronisé.** Toute évolution d'architecture, de schéma DB, de routes ou de patterns doit être répercutée ici dans le même changement. Une doc fausse fait prendre de mauvaises décisions.

8. **Commits atomiques et explicites.** Un commit = une intention claire, avec un message qui décrit le _quoi_ et le _pourquoi_. Ne committer ni pousser sans demande explicite.

---

## Stack technique

| Couche                 | Technologie                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| Framework              | Next.js 16.2.6 — App Router, React 19                                       |
| Base de données / Auth | Supabase (PostgreSQL + Auth SSR)                                            |
| IA                     | Google Gemini 2.5 Flash (`@google/genai`)                                   |
| Montres / GPS          | Garmin Connect (`garmin-connect`) — TypeScript/Node, **pas de pont Python** |
| Activités              | Strava (OAuth2, `STRAVA_CLIENT_ID`/`SECRET`)                                |
| UI                     | Tailwind CSS v4 + shadcn/ui + lucide-react                                  |
| Validation             | Zod v4                                                                      |
| Dates                  | date-fns v4                                                                 |
| Fonts                  | Outfit (sans) + JetBrains Mono                                              |
| Déploiement            | Vercel                                                                      |

---

## Architecture des dossiers

```
src/
  app/
    (app)/              ← groupe de routes protégées (auth requise)
      layout.tsx        ← vérifie la session, affiche AppNav
      dashboard/        ← tableau de bord principal
      program/          ← vue programme complet
        new/            ← création d'un nouveau programme
      session/[id]/     ← détail d'une séance
      calendar/         ← calendrier hebdomadaire
      activities/       ← liste activités (Garmin + Strava unifiées)
      profile/          ← profil + connexion Garmin/Strava + physiologie + équipement
    api/                ← Route Handlers (Next.js App Router)
      activities/       ← GET liste d'activités unifiée (Garmin + Strava)
      auth/signout/
      chat/             ← GET (historique) / POST (message)
      chat/[id]/        ← PATCH (confirmer/rejeter action IA)
      garmin/connect/   ← POST (sauvegarder creds Garmin)
      garmin/sync/      ← POST (déclencher sync Garmin)
      garmin/debug/
      goals/            ← CRUD objectifs de course
      physiology/       ← GET/POST données physiologiques
      plans/generate/   ← POST (générer programme complet)
      plans/[id]/       ← GET/PATCH/DELETE plan
      plans/[id]/regenerate-week/ ← POST (régénérer une semaine)
      plans/active/     ← GET plan actif
      profile/          ← GET/POST profil
      schedule/         ← GET/POST schedule events
      schedule/[id]/    ← GET/PATCH/DELETE schedule event
      sessions/         ← GET liste
      sessions/[id]/    ← GET/PATCH session (statut, RPE, notes)
      sessions/[id]/link-garmin/  ← POST lier activité Garmin
      sessions/[id]/coach-review/ ← POST analyse IA de la séance réalisée
      strava/connect/   ← GET (URL d'autorisation OAuth Strava)
      strava/callback/  ← GET (échange du code OAuth)
      strava/sync/      ← POST (synchroniser activités Strava)
      strava/disconnect/← POST (supprimer la connexion Strava)
    login/
    onboarding/         ← flow 3 étapes : profil → disciplines → Garmin
    page.tsx            ← landing page
    layout.tsx          ← root layout (fonts, Toaster)
  components/
    activities/         ← AddActivityModal
    calendar/           ← WeekCalendar, EventModal
    coach/              ← CoachChat (chat IA)
    common/             ← AppNav (nav desktop + mobile bottom bar)
    forms/              ← LoginForm, OnboardingFlow, ProgramForm
    garmin/             ← GarminConnectCard, GarminSyncButton
    plan/               ← PhaseBar, WeekView, SessionCard, SessionActions, GarminLinker, StopProgramButton
    profile/            ← EquipmentSection, PhysiologySection
    strava/             ← StravaConnectCard
    ui/                 ← composants shadcn/ui
  lib/
    activities/
      unify.ts          ← normalisation + déduplication des activités Garmin/Strava (+ tests)
    coach/
      knowledge/        ← base de connaissances coach (methodologies, nutrition, swim,
                           zones-ref, sessions-lib, maintenance) agrégée via index.ts
    gemini/
      client.ts         ← generateJSON<T>() : appelle Gemini, retourne du JSON parsé
      prompts.ts        ← TRIATHLON_COACH_SYSTEM, buildMacroPrompt, buildMicroPrompt,
                           COACH_CHAT_SYSTEM, buildChatContext
    garmin/
      client.ts         ← wrapper garmin-connect (login, sync activités/wellness/stats)
    strava/
      client.ts         ← OAuth2 Strava (exchangeCode, refreshIfNeeded, fetch activités)
    schemas/
      garmin.ts, goal.ts, plan.ts, profile.ts, schedule.ts
    supabase/
      server.ts         ← createClient() — SSR (cookies), pour Server Components et Route Handlers
      client.ts         ← createClient() — browser (singleton), pour Client Components
      admin.ts          ← createAdminClient() — service_role, bypass RLS
    utils/
      cn.ts             ← helper cn() (merge de classes Tailwind, convention shadcn)
      crypto.ts         ← encryptCredential / decryptCredential (AES-256-CBC)
      errors.ts         ← apiError() / apiSuccess() helpers
      json.ts           ← asJson() / fromJson() : pont vers le type Json (colonnes jsonb)
      zones.ts          ← calcul des zones d'entraînement (FC / puissance / allure)
      adherence.ts      ← calcul de l'adhérence au plan (prévu vs réalisé)
    theme.ts            ← constantes de thème (couleurs OKLCH, etc.)
  types/
    db.ts               ← types Supabase générés (Database interface)
    domain.ts           ← types métier (Discipline, Phase, HRZones, etc.)
  proxy.ts              ← (ex-middleware, renommé en Next 16) rafraîchit la session Supabase + protège les routes (redirect /login) — runtime nodejs
```

---

## Schéma de base de données (Supabase)

### Tables principales

**`profiles`** — un profil par utilisateur (id = auth.users.id)

- `first_name`, `birth_date`, `sex` (M/F/X)
- `weight_kg`, `height_cm`, `experience_years`
- `level` : `beginner | intermediate | advanced | elite`
- `weekly_hours_avg` : disponibilité hebdomadaire
- `available_disciplines` : array `string[]` (swim/bike/run)
- `notes`

**`physiology`** — données physiologiques (FTP, VMA, CSS, etc.)

- `user_id`, `test_date`
- `ftp_watts`, `hr_max`, `hr_threshold_bike`
- `vma_kmh`, `run_threshold_pace_sec_per_km`, `hr_max_run`, `hr_threshold_run`
- `css_pace_sec_per_100m`
- Vue `physiology_current` : dernière mesure par user

**`goals`** — objectifs de course

- `race_name`, `race_date`
- `race_type` : `sprint | olympic | half | full | xterra | custom`
- `swim_distance_m`, `bike_distance_m`, `run_distance_m`
- `bike_elevation_m`, `run_elevation_m`, `terrain`
- `priority` : `A | B | C`
- `target_type` : `finish | time | podium`, `target_time_seconds`
- `status` : `draft | active | completed | abandoned`

**`plans`** — programmes d'entraînement

- `user_id`, `goal_id` (nullable pour mode maintenance)
- `name`, `start_date`, `end_date`
- `methodology` : `polarized | pyramidal | threshold | custom`
- `periodization` : `linear | block | reverse`
- `status` : `active | archived` — un seul plan actif à la fois
- `params : Json`, `summary : Json`

**`plan_phases`** — phases du plan (généré par Gemini macro)

- `plan_id`, `phase` (prep/base/build/peak/taper/race)
- `start_week_num`, `end_week_num`, `focus`

**`plan_weeks`** — semaines du plan (généré par Gemini macro)

- `plan_id`, `week_num`, `phase`
- `is_recovery_week`, `planned_volume_hours`, `planned_tss`
- `distribution : Json` (`{z1z2, z3, z4z5}`)
- `notes`, `start_date`

**`sessions`** — séances individuelles (généré par Gemini micro)

- `plan_id`, `plan_week_id`, `user_id`, `session_date`
- `day_part` : `morning | midday | evening`
- `discipline` : `swim | bike | run | brick | strength | rest`
- `session_type` : `easy | tempo | threshold | vo2 | race_pace | technique | long | recovery | test`
- `title`, `duration_min`, `planned_tss`
- `structure : Json` (`{warmup, main, cooldown}`)
- `target_values : Json` (`{watts: [min,max], hr: [min,max], pace: "x:xx"}`)
- `target_zone`, `expected_rpe`, `coaching_note`
- `status` : `planned | done | skipped | modified`
- `actual_duration_min`, `actual_rpe`, `actual_notes`, `completed_at`
- `garmin_activity_id` (FK vers garmin_activities)

**`garmin_credentials`** — identifiants Garmin chiffrés AES-256

- `user_id`, `email_enc`, `password_enc`
- `session_data : Json` (tokens OAuth1 + OAuth2 pour réutilisation)
- `last_sync_at`

**`garmin_activities`** — activités synchronisées

- `garmin_activity_id` (unique Garmin), `activity_type` (swim/bike/run/strength/other)
- `started_at`, `duration_s`, `distance_m`
- `avg_hr`, `max_hr`, `avg_speed_ms`, `elevation_gain_m`
- `aerobic_te`, `anaerobic_te`, `raw_data`

**`garmin_wellness`** — données bien-être quotidiennes

- `date` (unique par user/date)
- `sleep_duration_s`, `sleep_score`
- `hrv_rmssd`, `body_battery_start/end`
- `stress_avg`, `resting_hr`, `steps`, `total_calories`

**`garmin_stats`** — stats Garmin globales (1 ligne par user)

- `vo2max_run`, `vo2max_bike`, `fitness_age`
- `training_readiness`, `training_load_7d`, `training_load_28d`
- `display_name`, `garmin_username`, `profile_image_url`
- `personal_records : Json`

**`availability_blocks`** — périodes d'indisponibilité

- `start_date`, `end_date`, `reason`

**`schedule_events`** — événements personnels (contraintes d'agenda)

- `title`, `event_type`, `event_date`, `start_time`, `end_time`
- `is_recurring` : bool
- `recurrence_day` : ISO day (1=lun…7=dim)
- `recurrence_end_date`

**`chat_messages`** — historique du coach IA

- `user_id`, `role` (user/assistant)
- `content` : texte du message
- `proposed_action : Json | null` — action proposée par l'IA
- `action_status` : `pending | confirmed | rejected | null`

**`plan_generations`** — log des appels Gemini

- `plan_id`, `trigger` (initial/week_regenerate)
- `scope`, `model`, `response_meta`

---

## Authentification

- **Provider** : Supabase Auth (email/password)
- **Session** : cookies SSR via `@supabase/ssr`
- **Protection** : `src/app/(app)/layout.tsx` — si pas de session → redirect `/login`
- **Client** :
  - `createClient()` depuis `@/lib/supabase/server` → Server Components + Route Handlers (lit cookies)
  - `createClient()` depuis `@/lib/supabase/client` → Client Components (singleton browser)
  - `createAdminClient()` depuis `@/lib/supabase/admin` → service_role, bypass RLS — à utiliser pour les opérations d'écriture admin (insert/upsert depuis Route Handlers)

---

## Système IA (Gemini)

### Client (`src/lib/gemini/client.ts`)

```ts
generateJSON<T>(systemPrompt, userPrompt, { temperature? }) → Promise<T>
```

- Modèle : `gemini-2.5-flash`
- `thinkingBudget: 0` (désactivé pour la vitesse)
- `responseMimeType: 'application/json'`
- Filtrage des parts `thought === true`

### Génération de programme — 2 phases

**Phase 1 — Macro** (`POST /api/plans/generate`)

1. Récupère profil, goal, activités Garmin récentes (8 semaines), wellness (14 jours)
2. `buildMacroPrompt()` → prompt décrivant l'athlète et l'objectif
3. Gemini génère : phases (`prep/base/build/peak/taper/race`) + semaines (volume, TSS, distribution d'intensité)
4. Insère dans `plans`, `plan_phases`, `plan_weeks`
5. Archive les anciens plans actifs

**Phase 2 — Micro** (`POST /api/plans/[id]/regenerate-week`)

1. Récupère la semaine cible, profil, sessions semaine précédente, wellness récent, schedule_events
2. `buildMicroPrompt()` → prompt avec contraintes d'agenda et séances précédentes
3. Gemini génère : sessions détaillées (structure warmup/main/cooldown, target_values, coaching_note)
4. Supprime les séances `planned` de la semaine, insère les nouvelles

### Coach Chat (`POST /api/chat`)

- Récupère contexte : profil, plan actif, séances de la semaine, historique chat (10 messages)
- Prompt : `COACH_CHAT_SYSTEM` + `buildChatContext()`
- Réponse JSON : `{ message, proposedAction: null | { type, description, params } }`
- Actions disponibles : `cancel_session`, `move_session`, `adjust_session`, `regenerate_week`
- Confirmation via `PATCH /api/chat/[id]` → exécute l'action côté serveur

---

## Intégration Garmin

**Connexion** : `POST /api/garmin/connect`

- Chiffre email + password (AES-256-CBC) → stocke dans `garmin_credentials`

**Sync** : `POST /api/garmin/sync`

- Déchiffre credentials, crée instance `GarminConnect`
- Tente réutilisation des tokens OAuth (session_data), sinon login
- En parallèle :
  - `runSync()` : activités (max 14 jours) + wellness jour par jour (350ms de délai entre jours)
  - `fetchGarminStats()` : profile, VO2max, fitness age, training readiness, training load, PRs
- Upsert dans `garmin_activities` (conflit `user_id,garmin_activity_id`) et `garmin_wellness` (conflit `user_id,date`)
- Met à jour `session_data` avec les nouveaux tokens exportés

**Chiffrement** (`src/lib/utils/crypto.ts`) :

- AES-256-CBC, IV aléatoire 16 bytes
- Clé depuis `ENCRYPTION_KEY` (32 chars raw ou 64 hex)
- Format stocké : `ivHex:encryptedHex`

---

## Intégration Strava

**OAuth2** (`src/lib/strava/client.ts`) — alternative/complément à Garmin pour importer les activités.

- `GET /api/strava/connect` : construit l'URL d'autorisation Strava (scope `read,activity:read`), pose un cookie `strava_oauth_state` (CSRF), redirige vers Strava. Callback = `${NEXT_PUBLIC_APP_URL}/api/strava/callback`.
- `GET /api/strava/callback` : vérifie le `state`, échange le code (`exchangeCode`), chiffre les tokens (`encryptStravaTokens`) et upsert dans `strava_credentials`.
- `POST /api/strava/sync` : déchiffre les tokens (`decryptStravaCreds`), rafraîchit si besoin (`refreshIfNeeded`), récupère activités + stats, upsert `strava_activities`. Réécrit les tokens chiffrés si le refresh les a changés.
- `POST /api/strava/disconnect` : supprime les credentials.
- **Chiffrement** : `access_token`/`refresh_token` sont chiffrés AES-256 (mêmes helpers `crypto.ts` que Garmin) via `src/lib/strava/credentials.ts` (`encryptStravaTokens` / `decryptStravaCreds`). Un déchiffrement qui échoue (ligne legacy en clair) est traité comme « reconnecter le compte ».
- **Config Strava** : _Authorization Callback Domain_ = le host de `NEXT_PUBLIC_APP_URL` (sans `https://`).
- Tables : `strava_credentials`, `strava_activities` (migration `0020_strava.sql`).

---

## Design System

### Couleurs (OKLCH) — Piste A « Lagune » (thème clair, teal)

Source de vérité : `src/lib/theme.ts` + `src/app/globals.css`. Les composants importent les
constantes via des alias historiques (`ACCENT as MINT`, `SURFACE as DARK`,
`SURFACE_DEEP as DARKER`, `DIVIDER as DIV`, `TEXT_FAINT/TEXT_MUTED as MUTED`) — les noms
`DARK`/`DARKER` sont désormais des **surfaces claires** (alias conservés, ne pas s'y fier).

```
BG     = oklch(0.94 0.004 220)           → fond de page (gris clair quasi neutre, gris / blanc cassé)
TEXT   = oklch(0.287 0.047 217.9)        → texte (canard profond #06303A)
MINT   = oklch(0.306 0.051 209.3)        → accent/boutons (canard #03363D)
DARK   = oklch(1 0 0)                     → SURFACE : fond des cards (blanc)
DARKER = oklch(0.925 0.018 200)          → SURFACE_DEEP : bandeaux/inserts footer/saisie (brume lagune, teal très clair)
NAV    = oklch(0.306 0.051 209.3)        → header/nav : canard sombre, texte clair (tokens --sidebar*)
DIV    = oklch(0.287 0.047 217.9 / 14%)  → séparateurs (canard estompé)
MUTED  = oklch(0.504 0.038 203.1)        → texte atténué (teal)

Filigrane : `public/topo.svg` (courbes de niveau, traits canard `#06303A`) posé via la classe
`.topo-lines` en très basse opacité (header, login, fond du layout `(app)`).
```

### Typographie

- Sans-serif : `Outfit` (variable `--font-sans`), weights 400-900
- Mono : `JetBrains Mono` (variable `--font-geist-mono`)

### Conventions UI

- Coins arrondis : `rounded-2xl` pour les cards majeures, `rounded-xl` pour boutons/chips
- Font style répétitif : `font-black uppercase tracking-widest text-xs` → étiquettes sections
- Bouton primaire : `backgroundColor: MINT, color: DARK` (texte blanc sur canard — `DARK` = surface blanche)
- Pas de classes Tailwind pour les couleurs thème — inline styles OKLCH directs
- Thème **clair** : ne pas réintroduire de blanc littéral (`oklch(1 0 0 / x%)`) ni de classes `text-white/*` comme texte/estompé — utiliser les tokens (ils virent au canard estompé sur fond clair)
- shadcn/ui pour les composants formulaire (Input, Select, Button, Card, Badge, Dialog, Tabs)

### Accessibilité (cible WCAG 2.2 niveau AA)

Le standard de référence est **WCAG 2.2 AA** (benchmark légal ADA/EAA, mesuré par Lighthouse/axe).

- **Contraste texte ≥ 4.5:1** (normal), ≥ 3:1 (grand texte ≥ 24px ou ≥ 18.66px gras). Pour du texte canard estompé sur fond clair, **opacité minimale 70%** (`oklch(0.287 0.047 217.9 / 70%)`) — en dessous ça échoue (ex. 50% ≈ 3:1). `TEXT_FAINT` est calé à 70%. Attention : `TEXT_MUTED` ne passe que ~4.34:1 sur le bandeau teal `SURFACE_DEEP` → préférer `TEXT_FAINT` (ink/70%) sur ces inserts.
- Texte clair sur le header canard : les opacités `cream/55`+ passent ; ne pas descendre sous 55%.
- Tout bouton à icône seule doit avoir un `aria-label` (ou un `<span className="sr-only">`).
- **Vérifier les ratios avec `node scripts/a11y-contrast.mjs`** (convertit OKLCH→sRGB, composite l'alpha, calcule le ratio WCAG) avant d'introduire une nouvelle couleur de texte.

---

## Patterns de code importants

### Server Components → lecture directe Supabase

```tsx
const supabase = await createClient() // @/lib/supabase/server
const { data } = await supabase.from('sessions').select('...')
```

Les factories Supabase (`server.ts`, `client.ts`, `admin.ts`) sont typées avec `<Database>` (types générés dans `src/types/db.ts` via `npm run db:types`) : les lignes (`data`) sont **strictement typées de bout en bout**, sans cast. Régénérer les types après toute migration (`npm run db:types`).

- **Colonnes jsonb** : typées `Json` côté types générés. Utiliser les helpers `src/lib/utils/json.ts` — `asJson(value)` à l'écriture, `fromJson<T>(value)` à la lecture — plutôt que des casts dispersés.
- **Payloads dynamiques** (objets construits à la volée) : typer avec `TablesInsert<'table'>` / `TablesUpdate<'table'>` (exportés par `db.ts`).
- Les anciennes annotations `as { data: … } | null` sur les lectures sont désormais redondantes ; les retirer au fil des modifications.

### Route Handlers → toujours valider avec Zod d'abord

```ts
const parsed = MySchema.safeParse(body)
if (!parsed.success) return apiError(parsed.error.issues[0].message, 400)
```

### Admin client — écriture depuis Route Handlers

```ts
const admin = createAdminClient() // @/lib/supabase/admin (service_role)
await admin.from('sessions').insert(...)
```

### Helpers de réponse API

```ts
apiSuccess(data, statusCode?)   // → Response JSON { data, success: true }
apiError(message, statusCode?)  // → Response JSON { error, success: false }
```

### Params Route Handlers (Next.js 16)

```ts
// Les params sont une Promise en Next.js 16 :
const { id } = await params
```

---

## Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL          ← URL publique Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY     ← clé anon Supabase
SUPABASE_SERVICE_ROLE_KEY         ← clé service_role (admin, server-side only)
GEMINI_API_KEY                    ← clé Google AI Studio
ENCRYPTION_KEY                    ← clé AES-256 pour Garmin (32 chars ou 64 hex)
STRAVA_CLIENT_ID                  ← ID app Strava (strava.com/settings/api)
STRAVA_CLIENT_SECRET              ← secret app Strava
NEXT_PUBLIC_APP_URL               ← URL publique de l'app, ex. https://coach-tri-amber.vercel.app (callback OAuth Strava)
```

> **Garmin / ENCRYPTION_KEY** : la prod (Vercel) utilise la clé d'origine qui déchiffre bien les identifiants Garmin stockés (sync OK). Le `.env.local` a une clé régénérée distincte → le sync Garmin échoue en **dev local** (déchiffrement impossible). Sans incidence en prod ; pour du Garmin en local, réaligner la clé et reconnecter Garmin. La même `ENCRYPTION_KEY` chiffre désormais aussi les tokens Strava.

---

## Pages et navigation

| Route           | Description                                 | Composants clés                     |
| --------------- | ------------------------------------------- | ----------------------------------- |
| `/`             | Landing page                                | —                                   |
| `/login`        | Connexion email/password                    | LoginForm                           |
| `/onboarding`   | Inscription 3 étapes                        | OnboardingFlow                      |
| `/dashboard`    | Tableau de bord + séance du jour + coach IA | CoachChat                           |
| `/program`      | Programme complet (phases + semaines)       | PhaseBar, WeekView                  |
| `/program/new`  | Créer un programme                          | ProgramForm                         |
| `/session/[id]` | Détail séance (structure, RPE, Garmin)      | SessionActions, GarminLinker        |
| `/calendar`     | Calendrier hebdomadaire + schedule events   | WeekCalendar, EventModal            |
| `/activities`   | Liste activités Garmin                      | —                                   |
| `/profile`      | Profil + connexion/sync Garmin              | GarminConnectCard, GarminSyncButton |

**Navigation** : `AppNav` — sticky header desktop + bottom bar mobile (5 liens). Bandeau **canard sombre** (tokens `--sidebar*`), texte clair, lien actif en teal glacier ; filigrane topo inversé pour ressortir sur le fond sombre.

---

## Règles et conventions à respecter

1. **Pas de mock Supabase** — toujours utiliser le vrai client.
2. **Admin client** (`createAdminClient`) uniquement dans les Route Handlers côté serveur, jamais dans les Client Components.
3. **Params async** : en Next.js 16, `params` et `searchParams` sont des `Promise` — toujours `await params`.
4. **Zod v4** : la syntaxe diffère de v3 (ex. `.min()` sur `z.number()` ne prend pas de message direct dans certains cas). Vérifier la doc si incertain.
5. **Design** : utiliser les couleurs OKLCH inline, ne pas créer de nouvelles classes Tailwind de couleur.
6. **Un seul plan actif** : à la création d'un plan, archiver les autres (`status = 'archived'`).
7. **generateJSON** : retourne toujours du JSON pur — le system prompt Gemini doit préciser "réponds uniquement en JSON".
8. **Garmin sync** : le délai de 350ms entre les jours wellness est intentionnel pour éviter le rate-limiting.
9. **Chiffrement des credentials tiers** : ne jamais stocker en clair les identifiants Garmin ni les tokens Strava — toujours `encryptCredential()` (Garmin) / `encryptStravaTokens()` (Strava).

---

## Limitations connues (dette technique)

- **Pas de rate-limiting sur les endpoints Gemini** (`plans/generate`, `plans/[id]/regenerate-week`, `chat`, `sessions/[id]/coach-review`). Ces routes déclenchent des appels IA payants sans limite par utilisateur → risque de coût/abus. Décision : reporté. Approche pressentie quand ce sera traité : table Postgres de comptage par user/fenêtre, ou Upstash Redis (sliding-window).
- **Casts de lecture résiduels** : ~18 annotations `as { data: … } | null` subsistent dans `src/app` depuis l'époque du placeholder `db.ts`. Désormais redondantes (les factories sont typées `<Database>`), à retirer par lots en relançant la chaîne — sans urgence, le typecheck passe avec.
