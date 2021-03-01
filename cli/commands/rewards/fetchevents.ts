import { flags } from '@oclif/command'
import { EventLog } from 'web3-core'
import { getPastEvents, mergeEvents, eventTypes } from '../../utils/events'
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
    const accounts = await this.kit.contracts.getAccounts()
    const eventsLimitPerFile = 500000 // upper limit of events JSON lib can stringify at a time

    // @ts-ignore - fromBlock defaults to 0 if undefined which is not assignable to (number | undefined) 
    fromBlock =  await this.determineBlockNumber(fromBlock, fromDate, this.kit.web3)
    toBlock = await this.determineBlockNumber(toBlock, toDate, this.kit.web3)

    if (!toBlock) this.error('Must submit parameter toBlock or toDate')
    if (toBlock < fromBlock) {
      this.error('Starting block cannot be more recent than ending block')
    }

    const progressBar = cli.progress()
    // progressBarTotal = number of times forno is pinged for events.
    // (all blocks / batchSize) * number of event types fetched
    const progressBarTotal = Math.floor(((toBlock - fromBlock)/batchSize + 1) * 3)
    progressBar.start(progressBarTotal, 0)

    const setWalletEvents = await getPastEvents(
      progressBar,
      accounts,
      eventTypes.AccountWalletAddressSet,
      fromBlock,
      toBlock,
      batchSize,
      []
    )
    const attestationCompletedEvents = await getPastEvents(
      progressBar,
      attestations,
      eventTypes.AttestationCompleted,
      fromBlock,
      toBlock,
      batchSize,
      []
    )
    const attestationEvents = mergeEvents(attestationCompletedEvents, setWalletEvents)

    const transferEvents = await getPastEvents(
      progressBar,
      stableToken,
      eventTypes.Transfer,
      fromBlock,
      toBlock,
      batchSize, 
      []
    )

    progressBar.update(progressBarTotal)
    progressBar.stop()
    this.writeEventsToFiles(attestationEvents, 'Attestation Events', eventsLimitPerFile)
    this.writeEventsToFiles(transferEvents, 'Transfer Events', eventsLimitPerFile)
  }

  writeEventsToFiles = (events: EventLog[], eventTitle: string, limit: number) => {
    let n = 0
    while (events.length > 0) {
      const splicedEvents = events.splice(0, limit)
      const fromBlock = splicedEvents[0].blockNumber
      const toBlock = splicedEvents[splicedEvents.length - 1].blockNumber
      const fileName = `${eventTitle.toLowerCase().replace(/ /g,'-')}${n}-${fromBlock}-${toBlock}.json`
      this.outputToFile(fileName, splicedEvents, eventTitle)
      n++
    }
  }
}
