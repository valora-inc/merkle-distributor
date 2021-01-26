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

## Use CLI to calculate CELO rewards and distribute rewards
To get complete documentation for each command and its parameters use the `--help` flag.
```bash
  ./bin/run rewards:generatemerkle --help
```

#### 1) Temporarily allocate more memory to node since aggregating events can take up a lot of space
  ```bash
  export NODE_OPTIONS="--max-old-space-size=8192"
  ```


#### 2) Fetch transfer and attestation events for rewards calculation
  ```bash
  ./bin/run rewards:fetchevents --toBlock 3000000 --env mainnet
  ```
  - Outputs two files:
    - Transfer Events: `transfer-cusd-events-<fromBlock>-<toBlock>.json`
    - Attestation Events: `attestation-events-<fromBlock<-<toBlock>.json`

#### 3) Use json files from previous command to calculate rewards
  ```bash
  ./bin/run rewards:generatemerkle \
    --attestationEvents <attestation-events.json> \
    --transferEvents <transfer-events.json> \
    --balanceFromBlock 2000000 \
    --balanceToBlock 3000000 \
    --reward 0.06 \
    --env mainnet
   ```
   - Outputs three files:
      - Merkle Tree representing rewards: `merkleTree.json`
      - Mapping of account to reward amount: `rewardsByAddress.json`
      - JSON with intermediate state to reach these reward amounts: `rewardsCalculationState.json`

#### 4) Deploy contract with merkle root from previous step
  ```bash
  ./bin/run rewards:deploydistributor --merkleTree merkleTree.json --env local --from <address>
  ```
  - Console logs important distributor information:
  ```bash
  Distibutor address:  0xEdCF1a0003f84A97E4a28c904d888C6a2811fe
  Merkle root:  0xb0071a0dc946557f936a848dfcdf7d8d06a01edbbadfca5fd034eb48110535af
  Token address:  0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9
  Total rewards:  849487996068222610
  ```
  
#### 5) Distribute rewards
  ```bash
  ./bin/run rewards:distribute --merkleTree merkleTree.json --address <distributor address> --env local --from <address> 
  ```
  - Outputs a file `distribution-<distributor address>.json` with a mapping of each account to the transactionHash of their distribution tx.
  - This is an asynchronous script that distibutes all unclaimed rewards.
  - If any of the transactions failed to complete, or returned an error, simply run the script again to retry all incomplete distributions.
  - Rewards are distributed fully when the output json `distribution-<distributor-address>.json` and `rewardsByAddress.json` mapping accounts keys match (same number of lines in each json file).
