# Changelog — Coach Tri

## [Unreleased] — 2026-06-04

### Intégration Strava (branch `feat/strava-oauth`)

#### Sécurité

- **Protection CSRF OAuth** : le flow connect/callback utilise un cookie `strava_oauth_state` (httpOnly, sameSite=lax, TTL 10 min). Le callback vérifie et consomme le cookie avant d'échanger le code d'autorisation — tout state absent ou incorrect est rejeté vers `/profile?strava_error=state_mismatch`.
- **Gestion d'erreur disconnect** : la suppression des credentials dans Supabase remonte maintenant les erreurs (`500`) au lieu de les ignorer silencieusement.

#### Fonctionnalités

- **Client Strava** (`src/lib/strava/client.ts`) : client HTTP avec projection des champs, refresh automatique du token OAuth2.
- **Routes API Strava** :
  - `GET /api/strava/connect` — initie l'OAuth, génère le state CSRF, redirige vers Strava.
  - `GET /api/strava/callback` — échange le code, stocke les tokens dans `strava_credentials`.
  - `DELETE /api/strava/disconnect` — supprime les credentials.
  - `POST /api/strava/sync` — importe les activités des 30 derniers jours, upsert dans `strava_activities`.
- **StravaConnectCard** (`src/components/strava/StravaConnectCard.tsx`) : carte UI sur la page profil avec état connecté/déconnecté, bouton sync, bouton déconnexion, date de dernière sync.
- **Page profil** : section "Connexion Strava" intégrée, requête `strava_credentials` en parallèle des autres données.
- **Coach IA enrichi par Strava** :
  - Scenario B : les stats YTD Strava sont injectées dans le prompt de régénération de semaine micro.
  - Scenario C : les activités récentes Strava sont injectées dans le contexte du coach chat.

#### Base de données

- Table `strava_credentials` : `athlete_id`, `access_token`, `refresh_token`, `expires_at`, `scope`, `last_sync_at`.
- Table `strava_activities` : champs similaires à `garmin_activities` (type, durée, distance, HR, vitesse, dénivelé).

---

## [2026-06-03]

### Retour coach IA après liaison activité Garmin

- Après avoir lié une activité Garmin à une séance, le coach IA génère automatiquement un retour personnalisé (verdict : optimal / acceptable / insuffisant / dépassement) avec message contextuel.
- Zones Karvonen calculées dynamiquement selon le profil physiologique de l'athlète.
- Adhérence aux zones cibles affichée dans le `GarminLinker`.
- Base de connaissances enrichie dans le service Garmin.

---

## [2026-06-02]

### Calendrier

- Calendrier adapté à la hauteur d'écran (moins de scroll).
- Fix format heure invalide sur Safari (`HH:MM:SS` → `HH:MM`).
- Édition des événements existants au clic.
- Ajout d'activités manuelles depuis le calendrier.
- Fix échange de séances via le coach IA.
- Fix sync Garmin et affichage des heures.

---

## [2026-05-31]

### Profil & Programme

- Section données physiologiques (FTP, VMA, CSS, FC seuil/max) avec édition.
- Correction de l'édition du profil utilisateur.
- Arrêt de programme (archivage).
- Zones d'entraînement personnalisées.
- Contexte de génération IA enrichi (physiologie + zones dans le prompt macro/micro).

---

## [2026-05-27]

### Phase 1 — Base de l'application

- Dashboard principal avec séance du jour.
- Coach IA conversationnel intégré au dashboard (actions : annuler, déplacer, ajuster séance, régénérer semaine).
- Vue programme complet (phases + semaines).
- Création de programme via Gemini 2.5 Flash (macro → micro).
- Détail de séance avec structure warmup/main/cooldown.
- Calendrier hebdomadaire avec événements personnels.
- Intégration Garmin Connect (OAuth, sync activités + wellness + stats).
- Authentification Supabase (email/password, sessions SSR).
- Onboarding 3 étapes (profil → disciplines → Garmin).
