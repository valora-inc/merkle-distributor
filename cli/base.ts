import { flags, Command } from '@oclif/command'

enum EnvNodes  {
  local     = 'http://localhost:8545',
  mainnet   = 'https://forno.celo.org',
  alfajores = 'https://alfajores-forno.celo-testnet.org',
  baklava   = 'https://baklava-forno.celo-testnet.org',
}

export abstract class BaseCommand extends Command {
  node(env: keyof typeof EnvNodes | undefined) {
    if (env) {      
      // @ts-ignore
      if (!Object.values(EnvNodes).includes(env)) this.error(`invalid env: ${env}`) 
      return EnvNodes[env as keyof typeof EnvNodes]
    } else {
      return EnvNodes['local']
    }
  }
}
