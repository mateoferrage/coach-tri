'use client'

import { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GoalBaseSchema, RACE_DISTANCES, SPORT_TYPES } from '@/lib/schemas/goal'

// Strip .default() from shared schema — react-hook-form resolver requires input/output types to match.
// Uses GoalBaseSchema (the plain object) because `.omit` can't run on GoalSchema's refinement.
const GoalFormSchema = GoalBaseSchema.omit({
  sport: true,
  priority: true,
  target_type: true,
}).extend({
  sport: z.enum(SPORT_TYPES).optional(),
  priority: z.enum(['A', 'B', 'C']).optional(),
  target_type: z.enum(['finish', 'time', 'podium']).optional(),
})

export type GoalFormData = z.infer<typeof GoalFormSchema>

export interface GoalFieldsetHandle {
  /** Déclenche la validation RHF/zod du formulaire. */
  validate: () => Promise<boolean>
  /** Valeurs du formulaire, nettoyées des NaN (inputs number vides). */
  getValues: () => GoalFormData
  /** True si aucun nom de course n'est saisi → slot optionnel resté vide. */
  isPristine: () => boolean
}

const RACE_TYPES = [
  { value: 'sprint', label: 'Sprint (750m / 20km / 5km)' },
  { value: 'olympic', label: 'Olympique (1.5km / 40km / 10km)' },
  { value: 'half', label: 'Half (1.9km / 90km / 21.1km)' },
  { value: 'full', label: 'Full (3.8km / 180km / 42.2km)' },
  { value: 'xterra', label: 'XTERRA (trail/off-road)' },
  { value: 'custom', label: 'Personnalisé' },
]

const RUNNING_RACE_TYPES_UI = [
  { value: 'road', label: 'Route (10 km, semi, marathon…)' },
  { value: 'trail', label: 'Trail' },
  { value: 'ultra', label: 'Ultra' },
]

const SURFACE_OPTIONS = [
  { value: 'road', label: 'Route' },
  { value: 'gravel', label: 'Chemin roulant' },
  { value: 'technical', label: 'Sentier technique' },
  { value: 'mountain', label: 'Montagne' },
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

/**
 * Formulaire complet de création d'une course (objectif A, B ou C).
 * Autonome : possède son propre useForm et expose validate/getValues/isPristine
 * via ref pour que le parent orchestre « valider tout → créer tout → générer ».
 */
export const GoalFieldset = forwardRef<GoalFieldsetHandle, { priority: 'A' | 'B' | 'C' }>(
  function GoalFieldset({ priority }, ref) {
    const goalForm = useForm<GoalFormData>({
      resolver: zodResolver(GoalFormSchema),
      defaultValues: { priority, target_type: 'finish', sport: 'triathlon', race_type: 'olympic' },
    })
    const [selectedRaceType, setSelectedRaceType] = useState<string>('olympic')
    const [sport, setSport] = useState<'triathlon' | 'running'>('triathlon')
    const watchTargetType = useWatch({ control: goalForm.control, name: 'target_type' })

    useImperativeHandle(
      ref,
      () => ({
        validate: () => goalForm.trigger(),
        getValues: () => {
          const raw = goalForm.getValues()
          return Object.fromEntries(
            Object.entries(raw).filter(([, v]) => !(typeof v === 'number' && isNaN(v))),
          ) as GoalFormData
        },
        isPristine: () => !goalForm.getValues('race_name')?.trim(),
      }),
      [goalForm],
    )

    function onRaceTypeChange(type: string | null) {
      if (!type) return
      setSelectedRaceType(type)
      goalForm.setValue('race_type', type as GoalFormData['race_type'])
      const distances = RACE_DISTANCES[type as keyof typeof RACE_DISTANCES]
      if (!distances) return // type de course à pied : pas de pré-remplissage triathlon
      if (distances.swim) goalForm.setValue('swim_distance_m', distances.swim)
      if (distances.bike) goalForm.setValue('bike_distance_m', distances.bike)
      if (distances.run) goalForm.setValue('run_distance_m', distances.run)
    }

    function onSportChange(value: string | null) {
      if (!value) return
      const s = value as 'triathlon' | 'running'
      setSport(s)
      goalForm.setValue('sport', s)
      if (s === 'triathlon') {
        onRaceTypeChange('olympic')
      } else {
        setSelectedRaceType('trail')
        goalForm.setValue('race_type', 'trail')
      }
    }

    return (
      <div className="space-y-4">
        {/* Sport selector */}
        <div className="space-y-2">
          <Label>Sport</Label>
          <Select defaultValue="triathlon" onValueChange={onSportChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="triathlon">Triathlon</SelectItem>
              <SelectItem value="running">Course à pied (route / trail / ultra)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Nom de la course</Label>
          <Input
            placeholder={sport === 'triathlon' ? 'Ex: Ironman 70.3 Nice' : 'Ex: UTMB, Paris Marathon…'}
            {...goalForm.register('race_name')}
          />
          {goalForm.formState.errors.race_name && (
            <p className="text-xs text-red-500">{goalForm.formState.errors.race_name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date de la course</Label>
            <Input type="date" {...goalForm.register('race_date')} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            {sport === 'triathlon' ? (
              <Select value={selectedRaceType} onValueChange={onRaceTypeChange}>
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
            ) : (
              <Select
                value={selectedRaceType}
                onValueChange={(v) => {
                  if (!v) return
                  setSelectedRaceType(v)
                  goalForm.setValue('race_type', v as GoalFormData['race_type'])
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUNNING_RACE_TYPES_UI.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Triathlon-specific: custom distances */}
        {sport === 'triathlon' && selectedRaceType === 'custom' && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nage (m)</Label>
              <Input type="number" {...goalForm.register('swim_distance_m', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vélo (m)</Label>
              <Input type="number" {...goalForm.register('bike_distance_m', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Course (m)</Label>
              <Input type="number" {...goalForm.register('run_distance_m', { valueAsNumber: true })} />
            </div>
          </div>
        )}

        {/* Running-specific fields */}
        {sport === 'running' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Distance (m)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 42195"
                  {...goalForm.register('run_distance_m', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">D+ dénivelé positif (m)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 2300"
                  {...goalForm.register('run_elevation_m', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">D- dénivelé négatif (m)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 2300"
                  {...goalForm.register('elevation_loss_m', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Altitude max (m)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 2500"
                  {...goalForm.register('max_altitude_m', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Technicité</Label>
                <Select
                  onValueChange={(v) => goalForm.setValue('surface', v as GoalFormData['surface'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Technicité..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SURFACE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Profil</Label>
                <Select
                  onValueChange={(v) =>
                    goalForm.setValue('terrain', (v ?? undefined) as GoalFormData['terrain'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Profil..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Plat</SelectItem>
                    <SelectItem value="hilly">Vallonné</SelectItem>
                    <SelectItem value="mountainous">Montagneux</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TimeInput
                label="Barrière horaire (cut-off)"
                valueSeconds={goalForm.getValues('cutoff_time_s')}
                onChange={(v) => goalForm.setValue('cutoff_time_s', v)}
                showHours
              />
              <TimeInput
                label="Temps estimé"
                valueSeconds={goalForm.getValues('estimated_finish_time_s')}
                onChange={(v) => goalForm.setValue('estimated_finish_time_s', v)}
                showHours
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {sport === 'triathlon' && (
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
          )}
          <div className={sport === 'triathlon' ? 'space-y-2' : 'space-y-2 col-span-2'}>
            <Label>Objectif</Label>
            <Select
              defaultValue="finish"
              onValueChange={(v) =>
                goalForm.setValue('target_type', (v ?? undefined) as GoalFormData['target_type'])
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

            {sport === 'triathlon' && (
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
            )}
          </div>
        )}
      </div>
    )
  },
)
