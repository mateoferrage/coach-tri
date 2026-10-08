import { generateJSON } from '@/lib/gemini/client'
import { TRIATHLON_COACH_SYSTEM, buildMacroPrompt } from '@/lib/gemini/prompts'
import { normalizePhase } from '@/lib/plan/phases'
import type { MacroPlan } from '@/lib/schemas/plan'

/**
 * Génère et normalise la structure macro (phases + semaines) via l'IA.
 * Lève une Error avec message explicite si la réponse est inexploitable.
 * L'appelant gère la persistance et le mapping vers apiError.
 */
export async function generateMacroWeeks(
  input: Parameters<typeof buildMacroPrompt>[0],
): Promise<{ phases: MacroPlan['phases']; weeks: MacroPlan['weeks'] }> {
  const userPrompt = buildMacroPrompt(input)
  const macroPlan = await generateJSON<MacroPlan>(TRIATHLON_COACH_SYSTEM, userPrompt)

  if (!macroPlan.phases?.length || !macroPlan.weeks?.length) {
    throw new Error('Réponse Gemini invalide — structure manquante')
  }
  const normalizedPhases = macroPlan.phases.map((p) => {
    const phase = normalizePhase(p.phase)
    return phase ? { ...p, phase } : null
  })
  if (normalizedPhases.includes(null)) {
    const bad = macroPlan.phases.map((p) => p.phase).filter((p) => !normalizePhase(p))
    throw new Error(`Réponse Gemini invalide — phase(s) inconnue(s) : ${bad.join(', ')}`)
  }
  const phases = normalizedPhases as MacroPlan['phases']
  const weeks = macroPlan.weeks.map((w) => ({
    ...w,
    phase: normalizePhase(w.phase) ?? w.phase.trim().toLowerCase(),
  }))
  return { phases, weeks }
}
