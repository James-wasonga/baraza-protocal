const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/// Deploys, in order:
///   1. ReputationSBT     (soulbound reputation tokens)
///   2. BarazaRegistry    (chama/circle membership, reads ReputationSBT)
///   3. DisputeEscrow      (core dispute logic, points at the already-deployed
///                          Stylus JurySelector — deploy that first with
///                          `cargo stylus deploy`, see contracts-stylus/README.md)
///
/// Set STYLUS_JURY_SELECTOR_ADDRESS in .env after deploying the Stylus
/// contract. If it's unset, this script deploys a MockJurySelector instead
/// so the rest of the system is testable end-to-end without Stylus tooling.
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Baraza Protocol contracts with account:", deployer.address);
  console.log("Network:", hre.network.name);

  const ReputationSBT = await hre.ethers.getContractFactory("ReputationSBT");
  const reputation = await ReputationSBT.deploy(deployer.address);
  await reputation.waitForDeployment();
  console.log("ReputationSBT deployed to:", await reputation.getAddress());

  const BarazaRegistry = await hre.ethers.getContractFactory("BarazaRegistry");
  const registry = await BarazaRegistry.deploy(deployer.address, await reputation.getAddress());
  await registry.waitForDeployment();
  console.log("BarazaRegistry deployed to:", await registry.getAddress());

  // ISSUER_ROLE on ReputationSBT must be granted to the registry (it calls
  // ensureProfile on membership add) and to DisputeEscrow (it adjusts
  // scores on resolution) — granted below after DisputeEscrow deploys.
  const ISSUER_ROLE = await reputation.ISSUER_ROLE();
  await (await reputation.grantRole(ISSUER_ROLE, await registry.getAddress())).wait();
  console.log("Granted ISSUER_ROLE to BarazaRegistry");

  let jurySelectorAddress = process.env.STYLUS_JURY_SELECTOR_ADDRESS;
  if (!jurySelectorAddress) {
    console.log("STYLUS_JURY_SELECTOR_ADDRESS not set — deploying MockJurySelector for local/dev use.");
    const MockJurySelector = await hre.ethers.getContractFactory("MockJurySelector");
    const mock = await MockJurySelector.deploy();
    await mock.waitForDeployment();
    jurySelectorAddress = await mock.getAddress();
    console.log("MockJurySelector deployed to:", jurySelectorAddress);
  }

  const DisputeEscrow = await hre.ethers.getContractFactory("DisputeEscrow");
  const escrow = await DisputeEscrow.deploy(
    deployer.address,
    await registry.getAddress(),
    await reputation.getAddress(),
    jurySelectorAddress
  );
  await escrow.waitForDeployment();
  console.log("DisputeEscrow deployed to:", await escrow.getAddress());

  await (await reputation.grantRole(ISSUER_ROLE, await escrow.getAddress())).wait();
  console.log("Granted ISSUER_ROLE to DisputeEscrow");

  const RELAYER_ROLE = await escrow.RELAYER_ROLE();
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  if (relayerAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await escrow.grantRole(RELAYER_ROLE, relayerAddress)).wait();
    console.log("Granted RELAYER_ROLE to", relayerAddress);
  }

  const deployment = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    contracts: {
      ReputationSBT: await reputation.getAddress(),
      BarazaRegistry: await registry.getAddress(),
      DisputeEscrow: await escrow.getAddress(),
      JurySelector: jurySelectorAddress
    }
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log("\nDeployment addresses written to", outFile);
  console.log(JSON.stringify(deployment.contracts, null, 2));
  console.log("\nCopy these into backend/.env and frontend/.env — see root README.md.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
