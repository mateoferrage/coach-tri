import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-2.5-flash'

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  return new GoogleGenAI({ apiKey })
}

/**
 * Generate JSON content via Gemini 2.5 Flash.
 * Thinking is disabled (thinkingBudget: 0) for speed and cost.
 * Returns parsed JSON of type T.
 */
export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number },
): Promise<T> {
  const ai = getClient()

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      temperature: options?.temperature ?? 0.7,
    },
  })

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
