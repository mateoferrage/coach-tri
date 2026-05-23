export type Discipline = 'swim' | 'bike' | 'run' | 'brick' | 'strength' | 'rest'
export type SessionType = 'easy' | 'tempo' | 'threshold' | 'vo2' | 'race_pace' | 'technique' | 'long' | 'recovery' | 'test'
export type Phase = 'prep' | 'base' | 'build' | 'peak' | 'taper' | 'race'
export type RaceType = 'sprint' | 'olympic' | 'half' | 'full' | 'xterra' | 'custom'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite'

export interface HRZones {
  z1: [number, number]
  z2: [number, number]
  z3: [number, number]
  z4: [number, number]
  z5: [number, number]
}

export interface SessionStructure {
  warmup: string
  main: string
  cooldown: string
}
