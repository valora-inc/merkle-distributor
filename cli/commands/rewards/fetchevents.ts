import { newKit } from '@celo/contractkit'
import { flags, Command } from '@oclif/command'
import fs from 'fs'
import { getPastEvents } from '../../utils/events'
import { BaseCommand } from '../../base'

export default class FetchEvents extends BaseCommand {
  static description = 'Fetch AttestationCompleted events from Attestations contract'

  static flags = {
    fromBlock: flags.integer({ required: true, description: 'Starting Block' }),
    toBlock: flags.integer({ required: true, description: 'Ending Block' }),
    batchSize: flags.integer({
      required: true,
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
    const kit = newKit(this.node(res.flags.env))
    const attestations = await kit.contracts.getAttestations()
    const stableToken = await kit.contracts.getStableToken()

    const attestationEvents = await getPastEvents(
      attestations,
      'AttestationCompleted',
      fromBlock,
      toBlock,
      batchSize,
      prevAttestationEvents
    )

    const transferEvents = await getPastEvents(
      stableToken,
      'Transfer',
      fromBlock,
      toBlock,
      batchSize, 
      prevTransferEvents
    )

    const attestationsFile = `attestation-completed-events-${fromBlock}-${toBlock}.json`
    fs.writeFile(attestationsFile, JSON.stringify(attestationEvents, null, 2), (err) => {
      if (err) throw err
    })
    console.log('AttestationCompleted results output to: ', attestationsFile)

    const transferFile = `transfer-cusd-events-${fromBlock}-${toBlock}.json`
    fs.writeFile(transferFile, JSON.stringify(transferEvents, null, 2), (err) => {
      if (err) throw err
    })
    console.log('Transfer results output to: ', transferFile)
  }
}

function parseJsonOrEmptyArray(json: string | undefined): any[] {
  let prevEvents: any[] = []
  if (json) {
    prevEvents = JSON.parse(fs.readFileSync(json, 'utf8'))
  }
  return prevEvents
}
