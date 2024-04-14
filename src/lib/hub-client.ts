import {
  getInsecureHubRpcClient,
  getSSLHubRpcClient,
} from '@farcaster/hub-nodejs'

import { log } from './logger.js'

const HUB_RPC = process.env.HUB_RPC
const HUB_SSL = process.env.HUB_SSL || 'true'

if (!HUB_RPC) {
  throw new Error('HUB_RPC env variable is not set')
}

export const hubClient =
  HUB_SSL === 'true'
    ? getSSLHubRpcClient(HUB_RPC)
    : getInsecureHubRpcClient(HUB_RPC)

/**
 * Requires that HUB_RPC returns info over grpc
 */
export const validateHubClient = async () => {
  const infoResult = await hubClient.getInfo({ dbStats: false })
  if (infoResult.isErr()) {
    const errorMessage = `Error connecting to HUB_RPC. Please check "${HUB_RPC}"`
    log.error(infoResult.error, errorMessage)
    process.exit(1)
  }
}
