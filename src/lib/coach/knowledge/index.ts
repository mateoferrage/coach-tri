import { METHODOLOGIES } from './methodologies'
import { ZONES_REF } from './zones-ref'
import { SESSIONS_LIB } from './sessions-lib'
import { NUTRITION } from './nutrition'
import { SWIM_TECHNIQUE } from './swim'
import { ADAPTATION } from './adaptation'
import { TRAIL_KNOWLEDGE } from './trail'
import { ROAD_KNOWLEDGE } from './road'

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
  ADAPTATION,
].join('\n\n---\n\n')

/** Lightweight subset for prompts where token budget is a concern. */
export const KNOWLEDGE_BASE_CORE = [METHODOLOGIES, ZONES_REF].join('\n\n---\n\n')

/** Sessions + zones reference — most relevant for micro-generation. */
export const KNOWLEDGE_BASE_MICRO = [ZONES_REF, SESSIONS_LIB].join('\n\n---\n\n')

/** Methodologies + form-based adaptation — most relevant for chat. */
export const KNOWLEDGE_BASE_CHAT = [METHODOLOGIES, ADAPTATION].join('\n\n---\n\n')

/** Spécialisation trail — injectée quand une course trail est visée. */
export const KNOWLEDGE_BASE_TRAIL = TRAIL_KNOWLEDGE

/** Spécialisation course sur route — injectée quand une course sur route est visée. */
export const KNOWLEDGE_BASE_ROAD = ROAD_KNOWLEDGE

export {
  METHODOLOGIES,
  ZONES_REF,
  SESSIONS_LIB,
  NUTRITION,
  SWIM_TECHNIQUE,
  ADAPTATION,
  TRAIL_KNOWLEDGE,
  ROAD_KNOWLEDGE,
}
