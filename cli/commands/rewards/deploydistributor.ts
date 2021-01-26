import { BigNumber } from 'bignumber.js'
import { flags } from '@oclif/command'
import fs from 'fs'
import { toTransactionObject } from '@celo/connect'
import { BaseCommand } from '../../base'
import MerkleDistributor from '../../MerkleDistributor.json'

export default class DeployMerkleDistributor extends BaseCommand {
  static description = 'Deploy Merkle Distributor Contract'

  static flags = {
    merkleTree: flags.string({ required: true, description: 'JSON file with rewards' }),
    env: flags.string({ required: false, description: '[default: local] Blockchain environment with which to interact' }),
    from: flags.string({ required: true, description: 'Deployer address' }),  
    privateKey: flags.string({ required: false, description: 'Use a private key to sign local transactions with' }), 
  }

  async run() {
    const res = this.parse(DeployMerkleDistributor)
    let merkleTree = JSON.parse(fs.readFileSync(res.flags.merkleTree, { encoding: 'utf8' }))
    const from: string = res.flags.from.toLowerCase()
    const celoToken = await this.kit.contracts.getGoldToken()
    const abi = MerkleDistributor.abi 

    // @ts-ignore - unhappy with the abi format, but it is valid
    let merkleDistributor = new this.kit.web3.eth.Contract(abi)
    let txResult = await toTransactionObject(
      this.kit.connection,
      // @ts-ignore - web3 Object instead of CeloTxObject
      merkleDistributor.deploy({
        data: "0x" + MerkleDistributor.bytecode,
        arguments: [celoToken.address, merkleTree.merkleRoot]
      })
    ).sendAndWaitForReceipt({ from })

    // @ts-ignore
    let contract = new this.kit.web3.eth.Contract(abi, txResult.contractAddress)
    merkleTree.contractAddress = contract.options.address
    fs.writeFileSync(res.flags.merkleTree, JSON.stringify(merkleTree, null, 2))

    this.log("Distibutor address: ", contract.options.address)
    this.log("Merkle root: ", await contract.methods.merkleRoot().call())
    this.log("Token address: ", await contract.methods.token().call())
    this.log("Total rewards: ",  new BigNumber(merkleTree.tokenTotal).toString())
  }
}
