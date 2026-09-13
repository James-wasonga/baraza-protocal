const { ethers } = require("ethers");
const config = require("../config/env");
const { DisputeEscrowABI, BarazaRegistryABI, ReputationSBTABI } = require("../config/abis");

/// Thin wrapper around the three deployed contracts, signed by the backend's
/// relayer wallet. This wallet needs RELAYER_ROLE (to confirm M-Pesa bonds)
/// and ARBITER_ADMIN_ROLE (to commit/reveal jury seeds) on DisputeEscrow —
/// see contracts-solidity/scripts/deploy.js, which grants both to
/// RELAYER_ADDRESS if set.
///
/// Account-abstraction seam: gasless dispute filing for non-crypto-native
/// users is designed around this same relayer pattern — a ZeroDev (or any
/// ERC-4337) bundler/paymaster would sit in front of `fileDispute` the same
/// way this relayer sits in front of `confirmBondOffchain`, sponsoring gas
/// for the user's UserOperation instead of the backend calling the
/// contract directly on their behalf. That bundler/paymaster integration
/// itself is not wired up in this build — this file is the seam where it
/// plugs in, not a working AA implementation.
class BlockchainService {
  constructor() {
    this.ready = false;
    if (!config.chain.relayerPrivateKey || !config.chain.disputeEscrowAddress) {
      console.warn(
        "[blockchain] RELAYER_PRIVATE_KEY or DISPUTE_ESCROW_ADDRESS not set — " +
        "chain-writing endpoints will return 503 until backend/.env is filled in."
      );
      return;
    }

    this.provider = new ethers.JsonRpcProvider(config.chain.rpcUrl, config.chain.chainId);
    this.wallet = new ethers.Wallet(config.chain.relayerPrivateKey, this.provider);

    this.escrow = new ethers.Contract(config.chain.disputeEscrowAddress, DisputeEscrowABI, this.wallet);
    this.registry = new ethers.Contract(
      config.chain.barazaRegistryAddress,
      BarazaRegistryABI,
      this.provider
    );
    this.reputation = new ethers.Contract(
      config.chain.reputationSbtAddress,
      ReputationSBTABI,
      this.provider
    );
    this.ready = true;
  }

  assertReady() {
    if (!this.ready) {
      const err = new Error(
        "Blockchain service not configured — set RELAYER_PRIVATE_KEY and contract addresses in backend/.env"
      );
      err.statusCode = 503;
      throw err;
    }
  }

  async relayerAddress() {
    this.assertReady();
    return this.wallet.address;
  }

  /// Called once Daraja confirms an STK Push succeeded for a dispute bond.
  async confirmBondOffchain(disputeId, partyAddress) {
    this.assertReady();
    const tx = await this.escrow.confirmBondOffchain(disputeId, partyAddress);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getDispute(disputeId) {
    this.assertReady();
    const d = await this.escrow.getDispute(disputeId);
    return {
      circleId: d.circleId.toString(),
      claimant: d.claimant,
      respondent: d.respondent,
      bondAmount: d.bondAmount.toString(),
      status: Number(d.status),
      summary: d.summary,
      votingDeadline: Number(d.votingDeadline),
      outcome: Number(d.outcome)
    };
  }

  async getJury(disputeId) {
    this.assertReady();
    return this.escrow.getJury(disputeId);
  }

  async getVoteTally(disputeId) {
    this.assertReady();
    const [forClaimant, forRespondent] = await this.escrow.getVoteTally(disputeId);
    return { forClaimant: Number(forClaimant), forRespondent: Number(forRespondent) };
  }

  async circleMembers(circleId) {
    this.assertReady();
    return this.registry.membersOf(circleId);
  }

  async reputationScore(address) {
    this.assertReady();
    const score = await this.reputation.scoreOf(address);
    return Number(score);
  }

  /// Orchestrates jury selection for a dispute: pulls circle membership,
  /// excludes the two parties, fetches each candidate's live reputation
  /// score as the selection weight, generates a random seed, commits its
  /// hash, waits one block for finality, then reveals and triggers the
  /// weighted draw. This is the piece that would run as a scheduled job or
  /// be triggered by the BondPosted event in production (no such listener
  /// is wired up in this build — it's called directly by the
  /// /disputes/:id/select-jury route today; a chain-event listener is the
  /// natural next step, not yet built).
  async selectJuryForDispute(disputeId, jurySize = 3) {
    this.assertReady();

    const dispute = await this.getDispute(disputeId);
    const allMembers = await this.circleMembers(dispute.circleId);
    const pool = allMembers.filter(
      (m) => m.toLowerCase() !== dispute.claimant.toLowerCase() &&
             m.toLowerCase() !== dispute.respondent.toLowerCase()
    );

    if (pool.length < jurySize) {
      const err = new Error(
        `Circle only has ${pool.length} eligible juror candidates, need ${jurySize}`
      );
      err.statusCode = 422;
      throw err;
    }

    const weights = await Promise.all(pool.map((addr) => this.reputationScore(addr)));

    const seedBytes = ethers.randomBytes(32);
    const seed = ethers.hexlify(seedBytes);
    const seedCommitment = ethers.keccak256(ethers.solidityPacked(["bytes32"], [seed]));

    const commitTx = await this.escrow.commitJurySeed(disputeId, seedCommitment);
    await commitTx.wait();

    const revealTx = await this.escrow.revealAndSelectJury(disputeId, seed, pool, weights, jurySize);
    const receipt = await revealTx.wait();

    const jury = await this.getJury(disputeId);
    return { jury, txHash: receipt.hash };
  }
}

module.exports = new BlockchainService();
