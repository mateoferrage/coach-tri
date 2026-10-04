import { describe, it, expect } from 'vitest'
import { PlanGenerationSchema } from './plan'

const base = { methodology: 'polarized', start_date: '2026-01-05' }
// UUID v4 conformes RFC (nibbles version=4 et variant=8) pour passer z.uuid()
const g1 = '11111111-1111-4111-8111-111111111111'
const g2 = '22222222-2222-4222-8222-222222222222'

describe('PlanGenerationSchema', () => {
  it('mode race : accepte goal_ids + primary_goal_id valides', () => {
    const r = PlanGenerationSchema.safeParse({ ...base, mode: 'race', goal_ids: [g1, g2], primary_goal_id: g1 })
    expect(r.success).toBe(true)
  })
  it('mode race : rejette primary_goal_id absent de goal_ids', () => {
    const r = PlanGenerationSchema.safeParse({ ...base, mode: 'race', goal_ids: [g1], primary_goal_id: g2 })
    expect(r.success).toBe(false)
  })
  it('mode race : rejette goal_ids vide', () => {
    const r = PlanGenerationSchema.safeParse({ ...base, mode: 'race', goal_ids: [], primary_goal_id: g1 })
    expect(r.success).toBe(false)
  })
  it('mode race : rejette plus de 3 courses', () => {
    const r = PlanGenerationSchema.safeParse({ ...base, mode: 'race', goal_ids: [g1, g2, g1, g2], primary_goal_id: g1 })
    expect(r.success).toBe(false)
  })
  it('mode maintenance : goal_ids optionnel', () => {
    const r = PlanGenerationSchema.safeParse({ ...base, mode: 'maintenance' })
    expect(r.success).toBe(true)
  })
})
