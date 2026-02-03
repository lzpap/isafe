"use client";

import { TransactionSummary } from "@/lib/clients/IsafeIndexerClient";
import { shortenAddress } from "@/lib/utils/shortenAddress";
import { formatTimestamp } from "@/lib/utils/formatTimestamp";
import { useGetTransactionDetails } from "@/hooks/useGetTransactionDetails";
import { CONFIG } from "@/config";

interface ExecutedTransactionsProps {
  transactions: TransactionSummary[];
}

export default function ExecutedTransactions({
  transactions,
}: ExecutedTransactionsProps) {
  const { data, isLoading, error } = useGetTransactionDetails(
    transactions.map((tx) => tx.transactionDigest)
  );
  if (isLoading) {
    return <div>Loading transactions...</div>;
  }

  if (error || (!data && !isLoading)) {
    return <div>Error loading transaction details: {error?.message}</div>;
  }
  return (
    <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-blue-500"
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
        Executed Transactions
      </h2>

      <div className="mb-4 text-sm text-foreground/60">
        {transactions.length} transaction
        {transactions.length !== 1 ? "s" : ""} in history
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
              d="M5 13l4 4L19 7"
            />
          </svg>
          <h3 className="mt-3 text-sm font-medium text-foreground/80">
            No executed transactions
          </h3>
          <p className="mt-1 text-sm text-foreground/50">
            Transaction history will appear here once transactions are executed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx, index) => (
            <div
              key={tx.transactionDigest}
              className="bg-background rounded-lg border border-foreground/10 p-4 hover:border-foreground/20 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-blue-500"
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
                    <p className="font-mono text-sm text-foreground break-all">
                      {data ? data[index]?.description : "Loading..."}
                    </p>
                    <p className="text-sm text-foreground/60">
                      {tx.transactionDigest}
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
                  <span className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-xs font-medium">
                    {tx.status}
                  </span>
                </div>
              </div>

              {/* View on Explorer Link */}
              <div className="flex justify-end">
                <a
                  href={`https://explorer.iota.org/txblock/${tx.transactionDigest}?network=${CONFIG.network}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                >
                  View on Explorer →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
