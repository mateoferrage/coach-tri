'use client'

import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { SectionLabel } from '@/components/common/SectionLabel'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { cn } from '@/lib/utils/cn'
import {
  CHOICE_TAB_CLASS,
  CHOICE_TABS_LIST_CLASS,
  GoalSlot,
  type Goal,
  type SlotMode,
} from './GoalSlot'
import type { GoalFieldsetHandle, GoalFormData } from './GoalFieldset'
import { assembleGoalIds } from '@/lib/plan/goal-slots'

const ProgramSettingsSchema = z.object({
  methodology: z.enum(['polarized', 'pyramidal', 'threshold']),
  start_date: z.string().min(1),
})

type ProgramSettings = z.infer<typeof ProgramSettingsSchema>

const METHODOLOGIES = [
  {
    value: 'polarized',
    label: 'Polarisé',
    desc: '80% basse intensité / 20% haute intensité — recommandé pour la plupart des athlètes',
  },
  {
    value: 'pyramidal',
    label: 'Pyramidal',
    desc: '70% Z1-Z2 / 20% Z3 / 10% Z4-Z5 — bon équilibre',
  },
  {
    value: 'threshold',
    label: 'Seuil',
    desc: 'Focus sur la Zone 3-4 — pour athlètes expérimentés avec moins de temps',
  },
]

const SLOTS = ['A', 'B', 'C'] as const
type SlotKey = (typeof SLOTS)[number]

const SLOT_META: Record<SlotKey, { title: string; description?: string; optional: boolean }> = {
  A: { title: 'Objectif A — course principale', optional: false },
  B: { title: 'Objectif B — secondaire (optionnel)', optional: true },
  C: { title: 'Objectif C — secondaire (optionnel)', optional: true },
}

const DISCIPLINE_LABELS: Record<string, string> = {
  swim: 'Natation',
  bike: 'Vélo',
  run: 'Course à pied',
  strength: 'Renforcement',
}
const COMPLEMENTARY_CHOICES = ['swim', 'bike', 'run', 'strength'] as const

export function ProgramForm({
  goals,
  availableDisciplines,
}: {
  goals: Goal[]
  availableDisciplines: string[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'race' | 'maintenance'>('race')
  const [loading, setLoading] = useState(false)
  // Dévoilement progressif : objectifs secondaires et disciplines
  // complémentaires n'apparaissent qu'à la demande.
  const [visibleSecondaries, setVisibleSecondaries] = useState(0) // 0 → aucun, max 2 (B, C)
  const [showComplementary, setShowComplementary] = useState(false)
  const [complementary, setComplementary] = useState<string[]>([])

  const initialMode: SlotMode = goals.length > 0 ? 'existing' : 'new'
  const [slotModes, setSlotModes] = useState<Record<SlotKey, SlotMode>>({
    A: initialMode,
    B: initialMode,
    C: initialMode,
  })
  const [existingIds, setExistingIds] = useState<Record<SlotKey, string | undefined>>({
    A: undefined,
    B: undefined,
    C: undefined,
  })

  // Un ref de fieldset par slot (ordre d'appel des hooks fixe → OK).
  const fieldsetRefs: Record<SlotKey, React.RefObject<GoalFieldsetHandle | null>> = {
    A: useRef<GoalFieldsetHandle>(null),
    B: useRef<GoalFieldsetHandle>(null),
    C: useRef<GoalFieldsetHandle>(null),
  }

  const settingsForm = useForm<ProgramSettings>({
    resolver: zodResolver(ProgramSettingsSchema),
    defaultValues: {
      methodology: 'polarized',
      start_date: format(new Date(), 'yyyy-MM-dd'),
    },
  })
  const selectedMethodology = useWatch({ control: settingsForm.control, name: 'methodology' })

  // Ids existants retenus par les autres slots (pour exclure des menus).
  function excludeFor(slot: SlotKey): string[] {
    return SLOTS.filter((s) => s !== slot)
      .map((s) => (slotModes[s] === 'existing' ? existingIds[s] : undefined))
      .filter((x): x is string => !!x)
  }

  // Résout un slot : 'skip' (vide/optionnel), { invalid } (à compléter, avec
  // raison), ou les données à utiliser (course existante ou nouvelle à créer).
  async function resolveSlot(
    slot: SlotKey,
  ): Promise<'skip' | { invalid: string } | { existingId: string } | { create: GoalFormData }> {
    const required = slot === 'A'
    if (slotModes[slot] === 'existing') {
      const id = existingIds[slot]
      if (id) return { existingId: id }
      return required
        ? {
            invalid: `Objectif ${slot} : choisis une course existante ou passe sur « Nouvelle course ».`,
          }
        : 'skip'
    }
    const ref = fieldsetRefs[slot].current
    if (!ref) {
      return required
        ? {
            invalid: `Objectif ${slot} : le formulaire « Nouvelle course » n'est pas prêt, réessaie.`,
          }
        : 'skip'
    }
    if (!required && ref.isPristine()) return 'skip'
    const ok = await ref.validate()
    if (!ok) {
      return { invalid: `Objectif ${slot} : complète les champs requis (nom, date, type).` }
    }
    return { create: ref.getValues() }
  }

  async function createGoal(values: GoalFormData): Promise<string> {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Erreur création objectif')
    }
    const created = await res.json()
    return created.id as string
  }

  async function onGenerate(settings: ProgramSettings) {
    setLoading(true)
    try {
      let body: Record<string, unknown>

      if (mode === 'race') {
        // 1) Valider tous les slots avant de créer quoi que ce soit.
        const resolutions = {} as Record<
          SlotKey,
          'skip' | { existingId: string } | { create: GoalFormData }
        >
        for (const slot of SLOTS) {
          const r = await resolveSlot(slot)
          if (typeof r === 'object' && 'invalid' in r) {
            console.error('[ProgramForm] slot invalide', {
              slot,
              mode: slotModes[slot],
              existingId: existingIds[slot],
              hasRef: !!fieldsetRefs[slot].current,
              reason: r.invalid,
            })
            toast.error(r.invalid)
            return
          }
          resolutions[slot] = r
        }

        // 2) Créer les nouvelles courses (A puis B puis C).
        const idBySlot: Partial<Record<SlotKey, string>> = {}
        for (const slot of SLOTS) {
          const r = resolutions[slot]
          if (r === 'skip') continue
          idBySlot[slot] = 'existingId' in r ? r.existingId : await createGoal(r.create)
        }

        const primaryId = idBySlot.A
        if (!primaryId) {
          toast.error('Course principale requise.')
          return
        }

        // 3) Assembler + générer.
        const { goal_ids, primary_goal_id } = assembleGoalIds({
          primaryId,
          secondaryIds: [idBySlot.B, idBySlot.C],
        })
        body = {
          mode,
          goal_ids,
          primary_goal_id,
          complementary_disciplines: complementary.length ? complementary : undefined,
          methodology: settings.methodology,
          start_date: settings.start_date,
        }
      } else {
        body = {
          mode,
          methodology: settings.methodology,
          start_date: settings.start_date,
        }
      }

      toast.info("Génération du programme par l'IA… (peut prendre 10-20 secondes)", {
        duration: 20000,
      })

      const genRes = await fetch('/api/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const genData = await genRes.json()
      if (!genRes.ok) throw new Error(genData.error ?? 'Erreur génération')

      toast.success(`Programme généré ! ${genData.total_weeks} semaines, ${genData.phases} phases.`)
      router.push('/program')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Mode selector */}
      <section aria-labelledby="program-mode-label" className="space-y-3">
        <SectionLabel id="program-mode-label">Type de programme</SectionLabel>
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'race' | 'maintenance')}>
          <TabsList className={CHOICE_TABS_LIST_CLASS}>
            <TabsTrigger value="race" className={CHOICE_TAB_CLASS}>
              Préparation course
            </TabsTrigger>
            <TabsTrigger value="maintenance" className={CHOICE_TAB_CLASS}>
              Maintien de forme
            </TabsTrigger>
          </TabsList>

          {/* Race mode : objectif principal d'emblée, le reste à la demande */}
          <TabsContent value="race" className="mt-4 space-y-4">
            {SLOTS.slice(0, 1 + visibleSecondaries).map((slot) => (
              <GoalSlot
                key={slot}
                priority={slot}
                title={SLOT_META[slot].title}
                description={SLOT_META[slot].description}
                optional={SLOT_META[slot].optional}
                goals={goals}
                excludeIds={excludeFor(slot)}
                mode={slotModes[slot]}
                onModeChange={(m) => setSlotModes((prev) => ({ ...prev, [slot]: m }))}
                existingId={existingIds[slot]}
                onExistingIdChange={(id) => setExistingIds((prev) => ({ ...prev, [slot]: id }))}
                fieldsetRef={fieldsetRefs[slot]}
              />
            ))}

            {/* Boutons de dévoilement progressif */}
            <div className="flex flex-col gap-2 sm:flex-row">
              {visibleSecondaries < 2 && (
                <Button
                  type="button"
                  variant="outline-primary"
                  className="flex-1"
                  onClick={() => setVisibleSecondaries((n) => Math.min(2, n + 1))}
                >
                  <Plus aria-hidden />
                  Ajouter un objectif secondaire
                </Button>
              )}
              {!showComplementary && (
                <Button
                  type="button"
                  variant="outline-primary"
                  className="flex-1"
                  onClick={() => setShowComplementary(true)}
                >
                  <Plus aria-hidden />
                  Ajouter des disciplines complémentaires
                </Button>
              )}
            </div>

            {/* Disciplines complémentaires (cross-training) */}
            {showComplementary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">Disciplines complémentaires</CardTitle>
                  <CardDescription>
                    Entraînées en plus de ton objectif, avec une vraie progression. Elles se
                    réduisent automatiquement en fin de prépa (pic / affûtage) pour protéger ton
                    objectif. Celles déjà couvertes par ton objectif sont ignorées.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {COMPLEMENTARY_CHOICES.filter(
                    (d) => !availableDisciplines.length || availableDisciplines.includes(d),
                  ).map((d) => {
                    const active = complementary.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setComplementary((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                          )
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                          active
                            ? 'border-primary bg-accent text-primary-ink'
                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                        )}
                      >
                        <DisciplineIcon discipline={d} className="size-4" />
                        {DISCIPLINE_LABELS[d] ?? d}
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Maintenance mode */}
          <TabsContent value="maintenance" className="mt-4">
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Programme continu sans date de fin. L&apos;IA génère 12 semaines de base,
                  renouvelables automatiquement selon vos données Garmin.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Program settings (common) */}
      <section
        aria-labelledby="program-settings-label"
        className="space-y-5 border-t border-border pt-8"
      >
        <SectionLabel id="program-settings-label">Paramètres du programme</SectionLabel>

        <div className="space-y-2">
          <Label htmlFor="program-start-date">Date de début</Label>
          <Input
            id="program-start-date"
            type="date"
            className="sm:max-w-xs"
            {...settingsForm.register('start_date')}
          />
        </div>

        <div className="space-y-3">
          <Label>Méthodologie</Label>
          <div className="space-y-2">
            {METHODOLOGIES.map((m) => {
              const active = selectedMethodology === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    settingsForm.setValue('methodology', m.value as ProgramSettings['methodology'])
                  }
                  className={cn(
                    'w-full rounded-xl border-[1.5px] p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    active
                      ? 'border-primary bg-accent'
                      : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      active ? 'text-primary-ink' : 'text-foreground',
                    )}
                  >
                    {m.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.desc}</p>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <Button
        variant="highlight"
        size="lg"
        className="w-full"
        disabled={loading}
        onClick={() => settingsForm.handleSubmit(onGenerate)()}
      >
        {loading ? (
          <>
            <Loader2 aria-hidden className="animate-spin" />
            Génération en cours…
          </>
        ) : (
          <>
            <Sparkles aria-hidden />
            Générer mon programme avec l&apos;IA
          </>
        )}
      </Button>
    </div>
  )
}
