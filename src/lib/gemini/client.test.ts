import { describe, it, expect, vi } from 'vitest'
import { callWithModelFallback, retryOnRateLimit } from './client'

const rateLimited = Object.assign(new Error('quota'), { status: 429 })

describe('retryOnRateLimit', () => {
  it('réessaie après un dépassement de quota', async () => {
    const call = vi.fn().mockRejectedValueOnce(rateLimited).mockResolvedValue('ok')
    await expect(retryOnRateLimit(call, 0)).resolves.toBe('ok')
    expect(call).toHaveBeenCalledTimes(2)
  })
  it('abandonne après deux nouvelles tentatives', async () => {
    const call = vi.fn().mockRejectedValue(rateLimited)
    await expect(retryOnRateLimit(call, 0)).rejects.toBe(rateLimited)
    expect(call).toHaveBeenCalledTimes(3)
  })
  it('ne patiente pas sur le quota journalier', async () => {
    const daily = Object.assign(new Error('GenerateRequestsPerDayPerProjectPerModel'), {
      status: 429,
    })
    const call = vi.fn().mockRejectedValue(daily)
    await expect(retryOnRateLimit(call, 0)).rejects.toBe(daily)
    expect(call).toHaveBeenCalledTimes(1)
  })
  it('ne réessaie pas les autres erreurs', async () => {
    const call = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(retryOnRateLimit(call, 0)).rejects.toThrow('boom')
    expect(call).toHaveBeenCalledTimes(1)
  })
})

describe('callWithModelFallback', () => {
  const daily = Object.assign(new Error('RequestsPerDay'), { status: 429 })
  it('passe au modèle suivant quand le quota journalier est épuisé', async () => {
    const call = vi.fn().mockRejectedValueOnce(daily).mockResolvedValue('ok')
    await expect(callWithModelFallback(['a', 'b'], call, 0)).resolves.toBe('ok')
    expect(call.mock.calls).toEqual([['a'], ['b']])
  })
  it('passe au modèle suivant quand le modèle est surchargé', async () => {
    const overloaded = Object.assign(new Error('overloaded'), { status: 503 })
    const call = vi.fn().mockRejectedValueOnce(overloaded).mockResolvedValue('ok')
    await expect(callWithModelFallback(['a', 'b'], call, 0)).resolves.toBe('ok')
  })
  it('explique clairement quand tous les quotas sont épuisés', async () => {
    const call = vi.fn().mockRejectedValue(daily)
    await expect(callWithModelFallback(['a', 'b'], call, 0)).rejects.toThrow('Quota quotidien')
  })
  it('ne change pas de modèle pour une autre erreur', async () => {
    const call = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(callWithModelFallback(['a', 'b'], call, 0)).rejects.toThrow('boom')
    expect(call).toHaveBeenCalledTimes(1)
  })
})
