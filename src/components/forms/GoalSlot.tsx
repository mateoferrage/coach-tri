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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GoalFieldset, type GoalFieldsetHandle } from './GoalFieldset'

export interface Goal {
  id: string
  race_name: string
  race_date: string
  race_type: string
  sport?: string
}

export type SlotMode = 'existing' | 'new'

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as SlotMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1" disabled={!hasGoals}>
              Course existante
            </TabsTrigger>
            <TabsTrigger value="new" className="flex-1">
              Nouvelle course
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="mt-4">
            {hasGoals ? (
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
            )}
          </TabsContent>

          <TabsContent value="new" className="mt-4">
            <GoalFieldset ref={fieldsetRef} priority={priority} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
