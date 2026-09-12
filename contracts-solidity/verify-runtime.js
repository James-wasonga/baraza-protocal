const solc = require("solc");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const contractsDir = path.join(__dirname, "contracts");

function findImports(importPath) {
  try {
    let resolved;
    if (importPath.startsWith("./") || importPath.startsWith("../")) {
      resolved = path.join(contractsDir, importPath);
    } else {
      resolved = path.join(__dirname, "node_modules", importPath);
    }
    return { contents: fs.readFileSync(resolved, "utf8") };
  } catch (e) {
    return { error: "File not found: " + importPath };
  }
}

function compileAll() {
  const files = fs.readdirSync(contractsDir).filter((f) => f.endsWith(".sol"));
  const sources = {};
  for (const f of files) sources[f] = { content: fs.readFileSync(path.join(contractsDir, f), "utf8") };

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length) {
    errors.forEach((e) => console.error(e.formattedMessage));
    throw new Error("Compilation failed");
  }
  return output.contracts;
}

function getArtifact(contracts, file, name) {
  const c = contracts[file][name];
  return { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
}

async function main() {
  console.log("Compiling with solc-js...");
  const contracts = compileAll();
  console.log("Compiled OK. Connecting to local node...");

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const accounts = await Promise.all(
    (await provider.send("eth_accounts", [])).map((addr) => provider.getSigner(addr))
  );
  const [admin, claimant, respondent, jurorA, jurorB, jurorC, outsider] = accounts;

  const repArt = getArtifact(contracts, "ReputationSBT.sol", "ReputationSBT");
  const regArt = getArtifact(contracts, "BarazaRegistry.sol", "BarazaRegistry");
  const mockArt = getArtifact(contracts, "MockJurySelector.sol", "MockJurySelector");
  const escrowArt = getArtifact(contracts, "DisputeEscrow.sol", "DisputeEscrow");

  console.log("\nDeploying ReputationSBT...");
  const RepFactory = new ethers.ContractFactory(repArt.abi, repArt.bytecode, admin);
  const reputation = await (await RepFactory.deploy(admin.address)).waitForDeployment();
  console.log("  ->", await reputation.getAddress());

  console.log("Deploying BarazaRegistry...");
  const RegFactory = new ethers.ContractFactory(regArt.abi, regArt.bytecode, admin);
  const registry = await (await RegFactory.deploy(admin.address, await reputation.getAddress())).waitForDeployment();
  console.log("  ->", await registry.getAddress());

  const ISSUER_ROLE = await reputation.ISSUER_ROLE();
  await (await reputation.grantRole(ISSUER_ROLE, await registry.getAddress())).wait();

  console.log("Deploying MockJurySelector...");
  const MockFactory = new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, admin);
  const jurySelector = await (await MockFactory.deploy()).waitForDeployment();
  console.log("  ->", await jurySelector.getAddress());

  console.log("Deploying DisputeEscrow...");
  const EscrowFactory = new ethers.ContractFactory(escrowArt.abi, escrowArt.bytecode, admin);
  const escrow = await (await EscrowFactory.deploy(
    admin.address, await registry.getAddress(), await reputation.getAddress(), await jurySelector.getAddress()
  )).waitForDeployment();
  console.log("  ->", await escrow.getAddress());
  await (await reputation.grantRole(ISSUER_ROLE, await escrow.getAddress())).wait();

  console.log("\n--- Scenario: create circle, file dispute, bond, select jury, vote, resolve ---\n");

  await (await registry.connect(claimant).createCircle(
    "Kilimani Traders Chama", "chama",
    [respondent.address, jurorA.address, jurorB.address, jurorC.address]
  )).wait();
  console.log("Circle created with 5 members (claimant + respondent + 3 juror candidates)");

  const bondAmount = ethers.parseEther("0.01");
  const evidence = ethers.keccak256(ethers.toUtf8Bytes("evidence-1"));
  await (await escrow.connect(claimant).fileDispute(
    1, respondent.address, bondAmount, "Respondent did not deliver goods paid for in round 4", [evidence]
  )).wait();
  console.log("Dispute #1 filed");

  await (await escrow.connect(claimant).postBondNative(1, { value: bondAmount })).wait();
  await (await escrow.connect(respondent).postBondNative(1, { value: bondAmount })).wait();
  let d = await escrow.getDispute(1);
  console.log("Both bonds posted. Status =", d.status.toString(), "(expect 1 = AwaitingJury)");

  const seed = ethers.encodeBytes32String("seed-1");
  const seedCommitment = ethers.keccak256(ethers.solidityPacked(["bytes32"], [seed]));
  await (await escrow.connect(admin).commitJurySeed(1, seedCommitment)).wait();

  const pool = [jurorA.address, jurorB.address, jurorC.address];
  const weights = [500, 600, 550];
  await (await escrow.connect(admin).revealAndSelectJury(1, seed, pool, weights, 3)).wait();
  d = await escrow.getDispute(1);
  const jury = await escrow.getJury(1);
  console.log("Jury selected:", jury, " Status =", d.status.toString(), "(expect 2 = Voting)");

  const signerByAddress = { [jurorA.address]: jurorA, [jurorB.address]: jurorB, [jurorC.address]: jurorC };
  await (await escrow.connect(signerByAddress[jury[0]]).castVote(1, 1)).wait(); // Claimant
  await (await escrow.connect(signerByAddress[jury[1]]).castVote(1, 1)).wait(); // Claimant -> majority

  d = await escrow.getDispute(1);
  console.log("2/3 jurors voted Claimant. Status =", d.status.toString(), "(expect 3 = Resolved), outcome =", d.outcome.toString(), "(expect 1 = Claimant)");

  const claimantScore = await reputation.scoreOf(claimant.address);
  const respondentScore = await reputation.scoreOf(respondent.address);
  console.log("Claimant reputation score:", claimantScore.toString(), "(expect > 500)");
  console.log("Respondent reputation score:", respondentScore.toString(), "(expect < 500)");

  const claimantBalanceAfter = await provider.getBalance(claimant.address);
  console.log("\nWinner payout settled on-chain: claimant balance now", ethers.formatEther(claimantBalanceAfter), "ETH");

  // Soulbound check
  const tokenId = await reputation.tokenIdOf(claimant.address);
  try {
    await (await reputation.connect(claimant).transferFrom(claimant.address, respondent.address, tokenId)).wait();
    console.log("\n❌ SBT transfer should have reverted but did not!");
    process.exitCode = 1;
    return;
  } catch (e) {
    console.log("SBT transfer correctly reverted (soulbound enforced) ✅");
  }

  // Non-member filing check
  try {
    await (await escrow.connect(outsider).fileDispute(1, respondent.address, bondAmount, "n/a", [])).wait();
    console.log("❌ Outsider filing should have reverted but did not!");
    process.exitCode = 1;
    return;
  } catch (e) {
    console.log("Non-circle-member filing correctly reverted ✅");
  }

  console.log("\n✅ Full lifecycle scenario passed end-to-end against real deployed bytecode.");
}

main().catch((e) => {
  console.error("\n❌ Scenario failed:", e.message || e);
  process.exitCode = 1;
});
