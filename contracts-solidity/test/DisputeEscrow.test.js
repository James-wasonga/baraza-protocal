const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Baraza Protocol — end-to-end dispute lifecycle", function () {
  async function deployAll() {
    const [admin, claimant, respondent, juror1, juror2, juror3, outsider] = await ethers.getSigners();

    const ReputationSBT = await ethers.getContractFactory("ReputationSBT");
    const reputation = await ReputationSBT.deploy(admin.address);

    const BarazaRegistry = await ethers.getContractFactory("BarazaRegistry");
    const registry = await BarazaRegistry.deploy(admin.address, await reputation.getAddress());

    const ISSUER_ROLE = await reputation.ISSUER_ROLE();
    await reputation.grantRole(ISSUER_ROLE, await registry.getAddress());

    const MockJurySelector = await ethers.getContractFactory("MockJurySelector");
    const jurySelector = await MockJurySelector.deploy();

    const DisputeEscrow = await ethers.getContractFactory("DisputeEscrow");
    const escrow = await DisputeEscrow.deploy(
      admin.address,
      await registry.getAddress(),
      await reputation.getAddress(),
      await jurySelector.getAddress()
    );
    await reputation.grantRole(ISSUER_ROLE, await escrow.getAddress());

    // Create a circle with claimant, respondent, and three juror candidates.
    await registry.connect(claimant).createCircle(
      "Kilimani Traders Chama",
      "chama",
      [respondent.address, juror1.address, juror2.address, juror3.address]
    );

    return { admin, claimant, respondent, juror1, juror2, juror3, outsider, registry, reputation, escrow, jurySelector };
  }

  it("runs a full filed -> bonded -> jury -> voted -> resolved cycle", async function () {
    const { claimant, respondent, juror1, juror2, juror3, registry, reputation, escrow, jurySelector, admin } =
      await deployAll();

    const bondAmount = ethers.parseEther("0.01");
    const evidence = ethers.keccak256(ethers.toUtf8Bytes("evidence-1"));

    // 1. File
    const fileTx = await escrow.connect(claimant).fileDispute(
      1, respondent.address, bondAmount, "Respondent did not deliver goods paid for in round 4", [evidence]
    );
    const fileReceipt = await fileTx.wait();
    const disputeId = 1n;

    let dispute = await escrow.getDispute(disputeId);
    expect(dispute.status).to.equal(0); // Filed

    // 2. Bond both sides
    await escrow.connect(claimant).postBondNative(disputeId, { value: bondAmount });
    await escrow.connect(respondent).postBondNative(disputeId, { value: bondAmount });

    dispute = await escrow.getDispute(disputeId);
    expect(dispute.status).to.equal(1); // AwaitingJury

    // 3. Commit + reveal jury seed, select jury from the 3 juror candidates
    const seed = ethers.encodeBytes32String("seed-1");
    const seedCommitment = ethers.keccak256(ethers.solidityPacked(["bytes32"], [seed]));

    await escrow.connect(admin).commitJurySeed(disputeId, seedCommitment);

    const pool = [juror1.address, juror2.address, juror3.address];
    const weights = [500, 600, 550];
    await escrow.connect(admin).revealAndSelectJury(disputeId, seed, pool, weights, 3);

    dispute = await escrow.getDispute(disputeId);
    expect(dispute.status).to.equal(2); // Voting

    const jury = await escrow.getJury(disputeId);
    expect(jury.length).to.equal(3);

    // 4. Jury votes — 2/3 favor the claimant, should auto-resolve
    const jurorSigners = [juror1, juror2, juror3].filter((j) => jury.includes(j.address));
    // map back to actual signer objects matching selected addresses
    const signerByAddress = {
      [juror1.address]: juror1,
      [juror2.address]: juror2,
      [juror3.address]: juror3
    };

    await escrow.connect(signerByAddress[jury[0]]).castVote(disputeId, 1); // Claimant
    await escrow.connect(signerByAddress[jury[1]]).castVote(disputeId, 1); // Claimant -> majority reached

    dispute = await escrow.getDispute(disputeId);
    expect(dispute.status).to.equal(3); // Resolved
    expect(dispute.outcome).to.equal(1); // Claimant

    // 5. Reputation updated
    const claimantScore = await reputation.scoreOf(claimant.address);
    const respondentScore = await reputation.scoreOf(respondent.address);
    expect(claimantScore).to.be.gt(500);
    expect(respondentScore).to.be.lt(500);
  });

  it("refunds the claimant on dismissal before the respondent bonds", async function () {
    const { claimant, respondent, escrow } = await deployAll();
    const bondAmount = ethers.parseEther("0.005");

    await escrow.connect(claimant).fileDispute(1, respondent.address, bondAmount, "Minor disagreement", []);
    await escrow.connect(claimant).postBondNative(1, { value: bondAmount });

    const before = await ethers.provider.getBalance(claimant.address);
    const tx = await escrow.connect(claimant).dismiss(1);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(claimant.address);

    expect(after + gasCost - before).to.equal(bondAmount);

    const dispute = await escrow.getDispute(1);
    expect(dispute.status).to.equal(4); // Dismissed
  });

  it("rejects a non-circle-member from filing", async function () {
    const { escrow, outsider, respondent } = await deployAll();
    await expect(
      escrow.connect(outsider).fileDispute(1, respondent.address, ethers.parseEther("0.01"), "n/a", [])
    ).to.be.revertedWithCustomError(escrow, "NotCircleMember");
  });

  it("blocks reputation SBT transfers — it is soulbound", async function () {
    const { registry, reputation, claimant, respondent } = await deployAll();
    const tokenId = await reputation.tokenIdOf(claimant.address);
    expect(tokenId).to.not.equal(0n);
    await expect(
      reputation.connect(claimant).transferFrom(claimant.address, respondent.address, tokenId)
    ).to.be.revertedWithCustomError(reputation, "SoulboundToken");
  });
});
