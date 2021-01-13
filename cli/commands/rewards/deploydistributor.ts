import { BigNumber } from 'bignumber.js'
import { flags } from '@oclif/command'
import fs from 'fs'
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
    const merkleTree = JSON.parse(fs.readFileSync(res.flags.merkleTree, { encoding: 'utf8' }))
    const from: string = res.flags.from.toLowerCase()
    const gasPrice = await this.getGasPrice(this.kit)
    const celoToken = await this.kit.contracts.getGoldToken()
    const abi = MerkleDistributor.abi 

    // @ts-ignore - unhappy with the abi format, but it is valid
    let merkleDistributor = new this.kit.web3.eth.Contract(abi)
    let contract = await merkleDistributor.deploy({
      data: "0x" + MerkleDistributor.bytecode,
      arguments: [celoToken.address, merkleTree.merkleRoot]
    }).send({ 
      from,
      gas: 1500000,
      gasPrice
    })

    this.log("Distibutor address: ", contract.options.address)
    this.log("Merkle root: ", await contract.methods.merkleRoot().call())
    this.log("Token address: ", await contract.methods.token().call())
    this.log("Total rewards: ",  new BigNumber(merkleTree.tokenTotal).toString())
  }
}
