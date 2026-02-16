"use client";

import { TransactionSummary } from "@/lib/clients/IsafeIndexerClient";
import { shortenAddress } from "@/lib/utils/shortenAddress";
import { formatTimestamp } from "@/lib/utils/formatTimestamp";
import { ApprovalProgressBar } from "./ApprovalProgressBar";
import { useState } from "react";
import { ExecuteTransactionDialog } from "./dialogs/ExecuteTransactionDialog";
import { ApproveTransactionDialog } from "./dialogs/ApproveTransactionDialog";
import { CancelTransactionDialog } from "./dialogs/CancelTransactionDialog";
import { useCurrentAccount } from "@iota/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useGetTransactionDetails } from "@/hooks/useGetTransactionDetails";
import { useSimulateTransactions } from "@/hooks/useSimulateTransactions";

interface ApprovedTransactionsProps {
  transactions: TransactionSummary[];
}

export default function ApprovedTransactions({
  transactions,
}: ApprovedTransactionsProps) {
  const queryClient = useQueryClient();
  const currentAccount = useCurrentAccount();
  const [executeTxDigestDialog, setExecuteTxDigestDialog] = useState<
    string | null
  >(null);
  const [approveTxDigestDialog, setApproveTxDigestDialog] = useState<
    string | null
  >(null);
  const [cancelTxDigestDialog, setCancelTxDigestDialog] = useState<
    string | null
  >(null);
  const handleExecute = async (txDigest: string) => {
    setExecuteTxDigestDialog(txDigest);
  };

  const { data, isLoading } = useGetTransactionDetails(
    transactions.map((tx) => tx.transactionDigest)
  );

  const { simulations } = useSimulateTransactions(
    data ? data.map((d) => d.bcs) : []
  );

  if (isLoading) {
    return <div>Loading transactions...</div>;
  }

  return (
    <>
      <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-500"
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
          Approved Transactions
        </h2>

        <div className="mb-4 text-sm text-foreground/60">
          {transactions.length} transaction
          {transactions.length !== 1 ? "s" : ""} ready for execution
        </div>

        {transactions.length === 0 ? (
          /* Empty state */
          <div className="bg-background rounded-lg border border-foreground/10 p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-foreground/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-3 text-sm font-medium text-foreground/80">
              No approved transactions
            </h3>
            <p className="mt-1 text-sm text-foreground/50">
              There are no transactions ready for execution.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx, index) => {
              const hasApproved = currentAccount?.address
                ? tx.approvedBy.includes(currentAccount.address)
                : false;

              return (
                <div
                  key={tx.transactionDigest}
                  className="bg-background rounded-lg border border-foreground/10 p-4 hover:border-foreground/20 transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-green-500"
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
                      <div>
                        <p className="font-mono text-sm text-foreground">
                          {data ? data[index]?.description : "Loading..."}
                        </p>
                        <p className="text-sm text-foreground/60">
                          Digest: {tx.transactionDigest}
                        </p>

                        <p className="text-sm text-foreground/60">
                          Proposed by {shortenAddress(tx.proposerAddress)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-foreground/50">
                        {formatTimestamp(tx.createdAt)}
                      </span>
                      <span className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-xs font-medium">
                        {tx.status}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <ApprovalProgressBar
                      currentApprovals={tx.currentApprovals}
                      threshold={tx.threshold}
                      totalAccountWeight={tx.totalAccountWeight}
                    />
                  </div>

                  {/* Simulation Warning */}
                  {simulations[index] && !simulations[index].passed && (
                    <div className="mb-3 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
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
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      <div>
                        <p className="text-sm text-red-500 font-medium">
                          Transaction may be outdated
                        </p>
                        <p className="text-xs text-red-500/70">
                          {simulations[index].error}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setCancelTxDigestDialog(tx.transactionDigest)}
                      className="flex items-center gap-2 px-4 py-2 border border-red-500/30 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/10 transition cursor-pointer"
                    >
                      <svg
                        className="w-4 h-4"
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
                      Cancel
                    </button>
                    {currentAccount && !hasApproved && (
                      <button
                        onClick={() => setApproveTxDigestDialog(tx.transactionDigest)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                      >
                        <svg
                          className="w-4 h-4"
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
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => handleExecute(tx.transactionDigest)}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
                    >
                      Execute
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {approveTxDigestDialog && (
        <ApproveTransactionDialog
          transactionDigest={approveTxDigestDialog}
          closeDialog={() => {
            queryClient.invalidateQueries();
            setApproveTxDigestDialog(null);
          }}
          onCompleted={() => setApproveTxDigestDialog(null)}
        />
      )}
      {cancelTxDigestDialog && (
        <CancelTransactionDialog
          transactionDigest={cancelTxDigestDialog}
          closeDialog={() => {
            setCancelTxDigestDialog(null);
            queryClient.invalidateQueries();
          }}
          onCompleted={() => setCancelTxDigestDialog(null)}
        />
      )}
      {executeTxDigestDialog && (
        <ExecuteTransactionDialog
          transactionDigest={executeTxDigestDialog}
          closeDialog={() => {
            setExecuteTxDigestDialog(null);
            queryClient.invalidateQueries();
          }}
          onCompleted={() => setExecuteTxDigestDialog(null)}
        />
      )}
    </>
  );
}
