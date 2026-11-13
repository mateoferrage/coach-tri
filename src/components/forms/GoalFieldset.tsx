'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useForm, useWatch, type FieldPath, type PathValue } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Flag, Timer } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { GoalBaseSchema, RACE_DISTANCES, SPORT_TYPES } from '@/lib/schemas/goal'
import { ChoiceGroup, type Choice } from './ChoiceGroup'

// Strip .default() from shared schema — react-hook-form resolver requires input/output types to match.
// Uses GoalBaseSchema (the plain object) because `.omit` can't run on GoalSchema's refinement.
const GoalFormSchema = GoalBaseSchema.omit({
  sport: true,
  priority: true,
  target_type: true,
})
  .extend({
    sport: z.enum(SPORT_TYPES).optional(),
    priority: z.enum(['A', 'B', 'C']).optional(),
    target_type: z.enum(['finish', 'time', 'podium']).optional(),
  })
  .superRefine((g, ctx) => {
    if (g.sport === 'running' && !g.run_distance_m) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['run_distance_m'],
        message: 'Distance requise',
      })
    }
    if (g.target_type === 'time' && !g.target_time_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_time_seconds'],
        message: 'Indique le chrono visé',
      })
    }
  })

export type GoalFormData = z.infer<typeof GoalFormSchema>

export interface GoalFieldsetHandle {
  /** Déclenche la validation RHF/zod du formulaire. */
  validate: () => Promise<boolean>
  /** Valeurs du formulaire, nettoyées des NaN (inputs number vides). */
  getValues: () => GoalFormData
  /** True si aucun nom de course n'est saisi → slot optionnel resté vide. */
  isPristine: () => boolean
  /** True si l'utilisateur a modifié au moins un champ depuis l'ouverture. */
  isDirty: () => boolean
}

type Sport = (typeof SPORT_TYPES)[number]

const SPORT_CHOICES: Choice<Sport>[] = [
  {
    value: 'triathlon',
    label: 'Triathlon',
    hint: 'Natation, vélo, course',
    icon: (
      <>
        <DisciplineIcon discipline="swim" className="size-4" />
        <DisciplineIcon discipline="bike" className="size-4" />
        <DisciplineIcon discipline="run" className="size-4" />
      </>
    ),
  },
  {
    value: 'running',
    label: 'Course à pied',
    hint: 'Route ou trail',
    icon: <DisciplineIcon discipline="run" className="size-4" />,
  },
]

const TRI_FORMATS: Choice<string>[] = [
  { value: 'sprint', label: 'Sprint', hint: '750 m · 20 km · 5 km' },
  { value: 'olympic', label: 'Olympique', hint: '1,5 km · 40 km · 10 km' },
  { value: 'half', label: 'Half', hint: '1,9 km · 90 km · 21,1 km' },
  { value: 'full', label: 'Full', hint: '3,8 km · 180 km · 42,2 km' },
  { value: 'xterra', label: 'XTERRA', hint: 'Off-road' },
  { value: 'custom', label: 'Personnalisé', hint: 'Tes distances' },
]

const RUN_TYPES: Choice<string>[] = [
  { value: 'road', label: 'Route', hint: '10 km, semi, marathon…' },
  { value: 'trail', label: 'Trail', hint: 'Chemins, dénivelé' },
]

const TERRAIN_CHOICES: Choice<'flat' | 'hilly' | 'mountainous'>[] = [
  { value: 'flat', label: 'Plat' },
  { value: 'hilly', label: 'Vallonné' },
  { value: 'mountainous', label: 'Montagneux' },
]

const SURFACE_CHOICES: Choice<'road' | 'gravel' | 'technical' | 'mountain'>[] = [
  { value: 'gravel', label: 'Chemin roulant' },
  { value: 'technical', label: 'Sentier technique' },
  { value: 'mountain', label: 'Haute montagne' },
  { value: 'road', label: 'Surtout bitume' },
]

const TARGET_CHOICES: Choice<'finish' | 'time'>[] = [
  {
    value: 'finish',
    label: 'Terminer',
    hint: 'Le coach estime un temps confortable à partir de tes allures actuelles.',
    icon: <Flag className="size-4" aria-hidden />,
  },
  {
    value: 'time',
    label: 'Chrono cible',
    hint: 'Le programme part de tes allures actuelles et se rapproche de ton allure visée.',
    icon: <Timer className="size-4" aria-hidden />,
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
              max={99}
              value={h}
              aria-label={`${label || 'Temps'} — heures`}
              onChange={(e) => {
                const n = Math.max(0, Math.min(99, parseInt(e.target.value) || 0))
                setH(n)
                fire(n, m, s)
              }}
              className="w-14 px-1 text-center tabular-nums"
            />
            <span className="text-muted-foreground text-xs">h</span>
          </>
        )}
        <Input
          type="number"
          min={0}
          max={59}
          value={m}
          aria-label={`${label || 'Temps'} — minutes`}
          onChange={(e) => {
            const n = Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
            setM(n)
            fire(h, n, s)
          }}
          className="w-14 px-1 text-center tabular-nums"
        />
        <span className="text-muted-foreground text-xs">min</span>
        <Input
          type="number"
          min={0}
          max={59}
          value={s}
          aria-label={`${label || 'Temps'} — secondes`}
          onChange={(e) => {
            const n = Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
            setS(n)
            fire(h, m, n)
          }}
          className="w-14 px-1 text-center tabular-nums"
        />
        <span className="text-muted-foreground text-xs">s</span>
      </div>
    </div>
  )
}

/** Saisie en km (décimales autorisées), stockée en mètres. */
function KmInput({
  id,
  valueMeters,
  onChange,
  placeholder,
}: {
  id: string
  valueMeters: number | undefined
  onChange: (meters: number | undefined) => void
  placeholder?: string
}) {
  const [text, setText] = useState(valueMeters ? String(valueMeters / 1000) : '')
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={0.1}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const km = parseFloat(e.target.value.replace(',', '.'))
          onChange(km > 0 ? Math.round(km * 1000) : undefined)
        }}
        className="pr-10"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        km
      </span>
    </div>
  )
}

const TARGET_TIME_FIELDS: string[] = [
  'target_time_seconds',
  'swim_target_time_s',
  't1_target_time_s',
  'bike_target_time_s',
  't2_target_time_s',
  'run_target_time_s',
]
// Champs réservés à la course à pied (refusés sur un triathlon par GoalSchema).
const RUNNING_ONLY_FIELDS = [
  'surface',
  'elevation_loss_m',
  'max_altitude_m',
  'cutoff_time_s',
  'estimated_finish_time_s',
] as const

function fmtPace(timeS: number | undefined, distanceM: number | undefined): string | null {
  if (!timeS || !distanceM) return null
  const secPerKm = Math.round(timeS / (distanceM / 1000))
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')} /km`
}

/** Course telle que lue en base (colonnes nullables). */
export type GoalRow = Record<string, unknown>

/**
 * Valeurs de départ du formulaire à partir d'une course enregistrée. Les
 * anciens formats sont ramenés aux choix actuels : ultra → trail,
 * podium → chrono cible (s'il y a un chrono) ou terminer.
 */
export function goalRowToFormValues(row: GoalRow): Partial<GoalFormData> {
  const clean = Object.fromEntries(
    Object.entries(row).filter(([k, v]) => v != null && k in GoalBaseSchema.shape),
  ) as Partial<GoalFormData>
  if (clean.race_type === 'ultra') clean.race_type = 'trail'
  if (clean.target_type === 'podium') {
    clean.target_type = clean.target_time_seconds ? 'time' : 'finish'
  }
  return clean
}

/**
 * Formulaire complet d'une course (objectif A, B ou C), vierge ou pré-rempli
 * avec une course existante (`initial`). Autonome : possède son propre useForm
 * et expose validate/getValues/isPristine/isDirty via ref pour que le parent
 * orchestre « valider tout → créer/mettre à jour → générer ».
 */
export const GoalFieldset = forwardRef<
  GoalFieldsetHandle,
  { priority: 'A' | 'B' | 'C'; initial?: Partial<GoalFormData> }
>(function GoalFieldset({ priority, initial }, ref) {
  const idPrefix = `goal-${priority}`
  const goalForm = useForm<GoalFormData>({
    resolver: zodResolver(GoalFormSchema),
    defaultValues: initial
      ? { target_type: 'finish', ...initial, priority }
      : {
          priority,
          target_type: 'finish',
          sport: 'triathlon',
          race_type: 'olympic',
          swim_distance_m: RACE_DISTANCES.olympic.swim,
          bike_distance_m: RACE_DISTANCES.olympic.bike,
          run_distance_m: RACE_DISTANCES.olympic.run,
        },
  })
  const { control, setValue, getValues, formState } = goalForm
  const sport = useWatch({ control, name: 'sport' }) ?? 'triathlon'
  const raceType = useWatch({ control, name: 'race_type' })
  const targetType = useWatch({ control, name: 'target_type' }) ?? 'finish'
  const terrain = useWatch({ control, name: 'terrain' })
  const surface = useWatch({ control, name: 'surface' })
  const runDistance = useWatch({ control, name: 'run_distance_m' })
  const targetTime = useWatch({ control, name: 'target_time_seconds' })
  // Remonte les champs de distance quand le format change (préremplissage).
  const [distanceKey, setDistanceKey] = useState(0)

  const dirty = useRef(false)
  useEffect(() => {
    return goalForm.subscribe({
      formState: { values: true },
      callback: () => {
        dirty.current = true
      },
    })
  }, [goalForm])

  useImperativeHandle(
    ref,
    () => ({
      validate: () => goalForm.trigger(),
      getValues: () => {
        const raw = goalForm.getValues()
        const finish = raw.target_type !== 'time'
        return Object.fromEntries(
          Object.entries(raw).filter(
            ([k, v]) =>
              !(typeof v === 'number' && isNaN(v)) && !(finish && TARGET_TIME_FIELDS.includes(k)),
          ),
        ) as GoalFormData
      },
      isPristine: () => !goalForm.getValues('race_name')?.trim(),
      isDirty: () => dirty.current,
    }),
    [goalForm],
  )

  const set = <K extends FieldPath<GoalFormData>>(name: K, value: PathValue<GoalFormData, K>) =>
    setValue(name, value, { shouldDirty: true, shouldValidate: formState.isSubmitted })

  function onTriFormatChange(type: string) {
    set('race_type', type as GoalFormData['race_type'])
    const d = RACE_DISTANCES[type as keyof typeof RACE_DISTANCES]
    if (d?.swim) set('swim_distance_m', d.swim)
    if (d?.bike) set('bike_distance_m', d.bike)
    if (d?.run) set('run_distance_m', d.run)
    setDistanceKey((k) => k + 1)
  }

  function onSportChange(s: Sport) {
    if (s === sport) return
    set('sport', s)
    if (s === 'triathlon') {
      for (const f of RUNNING_ONLY_FIELDS) set(f, undefined)
      onTriFormatChange('olympic')
    } else {
      set('race_type', 'road')
      set('swim_distance_m', undefined)
      set('bike_distance_m', undefined)
      set('run_distance_m', undefined)
      setDistanceKey((k) => k + 1)
    }
  }

  const errors = formState.errors
  const pace = sport === 'running' ? fmtPace(targetTime, runDistance) : null

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Sport</Label>
        <ChoiceGroup label="Sport" choices={SPORT_CHOICES} value={sport} onChange={onSportChange} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Nom de la course</Label>
          <Input
            id={`${idPrefix}-name`}
            placeholder={sport === 'triathlon' ? 'Ex : Ironman 70.3 Nice' : 'Ex : Marathon de Paris'}
            {...goalForm.register('race_name')}
          />
          {errors.race_name && <p className="text-xs text-destructive">{errors.race_name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-date`}>Date</Label>
          <Input id={`${idPrefix}-date`} type="date" {...goalForm.register('race_date')} />
          {errors.race_date && <p className="text-xs text-destructive">{errors.race_date.message}</p>}
        </div>
      </div>

      {sport === 'triathlon' ? (
        <div className="space-y-2">
          <Label>Format</Label>
          <ChoiceGroup
            label="Format"
            choices={TRI_FORMATS}
            value={raceType}
            onChange={onTriFormatChange}
            columns={3}
            size="sm"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Type de course</Label>
          <ChoiceGroup
            label="Type de course"
            choices={RUN_TYPES}
            value={raceType === 'ultra' ? 'trail' : raceType}
            onChange={(v) => {
              set('race_type', v as GoalFormData['race_type'])
              if (v === 'road') set('surface', undefined)
            }}
            size="sm"
          />
        </div>
      )}

      {sport === 'triathlon' && raceType === 'custom' && (
        <div key={distanceKey} className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-swim`} className="text-xs">
              Natation (m)
            </Label>
            <Input
              id={`${idPrefix}-swim`}
              type="number"
              {...goalForm.register('swim_distance_m', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-bike`} className="text-xs">
              Vélo
            </Label>
            <KmInput
              id={`${idPrefix}-bike`}
              valueMeters={getValues('bike_distance_m')}
              onChange={(v) => set('bike_distance_m', v)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-run`} className="text-xs">
              Course
            </Label>
            <KmInput
              id={`${idPrefix}-run`}
              valueMeters={getValues('run_distance_m')}
              onChange={(v) => set('run_distance_m', v)}
            />
          </div>
        </div>
      )}

      {sport === 'running' && (
        <div key={distanceKey} className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-distance`}>Distance</Label>
            <KmInput
              id={`${idPrefix}-distance`}
              placeholder={raceType === 'road' ? 'Ex : 42.195' : 'Ex : 35'}
              valueMeters={getValues('run_distance_m')}
              onChange={(v) => set('run_distance_m', v)}
            />
            {errors.run_distance_m && (
              <p className="text-xs text-destructive">{errors.run_distance_m.message}</p>
            )}
          </div>
          {raceType !== 'road' && (
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-elevation`}>
                D+ <span className="font-normal text-muted-foreground">(optionnel)</span>
              </Label>
              <div className="relative">
                <Input
                  id={`${idPrefix}-elevation`}
                  type="number"
                  min={0}
                  placeholder="Ex : 1800"
                  className="pr-10"
                  {...goalForm.register('run_elevation_m', { valueAsNumber: true })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  m
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {sport === 'running' && raceType !== 'road' && (
        <div className="space-y-2">
          <Label>
            Terrain <span className="font-normal text-muted-foreground">(optionnel)</span>
          </Label>
          <ChoiceGroup
            label="Terrain"
            choices={SURFACE_CHOICES}
            value={surface}
            onChange={(v) => set('surface', v)}
            size="sm"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>
          Profil du parcours <span className="font-normal text-muted-foreground">(optionnel)</span>
        </Label>
        <ChoiceGroup
          label="Profil du parcours"
          choices={TERRAIN_CHOICES}
          value={terrain}
          onChange={(v) => set('terrain', v)}
          columns={3}
          mobileColumns={3}
          size="sm"
        />
      </div>

      <div className="space-y-2">
        <Label>Objectif</Label>
        <ChoiceGroup
          label="Objectif"
          choices={TARGET_CHOICES}
          value={targetType === 'podium' ? 'time' : targetType}
          onChange={(v) => set('target_type', v)}
        />
      </div>

      {targetType === 'time' && (
        <div className="space-y-4 rounded-xl border border-border bg-muted p-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Chrono visé</p>
            <TimeInput
              label=""
              valueSeconds={getValues('target_time_seconds')}
              onChange={(v) => set('target_time_seconds', v)}
              showHours
            />
            {errors.target_time_seconds && (
              <p className="text-xs text-destructive">{errors.target_time_seconds.message}</p>
            )}
            {pace && (
              <p className="text-xs text-muted-foreground">Soit une allure moyenne de {pace}.</p>
            )}
          </div>

          {sport === 'triathlon' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Détail par discipline <span className="font-normal">(optionnel)</span>
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <TimeInput
                  label="Natation"
                  valueSeconds={getValues('swim_target_time_s')}
                  onChange={(v) => set('swim_target_time_s', v)}
                  showHours={false}
                />
                <TimeInput
                  label="T1"
                  valueSeconds={getValues('t1_target_time_s')}
                  onChange={(v) => set('t1_target_time_s', v)}
                  showHours={false}
                />
                <TimeInput
                  label="Vélo"
                  valueSeconds={getValues('bike_target_time_s')}
                  onChange={(v) => set('bike_target_time_s', v)}
                  showHours
                />
                <TimeInput
                  label="T2"
                  valueSeconds={getValues('t2_target_time_s')}
                  onChange={(v) => set('t2_target_time_s', v)}
                  showHours={false}
                />
                <TimeInput
                  label="Course à pied"
                  valueSeconds={getValues('run_target_time_s')}
                  onChange={(v) => set('run_target_time_s', v)}
                  showHours
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
