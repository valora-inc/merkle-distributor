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

## Use CLI to calculate CELO rewards and deploy distributor contract
```bash
  # temporarily allocate more memory to node since aggregating events can take up a lot of space
  export NODE_OPTIONS="--max-old-space-size=8192"

  # fetch transfer and attestation events for rewards calculation
  ./bin/run rewards:fetchevents --toBlock 3000000 --env mainnet

  # use json files from previous command to calculate rewards
  ./bin/run rewards:generatemerkle \
    --attestationEvents <attestation-events.json> \
    --transferEvents <transfer-events.json> \
    --balanceFromBlock 2000000 \
    --balanceToBlock 3000000 \
    --reward 0.06 \
    --env mainnet

  # deploy contract with merkle root calculated in with generatemerkle
  ./bin/run rewards:deploydistributor --merkleTree merkleTree.json --env local --from <address>
```
