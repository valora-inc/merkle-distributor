# @uniswap/merkle-distributor

[![Tests](https://github.com/Uniswap/merkle-distributor/workflows/Tests/badge.svg)](https://github.com/Uniswap/merkle-distributor/actions?query=workflow%3ATests)
[![Lint](https://github.com/Uniswap/merkle-distributor/workflows/Lint/badge.svg)](https://github.com/Uniswap/merkle-distributor/actions?query=workflow%3ALint)

# Local Development

The following assumes the use of `node@>=10`.

## Install Dependencies

`yarn`

## Compile Contracts

`yarn compile`

## Run Tests

`yarn test`

## Install CLI
`npm install -g @clabs/celogive`

## Use CLI to calculate CELO rewards and distribute rewards
To get complete documentation for each command and its parameters use the `--help` flag.
```bash
  celogive rewards:generatemerkle --help
```

#### tl;dr Summary
   1) Allocate enough memory to nodejs
   2) Fetch the correct transfer and attestation events
   3) Generate merkle tree representing rewards distribution based off on-chain events
   4) Deploy Merkle Distributor contract with corresponding merkle root
   5) Notify rewards multi-sig holders to transfer over reward amount to be distributed
   6) Distribute Rewards

#### 1) Temporarily allocate more memory to node since aggregating events can take up a lot of space
  ```bash
  export NODE_OPTIONS="--max-old-space-size=8192"
  ```

#### 2) Fetch transfer and attestation events for rewards calculation
It's best to fetch events until January, then fetch the rest and store in separate files, or else JSON can get too big for nodejs. Begin fetching next batch exactly one block after the previous batch ended using the `--fromBlock` flag. There will soon be a fix to do this automatically.
  ```bash
  celogive rewards:fetchevents --toDate 01/01/2021 --env mainnet
  ```
  - Outputs two files:
    - Transfer Events: `transfer-cusd-events-<fromBlock>-<toBlock>.json`
    - Attestation Events: `attestation-events-<fromBlock<-<toBlock>.json`

#### 3) Use json files from previous command to calculate rewards and merkle tree
  ```bash
  celogive rewards:generatemerkle \
    --attestationEvents <attestation-events1.json> <attestation-events2.json>\
    --transferEvents <transfer-events1.json> <transfer-events2.json>\
    --balanceFromDate 02/01/2021 \
    --balanceToDate 02/08/2021 \
    --celoToUsd 3.08 \
    --env mainnet
   ```
   - Outputs three files:
      - Merkle Tree representing rewards: `merkleTree.json`
      - Mapping of account to reward amount: `rewardsByAddress.json`
      - JSON with intermediate state to reach these reward amounts: `rewardsCalculationState.json`

#### 4) Deploy contract with merkle root from previous step
  ```bash
  celogive rewards:deploydistributor --merkleTree merkleTree.json --env mainnet --from <address> --privateKey <key>
  ```
  - Console logs important distributor information:
  ```bash
  Distibutor address:  0xEdCF1a0003f84A97E4a28c904d888C6a2811fe
  Merkle root:  0xb0071a0dc946557f936a848dfcdf7d8d06a01edbbadfca5fd034eb48110535af
  Token address:  0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9
  Total rewards:  849487996068222610
  ```
  
#### 5) Transfer balance to Merkle Distributor Contract. This involves communicating the total rewards to our rewards multisig signers in discord, so that they may transfer the appropriate amount for the next and final step: the distribution.
```bash
 # you can check the balance using the celocli to make sure funds were successfully transferred
 celocli account:balance <merkle distributor address>
```
  
#### 6) Distribute rewards
  ```bash
  celogive rewards:distribute --merkleTree merkleTree.json --address <distributor address> --env mainnet --from <address> --privateKey <key>
  ```
  - Outputs a file `distribution-<distributor address>.json` with a mapping of each account to the transactionHash of their distribution tx.
  - This is an asynchronous script that distibutes all unclaimed rewards.
  - If any of the transactions failed to complete, or returned an error, simply run the script again to retry all incomplete distributions.
  - Rewards are distributed fully when the output json `distribution-<distributor-address>.json` and `rewardsByAddress.json` mapping accounts keys match (same number of lines in each json file).


  ## Use CLI to verify merkle root of a deployed Merkle Distribution contract for a rewards round
  #### 1) Follow steps 1 and 2 from above so you're ready to compute a merkle root
  #### 2) Follow step 3 and use all the parameters given for the rewards round plus the verifyAgainstContract parameter with the contract address used in the rewards round. Parameters can be found in recent discussion on the rewards forum post [found here](https://forum.celo.org/t/governance-proposal-to-reward-early-users/662/41).
  ```bash
     celogive rewards:generatemerkle \
      --verifyAgainstContract <merkle distributor address>
      --attestationEvents <attestation-events1.json> <attestation-events2.json>\
      --transferEvents <transfer-events1.json> <transfer-events2.json>\
      --balanceFromDate 02/01/2021 \
      --balanceToDate 02/08/2021 \
      --celoToUsd 3.08 \
      --env mainnet
  ```
   
   - The console output will verify whether or not the merkle root computed matches the merkle root of the MerkleDistributor contract
   - Use the output files to verify all intermediary data used to calculate the final rewards and merkle root: `merkleTree.json` `rewardsByAccount.json` `rewardsCalculationState.json` 
