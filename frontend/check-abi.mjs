import { Interface } from "ethers";
import { DisputeEscrowABI, BarazaRegistryABI, ReputationSBTABI, ERC20ABI } from "./src/lib/abis.js";

const abis = { DisputeEscrowABI, BarazaRegistryABI, ReputationSBTABI, ERC20ABI };

for (const [name, abi] of Object.entries(abis)) {
  const bad = abi.filter((line) => {
    try {
      return new Interface([line]).fragments.length !== 1;
    } catch {
      return true;
    }
  });
  console.log(name, bad.length ? "HAS BAD LINES:" : "ok");
  bad.forEach((b) => console.log("   ", b));
}