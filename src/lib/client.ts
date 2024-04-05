import { getSSLHubRpcClient } from '@farcaster/hub-nodejs'
import { log } from './logger.js'

const HUB_RPC = process.env.HUB_RPC

if (!HUB_RPC) {
  throw new Error('HUB_RPC env variable is not set')
}

export const client = getSSLHubRpcClient(HUB_RPC)

/**
 * Requires that HUB_RPC returns info over grpc
 */
export const validateClient = async (): Promise<void> => {
  const infoResult = await client.getInfo({ dbStats: false })
  if (infoResult.isErr()) {
    const errorMessage = `Error connecting to HUB_RPC. Please check "${HUB_RPC}"`
    log.error(infoResult.error, errorMessage)
    process.exit(1)
  }
}
