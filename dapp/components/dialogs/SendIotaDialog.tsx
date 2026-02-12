"use client";
import { useState } from "react";
import { redirect } from "next/navigation";
import { isValidIotaAddress, toBase64, NANOS_PER_IOTA } from "@iota/iota-sdk/utils";
import { CONFIG } from "@/config/config";
import { ObjectRef, Transaction } from "@iota/iota-sdk/transactions";
import { useIotaClient } from "@iota/dapp-kit";
import { fromBase58 } from "@iota/iota-sdk/utils";
import { bcs } from "@iota/iota-sdk/bcs";
import { useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { formatIotaBalance } from "@/lib/utils/formatIotaBalance";
import { useTxServiceClientContext } from "@/contexts";

interface SendIotaDialogProps {
  accountAddress: string;
  accountBalance: string; // totalBalance in NANOs
  onClose: () => void;
}

const GAS_BUDGET = 10000000;

export function SendIotaDialog({
  accountAddress,
  accountBalance,
  onClose,
}: SendIotaDialogProps) {
  const [amount, setAmount] = useState("");
  const [targetAddress, setTargetAddress] = useState("");
  const [step, setStep] = useState(0); // 0 = input, 1-3 = processing, 4 = success, 5 = error
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [proposedTxDigest, setProposedTxDigest] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const iotaClient = useIotaClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();
  const txServiceClient = useTxServiceClientContext();

  // Validation
  const isAddressValid = targetAddress === "" || isValidIotaAddress(targetAddress);
  const parsedAmount = parseFloat(amount);
  const amountInNanos = isNaN(parsedAmount) ? BigInt(0) : BigInt(Math.floor(parsedAmount * Number(NANOS_PER_IOTA)));
  const balanceInNanos = BigInt(accountBalance || "0");
  const maxSendableNanos = balanceInNanos > BigInt(GAS_BUDGET) ? balanceInNanos - BigInt(GAS_BUDGET) : BigInt(0);
  const isAmountValid = amount === "" || (!isNaN(parsedAmount) && parsedAmount > 0 && amountInNanos <= maxSendableNanos);

  const canSubmit =
    targetAddress !== "" &&
    isValidIotaAddress(targetAddress) &&
    amount !== "" &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    amountInNanos <= maxSendableNanos &&
    amountInNanos > BigInt(0);

  async function prepareSendTransaction(): Promise<Transaction> {
    const tx = new Transaction();
    const sendAmountInNanos = BigInt(Math.floor(parseFloat(amount) * Number(NANOS_PER_IOTA)));

    // Split the amount from gas coin
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(sendAmountInNanos)]);

    // Transfer to recipient
    tx.transferObjects([coin], tx.pure.address(targetAddress));

    // Set transaction parameters
    tx.setSender(accountAddress);
    tx.setGasOwner(accountAddress);
    tx.setGasBudget(GAS_BUDGET);
    const referenceGasPrice = await iotaClient.getReferenceGasPrice();
    tx.setGasPrice(referenceGasPrice);

    return tx;
  }

  async function selectGas(tx: Transaction): Promise<Transaction> {
    let gasBalance = 0;
    const coinResponse = await iotaClient.getCoins({ owner: accountAddress });
    let i = 0;
    const payments: ObjectRef[] = [];
    // We need enough gas to cover both the gas budget AND the amount being sent
    const totalRequired = GAS_BUDGET + Number(amountInNanos);
    while (gasBalance < totalRequired && i < coinResponse.data.length) {
      payments.push({
        objectId: coinResponse.data[i].coinObjectId,
        version: coinResponse.data[i].version,
        digest: coinResponse.data[i].digest,
      });
      gasBalance += Number(coinResponse.data[i].balance);
      i++;
    }
    if (gasBalance < totalRequired) {
      throw new Error("Insufficient balance to cover gas budget and send amount");
    }
    tx.setGasPayment(payments);
    return tx;
  }

  async function proposeTransaction(tx: Transaction): Promise<string> {
    const toBeProposedTxBytes = await tx.build({ client: iotaClient });
    const toBeProposedTxDigest = await tx.getDigest();

    // Upload raw tx bytes to service BEFORE signing, so they're never lost
    const description = `Sending ${amount} IOTA(s) to ${targetAddress}`;
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

  async function handleSubmit() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setStep(1);

    try {
      // Step 1: Preparing send transaction
      const tx = await prepareSendTransaction();

      setStep(2); // Step 2: Selecting gas
      const finalTx = await selectGas(tx);

      setStep(3); // Step 3: Proposing transaction
      const proposedDigest = await proposeTransaction(finalTx);
      setProposedTxDigest(proposedDigest);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep(5);
    }
  }

  const steps = [
    "Preparing send transaction...",
    "Selecting gas...",
    "Proposing transaction...",
    "Success!",
    "Couldn't carry out send transaction",
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

  // Input stage (step 0)
  if (step === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-gradient-to-br from-black/60 to-blue-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative bg-background border border-foreground/20 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in">
          <div className="flex items-center justify-between p-6 border-b border-foreground/10">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <svg
                className="w-7 h-7 text-blue-500 rotate-45"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              Send IOTA
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
          <div className="p-6 space-y-6">
            {/* Amount Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground/70">
                Amount (IOTA)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full px-4 py-3 bg-foreground/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  amount !== "" && !isAmountValid
                    ? "border-red-500"
                    : "border-foreground/20"
                }`}
                min="0"
                step="any"
              />
              <div className="flex justify-between text-xs">
                <span className="text-foreground/60">
                  Available: {formatIotaBalance(accountBalance)}
                </span>
                {amount !== "" && !isAmountValid && (
                  <span className="text-red-500">
                    {parsedAmount <= 0 ? "Amount must be positive" : "Exceeds available balance (minus gas)"}
                  </span>
                )}
              </div>
            </div>

            {/* Target Address Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground/70">
                Recipient Address
              </label>
              <input
                type="text"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                placeholder="0x..."
                className={`w-full px-4 py-3 bg-foreground/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono text-sm ${
                  targetAddress !== "" && !isAddressValid
                    ? "border-red-500"
                    : "border-foreground/20"
                }`}
              />
              <div className="text-xs">
                {targetAddress !== "" && (
                  isAddressValid ? (
                    <span className="text-green-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Valid address
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Invalid address
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-5 py-3 bg-foreground/10 text-foreground rounded-lg font-medium hover:bg-foreground/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className={`flex-1 px-5 py-3 rounded-lg font-medium transition ${
                  canSubmit && !isSubmitting
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-foreground/20 text-foreground/40 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? "Processing..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Processing/Success/Error stages (step 1-5)
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
              className="w-7 h-7 text-blue-500 rotate-45"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            Send IOTA
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
          <div className="text-sm text-foreground/60 mb-4">
            Sending {amount} IOTA to {targetAddress.slice(0, 10)}...{targetAddress.slice(-8)}
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
                Proposed send transaction successfully!
              </span>
              <div className="text-sm text-foreground/60">
                Digest: {proposedTxDigest}
              </div>
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
