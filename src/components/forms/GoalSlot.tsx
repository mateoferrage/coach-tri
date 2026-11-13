'use client'

import type { Ref } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GoalFieldset, goalRowToFormValues, type GoalFieldsetHandle } from './GoalFieldset'

/** Course enregistrée (ligne complète de `goals`, pour pré-remplir le formulaire). */
export interface Goal extends Record<string, unknown> {
  id: string
  race_name: string
  race_date: string
  race_type: string
  sport?: string
}

export type SlotMode = 'existing' | 'new'

/** Onglets « choix d'option » (Élan) : pastilles bordées, sélection bleue claire. */
export const CHOICE_TABS_LIST_CLASS =
  'w-full gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto'
export const CHOICE_TAB_CLASS =
  'h-10 flex-1 rounded-full border-[1.5px] border-border bg-card px-3 font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground data-active:border-primary data-active:bg-accent data-active:text-primary-ink group-data-[variant=default]/tabs-list:data-active:shadow-none'

interface GoalSlotProps {
  priority: 'A' | 'B' | 'C'
  title: string
  description?: string
  goals: Goal[]
  /** Ids déjà retenus par les autres slots (exclus du menu existante). */
  excludeIds: string[]
  mode: SlotMode
  onModeChange: (mode: SlotMode) => void
  existingId?: string
  onExistingIdChange: (id: string | undefined) => void
  fieldsetRef: Ref<GoalFieldsetHandle>
  /** Objectif facultatif (B/C) → propose « Aucune » en mode existante. */
  optional?: boolean
}

function goalLabel(g: Goal): string {
  const sport = g.sport ? ` · ${g.sport === 'running' ? 'course à pied' : g.sport}` : ''
  return `${g.race_name} — ${g.race_date}${sport}`
}

export function GoalSlot({
  priority,
  title,
  description,
  goals,
  excludeIds,
  mode,
  onModeChange,
  existingId,
  onExistingIdChange,
  fieldsetRef,
  optional = false,
}: GoalSlotProps) {
  const hasGoals = goals.length > 0
  // Garde la course déjà choisie dans ce slot, exclut celles prises ailleurs.
  const availableGoals = goals.filter((g) => g.id === existingId || !excludeIds.includes(g.id))
  const selectedGoal = existingId ? goals.find((g) => g.id === existingId) : undefined

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as SlotMode)}>
          <TabsList className={CHOICE_TABS_LIST_CLASS}>
            <TabsTrigger value="existing" className={CHOICE_TAB_CLASS} disabled={!hasGoals}>
              Course existante
            </TabsTrigger>
            <TabsTrigger value="new" className={CHOICE_TAB_CLASS}>
              Nouvelle course
            </TabsTrigger>
          </TabsList>

        </Tabs>

        {mode === 'existing' &&
          (hasGoals ? (
            <Select
              value={existingId ?? ''}
              onValueChange={(v) => onExistingIdChange(v ? String(v) : undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder={optional ? 'Aucune (optionnel)' : 'Choisir une course...'} />
              </SelectTrigger>
              <SelectContent>
                {optional && <SelectItem value="">Aucune</SelectItem>}
                {availableGoals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {goalLabel(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune course enregistrée. Crée-en une via « Nouvelle course ».
            </p>
          ))}

        {/* Un seul fieldset monté à la fois → le ref du slot pointe toujours sur
            le formulaire visible : vierge (nouvelle) ou pré-rempli (existante). */}
        {mode === 'existing' && selectedGoal && (
          <div className="space-y-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Vérifie ou ajuste les infos de la course : tes modifications seront enregistrées à la
              génération du programme.
            </p>
            <GoalFieldset
              key={selectedGoal.id}
              ref={fieldsetRef}
              priority={priority}
              initial={goalRowToFormValues(selectedGoal)}
            />
          </div>
        )}
        {mode === 'new' && <GoalFieldset key="new" ref={fieldsetRef} priority={priority} />}
      </CardContent>
    </Card>
  )
}
