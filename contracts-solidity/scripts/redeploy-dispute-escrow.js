const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/// Redeploys ONLY DisputeEscrow — used when its logic changes (like adding
/// ERC-20/USDG bond support) but BarazaRegistry, ReputationSBT, and the
/// jury selector haven't. Re-wires the new contract to the existing three,
/// re-grants it ISSUER_ROLE on ReputationSBT, allowlists USDG as a bond
/// token, and updates deployments/<network>.json in place — leaving the
/// other three addresses untouched everywhere else.
///
/// Usage:
///   npx hardhat run scripts/redeploy-dispute-escrow.js --network arbitrumSepolia
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network}.json`);

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`No existing deployment found at ${deploymentFile} — run the full deploy script first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const { BarazaRegistry, ReputationSBT } = deployment.contracts;
  const oldEscrow = deployment.contracts.DisputeEscrow;

  console.log("Redeploying DisputeEscrow with account:", deployer.address);
  console.log("Re-wiring to existing BarazaRegistry:", BarazaRegistry);
  console.log("Re-wiring to existing ReputationSBT:", ReputationSBT);

  const jurySelectorAddress = process.env.STYLUS_JURY_SELECTOR_ADDRESS || deployment.contracts.JurySelector;
  console.log("Re-wiring to jury selector:", jurySelectorAddress);

  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;

  const DisputeEscrow = await hre.ethers.getContractFactory("DisputeEscrow");
  const escrow = await DisputeEscrow.deploy(relayerAddress, BarazaRegistry, ReputationSBT, jurySelectorAddress);
  await escrow.waitForDeployment();
  const newEscrowAddress = await escrow.getAddress();
  console.log("New DisputeEscrow deployed to:", newEscrowAddress);

  const reputation = await hre.ethers.getContractAt("ReputationSBT", ReputationSBT);
  const ISSUER_ROLE = await reputation.ISSUER_ROLE();
  const grantTx = await reputation.grantRole(ISSUER_ROLE, newEscrowAddress);
  await grantTx.wait();
  console.log("Granted ISSUER_ROLE to new DisputeEscrow.");

  const usdgAddress = process.env.USDG_TOKEN_ADDRESS;
  if (usdgAddress) {
    const allowTx = await escrow.setAllowedBondToken(usdgAddress, true);
    await allowTx.wait();
    console.log("Allowlisted USDG as a bond token:", usdgAddress);
  } else {
    console.log("USDG_TOKEN_ADDRESS not set in .env — skipping allowlist step.");
  }

  deployment.contracts.DisputeEscrow = newEscrowAddress;
  deployment.contracts.DisputeEscrow_previous = oldEscrow;
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

  console.log("\nUpdated deployments/" + network + ".json — DisputeEscrow address changed:");
  console.log("  old:", oldEscrow);
  console.log("  new:", newEscrowAddress);
  console.log("\nNext: update DISPUTE_ESCROW_ADDRESS in backend/.env and VITE_DISPUTE_ESCROW_ADDRESS in frontend/.env.");
  console.log("The other three addresses are unchanged.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});