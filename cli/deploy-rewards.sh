# run this script to deploy a merkle distributor contract based on the given parameters passed. 
# run from any empty directory or create a "distribution" directory in the root to 
# automatically git ignore your distribution json files!
# example call (all date parameters are mm/dd/yyyy):
# ./cli/deploy-rewards.sh <fromDate>> <toDate> <celoToUsd rate> <exec address> <exec private key>

# make sure celogive is installed at the latest version
npm install -g @clabs/celogive

# Log parameters for confirmation. It's advised to use a throwaway private/public key pair.
# Currently, this process takes up less than 4 cents in gas costs.
echo Parameters
echo "\tfromDate:" $1
echo "\ttoDate:" $2
echo "\texchangeRate:" $3
echo "\tfromAddress:" $4
echo "\tprivateKey:" $5

export NODE_OPTIONS="--max-old-space-size=8192"

# get blocks until March. Cache and comment out next 2 lines for faster runtime next session.
echo "\nFetching Rewards until March 1st"
celogive rewards:fetchevents --toDate 02/01/2021 --env mainnet
celogive rewards:fetchevents --fromBlock 4927506 --toDate 03/01/2021 --env mainnet

# last block fetched for date 03/01/2021 is 5411345
echo "\nFetching rest of rewards..."
celogive rewards:fetchevents --fromBlock 5411346 --toDate $2 --env mainnet

# collect event files in proper order to feed as parameters (replaces \n with a space)
ATTESTATION_EVENTS=$(ls -tr | grep attestation | tr "\n" " ")
TRANSFER_EVENTS=$(ls -tr | grep transfer | tr "\n" " ")

# construct merkle tree and output all intermediary data into rewardsCalculationState.json
echo "\nGenerating Merkle Tree..."
echo "celogive rewards:generatemerkle \n
  --attestationEvents  $ATTESTATION_EVENTS \n
  --transferEvents $TRANSFER_EVENTS \n
  --balanceFromDate $1 \n
  --balanceToDate $2 \n
  --celoToUsd $3 \n
  --env mainnet\n"

celogive rewards:generatemerkle \
  --attestationEvents  $ATTESTATION_EVENTS \
  --transferEvents $TRANFER_EVENTS\
  --balanceFromDate $1 \
  --balanceToDate $2 \
  --celoToUsd $3 \
  --env mainnet

echo "\nDeploying Merkle Distributor contract..."
celogive rewards:deploydistributor \
  --merkleTree merkleTree.json \
  --env mainnet \
  --from $4 \
  --privateKey $5
