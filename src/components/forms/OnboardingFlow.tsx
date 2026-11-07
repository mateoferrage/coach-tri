'use client'

import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/common/SectionLabel'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { cn } from '@/lib/utils/cn'

// Zod v4 — use z.number() with valueAsNumber in form inputs
const Step1Schema = z.object({
  first_name: z.string().min(1, 'Prénom requis'),
  birth_date: z.string().min(1, 'Date de naissance requise'),
  sex: z.enum(['M', 'F', 'X']),
  weight_kg: z.number().optional(),
  height_cm: z.number().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'elite']),
  weekly_hours_avg: z.number().optional(),
})

const Step3Schema = z.object({
  garmin_email: z.string().optional(),
  garmin_password: z.string().optional(),
})

type Step1Data = z.infer<typeof Step1Schema>
type Step3Data = z.infer<typeof Step3Schema>

const DISCIPLINES = [
  { id: 'swim', label: 'Natation' },
  { id: 'bike', label: 'Vélo' },
  { id: 'run', label: 'Course à pied' },
]

const LEVELS = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced', label: 'Avancé' },
  { value: 'elite', label: 'Elite' },
]

const SEXES = [
  { value: 'M', label: 'Homme' },
  { value: 'F', label: 'Femme' },
  { value: 'X', label: 'Autre' },
]

const TOTAL_STEPS = 3

const PILL =
  'inline-flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
const PILL_ON = 'border-primary bg-accent text-primary-ink'
const PILL_OFF = 'border-border bg-card text-foreground hover:border-primary/40'

/** Choix unique en pastilles (radiogroup accessible, flèches pour changer). */
function ChoicePills({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const labelId = useId()
  const noneActive = !options.some((o) => o.value === value)
  return (
    <div className="space-y-2">
      <SectionLabel as="p" id={labelId}>
        {label}
      </SectionLabel>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((o, index) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active || (noneActive && index === 0) ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => {
                const step =
                  e.key === 'ArrowRight' || e.key === 'ArrowDown'
                    ? 1
                    : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                      ? -1
                      : 0
                if (!step) return
                e.preventDefault()
                const nextIndex = (index + step + options.length) % options.length
                onChange(options[nextIndex].value)
                const radios =
                  e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="radio"]',
                  )
                radios?.[nextIndex]?.focus()
              }}
              className={cn(PILL, active ? PILL_ON : PILL_OFF)}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 space-y-1">
      <h2 className="text-2xl">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

interface InitialData {
  first_name: string | null
  birth_date: string | null
  sex: string | null
  weight_kg: number | null
  height_cm: number | null
  level: string | null
  weekly_hours_avg: number | null
  available_disciplines: string[] | null
}

export function OnboardingFlow({
  initialData,
  isEditing = false,
}: {
  initialData?: InitialData | null
  isEditing?: boolean
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null)
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(
    initialData?.available_disciplines ?? ['swim', 'bike', 'run'],
  )
  const [loading, setLoading] = useState(false)

  const form1 = useForm<Step1Data>({
    resolver: zodResolver(Step1Schema),
    defaultValues: {
      first_name: initialData?.first_name ?? '',
      birth_date: initialData?.birth_date ?? '',
      sex: (initialData?.sex as 'M' | 'F' | 'X') ?? 'M',
      weight_kg: initialData?.weight_kg ?? undefined,
      height_cm: initialData?.height_cm ?? undefined,
      level: (initialData?.level as Step1Data['level']) ?? 'beginner',
      weekly_hours_avg: initialData?.weekly_hours_avg ?? undefined,
    },
  })
  const form3 = useForm<Step3Data>({ resolver: zodResolver(Step3Schema) })
  const sex = useWatch({ control: form1.control, name: 'sex' })
  const level = useWatch({ control: form1.control, name: 'level' })
  const disciplinesLabelId = useId()

  function toggleDiscipline(id: string) {
    setSelectedDisciplines((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    )
  }

  function onStep1(data: Step1Data) {
    setStep1Data(data)
    setStep(2)
  }

  function onStep2() {
    if (selectedDisciplines.length === 0) {
      toast.error('Sélectionnez au moins une discipline')
      return
    }
    setStep(3)
  }

  async function submitProfile(garminEmail?: string, garminPassword?: string) {
    if (!step1Data) return
    setLoading(true)

    try {
      const profileRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...step1Data,
          available_disciplines: selectedDisciplines,
        }),
      })
      if (!profileRes.ok) throw new Error('Erreur lors de la sauvegarde du profil')

      if (garminEmail && garminPassword) {
        const garminRes = await fetch('/api/garmin/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: garminEmail, password: garminPassword }),
        })
        if (!garminRes.ok) {
          toast.warning(
            'Profil sauvegardé mais connexion Garmin échouée. Configurez-la depuis votre profil.',
          )
        }
      }

      toast.success(isEditing ? 'Profil mis à jour !' : 'Profil configuré !')
      router.push(isEditing ? '/profile' : '/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function onStep3(data: Step3Data) {
    await submitProfile(data.garmin_email, data.garmin_password)
  }

  return (
    <div className="rounded-xl bg-card p-6 sm:p-8">
      <div className="mb-6 space-y-2">
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                s <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
        <p className="text-[13px] font-semibold text-muted-foreground">
          Étape {step} sur {TOTAL_STEPS}
        </p>
      </div>

      {step === 1 && (
        <>
          <StepHeader title="Votre profil" description="Dites-nous qui vous êtes" />
          <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="first_name">Prénom</Label>
              <Input id="first_name" className="h-10" {...form1.register('first_name')} />
              {form1.formState.errors.first_name && (
                <p role="alert" className="text-sm text-destructive">
                  {form1.formState.errors.first_name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birth_date">Date de naissance</Label>
                <Input
                  id="birth_date"
                  type="date"
                  className="h-10"
                  {...form1.register('birth_date')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekly_hours_avg">Heures/semaine</Label>
                <Input
                  id="weekly_hours_avg"
                  type="number"
                  step="0.5"
                  className="h-10"
                  {...form1.register('weekly_hours_avg', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight_kg">Poids (kg)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.1"
                  className="h-10"
                  {...form1.register('weight_kg', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height_cm">Taille (cm)</Label>
                <Input
                  id="height_cm"
                  type="number"
                  className="h-10"
                  {...form1.register('height_cm', { valueAsNumber: true })}
                />
              </div>
            </div>

            <ChoicePills
              label="Sexe"
              options={SEXES}
              value={sex}
              onChange={(v) => form1.setValue('sex', v as 'M' | 'F' | 'X')}
            />

            <ChoicePills
              label="Niveau"
              options={LEVELS}
              value={level}
              onChange={(v) => form1.setValue('level', v as Step1Data['level'])}
            />

            <Button type="submit" variant="highlight" size="lg" className="w-full">
              {isEditing ? 'Suivant' : 'Suivant'}
            </Button>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <div id={disciplinesLabelId}>
            <StepHeader
              title="Vos disciplines"
              description="Quelles disciplines pratiquez-vous ?"
            />
          </div>
          <div className="space-y-6">
            <div role="group" aria-labelledby={disciplinesLabelId} className="flex flex-wrap gap-2">
              {DISCIPLINES.map((d) => {
                const active = selectedDisciplines.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDiscipline(d.id)}
                    className={cn(PILL, 'py-2.5', active ? PILL_ON : PILL_OFF)}
                  >
                    <DisciplineIcon
                      discipline={d.id}
                      size={17}
                      className={active ? 'text-primary-ink' : 'text-muted-foreground'}
                    />
                    {d.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="lg" onClick={() => setStep(1)} className="flex-1">
                Retour
              </Button>
              <Button variant="highlight" size="lg" onClick={onStep2} className="flex-1">
                Suivant
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <StepHeader
            title={isEditing ? 'Finaliser' : 'Connexion Garmin'}
            description={
              isEditing
                ? 'Enregistre tes modifications.'
                : 'Optionnel — connectez votre compte Garmin pour synchroniser vos activités. Vos identifiants sont chiffrés AES-256.'
            }
          />
          <form onSubmit={form3.handleSubmit(onStep3)} className="space-y-5">
            {!isEditing && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="garmin_email">Email Garmin Connect</Label>
                  <Input
                    id="garmin_email"
                    type="email"
                    className="h-10"
                    {...form3.register('garmin_email')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garmin_password">Mot de passe Garmin Connect</Label>
                  <Input
                    id="garmin_password"
                    type="password"
                    className="h-10"
                    {...form3.register('garmin_password')}
                  />
                </div>
              </>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                Retour
              </Button>
              <Button
                type="submit"
                variant="highlight"
                size="lg"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Sauvegarde...' : isEditing ? 'Enregistrer' : 'Terminer'}
              </Button>
            </div>
            {!isEditing && (
              <button
                type="button"
                className="w-full rounded-md text-sm font-medium text-primary-ink hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                onClick={() => submitProfile()}
                disabled={loading}
              >
                Passer cette étape
              </button>
            )}
          </form>
        </>
      )}
    </div>
  )
}
