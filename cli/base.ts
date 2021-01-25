import { Command } from '@oclif/command'
import { ParserOutput } from '@oclif/parser/lib/parse'
import { newKit, ContractKit } from '@celo/contractkit'
import fs from 'fs'
import Web3 from 'web3'

enum EnvNodes  {
  local     = 'http://localhost:8545',
  mainnet   = 'https://forno.celo.org',
  alfajores = 'https://alfajores-forno.celo-testnet.org',
  baklava   = 'https://baklava-forno.celo-testnet.org',
}

export abstract class BaseCommand extends Command {

  static dateDisclaimer = "Date is an approximation and matches to an arbitrary block near the given date"
  
  get kit(): ContractKit {
    const res: ParserOutput<any, any> = this.parse()
    let kit = newKit(this.nodeByEnv(res.flags.env))
    if (res.flags.privateKey) {
      kit.addAccount(res.flags.privateKey)
    }
    return kit
  }
  
  nodeByEnv(env: string | undefined): string {
    if (env) {      
      if (!Object.keys(EnvNodes).includes(env)) this.error(`invalid env: ${env}`) 
      return EnvNodes[env as keyof typeof EnvNodes]
    } else {
      return EnvNodes['local']
    }
  }

  outputToFile(filename: string, output: any, outputDetails: string) {
    fs.writeFile(filename, JSON.stringify(output, null, 2), (err) => {
      if (err) this.error(err)
    })
    this.log(outputDetails, ' output to file: ', filename)
  }
  
  // Determine block number from user parameters. If a date was submitted, use date to calculate 
  // corresponding block number. If no date, use the block number submitted.
  async determineBlockNumber(block: number | undefined, date: string | undefined, web3: Web3): Promise<number | undefined> {
    if (date) {
      let genesisBlock = await web3.eth.getBlock(0)
      let genesisDate: Date = new Date(parseInt(genesisBlock.timestamp.toString()) * 1000)
      let toDate: Date = new Date(date)
      // average block time is 5 seconds, divide 5000 to account for milliseconds
      const blockNumber = (toDate.getTime() - genesisDate.getTime()) / 5000
      if (blockNumber < 0) this.error(`date ${date} predates the chain. Choose a date after ${genesisDate}.`)
      return blockNumber
    }
    return block
  }
}
