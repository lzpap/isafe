"use client";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { SettingsAction } from "@/app/[account]/settings/page";
import { isValidIotaAddress, toBase64 } from "@iota/iota-sdk/utils";
import { CONFIG } from "@/config/config";
import { ObjectRef, Transaction } from "@iota/iota-sdk/transactions";
import { useIotaClient } from "@iota/dapp-kit";
import { fromBase58 } from "@iota/iota-sdk/utils";
import { bcs } from "@iota/iota-sdk/bcs";
import { queryKey } from "@/hooks/queryKey";
import { useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useTxServiceClientContext } from "@/contexts";

interface ExecuteSettingChangesDialogProps {
  action: SettingsAction;
  accountAddress: string;
  onClose: () => void;
  // Optionally, you can pass settings change params here
}

const GAS_BUDGET = 10000000;

export function ExecuteSettingChangesDialog({
  action,
  accountAddress,
  onClose,
}: ExecuteSettingChangesDialogProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [proposedTxDigest, setProposedTxDigest] = useState<string | null>(null);
  const iotaClient = useIotaClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();
  const txServiceClient = useTxServiceClientContext();

  async function prepareSettingsChange(): Promise<Transaction> {
    const tx = new Transaction();
    const PACKAGE_ID = CONFIG.packageId;

    switch (action.type) {
      case "add_member":
        if (!isValidIotaAddress(action.address)) {
          throw new Error("Invalid IOTA address");
        }
        if (action.weight <= 0) {
          throw new Error("Weight must be a positive number");
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::dynamic_auth::add_member`,
          arguments: [
            tx.object(accountAddress),
            tx.pure.address(action.address),
            tx.pure.u64(action.weight),
          ],
        });
        break;

      case "remove_member":
        if (!isValidIotaAddress(action.address)) {
          throw new Error("Invalid IOTA address");
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::dynamic_auth::remove_member`,
          arguments: [
            tx.object(accountAddress),
            tx.pure.address(action.address),
          ],
        });
        break;

      case "update_weight":
        if (!isValidIotaAddress(action.address)) {
          throw new Error("Invalid IOTA address");
        }
        if (action.newWeight <= 0) {
          throw new Error("Weight must be a positive number");
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::dynamic_auth::update_member_weight`,
          arguments: [
            tx.object(accountAddress),
            tx.pure.address(action.address),
            tx.pure.u64(action.newWeight),
          ],
        });
        break;

      case "set_threshold":
        if (action.newThreshold <= 0) {
          setError("Threshold must be a positive number");
          throw new Error("Threshold must be a positive number");
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::dynamic_auth::set_threshold`,
          arguments: [
            tx.object(accountAddress),
            tx.pure.u64(action.newThreshold),
          ],
        });
        break;
    }

    // TODO: Simulate to estimate gas?
    const gasBudget = GAS_BUDGET;
    tx.setSender(accountAddress);
    tx.setGasOwner(accountAddress);
    tx.setGasBudget(gasBudget);
    const referenceGasPrice = await iotaClient.getReferenceGasPrice();
    tx.setGasPrice(referenceGasPrice);
    return tx;
  }

  async function selectGas(tx: Transaction): Promise<Transaction> {
    let gasBalance = 0;
    const coinResponse = await iotaClient.getCoins({ owner: accountAddress });
    // TODO: select gas coins that are not already used for proposed transactions. Warn the user if there are no others!
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

  async function proposeSettingsChange(tx: Transaction): Promise<string> {
    const toBeProposedTxBytes = await tx.build({ client: iotaClient });

    const toBeProposedTxDigest = await tx.getDigest();

    // Build description
    let description = "";
    switch (action.type) {
      case "add_member":
        description = `Add member ${action.address} with weight ${action.weight}`;
        break;
      case "remove_member":
        description = `Remove member ${action.address}`;
        break;
      case "update_weight":
        description = `Update weight of member ${action.address} to ${action.newWeight}`;
        break;
      case "set_threshold":
        description = `Set new threshold to ${action.newThreshold}`;
        break;
    }

    // Upload raw tx bytes to service BEFORE signing, so they're never lost
    try {
      await txServiceClient.addTransaction(
        toBase64(toBeProposedTxBytes),
        description
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

    signAndExecuteTransaction(
      { transaction: proposingTx, waitForTransaction: true },
      {
        onSuccess: () => {
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false;
    async function runSteps() {
      setStep(1); // 1. Preparing settings change transaction
      try {
        // Simulate async step 1
        const tx = await prepareSettingsChange();
        if (cancelled) return;
        setStep(2); // 2. Selecting gas
        const finalTx = await selectGas(tx);
        if (cancelled) return;
        setStep(3); // 3. Proposing setting change
        const proposedTxDigest = await proposeSettingsChange(finalTx);
        setProposedTxDigest(proposedTxDigest);
        if (cancelled) return;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStep(5); // 4b. Failure
      }
    }
    runSteps();
    return () => {
      cancelled = true;
    };
  }, []);

  const steps = [
    "Preparing settings change transaction...",
    "Selecting gas...",
    "Proposing setting change...",
    "Success!",
    "Couldn't carry out settings change",
  ];

  const stepIcons = [
    <svg
      key="prepare"
      className="w-6 h-6 text-blue-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/60 to-blue-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background border border-foreground/20 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-foreground/10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <svg
              className="w-7 h-7 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Execute Setting Changes
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
        <div className="p-8 space-y-8">
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
                      ? "font-semibold text-blue-600"
                      : "text-foreground/70"
                  }
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        idx + 1 < step
                          ? "bg-green-100 text-green-600"
                          : idx + 1 === step
                          ? "bg-blue-100 text-blue-600 animate-pulse"
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
                          className="w-4 h-4 text-blue-400"
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
                Proposed setting change successfully with digest{" "}
                {proposedTxDigest}!
              </span>
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
        </div>
      </div>
    </div>
  );
}
