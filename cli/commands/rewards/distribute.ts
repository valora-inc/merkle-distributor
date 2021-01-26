import { flags } from '@oclif/command'
import fs from 'fs'
import { BaseCommand } from '../../base'
import MerkleDistributor from '../../MerkleDistributor.json'
import { toTransactionObject } from '@celo/connect'
import { concurrentMap } from "@celo/base"

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

    const txHashes = JSON.parse(fs.readFileSync(distributionFile, 'utf8'))
    const results = await concurrentMap(50, Object.keys(merkleTree.claims), async (account: string) => {
      const claim = merkleTree.claims[account] 
      const isClaimed = await merkleDistributor.methods.isClaimed(claim.index).call()
      if (isClaimed) {
        return { account, success: false, status: 'already_claimed' }
      }
      try {
        const claimTx = toTransactionObject(
          this.kit.connection,
          merkleDistributor.methods.claim(claim.index, account, claim.amount, claim.proof)
        )
        const receipt = await claimTx.sendAndWaitForReceipt({ from })
        this.log(`Success!\t${account}\t\t${receipt.transactionHash}`)
        return { account, success: true, status: receipt.transactionHash }
      } catch (error) {
        this.log(`Error with claim: ${account}\n${error}`)
        return { account, success: false, status: `${error}` }
      }
    })
    results.forEach(result => {
      if (result.success) {
        txHashes[result.account] = result.status
      } else {
        if (!txHashes[result.account]) txHashes[result.account] = result.status 
      }
    })
    fs.writeFileSync(distributionFile, JSON.stringify(txHashes, null, 2))
  }
}
