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
  const [admin, alice, bob, jurorA, jurorB, jurorC] = accounts;

  const repArt = getArtifact(contracts, "ReputationSBT.sol", "ReputationSBT");
  const regArt = getArtifact(contracts, "BarazaRegistry.sol", "BarazaRegistry");
  const mockArt = getArtifact(contracts, "MockJurySelector.sol", "MockJurySelector");
  const escrowArt = getArtifact(contracts, "DisputeEscrow.sol", "DisputeEscrow");
  const usdgArt = getArtifact(contracts, "MockERC20.sol", "MockERC20");

  console.log("\nDeploying ReputationSBT...");
  const reputation = await (await new ethers.ContractFactory(repArt.abi, repArt.bytecode, admin).deploy(admin.address)).waitForDeployment();
  console.log("  ->", await reputation.getAddress());

  console.log("Deploying BarazaRegistry...");
  const registry = await (await new ethers.ContractFactory(regArt.abi, regArt.bytecode, admin).deploy(admin.address, await reputation.getAddress())).waitForDeployment();
  console.log("  ->", await registry.getAddress());

  const ISSUER_ROLE = await reputation.ISSUER_ROLE();
  await (await reputation.grantRole(ISSUER_ROLE, await registry.getAddress())).wait();

  console.log("Deploying MockJurySelector...");
  const jurySelector = await (await new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, admin).deploy()).waitForDeployment();
  console.log("  ->", await jurySelector.getAddress());

  console.log("Deploying MockERC20 (stand-in for USDG)...");
  const usdg = await (await new ethers.ContractFactory(usdgArt.abi, usdgArt.bytecode, admin).deploy()).waitForDeployment();
  console.log("  ->", await usdg.getAddress());

  console.log("Deploying DisputeEscrow...");
  const escrow = await (await new ethers.ContractFactory(escrowArt.abi, escrowArt.bytecode, admin).deploy(
    admin.address, await registry.getAddress(), await reputation.getAddress(), await jurySelector.getAddress()
  )).waitForDeployment();
  console.log("  ->", await escrow.getAddress());
  await (await reputation.grantRole(ISSUER_ROLE, await escrow.getAddress())).wait();

  console.log("\n--- Scenario: USDG-denominated dispute, bond, jury, vote, resolve ---\n");

  await (await escrow.connect(admin).setAllowedBondToken(await usdg.getAddress(), true)).wait();
  console.log("USDG allowlisted as a bond token");

  await (await registry.connect(alice).createCircle(
    "Test Circle", "chama", [bob.address, jurorA.address, jurorB.address, jurorC.address]
  )).wait();

  const bondAmount = ethers.parseUnits("50", 6); // MockERC20 uses 6 decimals, like real USDG
  await (await usdg.mint(alice.address, bondAmount)).wait();
  await (await usdg.mint(bob.address, bondAmount)).wait();

  await (await escrow.connect(alice).fileDispute(
    1, bob.address, bondAmount, await usdg.getAddress(), "Shipment arrived short", []
  )).wait();
  console.log("Dispute #1 filed in USDG");

  await (await usdg.connect(alice).approve(await escrow.getAddress(), bondAmount)).wait();
  await (await escrow.connect(alice).postBondERC20(1)).wait();
  await (await usdg.connect(bob).approve(await escrow.getAddress(), bondAmount)).wait();
  await (await escrow.connect(bob).postBondERC20(1)).wait();
  console.log("Both bonds posted in USDG");

  let nativeRejected = false;
  try {
    await escrow.connect(alice).postBondNative.staticCall(1, { value: bondAmount });
  } catch (e) {
    nativeRejected = /WrongBondPath/.test(e.message) || /revert/i.test(e.message);
  }
  console.log("postBondNative correctly rejected on a USDG dispute:", nativeRejected);

  const seed = ethers.encodeBytes32String("seed-usdg-1");
  const seedCommitment = ethers.keccak256(ethers.solidityPacked(["bytes32"], [seed]));
  await (await escrow.connect(admin).commitJurySeed(1, seedCommitment)).wait();

  const pool = [jurorA.address, jurorB.address, jurorC.address];
  await (await escrow.connect(admin).revealAndSelectJury(1, seed, pool, [500, 600, 550], 3)).wait();
  const jury = await escrow.getJury(1);
  console.log("Jury selected:", jury);

  const signerByAddress = { [jurorA.address]: jurorA, [jurorB.address]: jurorB, [jurorC.address]: jurorC };
  await (await escrow.connect(signerByAddress[jury[0]]).castVote(1, 1)).wait();
  await (await escrow.connect(signerByAddress[jury[1]]).castVote(1, 1)).wait();

  const d = await escrow.getDispute(1);
  const aliceBalance = await usdg.balanceOf(alice.address);
  const expected = (bondAmount * 2n * 9500n) / 10000n;

  console.log("\nStatus =", d.status.toString(), "(expect 3 = Resolved), outcome =", d.outcome.toString(), "(expect 1 = Claimant)");
  console.log("Alice (winner) USDG balance:", ethers.formatUnits(aliceBalance, 6), "expected:", ethers.formatUnits(expected, 6));

  const allPassed = nativeRejected && d.status.toString() === "3" && d.outcome.toString() === "1" && aliceBalance === expected;
  console.log("\n" + (allPassed ? "✅ ALL USDG BOND CHECKS PASSED" : "❌ SOMETHING DID NOT MATCH — DO NOT SHIP"));
  if (!allPassed) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\n❌ Scenario failed:", e.message || e);
  process.exitCode = 1;
});