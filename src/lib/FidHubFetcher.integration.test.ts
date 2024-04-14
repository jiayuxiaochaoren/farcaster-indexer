import { Message } from '@farcaster/hub-nodejs'
import { beforeAll, describe, expect, it } from 'vitest'

import { FidHubFetcher } from './FidHubFetcher'

// Note: based on how hubs handle storage limits, it's possible for the number
// of messages to decrease, so we should include a buffer in the tests.
describe('FidHubFetcher', () => {
  let fidHubFetcher: FidHubFetcher

  beforeAll(() => {
    fidHubFetcher = new FidHubFetcher(3)
  })

  describe('getAllCastsByFid', () => {
    it('should return an array of messages', async () => {
      const casts = await fidHubFetcher.getAllCastsByFid()
      expect(Array.isArray(casts)).toBe(true)
      expect(casts.length).toBeGreaterThan(22_900)
    })
  })

  describe('getAllReactionsByFid', () => {
    it('should return an array of messages', async () => {
      const reactions = await fidHubFetcher.getAllReactionsByFid()
      expect(Array.isArray(reactions)).toBe(true)
      expect(reactions.length).toBeGreaterThan(34_900)
    })
  })

  describe('getAllLinksByFid', () => {
    it('should return an array of messages', async () => {
      const links = await fidHubFetcher.getAllLinksByFid()
      expect(Array.isArray(links)).toBe(true)
      expect(links.length).toBeGreaterThan(3_000)
    })
  })

  describe('getAllUserDataByFid', () => {
    it('should return an array of messages', async () => {
      const userData: ReadonlyArray<Message> =
        await fidHubFetcher.getAllUserDataByFid()
      expect(Array.isArray(userData)).toBe(true)
      expect(userData.length).toBeGreaterThan(3)
    })
  })

  describe('getAllVerificationsByFid', () => {
    it('should return an array of messages', async () => {
      const verifications: ReadonlyArray<Message> =
        await fidHubFetcher.getAllVerificationsByFid()
      expect(Array.isArray(verifications)).toBe(true)
      expect(verifications.length).toBeGreaterThan(1)
    })
  })
})
