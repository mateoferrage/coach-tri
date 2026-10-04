'use client'

import { useState, useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GoalBaseSchema, RACE_DISTANCES } from '@/lib/schemas/goal'
import { format } from 'date-fns'

// Strip .default() from shared schema — react-hook-form resolver requires input/output types to match.
// Uses GoalBaseSchema (the plain object) because `.omit` can't run on GoalSchema's refinement.
const GoalFormSchema = GoalBaseSchema.omit({
  sport: true,
  priority: true,
  target_type: true,
}).extend({
  sport: z.enum(['triathlon', 'running']).optional(),
  priority: z.enum(['A', 'B', 'C']).optional(),
  target_type: z.enum(['finish', 'time', 'podium']).optional(),
})

const ProgramSettingsSchema = z.object({
  methodology: z.enum(['polarized', 'pyramidal', 'threshold']),
  start_date: z.string().min(1),
  existing_goal_id: z.string().optional(),
})

type GoalFormData = z.infer<typeof GoalFormSchema>
type ProgramSettings = z.infer<typeof ProgramSettingsSchema>

const RACE_TYPES = [
  { value: 'sprint', label: 'Sprint (750m / 20km / 5km)' },
  { value: 'olympic', label: 'Olympique (1.5km / 40km / 10km)' },
  { value: 'half', label: 'Half (1.9km / 90km / 21.1km)' },
  { value: 'full', label: 'Full (3.8km / 180km / 42.2km)' },
  { value: 'xterra', label: 'XTERRA (trail/off-road)' },
  { value: 'custom', label: 'Personnalisé' },
]

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

function TimeInput({
  label,
  valueSeconds,
  onChange,
  showHours = true,
}: {
  label: string
  valueSeconds: number | undefined
  onChange: (seconds: number | undefined) => void
  showHours?: boolean
}) {
  const [h, setH] = useState(valueSeconds != null ? Math.floor(valueSeconds / 3600) : 0)
  const [m, setM] = useState(valueSeconds != null ? Math.floor((valueSeconds % 3600) / 60) : 0)
  const [s, setS] = useState(valueSeconds != null ? valueSeconds % 60 : 0)

  const fire = useCallback(
    (nh: number, nm: number, ns: number) => {
      const total = nh * 3600 + nm * 60 + ns
      onChange(total > 0 ? total : undefined)
    },
    [onChange],
  )

  return (
    <div className="space-y-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-1">
        {showHours && (
          <>
            <Input
              type="number"
              min={0}
              max={23}
              value={h}
              onChange={(e) => {
                const n = Math.max(0, Math.min(23, parseInt(e.target.value) || 0))
                setH(n)
                fire(n, m, s)
              }}
              className="w-14 text-center px-1"
            />
            <span className="text-muted-foreground text-xs">h</span>
          </>
        )}
        <Input
          type="number"
          min={0}
          max={59}
          value={m}
          onChange={(e) => {
            const n = Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
            setM(n)
            fire(h, n, s)
          }}
          className="w-14 text-center px-1"
        />
        <span className="text-muted-foreground text-xs">min</span>
        <Input
          type="number"
          min={0}
          max={59}
          value={s}
          onChange={(e) => {
            const n = Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
            setS(n)
            fire(h, m, n)
          }}
          className="w-14 text-center px-1"
        />
        <span className="text-muted-foreground text-xs">s</span>
      </div>
    </div>
  )
}

interface Goal {
  id: string
  race_name: string
  race_date: string
  race_type: string
}

export function ProgramForm({ goals }: { goals: Goal[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<'race' | 'maintenance'>('race')
  const [selectedRaceType, setSelectedRaceType] = useState<string>('olympic')
  const [loading, setLoading] = useState(false)
  const [goalCreated, setGoalCreated] = useState<Goal | null>(null)

  const goalForm = useForm<GoalFormData>({
    resolver: zodResolver(GoalFormSchema),
    defaultValues: { priority: 'A', target_type: 'finish' },
  })
  const watchTargetType = useWatch({ control: goalForm.control, name: 'target_type' })
  const settingsForm = useForm<ProgramSettings>({
    resolver: zodResolver(ProgramSettingsSchema),
    defaultValues: {
      methodology: 'polarized',
      start_date: format(new Date(), 'yyyy-MM-dd'),
    },
  })
  // useWatch (plutôt que settingsForm.watch dans le render) : compatible React Compiler
  const selectedMethodology = useWatch({ control: settingsForm.control, name: 'methodology' })

  function onRaceTypeChange(type: string | null) {
    if (!type) return
    setSelectedRaceType(type)
    goalForm.setValue('race_type', type as GoalFormData['race_type'])
    const distances = RACE_DISTANCES[type as keyof typeof RACE_DISTANCES]
    if (distances.swim) goalForm.setValue('swim_distance_m', distances.swim)
    if (distances.bike) goalForm.setValue('bike_distance_m', distances.bike)
    if (distances.run) goalForm.setValue('run_distance_m', distances.run)
  }

  async function createGoalAndGenerate(settings: ProgramSettings) {
    setLoading(true)
    try {
      let goal_id = settings.existing_goal_id ?? goalCreated?.id

      // If race mode and no goal yet, validate then create the goal first
      if (mode === 'race' && !goal_id) {
        const valid = await goalForm.trigger()
        if (!valid) {
          toast.error('Complète les informations de la course (nom, date, type).')
          return
        }
        const goalData = goalForm.getValues()
        const goalRes = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(goalData),
        })
        if (!goalRes.ok) {
          const err = await goalRes.json()
          throw new Error(err.error ?? 'Erreur création objectif')
        }
        const created = await goalRes.json()
        goal_id = created.id
        setGoalCreated(created)
      }

      // Generate program
      toast.info("Génération du programme par l'IA… (peut prendre 10-20 secondes)", {
        duration: 20000,
      })

      const genRes = await fetch('/api/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          goal_id: mode === 'race' ? goal_id : undefined,
          methodology: settings.methodology,
          start_date: settings.start_date,
        }),
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
    <div className="space-y-6">
      {/* Mode selector */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'race' | 'maintenance')}>
        <TabsList className="w-full">
          <TabsTrigger value="race" className="flex-1">
            Préparation course
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex-1">
            Maintien de forme
          </TabsTrigger>
        </TabsList>

        {/* Race mode */}
        <TabsContent value="race" className="space-y-4 mt-4">
          {goals.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Utiliser une course existante</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  onValueChange={(v) =>
                    settingsForm.setValue('existing_goal_id', v != null ? String(v) : undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une course..." />
                  </SelectTrigger>
                  <SelectContent>
                    {goals.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.race_name} — {g.race_date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {goals.length > 0 ? 'Ou créer une nouvelle course' : 'Votre course cible'}
              </CardTitle>
              <CardDescription>Les distances sont pré-remplies selon le type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nom de la course</Label>
                <Input placeholder="Ex: Ironman 70.3 Nice" {...goalForm.register('race_name')} />
                {goalForm.formState.errors.race_name && (
                  <p className="text-xs text-red-500">
                    {goalForm.formState.errors.race_name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de la course</Label>
                  <Input type="date" {...goalForm.register('race_date')} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select defaultValue="olympic" onValueChange={onRaceTypeChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RACE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedRaceType === 'custom' && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nage (m)</Label>
                    <Input
                      type="number"
                      {...goalForm.register('swim_distance_m', { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vélo (m)</Label>
                    <Input
                      type="number"
                      {...goalForm.register('bike_distance_m', { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Course (m)</Label>
                    <Input
                      type="number"
                      {...goalForm.register('run_distance_m', { valueAsNumber: true })}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Terrain vélo/course</Label>
                  <Select
                    onValueChange={(v) =>
                      goalForm.setValue('terrain', (v ?? undefined) as GoalFormData['terrain'])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Terrain..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Plat</SelectItem>
                      <SelectItem value="hilly">Vallonné</SelectItem>
                      <SelectItem value="mountainous">Montagneux</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Objectif</Label>
                  <Select
                    defaultValue="finish"
                    onValueChange={(v) =>
                      goalForm.setValue(
                        'target_type',
                        (v ?? undefined) as GoalFormData['target_type'],
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="finish">Terminer</SelectItem>
                      <SelectItem value="time">Chrono cible</SelectItem>
                      <SelectItem value="podium">Podium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {watchTargetType === 'time' && (
                <div className="space-y-4 p-4 bg-muted rounded-lg border border-border">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Temps total cible</p>
                    <TimeInput
                      label=""
                      valueSeconds={goalForm.getValues('target_time_seconds')}
                      onChange={(v) => goalForm.setValue('target_time_seconds', v)}
                      showHours
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Détail par discipline{' '}
                      <span className="font-normal text-muted-foreground">(optionnel)</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <TimeInput
                        label="Natation"
                        valueSeconds={goalForm.getValues('swim_target_time_s')}
                        onChange={(v) => goalForm.setValue('swim_target_time_s', v)}
                        showHours={false}
                      />
                      <TimeInput
                        label="T1"
                        valueSeconds={goalForm.getValues('t1_target_time_s')}
                        onChange={(v) => goalForm.setValue('t1_target_time_s', v)}
                        showHours={false}
                      />
                      <TimeInput
                        label="Vélo"
                        valueSeconds={goalForm.getValues('bike_target_time_s')}
                        onChange={(v) => goalForm.setValue('bike_target_time_s', v)}
                        showHours
                      />
                      <TimeInput
                        label="T2"
                        valueSeconds={goalForm.getValues('t2_target_time_s')}
                        onChange={(v) => goalForm.setValue('t2_target_time_s', v)}
                        showHours={false}
                      />
                      <TimeInput
                        label="Course à pied"
                        valueSeconds={goalForm.getValues('run_target_time_s')}
                        onChange={(v) => goalForm.setValue('run_target_time_s', v)}
                        showHours
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance mode */}
        <TabsContent value="maintenance" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Programme continu sans date de fin. L&apos;IA génère 12 semaines de base,
                renouvelables automatiquement selon vos données Garmin.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Program settings (common) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paramètres du programme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Date de début</Label>
            <Input type="date" {...settingsForm.register('start_date')} />
          </div>

          <div className="space-y-3">
            <Label>Méthodologie</Label>
            {METHODOLOGIES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() =>
                  settingsForm.setValue('methodology', m.value as ProgramSettings['methodology'])
                }
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                  selectedMethodology === m.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <p className="font-medium text-sm">{m.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        size="lg"
        disabled={loading}
        onClick={settingsForm.handleSubmit(createGoalAndGenerate)}
      >
        {loading ? '✨ Génération en cours…' : "✨ Générer mon programme avec l'IA"}
      </Button>
    </div>
  )
}
