import { cli } from 'cli-ux'
import fs from 'fs'
import { flags, Command } from '@oclif/command'
import { EventLog } from 'web3-core'
import { parseBalanceMap } from '../../../src/parse-balance-map'
import {
  AttestationIssuers,
  calculateRewards,
  initializeBalancesByBlock,
  mergeEvents,
  processAttestationCompletion,
  processTransfer,
  RewardsCalculationState,
} from '../../utils/calculate-rewards'

export default class CalculateRewards extends Command {
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
      multiple: true,
      description: 'File containing Transfer events',
    }),
  }

  async run() {
    const res = this.parse(CalculateRewards)
    const balanceFromBlock = res.flags.balanceFromBlock
    const balanceToBlock = res.flags.balanceToBlock
    const reward = parseFloat(res.flags.reward)
    const attestationEvents = JSON.parse(fs.readFileSync(res.flags.attestationEvents, 'utf8'))
    // parse multiple Json events input files
    const transferEvents = res.flags.transferEvents.reduce(
      (arr: EventLog[], eventsArr): EventLog[] => {
        const events = JSON.parse(fs.readFileSync(eventsArr, 'utf8'))
        return arr.concat(events)
      },
      []
    )
    const allEvents: EventLog[] = mergeEvents(attestationEvents, transferEvents)

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

    allEvents.forEach((event, index) => {
      progressBar.update(index)
      if (
        event.blockNumber >= state.blockNumberToStartTracking &&
        !state.startedBlockBalanceTracking
      ) {
        initializeBalancesByBlock(state)
        state.startedBlockBalanceTracking = true
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
    })

    const rewards = calculateRewards(
      balancesByBlock,
      state.blockNumberToStartTracking,
      state.blockNumberToFinishTracking,
      state.rewardPercentage
    )
    progressBar.update()

    const merkleData = parseBalanceMap(rewards)
    progressBar.update()

    progressBar.stop()
    fs.writeFileSync('merkleTree.json', JSON.stringify(merkleData, null, 2))
    fs.writeFileSync('rewardsBalances.json',JSON.stringify( rewards, null, 2))
    fs.writeFileSync('rewardsCalculationState.json', JSON.stringify(state, null, 2))

    console.info('Done')
  }
}
