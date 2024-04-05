import { describe, expect, it } from 'vitest'
import { getAllFids } from './backfill'

describe('getAllFids', () => {
  it('should return an array of fids from 1 to the maximum fid', async () => {
    const fids = await getAllFids()

    expect(Array.isArray(fids)).toBeTruthy()
    expect(fids[0]).toBe(1)
    expect([...fids].pop()).toBeGreaterThan(100_000)
  })
})
