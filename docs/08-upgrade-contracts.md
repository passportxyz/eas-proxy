# Upgrade

Each contract should a script that can be used to upgrade the contract. This script will deploy the new contract and generate calldata that should be used by the multsig to upgrade the contract. When the multisig approves the upgrade, it is calling the `upgradeTo` function and passing the address of the newly deployed contract.

e.g.

```bash
npx hardhat run scripts/upgradeAttester.ts --network optimism
```

Once deployed you should verify the contract on etherscan.

```bash
npx hardhat verify 0x423cd60ab053F1b63D6F78c8c0c63e20F009d669 --network optimism
```

Then copy the `./deployments` directory over to the passport application.

Finally copy the calldata from the deployment script output and paste it into the multisig UI.
