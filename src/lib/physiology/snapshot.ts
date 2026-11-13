import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'

type Client = SupabaseClient<Database>
type PhysiologyInsert = Database['public']['Tables']['physiology']['Insert']

/** Colonnes saisies hors formulaire de profil (tests) : reportées d'une mesure à l'autre. */
export const CARRIED_FIELDS = ['hr_threshold_run', 'hr_threshold_bike', 'hr_max_run'] as const

/** Colonnes de la ligne courante à recopier dans une nouvelle mesure. */
export const SNAPSHOT_FIELDS = [
  'run_5k_time_s',
  'run_10k_time_s',
  'run_half_time_s',
  'swim_100m_time_s',
  'swim_200m_time_s',
  'swim_400m_time_s',
  'swim_800m_time_s',
  'ftp_watts',
  'hr_max',
  'resting_hr',
  'run_threshold_pace_sec_per_km',
  'vma_kmh',
  'css_pace_sec_per_100m',
  ...CARRIED_FIELDS,
] as const

export type PhysiologyRow = Partial<Record<(typeof SNAPSHOT_FIELDS)[number], number | null>> & {
  measured_fields?: string[] | null
}

/** Dernière mesure de l'athlète (vue physiology_current). */
export async function fetchCurrentPhysiology(
  client: Client,
  userId: string,
): Promise<PhysiologyRow | null> {
  const { data } = await client
    .from('physiology_current')
    .select([...SNAPSHOT_FIELDS, 'measured_fields'].join(', '))
    .eq('user_id', userId)
    .maybeSingle()
  return (data as PhysiologyRow | null) ?? null
}

/**
 * Enregistre une mesure. Une seule ligne par date : `physiology_current`
 * départage par date, deux lignes le même jour rendraient le choix aléatoire.
 */
export async function saveSnapshot(
  admin: Client,
  row: PhysiologyInsert & { test_date: string },
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const { data: sameDay } = await admin
    .from('physiology')
    .select('id')
    .eq('user_id', row.user_id)
    .eq('test_date', row.test_date)
    .limit(1)
    .maybeSingle()

  return (await (
    sameDay
      ? admin.from('physiology').update(row).eq('id', sameDay.id)
      : admin.from('physiology').insert(row)
  )
    .select()
    .single()) as { data: Record<string, unknown> | null; error: { message: string } | null }
}
