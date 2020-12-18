import { EventLog } from 'web3-core'

export async function getPastEvents(
    contract: any,
    event: string,
    fromBlock: number,
    toBlock: number,
    batchSize: number,
    prevEvents: any[] = []
  ): Promise<EventLog[]> {
    // if inclusive range is larger than batchsize, keep reducing range recursively, work back up
    if (toBlock - fromBlock >= batchSize) {
      const prevToBlock = toBlock - batchSize
      prevEvents = await getPastEvents(contract, event, fromBlock, prevToBlock, batchSize, prevEvents)
      fromBlock = toBlock - batchSize + 1 // +1 because of inclusivity of range
    }
    const events = await contract.getPastEvents(event, { fromBlock, toBlock })
    return prevEvents.concat(events)
  }