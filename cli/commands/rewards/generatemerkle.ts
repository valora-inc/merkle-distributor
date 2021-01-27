import { cli } from 'cli-ux'
import { BigNumber } from 'bignumber.js'
import { newKit } from '@celo/contractkit'
import fs from 'fs'
import { flags } from '@oclif/command'
import { EventLog } from 'web3-core'
import { parseBalanceMap } from '../../../src/parse-balance-map'
import { BaseCommand } from '../../base'
import { mergeEvents } from '../../utils/events'
import {
  AttestationIssuers,
  calculateRewards,
  initializeBalancesByBlock,
  processAttestationCompletion,
  processTransfer,
  RewardsCalculationState,
} from '../../utils/calculate-rewards'

export default class CalculateRewards extends BaseCommand {
  static description = 'Parses Events for data'

  static flags = {
    celoToUsd: flags.string ({
      required: true,
      description: 'CELO to USD conversion rate. (CELO price in dollars)'
    }),
    balanceFromBlock: flags.integer({
      required: false,
      description: 'Block number from which to start tracking average balance'
    }),
    balanceToBlock: flags.integer({
      required: false,
      description: 'Block number to finish tracking average balance'
    }),
    balanceFromDate: flags.string({
      required: false,
      exclusive: ['balanceFromBlock'],
      description: `Date from which to start tracking average balance. ${CalculateRewards.dateDisclaimer}`
    }),
    balanceToDate: flags.string({
      required: false,
      exclusive: ['balanceToBlock'],
      description: `Date to finish tracking average balance ${CalculateRewards.dateDisclaimer}`
    }),
    attestationEvents: flags.string({
      required: true,
      description: 'File containing AttestationCompleted events',
    }),
    transferEvents: flags.string({
      required: true,
      description: 'File containing Transfer events',
    }),
    env: flags.string({ required: true, description: 'blockchain environment with which to interact' }),
  }

  async run() {
    const res = this.parse(CalculateRewards)
    let balanceFromBlock = res.flags.balanceFromBlock
    let balanceToBlock = res.flags.balanceToBlock
    const balanceFromDate = res.flags.balanceFromDate
    const balanceToDate = res.flags.balanceToDate
    const celoToUsd = new BigNumber(parseFloat(res.flags.celoToUsd))
    const attestationEvents = JSON.parse(fs.readFileSync(res.flags.attestationEvents, 'utf8'))
    const transferEvents = JSON.parse(fs.readFileSync(res.flags.transferEvents, 'utf8'))
    const allEvents: EventLog[] = mergeEvents(attestationEvents, transferEvents)
    let web3 = newKit(this.nodeByEnv(res.flags.env)).web3

    balanceFromBlock = await this.determineBlockNumber(balanceFromBlock, balanceFromDate, web3)
    balanceToBlock = await this.determineBlockNumber(balanceToBlock, balanceToDate, web3)

    if (!balanceFromBlock) this.error('Must submit either BalanceFromBlock or BalanceFromDate')
    if (!balanceToBlock) this.error('Must submit either BalanceToBlock or BalanceToDate')
    if (balanceToBlock < balanceFromBlock) {
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
      celoToUsd: celoToUsd
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
      celoToUsd
    )

    this.outputToFile('rewardsByAddress.json', rewards, "Reward amounts")
    this.outputToFile('rewardsCalculationState.json', state, 'Rewards chain state')

    const merkleData = parseBalanceMap(rewards)
    this.outputToFile('merkleTree.json', merkleData, 'Merkle Tree')
    console.info('Done')
  }
}
