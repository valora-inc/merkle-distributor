import { cli } from 'cli-ux'
import fs from 'fs'
import { flags } from '@oclif/command'
import { EventLog } from 'web3-core'
import { parseBalanceMap } from '../../../src/parse-balance-map'
import { BaseCommand } from '../../base'
import {
  AttestationIssuers,
  calculateRewards,
  initializeBalancesByBlock,
  mergeEvents,
  processAttestationCompletion,
  processTransfer,
  RewardsCalculationState,
} from '../../utils/calculate-rewards'

export default class CalculateRewards extends BaseCommand {
  static description = 'Parses Events for data'

  static flags = {
    reward: flags.string({
      required: true,
      description: 'Percentage of balance reward is equal to'
    }),
    balanceFromBlock: flags.integer({
      required: true,
      description: 'Block number from which to start tracking average balance'
    }),
    balanceToBlock: flags.integer({
      required: true,
      description: 'Block number to finish tracking average balance'
    }),
    attestationEvents: flags.string({
      required: true,
      description: 'File containing AttestationCompleted events',
    }),
    transferEvents: flags.string({
      required: true,
      description: 'File containing Transfer events',
    }),
  }

  async run() {
    const res = this.parse(CalculateRewards)
    const balanceFromBlock = res.flags.balanceFromBlock
    const balanceToBlock = res.flags.balanceToBlock
    const reward = parseFloat(res.flags.reward)
    const attestationEvents = JSON.parse(fs.readFileSync(res.flags.attestationEvents, 'utf8'))
    const transferEvents = JSON.parse(fs.readFileSync(res.flags.transferEvents, 'utf8'))
    const allEvents: EventLog[] = mergeEvents(attestationEvents, transferEvents)

    if (balanceToBlock <= balanceFromBlock) {
      this.error('block to start tracking balances cannot be larger than block to finish tracking balances')
    }
  
    // State over time
    const trackIssuers: AttestationIssuers = {}
    const attestationCompletions = {}
    const balances = {}
    const balancesByBlock = {}
    const state: RewardsCalculationState = {
      attestationCompletions,
      balances,
      balancesByBlock,
      blockNumberToStartTracking: balanceFromBlock,
      blockNumberToFinishTracking: balanceToBlock,
      startedBlockBalanceTracking: false,
      rewardPercentage: reward,
    }

    const progressBar = cli.progress()
    progressBar.start(allEvents.length, 0)
    
    for(let index in allEvents) {
      progressBar.increment()
      const event = allEvents[index]
      if(!state.startedBlockBalanceTracking) {
        if (event.blockNumber >= state.blockNumberToStartTracking ) {
          initializeBalancesByBlock(state)
          state.startedBlockBalanceTracking = true  
        }
      } else if (event.blockNumber > state.blockNumberToFinishTracking) {
        break
      }

      switch (event.event) {
        case 'AttestationCompleted':
          processAttestationCompletion(state, trackIssuers, event)
          break
        case 'Transfer':
          processTransfer(state, event)
          break
        default:
          throw new Error('Unknown event')
      }
    }

    await progressBar.update(allEvents.length)
    progressBar.stop()

    const rewards = calculateRewards(
      balancesByBlock,
      state.blockNumberToStartTracking,
      state.blockNumberToFinishTracking,
      state.rewardPercentage
    )

    this.outputToFile('rewardsByAddress.json', rewards, "Reward amounts")
    this.outputToFile('rewardsCalculationState.json', state, 'Rewards chain state')

    const merkleData = parseBalanceMap(rewards)
    this.outputToFile('merkleTree.json', merkleData, 'Merkle Tree')
    console.info('Done')
  }
}
