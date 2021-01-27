import { flags } from '@oclif/command'
import fs from 'fs'
import { getPastEvents } from '../../utils/events'
import { BaseCommand } from '../../base'
import { cli } from 'cli-ux'

export default class FetchEvents extends BaseCommand {
  static description = 'Fetch AttestationCompleted events from Attestations contract and Transfer Events from StableToken contract'

  static flags = {
    fromBlock: flags.integer({
      required: false, 
      description: '[default: 0] Starting Block' 
    }),
    toBlock: flags.integer({
      required: false,
      description: 'Ending Block'
    }),
    fromDate: flags.string({
      required: false,
      exclusive: ['fromBlock'],
      description: `collect events starting roughly at this date ("MM/DD/YYYY"). ${FetchEvents.dateDisclaimer}`
    }),
    toDate: flags.string({
      required: false,
      exclusive: ['toBlock'],
      description: `collect events until this date ("MM/DD/YYYY"). ${FetchEvents.dateDisclaimer}`
    }),
    batchSize: flags.integer({
      required: false,
      default: 100000,
      description: 'batch size of blocks requested by the server at a time',
    }),
    env: flags.string({ required: false, description: 'blockchain environment with which to interact' }),
  }

  async run() {
    const res = this.parse(FetchEvents)
    let fromBlock = res.flags.fromBlock || 0
    let toBlock = res.flags.toBlock
    const fromDate = res.flags.fromDate
    const toDate = res.flags.toDate
    const batchSize = res.flags.batchSize
    const attestations = await this.kit.contracts.getAttestations()
    const stableToken = await this.kit.contracts.getStableToken()

    // @ts-ignore
    fromBlock =  await this.determineBlockNumber(fromBlock, fromDate, this.kit.web3)
    toBlock = await this.determineBlockNumber(toBlock, toDate, this.kit.web3)

    if (!toBlock) this.error('Must submit parameter toBlock or toDate')
    if (toBlock < fromBlock) {
      this.error('Starting block cannot be more recent than ending block')
    }

    const progressBar = cli.progress()
    const progressBarTotal = Math.floor(((toBlock - fromBlock)/batchSize + 1) * 2)
    progressBar.start(progressBarTotal, 0)

    const attestationEvents = await getPastEvents(
      progressBar,
      attestations,
      'AttestationCompleted',
      fromBlock,
      toBlock,
      batchSize,
      []
    )

    const transferEvents = await getPastEvents(
      progressBar,
      stableToken,
      'Transfer',
      fromBlock,
      toBlock,
      batchSize, 
      []
    )

    progressBar.stop()
    const attestationsFile = `attestation-completed-events-${fromBlock}-${toBlock}.json`
    const transferFile = `transfer-cusd-events-${fromBlock}-${toBlock}.json`
    this.outputToFile(attestationsFile, attestationEvents, 'AttestationCompleted events')
    this.outputToFile(transferFile, transferEvents, 'Transfer events')
  }
}
