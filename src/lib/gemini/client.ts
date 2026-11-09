import { GoogleGenAI } from '@google/genai'

// Offre gratuite : quota journalier très bas et propre à chaque modèle. Les modèles
// suivants prennent le relais quand le précédent est épuisé ou indisponible.
// Tous doivent accepter `thinkingBudget: 0` (ce n'est pas le cas de 3.5 Flash-Lite).
export const PROGRAM_MODEL = 'gemini-3.1-flash-lite'
const PROGRAM_MODELS = [PROGRAM_MODEL, 'gemini-3.5-flash', 'gemini-2.5-flash']
// Conversation et bilans de séance : on préserve le quota du modèle des programmes.
const CONVERSATION_MODELS = ['gemini-2.5-flash', 'gemini-3.5-flash', PROGRAM_MODEL]

const QUOTA_MESSAGE = "Quota quotidien de l'IA atteint, réessaie demain matin."

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  return new GoogleGenAI({ apiKey })
}

const RATE_LIMIT_DELAY_MS = 20_000
const RATE_LIMIT_RETRIES = 2

function isDailyQuotaError(err: unknown): boolean {
  return (
    (err as { status?: number }).status === 429 &&
    err instanceof Error &&
    err.message.includes('PerDay')
  )
}

/** Un dépassement de quota à la minute se résorbe vite : on patiente au lieu d'échouer. */
export async function retryOnRateLimit<T>(
  call: () => Promise<T>,
  delayMs = RATE_LIMIT_DELAY_MS,
): Promise<T> {
  for (let retriesLeft = RATE_LIMIT_RETRIES; ; retriesLeft--) {
    try {
      return await call()
    } catch (err: unknown) {
      const isRateLimit = (err as { status?: number }).status === 429
      if (!isRateLimit || isDailyQuotaError(err) || retriesLeft === 0) throw err
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

/** Essaie chaque modèle dans l'ordre tant que le précédent est épuisé ou indisponible. */
export async function callWithModelFallback<T>(
  models: string[],
  call: (model: string) => Promise<T>,
  delayMs = RATE_LIMIT_DELAY_MS,
): Promise<T> {
  let quotaExhausted = false
  let lastError: unknown
  for (const model of models) {
    try {
      return await retryOnRateLimit(() => call(model), delayMs)
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      if (isDailyQuotaError(err)) quotaExhausted = true
      else if (status !== 404 && status !== 503) throw err
      lastError = err
    }
  }
  throw quotaExhausted ? new Error(QUOTA_MESSAGE) : lastError
}

/**
 * Generate JSON content via Gemini, with model fallback.
 * Thinking is disabled by default for speed and cost; pass `thinkingBudget`
 * where reasoning quality matters more than latency.
 * Returns parsed JSON of type T.
 */
export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; thinkingBudget?: number; conversation?: boolean },
): Promise<T> {
  const ai = getClient()

  const response = await callWithModelFallback(
    options?.conversation ? CONVERSATION_MODELS : PROGRAM_MODELS,
    (model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingBudget: options?.thinkingBudget ?? 0 },
          responseMimeType: 'application/json',
          temperature: options?.temperature ?? 0.7,
        },
      }),
  )

  // Filter out thinking parts (thought === true) and collect text
  const text =
    response.candidates?.[0]?.content?.parts
      ?.filter((p) => !p.thought)
      ?.map((p) => p.text ?? '')
      ?.join('') ?? ''

  if (!text) throw new Error('Gemini returned empty response')

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Gemini response is not valid JSON: ${text.slice(0, 200)}`)
  }
}
