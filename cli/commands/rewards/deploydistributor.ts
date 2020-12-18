import { cli } from 'cli-ux'
import { newKit } from '@celo/contractkit'
import { flags, Command } from '@oclif/command'
import fs from 'fs'
import { BaseCommand } from '../../base'
import MerkleDistributor from '../../MerkleDistributor.json'

export default class DeployMerkleDistributor extends BaseCommand {
  static description = 'Deploy Merkle Distributor Contract'

  static flags = {
    merkleTree: flags.string({ required: true, description: 'JSON file with rewards' }),
    env: flags.string({ required: false, description: 'blockchain environment with which to interact' }),
    from: flags.string({ required: true, description: 'Deployer address' }),  
    privateKey: flags.string({ required: false, description: 'Use a private key to sign local transactions with' }), 
  }

  async run() {
    const res = this.parse(DeployMerkleDistributor)
    const merkleTree = JSON.parse(fs.readFileSync(res.flags.merkleTree, { encoding: 'utf8' }))
    const from: string = res.flags.from
    const kit = newKit(this.node(res.flags.env))
    const stableToken = await kit.contracts.getStableToken()
    const abi = MerkleDistributor.abi 
    if (res.flags.privateKey) {
      kit.addAccount(res.flags.privateKey)
    }
    let merkleDistributor = new kit.web3.eth.Contract(abi)
    let contract = await merkleDistributor.deploy({
        data: MerkleDistributor.bytecode,
        arguments: [stableToken.address, merkleTree.merkleRoot]
    }).send({ 
        from,
        gas: 1500000,
        gasPrice: '30000000000000'
    })
    //@ts-ignore
    console.log("Distibutor address: ", contract._address)
    console.log("Merkle root: ", await contract.methods.merkleRoot().call())
    console.log("Token address: ", await contract.methods.token().call())
  }
}