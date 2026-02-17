"use client";
import { useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { Transaction } from "@iota/iota-sdk/transactions";
import {
  isValidIotaAddress,
  fromBase58,
  toBase64,
} from "@iota/iota-sdk/utils";
import { useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { bcs } from "@iota/iota-sdk/bcs";
import { CONFIG } from "@/config/config";
import { useTxServiceClientContext } from "@/contexts";
import { shortenAddress } from "@/lib/utils/shortenAddress";


interface DeleteAccountDialogProps {
  accountAddress: string;
  onClose: () => void;
}

type OwnedObject = {
  objectId: string;
  type: string;
  version: string;
  digest: string;
};

export function DeleteAccountDialog({
  accountAddress,
  onClose,
}: DeleteAccountDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [proposedTxDigest, setProposedTxDigest] = useState<string | null>(null);

  // Beneficiary state
  const [beneficiary, setBeneficiary] = useState("");
  const [ownedObjects, setOwnedObjects] = useState<OwnedObject[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(true);

  const iotaClient = useIotaClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const txServiceClient = useTxServiceClientContext();
  const hasStarted = useRef(false);

  // Fetch owned objects on mount
  useEffect(() => {
    async function fetchOwnedObjects() {
      try {
        const allObjects: OwnedObject[] = [];
        let cursor: string | null | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
          const response = await iotaClient.getOwnedObjects({
            owner: accountAddress,
            options: { showType: true },
            ...(cursor ? { cursor } : {}),
          });

          for (const item of response.data) {
            if (item.data) {
              // ignore all iota coins: they will be transferred with gas and we don't want to list them here
              if (item.data.type?.startsWith("0x2::coin::Coin<0x2::iota::IOTA>")) continue;
              allObjects.push({
                objectId: item.data.objectId,
                type: item.data.type || "unknown",
                version: item.data.version,
                digest: item.data.digest,
              });
            }
          }

          hasMore = response.hasNextPage;
          cursor = response.nextCursor;
        }

        setOwnedObjects(allObjects);
      } catch (err) {
        console.error("Failed to fetch owned objects:", err);
      } finally {
        setLoadingObjects(false);
      }
    }
    fetchOwnedObjects();
  }, [accountAddress, iotaClient]);

  const canConfirm =
    !loadingObjects &&
    beneficiary.trim() !== "" &&
    isValidIotaAddress(beneficiary);

  // ── Execution steps (Phase B) ──

  async function fetchTransactionDigests(): Promise<number[][]> {
    // View call to get the Transactions struct
    const data = await iotaClient.view({
      functionName: `${CONFIG.packageId}::dynamic_auth::transactions`,
      arguments: [accountAddress],
    });

    if ("executionError" in data) {
      throw new Error(
        `Failed to fetch transactions: ${data.executionError}`
      );
    }

    // Parse: Transactions has { table: Table<vector<u8>, Transaction> }
    // Table has { id: { id: "0x..." }, size: "..." }
    const values = data.functionReturnValues;
    if (!values || values.length === 0) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txStruct = values[0] as any;
    const tableId = txStruct.fields?.table?.fields?.id?.id;
    if (!tableId) return [];

    // Check if table has entries
    const tableSize = Number(txStruct?.fields?.table?.fields?.size || "0");
    if (tableSize === 0) return [];

    // Fetch all dynamic field keys from the table
    const digests: number[][] = [];
    let cursor: string | null | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await iotaClient.getDynamicFields({
        parentId: tableId,
        ...(cursor ? { cursor } : {}),
      });

      console.log("Fetched transaction digests page:", response);

      for (const entry of response.data) {
        // The key is vector<u8>, returned as an array of numbers
        const digestBytes = entry.name.value as number[];
        digests.push(digestBytes);
      }

      hasMore = response.hasNextPage;
      cursor = response.nextCursor;
    }

    return digests;
  }

  async function buildDeletionTx(
    transactionDigests: number[][],
    gasCoinIds: Set<string>
  ): Promise<Transaction> {
    const tx = new Transaction();
    const PACKAGE_ID = CONFIG.packageId;

    // 1. Transfer all owned objects to beneficiary (excluding gas coins)
    if (ownedObjects.length > 0 && beneficiary) {
      for (const obj of ownedObjects) {
        if (gasCoinIds.has(obj.objectId)) continue;
        tx.transferObjects(
          [tx.object(obj.objectId)],
          tx.pure.address(beneficiary)
        );
      }
    }

    // 2. Remove all on-chain transactions
    for (const digestBytes of transactionDigests) {
      tx.moveCall({
        target: `${PACKAGE_ID}::dynamic_auth::remove_transaction`,
        arguments: [
          tx.object(accountAddress),
          tx.pure(
            bcs.vector(bcs.u8()).serialize(new Uint8Array(digestBytes))
          ),
        ],
      });
    }

    // Remove the current (deletion) transaction's own digest from the account
    tx.moveCall({
      target: `${PACKAGE_ID}::dynamic_auth::remove_current_transaction`,
      arguments: [tx.object(accountAddress)],
    });

    // 3. Destroy account data (members, threshold, empty tx table, guardian, allowed authenticators)
    tx.moveCall({
      target: `${PACKAGE_ID}::dynamic_auth::destroy_account_data`,
      arguments: [tx.object(accountAddress)],
    });

    // 4. Delete the account object (consumes it — must be last)
    tx.moveCall({
      target: `${PACKAGE_ID}::account::delete_account`,
      arguments: [tx.object(accountAddress)],
    });

    // 5. Transfer remaining gas coin to beneficiary
    if (beneficiary) {
      tx.transferObjects([tx.gas], tx.pure.address(beneficiary));
    }

    tx.setSender(accountAddress);
    tx.setGasOwner(accountAddress);
    const referenceGasPrice = await iotaClient.getReferenceGasPrice();
    tx.setGasPrice(referenceGasPrice);
    console.log("Built deletion transaction:", tx);
    return tx;
  }

  async function proposeDeletion(tx: Transaction): Promise<string> {
    const toBeProposedTxBytes = await tx.build({ client: iotaClient });
    const toBeProposedTxDigest = await tx.getDigest();

    try {
      await txServiceClient.addTransaction(
        toBase64(toBeProposedTxBytes),
        "Delete account"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to upload transaction to service: ${message}`);
    }

    const proposingTx = new Transaction();
    proposingTx.moveCall({
      target: `${CONFIG.packageId}::dynamic_auth::propose_transaction`,
      arguments: [
        proposingTx.object(accountAddress),
        proposingTx.pure(
          bcs.vector(bcs.u8()).serialize(fromBase58(toBeProposedTxDigest))
        ),
      ],
    });

    return new Promise<string>((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction: proposingTx, waitForTransaction: true },
        {
          onSuccess: () => {
            setStep(5);
            setSuccess(true);
            resolve(toBeProposedTxDigest);
          },
          onError: (err) => {
            reject(new Error(`Transaction failed: ${err.message}`));
          },
        }
      );
    });
  }

  // Run execution steps after confirmation
  useEffect(() => {
    if (!confirmed || hasStarted.current) return;
    hasStarted.current = true;

    async function runSteps() {
      try {
        setStep(1); // Fetching on-chain data
        const [transactionDigests, coinResponse] = await Promise.all([
          fetchTransactionDigests(),
          iotaClient.getCoins({ owner: accountAddress, coinType: "0x2::iota::IOTA" }),
        ]);

        // Collect gas coin IDs to exclude from object transfers
        const gasCoinIds = new Set(coinResponse.data.map((c) => c.coinObjectId));

        setStep(2); // Building deletion transaction
        const tx = await buildDeletionTx(transactionDigests, gasCoinIds);

        setStep(3); // Selecting gas
        if (coinResponse.data.length === 0) {
          throw new Error("Account has no IOTA coins to pay for gas");
        }
        tx.setGasPayment(
          coinResponse.data.map((c) => ({
            objectId: c.coinObjectId,
            version: c.version,
            digest: c.digest,
          }))
        );
        tx.setGasBudget(100_000_000); // Set a high gas budget to ensure execution

        setStep(4); // Proposing deletion
        const digest = await proposeDeletion(tx);
        setProposedTxDigest(digest);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStep(6); // Error
      }
    }
    runSteps();
  }, [confirmed]);

  // ── Render ──

  const steps = [
    "Fetching on-chain data...",
    "Building deletion transaction...",
    "Selecting gas...",
    "Proposing account deletion...",
    "Success!",
    "Couldn't propose account deletion",
  ];

  const stepIcons = [
    // 1 - Fetching
    <svg key="fetch" className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>,
    // 2 - Building
    <svg key="build" className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>,
    // 3 - Selecting gas
    <svg key="gas" className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path d="M12 8v4l3 3" strokeWidth="2" />
    </svg>,
    // 4 - Proposing
    <svg key="propose" className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="4" strokeWidth="2" />
      <path d="M8 12h8" strokeWidth="2" />
    </svg>,
    // 5 - Success
    <svg key="success" className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>,
    // 6 - Error
    <svg key="fail" className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/60 to-red-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background border border-foreground/20 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-foreground/10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <svg
              className="w-7 h-7 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete Account
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-foreground/10 rounded-full transition"
            aria-label="Close dialog"
          >
            <svg
              className="w-6 h-6 text-foreground/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!confirmed ? (
            /* Phase A: Confirmation */
            <>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 font-semibold mb-2">
                  This action will propose the deletion of this account.
                </p>
                <p className="text-sm text-foreground/60">
                  Once approved by enough members, all account data will be
                  permanently removed from the blockchain. This cannot be undone.
                </p>
              </div>

              <div className="text-sm text-foreground/60">
                <p className="font-medium text-foreground/80 mb-1">
                  Account: <span className="font-mono">{shortenAddress(accountAddress)}</span>
                </p>
              </div>

              {/* Owned objects info */}
              {loadingObjects ? (
                <div className="flex items-center gap-2 text-sm text-foreground/50">
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Checking account objects...
                </div>
              ) : (
                <div className="space-y-3">
                  {ownedObjects.length > 0 && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-yellow-500 text-sm font-medium">
                        This account owns {ownedObjects.length} object{ownedObjects.length !== 1 && "s"} that will be transferred to the beneficiary.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-foreground/70 mb-1.5">
                      Beneficiary Address <span className="text-red-400">*</span>
                    </label>
                    <p className="text-xs text-foreground/50 mb-2">
                      Remaining gas coins{ownedObjects.length > 0 ? " and owned objects" : ""} will be transferred to this address.
                    </p>
                    <input
                      type="text"
                      value={beneficiary}
                      onChange={(e) => setBeneficiary(e.target.value)}
                      placeholder="0x... address to receive remaining funds"
                      className={`w-full px-4 py-2.5 border rounded-lg bg-foreground/5 focus:outline-none focus:ring-2 font-mono text-sm ${
                        beneficiary && !isValidIotaAddress(beneficiary)
                          ? "border-red-500/50 focus:ring-red-500/30"
                          : "border-foreground/10 focus:ring-red-500/30"
                      }`}
                    />
                    {beneficiary && !isValidIotaAddress(beneficiary) && (
                      <p className="text-xs text-red-400 mt-1">
                        Invalid IOTA address
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setConfirmed(true)}
                  disabled={!canConfirm}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm Delete
                </button>
              </div>
            </>
          ) : (
            /* Phase B: Execution steps */
            <>
              <ol className="space-y-4">
                {steps
                  .slice(0, success ? 5 : error ? 6 : step)
                  .map((label, idx) => (
                    <li
                      key={label}
                      className={
                        idx + 1 < step
                          ? "opacity-60"
                          : idx + 1 === step
                          ? "font-semibold text-red-600"
                          : "text-foreground/70"
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={[
                            idx + 1 < step
                              ? "bg-green-100 text-green-600"
                              : idx + 1 === step
                              ? "bg-red-100 text-red-600 animate-pulse"
                              : "bg-foreground/10 text-foreground/60",
                            "rounded-full p-2 flex items-center justify-center transition-all",
                          ].join(" ")}
                        >
                          {stepIcons[idx]}
                        </span>
                        <span className="text-base">{label}</span>
                        {idx + 1 === step && !error && !success && (
                          <span className="ml-2 animate-spin inline-block align-middle">
                            <svg
                              className="w-4 h-4 text-red-400"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
              </ol>

              {success && proposedTxDigest && (
                <div className="mt-8 flex flex-col items-center gap-4">
                  <span className="text-green-600 text-lg font-semibold flex items-center gap-2">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Account deletion proposed successfully!
                  </span>
                  <p className="text-sm text-foreground/60 text-center">
                    The deletion is now a proposed transaction that members must
                    approve before it takes effect.
                  </p>
                  <div className="flex gap-3">
                    <button
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium shadow hover:bg-blue-700 transition"
                      onClick={() => redirect(`/${accountAddress}`)}
                    >
                      Go to Proposed Transactions
                    </button>
                    <button
                      className="px-5 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition"
                      onClick={onClose}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              {error && (
                <div className="mt-8 text-red-600 text-lg font-semibold flex items-center gap-2">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Ooops, something went wrong: {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
