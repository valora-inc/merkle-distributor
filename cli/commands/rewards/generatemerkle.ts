import { cli } from 'cli-ux'
import { BigNumber } from 'bignumber.js'
import { newKit } from '@celo/contractkit'
import fs from 'fs'
import { EventLog } from 'web3-core'
import { flags } from '@oclif/command'
import { parseBalanceMap } from '../../../src/parse-balance-map'
import { BaseCommand } from '../../base'
import {
  AttestationIssuers,
  calculateRewards,
  initializeBalancesByBlock,
  processAttestationCompletion,
  processTransfer,
  RewardsCalculationState,
  processAccountWalletAddressSet,
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
      multiple: true,
      description: 'Files containing AttestationCompleted events. Will accept one or multiple ordered files.',
    }),
    transferEvents: flags.string({
      required: true,
      multiple: true,
      description: 'Files containing Transfer events. Will accept one or multiple ordered files.',
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
    const attestationEvents = eventsJSONToArray(res.flags.attestationEvents)
    const transferEvents = eventsJSONToArray(res.flags.transferEvents)
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
      walletAssociations: {},
      attestationCompletions,
      balances,
      balancesByBlock,
      blockNumberToStartTracking: balanceFromBlock,
      blockNumberToFinishTracking: balanceToBlock,
      startedBlockBalanceTracking: false,
      celoToUsd: celoToUsd
    }

    const progressBar = cli.progress()
    progressBar.start(attestationEvents.length + transferEvents.length, 0)

    attestationEvents.forEach(event => {
      progressBar.increment()
      if (event.event == 'AttestationCompleted') {
        processAttestationCompletion(state, trackIssuers, event)
      } else if (event.event == "AccountWalletAddressSet") {
        processAccountWalletAddressSet(state.walletAssociations, event)
      } else {
        this.error(`Uknown event:\n${event}`) 
      }
    })

    for(let index in transferEvents) {
      progressBar.increment()
      const event = transferEvents[index]
      if(!state.startedBlockBalanceTracking) {
        if (event.blockNumber >= state.blockNumberToStartTracking ) {
          initializeBalancesByBlock(state)
          state.startedBlockBalanceTracking = true  
        }
      } else if (event.blockNumber > state.blockNumberToFinishTracking) {
        break
      }
      if (event.event = 'Transfer') {
        processTransfer(state, event)
      } else {
        this.error(`Uknown event:\n${event}`)
      }
    }

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

export function eventsJSONToArray(eventFiles: string[]): EventLog[] {
  return eventFiles
    .map((eventFile: string) => JSON.parse(fs.readFileSync(eventFile, 'utf8')))
    .reduce((acc, el) => acc.concat(el))
}
