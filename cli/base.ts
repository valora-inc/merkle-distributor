import { flags, Command } from '@oclif/command'
import fs from 'fs'

enum EnvNodes  {
  local     = 'http://localhost:8545',
  mainnet   = 'https://forno.celo.org',
  alfajores = 'https://alfajores-forno.celo-testnet.org',
  baklava   = 'https://baklava-forno.celo-testnet.org',
}

export abstract class BaseCommand extends Command {
  nodeByEnv(env: string | undefined) {
    if (env) {      
      // @ts-ignore
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
}
