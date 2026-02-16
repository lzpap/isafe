"use client";
import { useEffect, useRef, useState } from "react";
import { ObjectRef, Transaction } from "@iota/iota-sdk/transactions";
import { fromBase58, toBase64 } from "@iota/iota-sdk/utils";
import { useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { bcs } from "@iota/iota-sdk/bcs";
import { CONFIG } from "@/config/config";
import { useISafeAccount } from "@/providers/ISafeAccountProvider";
import { useTxServiceClientContext } from "@/contexts";
import { shortenAddress } from "@/lib/utils/shortenAddress";

interface BatchCancelTransactionDialogProps {
  transactionDigests: string[];
  closeDialog: () => void;
  onCompleted?: () => void;
}

export function BatchCancelTransactionDialog({
  transactionDigests,
  closeDialog,
  onCompleted,
}: BatchCancelTransactionDialogProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [proposedTxDigest, setProposedTxDigest] = useState<string | null>(null);
  const iotaClient = useIotaClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { isafeAccount } = useISafeAccount();
  const txServiceClient = useTxServiceClientContext();
  const hasStarted = useRef(false);

  async function prepareBatchCancellationTx(): Promise<Transaction> {
    const tx = new Transaction();
    const PACKAGE_ID = CONFIG.packageId;

    for (const digest of transactionDigests) {
      tx.moveCall({
        target: `${PACKAGE_ID}::dynamic_auth::remove_transaction`,
        arguments: [
          tx.object(isafeAccount),
          tx.pure(
            bcs.vector(bcs.u8()).serialize(fromBase58(digest))
          ),
        ],
      });
    }

    tx.setSender(isafeAccount);
    tx.setGasOwner(isafeAccount);
    const referenceGasPrice = await iotaClient.getReferenceGasPrice();
    tx.setGasPrice(referenceGasPrice);
    return tx;
  }

  async function estimateAndSetGas(tx: Transaction): Promise<{ tx: Transaction; gasBudget: number }> {
    // Use a large placeholder budget for the dry run
    tx.setGasBudget(100_000_000);

    // Select gas coins for the dry run
    const coinResponse = await iotaClient.getCoins({ owner: isafeAccount });
    let gasBalance = 0;
    let i = 0;
    const payments: ObjectRef[] = [];
    while (gasBalance < 100_000_000 && i < coinResponse.data.length) {
      payments.push({
        objectId: coinResponse.data[i].coinObjectId,
        version: coinResponse.data[i].version,
        digest: coinResponse.data[i].digest,
      });
      gasBalance += Number(coinResponse.data[i].balance);
      i++;
    }
    if (payments.length === 0) {
      throw new Error("No gas coins available");
    }
    tx.setGasPayment(payments);

    const txBytes = await tx.build({ client: iotaClient });
    const dryRunResult = await iotaClient.dryRunTransactionBlock({
      transactionBlock: toBase64(txBytes),
    });

    if (dryRunResult.effects.status.status === "failure") {
      throw new Error(`Dry run failed: ${dryRunResult.effects.status.error}`);
    }

    const gasUsed = dryRunResult.effects.gasUsed;
    const totalGas =
      Number(gasUsed.computationCost) +
      Number(gasUsed.storageCost) -
      Number(gasUsed.storageRebate);
    // Add 20% margin
    const gasBudget = Math.ceil(Math.max(totalGas, 1_000_000) * 1.2);

    // Rebuild with correct budget
    tx.setGasBudget(gasBudget);

    // Re-select gas with actual budget
    gasBalance = 0;
    i = 0;
    const finalPayments: ObjectRef[] = [];
    while (gasBalance < gasBudget && i < coinResponse.data.length) {
      finalPayments.push({
        objectId: coinResponse.data[i].coinObjectId,
        version: coinResponse.data[i].version,
        digest: coinResponse.data[i].digest,
      });
      gasBalance += Number(coinResponse.data[i].balance);
      i++;
    }
    if (gasBalance < gasBudget) {
      throw new Error("Insufficient balance to cover gas budget");
    }
    tx.setGasPayment(finalPayments);

    return { tx, gasBudget };
  }

  async function proposeBatchCancellation(tx: Transaction): Promise<string> {
    const toBeProposedTxBytes = await tx.build({ client: iotaClient });
    const toBeProposedTxDigest = await tx.getDigest();

    try {
      await txServiceClient.addTransaction(
        toBase64(toBeProposedTxBytes),
        `Batch cancel ${transactionDigests.length} transactions`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to upload transaction to service: ${message}`);
    }

    const proposingTx = new Transaction();

    proposingTx.moveCall({
      target: `${CONFIG.packageId}::dynamic_auth::propose_transaction`,
      arguments: [
        proposingTx.object(isafeAccount),
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

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function runSteps() {
      setStep(1);
      try {
        const tx = await prepareBatchCancellationTx();
        setStep(2);
        const { tx: finalTx } = await estimateAndSetGas(tx);
        setStep(3);
        // Gas is already selected in estimateAndSetGas
        setStep(4);
        const digest = await proposeBatchCancellation(finalTx);
        setProposedTxDigest(digest);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStep(6);
      }
    }
    runSteps();
  }, []);

  const steps = [
    "Preparing batch cancellation...",
    "Estimating gas...",
    "Selecting gas...",
    "Proposing batch cancellation...",
    "Success!",
    "Couldn't propose batch cancellation",
  ];

  const stepIcons = [
    <svg key="prepare" className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>,
    <svg key="estimate" className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>,
    <svg key="gas" className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path d="M12 8v4l3 3" strokeWidth="2" />
    </svg>,
    <svg key="propose" className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="4" strokeWidth="2" />
      <path d="M8 12h8" strokeWidth="2" />
    </svg>,
    <svg key="success" className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>,
    <svg key="fail" className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/60 to-red-900/60 backdrop-blur-sm"
        onClick={closeDialog}
      />
      <div className="relative bg-background border border-foreground/20 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-fade-in">
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Batch Cancel {transactionDigests.length} Transactions
          </h2>
          <button
            onClick={closeDialog}
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
        <div className="p-8 space-y-8">
          <div className="p-3 bg-foreground/5 rounded-lg max-h-32 overflow-y-auto">
            <p className="text-xs text-foreground/50 mb-2">
              Cancelling {transactionDigests.length} transactions
            </p>
            {transactionDigests.map((digest) => (
              <p key={digest} className="text-xs font-mono text-foreground/70 truncate">
                {shortenAddress(digest)}
              </p>
            ))}
          </div>

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
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
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
                Batch cancellation proposed successfully!
              </span>
              <p className="text-sm text-foreground/60 text-center">
                The batch cancellation is now a proposed transaction that members must
                approve before it takes effect.
              </p>
              <button
                className="px-5 py-2 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition"
                onClick={closeDialog}
              >
                Close
              </button>
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
        </div>
      </div>
    </div>
  );
}
