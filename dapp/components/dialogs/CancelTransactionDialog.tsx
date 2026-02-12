"use client";
import { useEffect, useState } from "react";
import { ObjectRef, Transaction } from "@iota/iota-sdk/transactions";
import { fromBase58, toBase64 } from "@iota/iota-sdk/utils";
import { useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { bcs } from "@iota/iota-sdk/bcs";
import { CONFIG } from "@/config/config";
import { useISafeAccount } from "@/providers/ISafeAccountProvider";
import { useTxServiceClientContext } from "@/contexts";
import { shortenAddress } from "@/lib/utils/shortenAddress";
import { useQueryClient } from "@tanstack/react-query";

interface CancelTransactionDialogProps {
  transactionDigest: string;
  closeDialog: () => void;
  onCompleted?: () => void;
}

const GAS_BUDGET = 10000000;

export function CancelTransactionDialog({
  transactionDigest,
  closeDialog,
  onCompleted,
}: CancelTransactionDialogProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [proposedTxDigest, setProposedTxDigest] = useState<string | null>(null);
  const iotaClient = useIotaClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { isafeAccount } = useISafeAccount();
  const txServiceClient = useTxServiceClientContext();
  const queryClient = useQueryClient();

  async function prepareCancellationTx(): Promise<Transaction> {
    const tx = new Transaction();
    const PACKAGE_ID = CONFIG.packageId;

    tx.moveCall({
      target: `${PACKAGE_ID}::dynamic_auth::remove_transaction`,
      arguments: [
        tx.object(isafeAccount),
        tx.pure(
          bcs.vector(bcs.u8()).serialize(fromBase58(transactionDigest))
        ),
      ],
    });

    tx.setSender(isafeAccount);
    tx.setGasOwner(isafeAccount);
    tx.setGasBudget(GAS_BUDGET);
    const referenceGasPrice = await iotaClient.getReferenceGasPrice();
    tx.setGasPrice(referenceGasPrice);
    return tx;
  }

  async function selectGas(tx: Transaction): Promise<Transaction> {
    let gasBalance = 0;
    const coinResponse = await iotaClient.getCoins({ owner: isafeAccount });
    let i = 0;
    const payments: ObjectRef[] = [];
    while (gasBalance < GAS_BUDGET && i < coinResponse.data.length) {
      payments.push({
        objectId: coinResponse.data[i].coinObjectId,
        version: coinResponse.data[i].version,
        digest: coinResponse.data[i].digest,
      });
      gasBalance += Number(coinResponse.data[i].balance);
      i++;
    }
    if (gasBalance < GAS_BUDGET) {
      throw new Error("Insufficient balance to cover gas budget");
    }
    tx.setGasPayment(payments);
    return tx;
  }

  async function proposeCancellation(tx: Transaction): Promise<string> {
    const toBeProposedTxBytes = await tx.build({ client: iotaClient });
    const toBeProposedTxDigest = await tx.getDigest();

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

    signAndExecuteTransaction(
      { transaction: proposingTx, waitForTransaction: true },
      {
        onSuccess: async () => {
          await txServiceClient.addTransaction(
            toBase64(toBeProposedTxBytes),
            `Cancel transaction ${shortenAddress(transactionDigest)}`
          );
          queryClient.invalidateQueries();
          setStep(4);
          setSuccess(true);
        },
        onError: (err) => {
          throw new Error(`Transaction failed: ${err.message}`);
        },
      }
    );
    return toBeProposedTxDigest;
  }

  useEffect(() => {
    let cancelled = false;
    async function runSteps() {
      setStep(1);
      try {
        const tx = await prepareCancellationTx();
        if (cancelled) return;
        setStep(2);
        const finalTx = await selectGas(tx);
        if (cancelled) return;
        setStep(3);
        const digest = await proposeCancellation(finalTx);
        setProposedTxDigest(digest);
        if (cancelled) return;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStep(5);
      }
    }
    runSteps();
    return () => {
      cancelled = true;
    };
  }, []);

  const steps = [
    "Preparing cancellation transaction...",
    "Selecting gas...",
    "Proposing cancellation...",
    "Success!",
    "Couldn't propose cancellation",
  ];

  const stepIcons = [
    <svg
      key="prepare"
      className="w-6 h-6 text-red-500"
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
    </svg>,
    <svg
      key="gas"
      className="w-6 h-6 text-yellow-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path d="M12 8v4l3 3" strokeWidth="2" />
    </svg>,
    <svg
      key="propose"
      className="w-6 h-6 text-purple-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <rect x="4" y="4" width="16" height="16" rx="4" strokeWidth="2" />
      <path d="M8 12h8" strokeWidth="2" />
    </svg>,
    <svg
      key="success"
      className="w-6 h-6 text-green-500"
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
    </svg>,
    <svg
      key="fail"
      className="w-6 h-6 text-red-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
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
            Cancel Transaction
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
          <div className="p-3 bg-foreground/5 rounded-lg">
            <p className="text-xs text-foreground/50 mb-1">
              Cancelling Transaction
            </p>
            <p className="text-sm font-mono text-foreground break-all">
              {transactionDigest}
            </p>
          </div>

          <ol className="space-y-4">
            {steps
              .slice(0, success ? 4 : error ? 5 : step)
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
                Cancellation proposed successfully!
              </span>
              <p className="text-sm text-foreground/60 text-center">
                The cancellation is now a proposed transaction that members must
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
