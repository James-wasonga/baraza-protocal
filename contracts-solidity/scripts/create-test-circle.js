const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/// Creates one test circle with your deployer address plus any extra member
/// addresses you pass, so there's something to file a dispute against right
/// after deployment. Reads the deployed BarazaRegistry address from
/// deployments/<network>.json — run `npm run deploy:sepolia` first.
///
/// Usage:
///   npx hardhat run scripts/create-test-circle.js --network arbitrumSepolia
///
/// To add more members than just the deployer, set TEST_MEMBER_ADDRESSES in
/// .env as a comma-separated list, e.g.:
///   TEST_MEMBER_ADDRESSES=0xabc...,0xdef...
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deploymentFile = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`No deployment found at ${deploymentFile} — run the deploy script first.`);
  }
  const { contracts } = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  const registry = await hre.ethers.getContractAt("BarazaRegistry", contracts.BarazaRegistry);

  const extraMembers = (process.env.TEST_MEMBER_ADDRESSES || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  console.log("Creating test circle with deployer", deployer.address);
  if (extraMembers.length) console.log("Plus members:", extraMembers);

  const tx = await registry.createCircle("Test Circle", "chama", extraMembers);
  const receipt = await tx.wait();

  const event = receipt.logs
    .map((l) => {
      try {
        return registry.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((l) => l?.name === "CircleCreated");

  const circleId = event ? event.args.circleId.toString() : "unknown";
  console.log("\nCircle created — circleId:", circleId);
  console.log("Use this circleId when filing a test dispute from the frontend or via curl.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 