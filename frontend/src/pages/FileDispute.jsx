// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { parseEther, id as keccakId } from "ethers";
// import { useWallet } from "../hooks/useWallet.jsx";
// import { useContracts } from "../hooks/useContracts.js";
// import { sampleCircles } from "../lib/sampleData.js";
// import BondModal from "../components/BondModal.jsx";

// export default function FileDispute() {
//   const navigate = useNavigate();
//   const { address, connect } = useWallet();
//   const { configured, disputeEscrow, withSigner } = useContracts();

//   const [circleId, setCircleId] = useState(sampleCircles[0]?.id ?? 1);
//   const [respondent, setRespondent] = useState("");
//   const [bondAmount, setBondAmount] = useState("0.01");
//   const [summary, setSummary] = useState("");
//   const [evidenceNote, setEvidenceNote] = useState("");
//   const [submitting, setSubmitting] = useState(false);
//   const [filedId, setFiledId] = useState(null);
//   const [showBondModal, setShowBondModal] = useState(false);
//   const [error, setError] = useState(null);

//   const canSubmit = respondent.length === 42 && summary.trim().length > 10 && Number(bondAmount) > 0;

//   async function handleSubmit(e) {
//     e.preventDefault();
//     setError(null);

//     if (!address) {
//       await connect();
//       return;
//     }

//     if (!configured || !disputeEscrow) {
//       // Demo mode: no deployed contracts yet — simulate a successful filing
//       // so the flow (including the bond modal) is still fully walkable.
//       setFiledId("demo-1");
//       setShowBondModal(true);
//       return;
//     }

//     setSubmitting(true);
//     try {
//       const contract = await withSigner(disputeEscrow);
//       const evidenceHashes = evidenceNote ? [keccakId(evidenceNote)] : [];
//       const tx = await contract.fileDispute(
//         circleId,
//         respondent,
//         parseEther(bondAmount),
//         summary,
//         evidenceHashes
//       );
//       const receipt = await tx.wait();
//       const event = receipt.logs
//         .map((l) => {
//           try {
//             return contract.interface.parseLog(l);
//           } catch {
//             return null;
//           }
//         })
//         .find((l) => l?.name === "DisputeFiled");
//       const newId = event ? event.args.disputeId.toString() : null;
//       setFiledId(newId);
//       setShowBondModal(true);
//     } catch (err) {
//       setError(err?.reason || err?.message || "Filing failed.");
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   return (
//     <div className="mx-auto max-w-2xl px-5 sm:px-8 py-12">
//       <p className="label-caps text-marigold-400 mb-2">New dispute</p>
//       <h1 className="font-display text-3xl text-bone-100 mb-2">File a dispute</h1>
//       <p className="text-bone-300 mb-8">
//         Filing is free — the bond is only collected once you post it in the next step, and it's
//         refunded in full if you win.
//       </p>

//       <form onSubmit={handleSubmit} className="panel p-6 space-y-6">
//         <Field label="Circle">
//           <select
//             value={circleId}
//             onChange={(e) => setCircleId(Number(e.target.value))}
//             className="input-field"
//           >
//             {sampleCircles.map((c) => (
//               <option key={c.id} value={c.id}>
//                 {c.name}
//               </option>
//             ))}
//           </select>
//         </Field>

//         <Field label="Respondent's wallet address" hint="Must be a member of the same circle">
//           <input
//             value={respondent}
//             onChange={(e) => setRespondent(e.target.value)}
//             placeholder="0x…"
//             className="input-field font-mono text-sm"
//           />
//         </Field>

//         <Field label="Bond amount (ETH, per party)" hint="Refunded in full if you win the dispute">
//           <input
//             type="number"
//             step="0.001"
//             min="0"
//             value={bondAmount}
//             onChange={(e) => setBondAmount(e.target.value)}
//             className="input-field"
//           />
//         </Field>

//         <Field label="What happened?" hint={`${summary.length}/300 characters`}>
//           <textarea
//             value={summary}
//             onChange={(e) => setSummary(e.target.value.slice(0, 300))}
//             rows={4}
//             placeholder="Describe the claim in plain terms — the jury will read this first."
//             className="input-field resize-none"
//           />
//         </Field>

//         <Field label="Evidence note (optional)" hint="A description gets hashed on-chain; keep the original off-chain">
//           <input
//             value={evidenceNote}
//             onChange={(e) => setEvidenceNote(e.target.value)}
//             placeholder="e.g. M-Pesa statement 12 Aug – 20 Aug"
//             className="input-field"
//           />
//         </Field>

//         {error && <p className="text-sm text-rust-500">{error}</p>}
//         {!configured && (
//           <p className="text-xs text-bone-500 border-t border-ink-border pt-4">
//             Demo mode: no contracts deployed yet, so filing is simulated. Deploy the contracts
//             and set the addresses in frontend/.env to file for real.
//           </p>
//         )}

//         <button type="submit" disabled={!canSubmit || submitting} className="btn-primary w-full">
//           {!address ? "Connect wallet to file" : submitting ? "Filing…" : "File dispute"}
//         </button>
//       </form>

//       {showBondModal && (
//         <BondModal
//           disputeId={filedId}
//           party={address}
//           bondAmountEth={bondAmount}
//           onClose={() => navigate(configured && filedId ? `/disputes/${filedId}` : "/disputes")}
//           onNativePay={async () => {
//             if (configured && disputeEscrow && filedId) {
//               const contract = await withSigner(disputeEscrow);
//               await (await contract.postBondNative(filedId, { value: parseEther(bondAmount) })).wait();
//             }
//             navigate(configured && filedId ? `/disputes/${filedId}` : "/disputes");
//           }}
//         />
//       )}
//     </div>
//   );
// }

// function Field({ label, hint, children }) {
//   return (
//     <div>
//       <div className="flex items-baseline justify-between mb-1.5">
//         <label className="label-caps">{label}</label>
//         {hint && <span className="text-xs text-bone-500">{hint}</span>}
//       </div>
//       {children}
//     </div>
//   );
// }

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseEther } from "ethers";
import { useWallet } from "../hooks/useWallet.jsx";
import { useContracts } from "../hooks/useContracts.js";
import { sampleCircles } from "../lib/sampleData.js";
import BondModal from "../components/BondModal.jsx";

/// Hashes a File's actual bytes with SHA-256 (via the browser's built-in
/// Web Crypto API — no library, no upload) and returns a 32-byte hex
/// string suitable for the contract's `bytes32[] evidenceHashes` param.
/// This proves "this exact file existed at filing time" without ever
/// sending the file anywhere. The file itself stays on the user's device;
/// only its fingerprint goes on-chain.
async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return "0x" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function FileDispute() {
  const navigate = useNavigate();
  const { address, connect } = useWallet();
  const { configured, disputeEscrow, barazaRegistry, withSigner } = useContracts();

  const [circleId, setCircleId] = useState(sampleCircles[0]?.id ?? 1);
  const [members, setMembers] = useState(sampleCircles[0]?.members ?? []);
  const [respondent, setRespondent] = useState("");
  const [bondAmount, setBondAmount] = useState("0.01");
  const [summary, setSummary] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState([]); // [{ name, hash }]
  const [hashingFile, setHashingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filedId, setFiledId] = useState(null);
  const [showBondModal, setShowBondModal] = useState(false);
  const [error, setError] = useState(null);

  // Load this circle's members — from chain if configured, otherwise from
  // the same sample data the rest of the demo uses.
  useEffect(() => {
    setRespondent("");
    if (configured && barazaRegistry) {
      barazaRegistry
        .membersOf(circleId)
        .then((addrs) => setMembers(addrs))
        .catch(() => setMembers(sampleCircles.find((c) => c.id === circleId)?.members ?? []));
    } else {
      setMembers(sampleCircles.find((c) => c.id === circleId)?.members ?? []);
    }
  }, [circleId, configured, barazaRegistry]);

  const respondentOptions = useMemo(
    () => members.filter((m) => m.toLowerCase() !== (address || "").toLowerCase()),
    [members, address]
  );

  const canSubmit = respondent.length === 42 && summary.trim().length > 10 && Number(bondAmount) > 0;

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHashingFile(true);
    try {
      const hash = await hashFile(file);
      setEvidenceFiles((prev) => [...prev, { name: file.name, hash }]);
    } finally {
      setHashingFile(false);
      e.target.value = ""; // allow re-selecting the same file name again
    }
  }

  function removeEvidence(idx) {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!address) {
      await connect();
      return;
    }

    if (!configured || !disputeEscrow) {
      // Demo mode: no deployed contracts yet — simulate a successful filing
      // so the flow (including the bond modal) is still fully walkable.
      setFiledId("demo-1");
      setShowBondModal(true);
      return;
    }

    setSubmitting(true);
    try {
      const contract = await withSigner(disputeEscrow);
      const evidenceHashes = evidenceFiles.map((f) => f.hash);
      const tx = await contract.fileDispute(
        circleId,
        respondent,
        parseEther(bondAmount),
        summary,
        evidenceHashes
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((l) => {
          try {
            return contract.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((l) => l?.name === "DisputeFiled");
      const newId = event ? event.args.disputeId.toString() : null;
      setFiledId(newId);
      setShowBondModal(true);
    } catch (err) {
      setError(err?.reason || err?.message || "Filing failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 sm:px-8 py-12">
      <p className="label-caps text-marigold-400 mb-2">New dispute</p>
      <h1 className="font-display text-3xl text-bone-100 mb-2">File a dispute</h1>
      <p className="text-bone-300 mb-8">
        Filing is free — the bond is only collected once you post it in the next step, and it's
        refunded in full if you win.
      </p>

      <form onSubmit={handleSubmit} className="panel p-6 space-y-6">
        <Field label="Circle">
          <select
            value={circleId}
            onChange={(e) => setCircleId(Number(e.target.value))}
            className="input-field"
          >
            {sampleCircles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Respondent"
          hint={address ? `${respondentOptions.length} other member(s) in this circle` : "Connect wallet first"}
        >
          <select
            value={respondent}
            onChange={(e) => setRespondent(e.target.value)}
            className="input-field font-mono text-sm"
            disabled={!address || respondentOptions.length === 0}
          >
            <option value="">— select a circle member —</option>
            {respondentOptions.map((addr) => (
              <option key={addr} value={addr}>
                {addr}
              </option>
            ))}
          </select>
          <p className="text-xs text-bone-500 mt-1.5">
            Only members of the selected circle appear here — the contract rejects anyone else.
          </p>
        </Field>

        <Field label="Bond amount (ETH, per party)" hint="Refunded in full if you win the dispute">
          <input
            type="number"
            step="0.001"
            min="0"
            value={bondAmount}
            onChange={(e) => setBondAmount(e.target.value)}
            className="input-field"
          />
        </Field>

        <Field label="What happened?" hint={`${summary.length}/300 characters`}>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 300))}
            rows={4}
            placeholder="Describe the claim in plain terms — the jury will read this first."
            className="input-field resize-none"
          />
        </Field>

        <Field label="Evidence (optional)" hint="Files are hashed in your browser — never uploaded anywhere">
          <label className="btn-secondary w-full cursor-pointer">
            {hashingFile ? "Hashing…" : "Choose a file (screenshot, statement, PDF…)"}
            <input type="file" onChange={handleFileChosen} className="hidden" disabled={hashingFile} />
          </label>
          {evidenceFiles.length > 0 && (
            <ul className="mt-3 space-y-2">
              {evidenceFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-xs bg-ink-900 rounded-sm px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-bone-100 truncate">{f.name}</p>
                    <p className="font-mono text-bone-500 truncate">{f.hash}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEvidence(i)}
                    className="text-bone-500 hover:text-rust-500 ml-3 shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-bone-500 mt-2">
            Only a SHA-256 fingerprint of the file goes on-chain — proof it existed at filing
            time, without exposing its contents. Keep the actual file yourself; jurors will ask
            you to share it directly (e.g. over WhatsApp) when reviewing the case.
          </p>
        </Field>

        {error && <p className="text-sm text-rust-500">{error}</p>}
        {!configured && (
          <p className="text-xs text-bone-500 border-t border-ink-border pt-4">
            Demo mode: no contracts deployed yet, so filing is simulated. Deploy the contracts
            and set the addresses in frontend/.env to file for real.
          </p>
        )}

        <button type="submit" disabled={!canSubmit || submitting} className="btn-primary w-full">
          {!address ? "Connect wallet to file" : submitting ? "Filing…" : "File dispute"}
        </button>
      </form>

      {showBondModal && (
        <BondModal
          disputeId={filedId}
          party={address}
          bondAmountEth={bondAmount}
          onClose={() => navigate(configured && filedId ? `/disputes/${filedId}` : "/disputes")}
          onNativePay={async () => {
            if (configured && disputeEscrow && filedId) {
              const contract = await withSigner(disputeEscrow);
              await (await contract.postBondNative(filedId, { value: parseEther(bondAmount) })).wait();
            }
            navigate(configured && filedId ? `/disputes/${filedId}` : "/disputes");
          }}
        />
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="label-caps">{label}</label>
        {hint && <span className="text-xs text-bone-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}