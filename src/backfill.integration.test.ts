import { describe, expect, it } from 'vitest'

import { getAllFids } from './backfill'

describe('getAllFids', () => {
  it('should return an array of fids from 1 to the maximum fid', async () => {
    const fids = await getAllFids()

    expect(fids[0]).toBe(1)
    expect([...fids].pop()).toBeGreaterThan(450_000)
    expect([...fids].pop()).toBe(fids.length)
  })
  it('should return an array of one fid when a smaller range is set', async () => {
    const fids = await getAllFids({ minFid: 3, maxFid: 3 })

    expect(fids[0]).toBe(3)
    expect(fids).toHaveLength(1)
  })
})
