import { Message } from '@farcaster/hub-nodejs'
import { beforeAll, describe, expect, it } from 'vitest'
import { FidHubFetcher } from './FidHubFetcher'

describe('FidHubFetcher', () => {
  let fidHubFetcher: FidHubFetcher

  beforeAll(() => {
    fidHubFetcher = new FidHubFetcher(3)
  })

  describe('getAllCastsByFid', () => {
    it('should return an array of messages', async () => {
      const casts: ReadonlyArray<Message> =
        await fidHubFetcher.getAllCastsByFid()
      expect(Array.isArray(casts)).toBe(true)
      expect(casts.length).toBeGreaterThan(22_916)
    })
  })

  describe('getAllReactionsByFid', () => {
    it('should return an array of messages', async () => {
      const reactions: ReadonlyArray<Message> =
        await fidHubFetcher.getAllReactionsByFid()
      expect(Array.isArray(reactions)).toBe(true)
      expect(reactions.length).toBeGreaterThan(34911)
    })
  })

  describe('getAllLinksByFid', () => {
    it('should return an array of messages', async () => {
      const links: ReadonlyArray<Message> =
        await fidHubFetcher.getAllLinksByFid()
      expect(Array.isArray(links)).toBe(true)
      expect(links.length).toBeGreaterThan(3021)
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
