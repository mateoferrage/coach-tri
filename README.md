# Coach Tri

Web app de coaching triathlon pilotée par IA : génération de programmes d'entraînement personnalisés, coach IA conversationnel, et synchronisation des données Garmin Connect et Strava.

## Stack

- **Framework** : Next.js 16 (App Router) + React 19
- **Base de données / Auth** : Supabase (PostgreSQL + Auth SSR)
- **IA** : Google Gemini 2.5 Flash (`@google/genai`)
- **Données d'activité** : Garmin Connect (`garmin-connect`) + Strava (OAuth2)
- **UI** : Tailwind CSS v4 + shadcn/ui + lucide-react
- **Validation** : Zod v4 · **Dates** : date-fns v4
- **Déploiement** : Vercel

## Prérequis

- Node.js 20+
- Un projet Supabase
- Une clé API Google AI Studio (Gemini)
- (Optionnel) Une app Strava pour l'import d'activités

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigner les variables
npm run dev                  # http://localhost:3000
```

Appliquer le schéma de base de données (migrations Supabase) :

```bash
npm run db:push
```

## Variables d'environnement

Voir `.env.example`. Variables requises :

| Variable                                    | Description                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                  | URL publique du projet Supabase                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`             | Clé anon Supabase                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`                 | Clé service_role (server-side uniquement)                              |
| `GEMINI_API_KEY`                            | Clé Google AI Studio                                                   |
| `ENCRYPTION_KEY`                            | Clé AES-256 pour chiffrer les identifiants Garmin (32 chars ou 64 hex) |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | App Strava (optionnel)                                                 |
| `NEXT_PUBLIC_APP_URL`                       | URL publique de l'app — callback OAuth Strava                          |

## Scripts

| Commande               | Rôle                                       |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Serveur de développement                   |
| `npm run build`        | Build de production                        |
| `npm run start`        | Serveur de production                      |
| `npm run lint`         | ESLint                                     |
| `npm run format`       | Formate le code avec Prettier              |
| `npm run format:check` | Vérifie le formatage (CI)                  |
| `npm run typecheck`    | Vérification TypeScript (`tsc --noEmit`)   |
| `npm run test`         | Tests unitaires (Vitest)                   |
| `npm run db:push`      | Applique les migrations Supabase           |
| `npm run db:types`     | Régénère `src/types/db.ts` depuis Supabase |

## Architecture

L'architecture détaillée (dossiers, schéma de base de données, intégrations Garmin/Strava, système IA, conventions de code) est documentée dans [`AGENTS.md`](./AGENTS.md).

## Déploiement

Déployé sur Vercel. Penser à configurer toutes les variables d'environnement côté Vercel et, pour Strava, à régler l'_Authorization Callback Domain_ sur le host de `NEXT_PUBLIC_APP_URL`.
