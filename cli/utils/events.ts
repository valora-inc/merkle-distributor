import { EventLog } from 'web3-core'

export enum eventTypes  {
  Transfer                = 'Transfer',
  AttestationCompleted    = 'AttestationCompleted',
  AccountWalletAddressSet = 'AccountWalletAddressSet'
}

export async function getPastEvents(
  progressBar: any,
  contract: any,
  event: string,
  fromBlock: number,
  toBlock: number,
  batchSize: number,
  prevEvents: EventLog[] = []
): Promise<EventLog[]> {
  // if inclusive range is larger than batchsize, keep reducing range recursively, work back up
  if (toBlock - fromBlock >= batchSize) {
    const prevToBlock = toBlock - batchSize
    prevEvents = await getPastEvents(progressBar, contract, event, fromBlock, prevToBlock, batchSize, prevEvents)
    fromBlock = toBlock - batchSize + 1 // +1 because of inclusivity of range
  }
  const events = await contract.getPastEvents(event, { fromBlock, toBlock })
  progressBar.increment()
  return prevEvents.concat(events)
}

export function mergeEvents(arr1: EventLog[], arr2: EventLog[]) {
  const merged = []
  let index1 = 0
  let index2 = 0
  let current = 0

  while (current < arr1.length + arr2.length) {
    const isArr1Depleted = index1 >= arr1.length
    const isArr2Depleted = index2 >= arr2.length

    if (!isArr1Depleted && (isArr2Depleted || isPrecedingEvent(arr1[index1], arr2[index2]))) {
      merged[current] = arr1[index1]
      index1++
    } else {
      merged[current] = arr2[index2]
      index2++
    }

    current++
  }

  return merged
}

function isPrecedingEvent(event1: EventLog, event2: EventLog) {
  if (event1.blockNumber < event2.blockNumber) {
    return true
  } else if (event2.blockNumber < event1.blockNumber) {
    return false
  } else {
    return event1.transactionIndex < event2.transactionIndex ? true : false
  }
}
