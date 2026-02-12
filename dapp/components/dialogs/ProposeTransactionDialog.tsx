"use client";
import { Transaction } from "@iota/iota-sdk/transactions";
import { fromBase58, fromBase64 } from "@iota/iota-sdk/utils";
import { useState } from "react";
import { useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { bcs } from "@iota/iota-sdk/bcs";
import { CONFIG } from "@/config/config";
import { useISafeAccount } from "@/providers/ISafeAccountProvider";
import { isTxAlreadyProposedError } from "@/lib/utils/errorResolution";
import { useTxServiceClientContext } from "@/contexts";

const TxAlreadyProposedError = "Transaction has already been proposed";

interface ProposeTransactionDialogProps {
  name: string;
  closeDialog: () => void;
  onCompleted?: () => void;
}

interface ValidationResult {
  isValid: boolean;
  transaction: Transaction | null;
  error?: string;
}

function validateTransactionBytes(txBytes: string): ValidationResult {
  if (!txBytes.trim()) {
    return { isValid: true, transaction: null }; // Empty is okay, will be required on submit
  }

  try {
    // Decode from base64
    const bytes = fromBase64(txBytes);

    // Parse as Transaction using BCS
    const transaction = Transaction.from(bytes);

    return { isValid: true, transaction };
  } catch (error) {
    const originalError =
      error instanceof Error ? error.message : String(error);
    return {
      isValid: false,
      transaction: null,
      error: `Invalid transaction bytes: ${originalError}`,
    };
  }
}

export function ProposeTransactionDialog({
  name,
  closeDialog,
  onCompleted,
}: ProposeTransactionDialogProps) {
  const [txBytes, setTxBytes] = useState("");
  const [description, setDescription] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    transaction: null,
  });
  const [simulationPassed, setSimulationPassed] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposalSuccess, setProposalSuccess] = useState(false);
  const client = useIotaClient();
  const { mutate: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();
  const { isafeAccount } = useISafeAccount();
  const txServiceClient = useTxServiceClientContext();

  const handleTxBytesChange = (value: string) => {
    setTxBytes(value);
    const result = validateTransactionBytes(value);
    setValidationResult(result);
    // Reset simulation state when tx bytes change
    setSimulationPassed(false);
    setSimulationError(null);
    // TODO: show what the tranasction does in a user-friendly way
  };

  const handleSimulate = async () => {
    if (!validationResult.transaction) return;

    setIsSimulating(true);
    setSimulationError(null);

    try {
      const result = await client.dryRunTransactionBlock({
        transactionBlock: txBytes,
      });

      // TODO: show the result of the simulation in more detail
      if (result.effects.status.status == "failure") {
        setSimulationError(`Simulation failed: Transaction execution failed with ${result.effects.status.error}`);
        setSimulationPassed(false);
        return;
      }

      setSimulationPassed(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSimulationError(`Simulation failed: ${message}`);
      setSimulationPassed(false);
    } finally {
      setIsSimulating(false);
    }
  };

  const handlePropose = async () => {
    try {
      const tx = new Transaction();

      const PACKAGE_ID = CONFIG.packageId;

      const proposingTxDigest = await validationResult.transaction!.getDigest();

      tx.moveCall({
        target: `${PACKAGE_ID}::dynamic_auth::propose_transaction`,
        arguments: [
          tx.object(isafeAccount),
          tx.pure(
            bcs.vector(bcs.u8()).serialize(fromBase58(proposingTxDigest))
          ),
        ],
      });

      // Upload raw tx bytes to service BEFORE signing, so they're never lost
      try {
        await txServiceClient.addTransaction(txBytes, description);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to upload transaction to service: ${message}`);
      }

      // Sign and execute the proposal on-chain
      signAndExecuteTransaction(
        {
          transaction: tx,
          waitForTransaction: true,
        },
        {
          onSuccess: () => {
            setProposalSuccess(true);
          },
          onError: (error) => {
            if (isTxAlreadyProposedError(error)) {
              setProposalError(
                "Failed to propose transaction, as it has already been proposed"
              );
              return;
            }
            setProposalError(`Failed to propose transaction: ${error.message}`);
          },
        }
      );
    } catch (err: any) {
      setProposalError(`Failed to propose transaction: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeDialog}
      />

      {/* Dialog */}
      <div className="relative bg-background border border-foreground/20 rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-foreground/10">
          <h2 className="text-xl font-semibold">Propose A New Transaction</h2>
          <button
            onClick={closeDialog}
            className="p-2 hover:bg-foreground/10 rounded-md transition"
          >
            <svg
              className="w-5 h-5"
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

        {/* Body */}
        <div className="p-6">
          {proposalSuccess ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-green-500"
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
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Transaction Proposed Successfully!
              </h3>
              <p className="text-sm text-foreground/60 text-center mb-6">
                Your transaction has been proposed and is awaiting approval from
                other members.
              </p>
              <button
                onClick={closeDialog}
                className="px-6 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="txBytes"
                  className="block text-sm font-medium text-foreground/80 mb-2"
                >
                  Transaction Bytes (Base64)
                </label>
                <textarea
                  id="txBytes"
                  value={txBytes}
                  onChange={(e) => handleTxBytesChange(e.target.value)}
                  placeholder="Enter base64 encoded transaction bytes..."
                  className={`w-full px-4 py-3 bg-foreground/5 border rounded-lg text-sm font-mono focus:outline-none resize-none ${
                    !validationResult.isValid
                      ? "border-red-500 focus:border-red-500"
                      : validationResult.transaction
                      ? "border-green-500 focus:border-green-500"
                      : "border-foreground/20 focus:border-foreground/40"
                  }`}
                  rows={8}
                />
                {!validationResult.isValid && validationResult.error && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <svg
                      className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
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
                    </svg>
                    <p className="text-sm text-red-500">
                      {validationResult.error}
                    </p>
                  </div>
                )}
                {validationResult.isValid && validationResult.transaction && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
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
                    <p className="text-sm text-green-500">
                      Valid transaction bytes
                    </p>
                  </div>
                )}
                {simulationError && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <svg
                      className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
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
                    </svg>
                    <p className="text-sm text-red-500">{simulationError}</p>
                  </div>
                )}
                {simulationPassed && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm text-green-500">
                      Simulation passed successfully
                    </p>
                  </div>
                )}
                {proposalError && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <svg
                      className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
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
                    </svg>
                    <p className="text-sm text-red-500">{proposalError}</p>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-foreground/80 mb-2"
                >
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter transaction description..."
                  className="w-full px-4 py-3 bg-foreground/5 border border-foreground/20 rounded-lg text-sm focus:outline-none focus:border-foreground/40"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!proposalSuccess && (
          <div className="flex justify-end gap-3 p-6 border-t border-foreground/10">
            <button
              onClick={closeDialog}
              className="px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-foreground/10 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSimulate}
              disabled={
                !validationResult.isValid ||
                !validationResult.transaction ||
                isSimulating
              }
              className="px-4 py-2 text-sm font-medium border border-foreground/20 text-foreground rounded-lg hover:bg-foreground/10 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSimulating ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Simulating...
                </>
              ) : simulationPassed ? (
                <>
                  <svg
                    className="w-4 h-4 text-green-500"
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
                  Simulated
                </>
              ) : (
                "Simulate"
              )}
            </button>
            <button
              onClick={handlePropose}
              disabled={
                !validationResult.isValid || !simulationPassed || isPending
              }
              className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Proposing...
                </>
              ) : (
                "Propose"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
