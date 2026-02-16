"use client";

import { TransactionSummary } from "@/lib/clients/IsafeIndexerClient";
import { shortenAddress } from "@/lib/utils/shortenAddress";
import { formatTimestamp } from "@/lib/utils/formatTimestamp";
import { useState } from "react";
import { ProposeTransactionDialog } from "./dialogs/ProposeTransactionDialog";
import { ApproveTransactionDialog } from "./dialogs/ApproveTransactionDialog";
import { useCurrentAccount } from "@iota/dapp-kit";
import { ApprovalProgressBar } from "./ApprovalProgressBar";
import { Member } from "@/hooks/useGetMembers";
import { CancelTransactionDialog } from "./dialogs/CancelTransactionDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useGetTransactionDetails } from "@/hooks/useGetTransactionDetails";
import { useSimulateTransactions } from "@/hooks/useSimulateTransactions";

interface ProposedTransactionsProps {
  transactions: TransactionSummary[];
  members: Member[];
  batchCancelDigests: string[];
  onToggleBatchCancel: (digest: string) => void;
}

export default function ProposedTransactions({
  transactions,
  members,
  batchCancelDigests,
  onToggleBatchCancel,
}: ProposedTransactionsProps) {
  const queryClient = useQueryClient();

  const [proposeDialogName, setProposeDialogName] = useState<string | null>(
    null
  );
  const [approveTxDigestDialog, setApproveTxDigestDialog] = useState<
    string | null
  >(null);
  const [cancelTxDigestDialog, setCancelTxDigestDialog] = useState<
    string | null
  >(null);
  const currentAccount = useCurrentAccount();

  const handleApprove = (txDigest: string) => {
    setApproveTxDigestDialog(txDigest);
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <svg
              className="w-5 h-5 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Proposed Transactions
          </h2>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition"
            onClick={() => {
              setProposeDialogName("ProposeTransactionDialog");
            }}
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Propose New Transaction
          </button>
        </div>

        <div className="mb-4 text-sm text-foreground/60">
          {transactions.length} transaction
          {transactions.length !== 1 ? "s" : ""} awaiting approval
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-3 text-sm font-medium text-foreground/80">
              No proposed transactions
            </h3>
            <p className="mt-1 text-sm text-foreground/50">
              There are no transactions waiting for approval.
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
                      <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-yellow-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
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
                      <span className="bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded text-xs font-medium">
                        {tx.status}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <ApprovalProgressBar
                      members={members}
                      approvedBy={tx.approvedBy}
                      threshold={tx.threshold}
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
                      <div className="flex-1">
                        <p className="text-sm text-red-500 font-medium">
                          Transaction may be outdated
                        </p>
                        <p className="text-xs text-red-500/70">
                          {simulations[index].error}
                        </p>
                      </div>
                      <button
                        onClick={() => onToggleBatchCancel(tx.transactionDigest)}
                        className={`flex-shrink-0 text-xs px-2 py-1 rounded font-medium transition cursor-pointer ${
                          batchCancelDigests.includes(tx.transactionDigest)
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "border border-red-500/30 text-red-500 hover:bg-red-500/10"
                        }`}
                      >
                        {batchCancelDigests.includes(tx.transactionDigest)
                          ? "Remove from batch"
                          : "Add to batch cancellation"}
                      </button>
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
                        onClick={() => handleApprove(tx.transactionDigest)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 active:bg-green-800 transition shadow-sm cursor-pointer"
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
                    {currentAccount && hasApproved && (
                      <span className="flex items-center gap-2 px-3 py-1.5 text-foreground/50 text-sm">
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
                        You approved
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {proposeDialogName && (
        <ProposeTransactionDialog
          name={proposeDialogName}
          closeDialog={() => {
            queryClient.invalidateQueries();
            setProposeDialogName(null);
          }}
          onCompleted={() => setProposeDialogName(null)}
        />
      )}
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
    </>
  );
}
