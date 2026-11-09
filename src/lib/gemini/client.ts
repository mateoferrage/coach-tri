import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-2.5-flash'

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  return new GoogleGenAI({ apiKey })
}

const RATE_LIMIT_DELAY_MS = 20_000
const RATE_LIMIT_RETRIES = 2

/** Un dépassement de quota à la minute se résorbe vite : on patiente au lieu d'échouer. */
export async function retryOnRateLimit<T>(
  call: () => Promise<T>,
  delayMs = RATE_LIMIT_DELAY_MS,
): Promise<T> {
  for (let retriesLeft = RATE_LIMIT_RETRIES; ; retriesLeft--) {
    try {
      return await call()
    } catch (err: unknown) {
      if ((err as { status?: number }).status !== 429) throw err
      // Le quota journalier ne se recharge pas à la minute : inutile de patienter.
      if (err instanceof Error && err.message.includes('PerDay')) {
        throw new Error("Quota quotidien de l'IA atteint, réessaie plus tard.")
      }
      if (retriesLeft === 0) throw err
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

/**
 * Generate JSON content via Gemini 2.5 Flash.
 * Thinking is disabled by default for speed and cost; pass `thinkingBudget`
 * where reasoning quality matters more than latency.
 * Returns parsed JSON of type T.
 */
export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; thinkingBudget?: number },
): Promise<T> {
  const ai = getClient()

  const response = await retryOnRateLimit(() =>
    ai.models.generateContent({
      model: MODEL,
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
