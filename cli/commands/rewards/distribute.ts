import { flags } from '@oclif/command'
import fs from 'fs'
import { BaseCommand } from '../../base'
import MerkleDistributor from '../../MerkleDistributor.json'

export default class DeployMerkleDistributor extends BaseCommand {
  static description = 'Deploy Merkle Distributor Contract'

  static flags = {
    merkleTree: flags.string({ required: true, description: 'JSON file with rewards' }),
    address: flags.string({ required: true, description: 'Address of merkle distributor contract' }),
    env: flags.string({ required: false, description: '[default: local] Blockchain environment with which to interact' }),
    from: flags.string({ required: true, description: 'Deployer address' }),  
    privateKey: flags.string({ required: false, description: 'Use a private key to sign local transactions with' }), 
  }

  async run() {
    const res = this.parse(DeployMerkleDistributor)
    const merkleTree = JSON.parse(fs.readFileSync(res.flags.merkleTree, { encoding: 'utf8' }))
    const from: string = res.flags.from.toLowerCase()
    const gasPrice = await this.getGasPrice(this.kit)
    const abi = MerkleDistributor.abi 
    const distAddress = res.flags.address
    const merkleDistributor = new this.kit.web3.eth.Contract(abi, distAddress)
    const distributorMerkleRoot = await merkleDistributor.methods.merkleRoot().call()
    if (merkleTree.merkleRoot != distributorMerkleRoot) {
      this.error(`merkle roobt: ${merkleTree.merkleRoot} does not match contract root: ${distributorMerkleRoot}`)
    }

    const distributionFile = `distribution-${distAddress}.json`
    if (!fs.existsSync(distributionFile) || fs.readFileSync(distributionFile).length == 0) {
      fs.writeFileSync(distributionFile, '{}')
    }
    
    for (let account of Object.keys(merkleTree.claims)) {
      let claim = merkleTree.claims[account]
      merkleDistributor.methods.isClaimed(claim.index).call((err: Error, claimed: boolean) =>{
        if (err) this.error(err)
        if (!claimed) {
          merkleDistributor.methods.claim(
            claim.index,
            account,
            claim.amount,
            claim.proof
          ).send(
            { from, gas: 1500000, gasPrice }
          ).on('receipt', (receipt: any) => {
            console.log(`Success! ${account}`)
            let txHashes = JSON.parse(fs.readFileSync(distributionFile).toString()) 
            txHashes[account] = receipt.transactionHash
            fs.writeFileSync(distributionFile, JSON.stringify(txHashes, null, 2))
          }
          ).on('error', (error: Error) => {
            this.log(`Error for account ${account}:\n${error}`, )
          })
        } else {
          let txHashes = JSON.parse(fs.readFileSync(distributionFile).toString()) 
          if (!txHashes[account]) {
            txHashes[account] = 'already claimed separately'
            fs.writeFileSync(distributionFile, JSON.stringify(txHashes, null, 2))
          } 
        }
      })
    }
  }
}
