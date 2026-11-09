import { describe, it, expect, vi } from 'vitest'
import { retryOnRateLimit } from './client'

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
    await expect(retryOnRateLimit(call, 0)).rejects.toThrow('Quota quotidien')
    expect(call).toHaveBeenCalledTimes(1)
  })
  it('ne réessaie pas les autres erreurs', async () => {
    const call = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(retryOnRateLimit(call, 0)).rejects.toThrow('boom')
    expect(call).toHaveBeenCalledTimes(1)
  })
})
