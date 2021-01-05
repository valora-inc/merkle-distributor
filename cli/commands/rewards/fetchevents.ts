import { newKit } from '@celo/contractkit'
import { flags } from '@oclif/command'
import fs from 'fs'
import { getPastEvents } from '../../utils/events'
import { BaseCommand } from '../../base'
import { cli } from 'cli-ux'

export default class FetchEvents extends BaseCommand {
  static description = 'Fetch AttestationCompleted events from Attestations contract and Transfer Events from StableToken contract'

  static flags = {
    fromBlock: flags.integer({ required: false, default: 0, description: 'Starting Block' }),
    toBlock: flags.integer({ required: true, description: 'Ending Block' }),
    batchSize: flags.integer({
      required: false,
      default: 100000,
      description: 'batch size of blocks requested by the server at a time',
    }),
    prevAttestationEvents: flags.string({
      required: false,
      description: "JSON file with previous attestation events before block range" 
    }),
    prevTransferEvents: flags.string({
      required: false,
      description: "JSON file with previous transfer events before block range" 
    }),
    env: flags.string({ required: false, description: 'blockchain environment with which to interact' }),
  }

  async run() {
    const res = this.parse(FetchEvents)
    const fromBlock = res.flags.fromBlock
    const toBlock = res.flags.toBlock
    const batchSize = res.flags.batchSize
    const prevAttestationEvents = parseJsonOrEmptyArray(res.flags.prevAttestationEvents)
    const prevTransferEvents = parseJsonOrEmptyArray(res.flags.prevTransferEvents)
    const kit = newKit(this.nodeByEnv(res.flags.env))
    const attestations = await kit.contracts.getAttestations()
    const stableToken = await kit.contracts.getStableToken()
    
    if (toBlock < fromBlock) {
      this.error('Starting block cannot be larger than ending block')
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
      prevAttestationEvents
    )

    const transferEvents = await getPastEvents(
      progressBar,
      stableToken,
      'Transfer',
      fromBlock,
      toBlock,
      batchSize, 
      prevTransferEvents
    )

    progressBar.stop()
    const attestationsFile = `attestation-completed-events-${fromBlock}-${toBlock}.json`
    const transferFile = `transfer-cusd-events-${fromBlock}-${toBlock}.json`
    this.outputToFile(attestationsFile, attestationEvents, 'AttestationCompleted events')
    this.outputToFile(transferFile, transferEvents, 'Transfer events')
  }
}

function parseJsonOrEmptyArray(json: string | undefined): any[] {
  let prevEvents: any[] = []
  if (json) {
    prevEvents = JSON.parse(fs.readFileSync(json, 'utf8'))
  }
  return prevEvents
}
