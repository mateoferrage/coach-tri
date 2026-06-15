import { METHODOLOGIES } from './methodologies'
import { ZONES_REF } from './zones-ref'
import { SESSIONS_LIB } from './sessions-lib'
import { NUTRITION } from './nutrition'
import { SWIM_TECHNIQUE } from './swim'
import { MAINTENANCE } from './maintenance'

/**
 * Full knowledge base — all 6 reference documents combined.
 * Injected into AI system prompts to ground generation in proven methodologies.
 */
export const KNOWLEDGE_BASE = [
  METHODOLOGIES,
  ZONES_REF,
  SESSIONS_LIB,
  NUTRITION,
  SWIM_TECHNIQUE,
  MAINTENANCE,
].join('\n\n---\n\n')

/** Lightweight subset for prompts where token budget is a concern. */
export const KNOWLEDGE_BASE_CORE = [METHODOLOGIES, ZONES_REF].join('\n\n---\n\n')

/** Sessions + zones reference — most relevant for micro-generation. */
export const KNOWLEDGE_BASE_MICRO = [ZONES_REF, SESSIONS_LIB].join('\n\n---\n\n')

/** Methodologies + maintenance — most relevant for chat and macro-generation. */
export const KNOWLEDGE_BASE_CHAT = [METHODOLOGIES, MAINTENANCE].join('\n\n---\n\n')

export { METHODOLOGIES, ZONES_REF, SESSIONS_LIB, NUTRITION, SWIM_TECHNIQUE, MAINTENANCE }
