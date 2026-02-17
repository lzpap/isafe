"use client";

import { TransactionSummary } from "@/lib/clients/IsafeIndexerClient";
import { ResolvedAddress } from "./ResolvedAddress";
import { formatTimestamp } from "@/lib/utils/formatTimestamp";
import { useGetTransactionDetails } from "@/hooks/useGetTransactionDetails";

interface RejectedTransactionsProps {
  transactions: TransactionSummary[];
}

export default function RejectedTransactions({
  transactions,
}: RejectedTransactionsProps) {
  const { data, isLoading } = useGetTransactionDetails(
    transactions.map((tx) => tx.transactionDigest)
  );
  if (isLoading) {
    return <div>Loading transactions...</div>;
  }
  return (
    <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-red-500"
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
        Rejected Transactions
      </h2>

      <div className="mb-4 text-sm text-foreground/60">
        {transactions.length} rejected transaction
        {transactions.length !== 1 ? "s" : ""}
      </div>

      {transactions.length === 0 ? (
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <h3 className="mt-3 text-sm font-medium text-foreground/80">
            No rejected transactions
          </h3>
          <p className="mt-1 text-sm text-foreground/50">
            Rejected transactions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx, index) => (
            <div
              key={tx.transactionDigest}
              className="bg-background rounded-lg border border-foreground/10 p-4 hover:border-foreground/20 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-red-500"
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
                  </div>
                  <div>
                    <p className="font-mono text-sm text-foreground break-all">
                      {data ? data[index]?.description : "Loading..."}
                    </p>
                    <p className="text-sm text-foreground/60">
                      {tx.transactionDigest}
                    </p>
                    <p className="text-sm text-foreground/60">
                      Proposed by <ResolvedAddress address={tx.proposerAddress} />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-foreground/50">
                    {formatTimestamp(tx.createdAt)}
                  </span>
                  <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded text-xs font-medium">
                    {tx.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
