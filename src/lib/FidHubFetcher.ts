import { FidRequest, Message } from '@farcaster/hub-nodejs'

import { hubClient } from './hub-client.js'
import { checkMessages } from './utils.js'

/**
 * Facade class providing a simplified interface to interact with the @farcaster/hub-nodejs package.
 * This class encapsulates the complexity of interacting with the underlying package,
 * promoting loose coupling and enhancing maintainability and readability.
 */
export class FidHubFetcher {
  #pageSize = 10_000
  #fidRequest: FidRequest

  constructor(fid: number) {
    this.#fidRequest = FidRequest.create({ fid })
  }

  async getAllCastsByFid() {
    const casts: Message[] = []
    let nextPageToken: Uint8Array | undefined

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await hubClient.getCastsByFid({
        ...this.#fidRequest,
        pageSize: this.#pageSize,
        pageToken: nextPageToken,
      })

      const messages = checkMessages(res, this.#fidRequest.fid)
      casts.push(...messages)

      if (messages.length < this.#pageSize) {
        break
      }

      nextPageToken = res._unsafeUnwrap().nextPageToken
    }

    return casts
  }

  async getAllReactionsByFid() {
    const reactions: Message[] = []
    let nextPageToken: Uint8Array | undefined

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await hubClient.getReactionsByFid({
        ...this.#fidRequest,
        pageSize: this.#pageSize,
        pageToken: nextPageToken,
      })

      const messages = checkMessages(res, this.#fidRequest.fid)
      reactions.push(...messages)

      if (messages.length < this.#pageSize) {
        break
      }

      nextPageToken = res._unsafeUnwrap().nextPageToken
    }

    return reactions
  }

  async getAllLinksByFid() {
    return hubClient
      .getLinksByFid({ ...this.#fidRequest, reverse: true })
      .then((links) => checkMessages(links, this.#fidRequest.fid))
  }

  async getAllUserDataByFid() {
    return hubClient
      .getUserDataByFid(this.#fidRequest)
      .then((userDatas) => checkMessages(userDatas, this.#fidRequest.fid))
  }

  async getAllVerificationsByFid() {
    return hubClient
      .getVerificationsByFid(this.#fidRequest)
      .then((verifications) =>
        checkMessages(verifications, this.#fidRequest.fid)
      )
  }
}
