const solc = require("solc");
const fs = require("fs");
const path = require("path");

const contractsDir = path.join(__dirname, "contracts");
const files = fs.readdirSync(contractsDir).filter((f) => f.endsWith(".sol"));

function findImports(importPath) {
  try {
    let resolved;
    if (importPath.startsWith("@openzeppelin/")) {
      resolved = path.join(__dirname, "node_modules", importPath);
    } else if (importPath.startsWith("./") || importPath.startsWith("../")) {
      resolved = path.join(contractsDir, importPath);
    } else {
      resolved = path.join(__dirname, "node_modules", importPath);
    }
    return { contents: fs.readFileSync(resolved, "utf8") };
  } catch (e) {
    return { error: "File not found: " + importPath };
  }
}

const sources = {};
for (const f of files) {
  sources[f] = { content: fs.readFileSync(path.join(contractsDir, f), "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
  }
};

console.log("Compiling with solc", solc.version());
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

let hasError = false;
if (output.errors) {
  for (const err of output.errors) {
    if (err.severity === "error") {
      hasError = true;
      console.error("\nERROR:", err.formattedMessage);
    } else {
      console.warn("\nwarning:", err.formattedMessage);
    }
  }
}

if (!hasError) {
  console.log("\n✅ All contracts compiled successfully with no errors.\n");
  for (const file of Object.keys(output.contracts || {})) {
    for (const name of Object.keys(output.contracts[file])) {
      const bytecodeLen = output.contracts[file][name].evm.bytecode.object.length / 2;
      console.log(`  ${file}:${name}  (${bytecodeLen} bytes runtime+init bytecode)`);
    }
  }
} else {
  process.exit(1);
}
