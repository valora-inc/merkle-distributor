import { BigNumber } from 'bignumber.js'
import { EventLog } from 'web3-core'

const tierRewards: {[keys: number]: number} = {
  20:  1,
  100: 5,
  500: 10 
}
const tiers = Object.keys(tierRewards).map(s => parseInt(s))

function assignTier(weightedAverage: BigNumber): BigNumber {
  const smallerThan = (tier: number) => weightedAverage.lt(toWei(tier))
  let reward: number
  if (smallerThan(tiers[0])) {
    reward = 0
  } else if (smallerThan(tiers[1])) {
    reward = tierRewards[tiers[0]]
  } else if (smallerThan(tierRewards[2])) {
    reward = tierRewards[tiers[1]]
  } else {
    reward = tierRewards[tiers[2]]
  }
  return toWei(reward)
}

function toWei(num: number): BigNumber {
  return new BigNumber(num).times(new BigNumber(10).pow(18))
}

export function initializeBalancesByBlock(state: RewardsCalculationState) {
  Object.keys(state.balances).forEach((acct) => {
    if (state.attestationCompletions[acct] >= 3) {
      state.balancesByBlock[acct] = {
        balances: [state.balances[acct]],
        blocks: [state.blockNumberToStartTracking],
      }
    }
  })
}

function updateBalance(balances: Balances, eventLog: EventLog) {
  const amount = eventLog.returnValues.value
  const to = eventLog.returnValues.to
  const from = eventLog.returnValues.from
  balances[to] ? (balances[to] = balances[to].plus(amount)) : (balances[to] = new BigNumber(amount))
  balances[from]
    ? (balances[from] = balances[from].minus(amount))
    : (balances[from] = new BigNumber(0)) // just for address 0x0
  return { to, from }
}

export interface RewardsCalculationState {
  attestationCompletions: AttestationCompletions
  balances: Balances
  balancesByBlock: BalancesByBlockState
  startedBlockBalanceTracking: boolean
  blockNumberToStartTracking: number
  blockNumberToFinishTracking: number
  celoToUsd: BigNumber
}

export interface AttestationIssuers {
  [account: string]: string[]
}
export interface AttestationCompletions {
  [account: string]: number
}
export interface Balances {
  [account: string]: BigNumber
}
export interface BalancesByBlockState {
  [account: string]: BalancesByBlock
}
export interface BalancesByBlock {
  balances: BigNumber[]
  blocks: number[]
}

export function processAttestationCompletion(
  state: RewardsCalculationState,
  issuers: AttestationIssuers,
  event: EventLog
) {
  const account = event.returnValues.account
  const issuer = event.returnValues.issuer

  if (!issuers[account]) {
    issuers[account] = [issuer]
    state.attestationCompletions[account] = 1
  } else if (issuers[account].indexOf(issuer) === -1) {
    issuers[account].push(issuer)
    state.attestationCompletions[account] += 1
  }

  if (state.startedBlockBalanceTracking && state.attestationCompletions[account] === 3) {
    // Just completed
    state.balancesByBlock[account] = {
      balances: [state.balances[account] || new BigNumber(0)],
      blocks: [event.blockNumber],
    }
  }
}

export function processTransfer(state: RewardsCalculationState, event: EventLog) {
  const { to, from } = updateBalance(state.balances, event)

  if (state.startedBlockBalanceTracking) {
    updateBalanceByBlock(state, from, event.blockNumber)
    updateBalanceByBlock(state, to, event.blockNumber)
  }
}

function updateBalanceByBlock(
  state: RewardsCalculationState,
  account: string,
  blockNumber: number
) {
  if (state.attestationCompletions[account] >= 3) {
    const balancesByBlock = state.balancesByBlock[account]
    if (balancesByBlock.balances.length > 0) {
      balancesByBlock.balances.push(state.balances[account])
      balancesByBlock.blocks.push(blockNumber)
    } else {
      state.balancesByBlock[account] = {
        balances: [state.balances[account]],
        blocks: [blockNumber],
      }
    }
  }
}

export function calculateRewards(
  balancesTWA: { [address: string]: BalancesByBlock },
  fromBlock: number,
  toBlock: number,
  celoToUsd: BigNumber
): { [address: string]: number } {
  let rewards: { [key: string]: number } = {}
  let firstTier = toWei(tiers[0])
  Object.keys(balancesTWA).forEach((address) => {
    const balances = balancesTWA[address].balances
    const blocks = balancesTWA[address].blocks
    const weightedSum = balances.reduce((prevWeightedBalance, balance, i) => {
      const currentBlock = blocks[i]
      const nextBlock = blocks[i + 1] || toBlock
      const weightedBalance = balance.times(nextBlock - currentBlock)
      return prevWeightedBalance.plus(weightedBalance)
    }, new BigNumber(0))
    const weightedAverage = weightedSum.dividedBy(new BigNumber(toBlock - fromBlock))
    if (weightedAverage.gte(firstTier)) {
      rewards[address] = assignTier(weightedAverage).div(celoToUsd).toNumber()
    }
  })
  return rewards
}
