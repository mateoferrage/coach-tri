import type { Json } from '@/types/db'

/**
 * Pont vers le type `Json` des colonnes jsonb. Les types Supabase générés ne
 * décrivent pas la forme précise des payloads jsonb : on convertit explicitement
 * au point d'écriture, avec une valeur réellement sérialisable.
 */
export function asJson<T>(value: T): Json {
  return value as unknown as Json
}

/**
 * Symétrique en lecture : interprète une colonne jsonb (`Json`) selon sa forme
 * connue à l'exécution (ex. `structure`, `target_values`).
 */
export function fromJson<T>(value: Json | null | undefined): T {
  return (value ?? null) as unknown as T
}
