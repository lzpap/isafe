"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProposedTransactions from "@/components/ProposedTransactions";
import ApprovedTransactions from "@/components/ApprovedTransactions";
import ExecutedTransactions from "@/components/ExecutedTransactions";
import { useGetSortedAccountTransactions } from "@/hooks/useGetAccountTransactions";
import { BatchCancelTransactionDialog } from "@/components/dialogs/BatchCancelTransactionDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useSeenTransactions } from "@/hooks/useSeenTransactions";
import { useGetMembers } from "@/hooks/useGetMembers";

type TabType = "proposed" | "approved" | "executed";

export default function TransactionsPage() {
  const params = useParams();
  const accountAddress = params.account as string;
  const [activeTab, setActiveTab] = useState<TabType>("proposed");
  const [batchCancelDigests, setBatchCancelDigests] = useState<string[]>([]);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const queryClient = useQueryClient();
  const { getUnseenCount, markAsSeen } = useSeenTransactions(accountAddress);
  const { data: members = [] } = useGetMembers(accountAddress);

  // Fetch transactions data here
  const { data: transactionsData, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetSortedAccountTransactions(accountAddress);

  // Mark current tab's transactions as seen when tab or data changes
  useEffect(() => {
    if (!transactionsData) return;
    const digests = (transactionsData[activeTab] || []).map((tx) => tx.transactionDigest);
    if (digests.length > 0) markAsSeen(activeTab, digests);
  }, [activeTab, transactionsData, markAsSeen]);

  const onToggleBatchCancel = useCallback((digest: string) => {
    setBatchCancelDigests((prev) =>
      prev.includes(digest)
        ? prev.filter((d) => d !== digest)
        : [...prev, digest]
    );
  }, []);

  const unseenCounts: Record<TabType, number> = {
    proposed: getUnseenCount("proposed", (transactionsData?.proposed || []).map((tx) => tx.transactionDigest)),
    approved: getUnseenCount("approved", (transactionsData?.approved || []).map((tx) => tx.transactionDigest)),
    executed: getUnseenCount("executed", (transactionsData?.executed || []).map((tx) => tx.transactionDigest)),
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: "proposed",
      label: "Proposed",
      count: unseenCounts.proposed,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "approved",
      label: "Approved",
      count: unseenCounts.approved,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "executed",
      label: "Executed",
      count: unseenCounts.executed,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto pt-20 space-y-6 pb-12 px-6">
      {/* Tab Navigation */}
      <div className="bg-foreground/5 rounded-xl p-1 border border-foreground/10">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition relative ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Cancellation Bar */}
      {batchCancelDigests.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <span className="text-sm text-red-500 font-medium">
            {batchCancelDigests.length} transaction{batchCancelDigests.length !== 1 ? "s" : ""} selected for batch cancellation
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBatchCancelDigests([])}
              className="text-xs px-3 py-1.5 border border-foreground/20 text-foreground/60 rounded-lg font-medium hover:bg-foreground/5 transition cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={() => setShowBatchDialog(true)}
              className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition cursor-pointer"
            >
              Cancel {batchCancelDigests.length} transaction{batchCancelDigests.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={activeTab !== "proposed" ? "hidden" : undefined}>
        <ProposedTransactions transactions={transactionsData?.proposed || []} members={members} batchCancelDigests={batchCancelDigests} onToggleBatchCancel={onToggleBatchCancel} />
      </div>
      <div className={activeTab !== "approved" ? "hidden" : undefined}>
        <ApprovedTransactions transactions={transactionsData?.approved || []} members={members} batchCancelDigests={batchCancelDigests} onToggleBatchCancel={onToggleBatchCancel} />
      </div>
      <div className={activeTab !== "executed" ? "hidden" : undefined}>
        <ExecutedTransactions transactions={transactionsData?.executed || []} />
      </div>

      {/* Load More Transactions */}
      {hasNextPage && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 text-sm font-medium bg-foreground/10 hover:bg-foreground/15 text-foreground rounded-lg transition disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading..." : "Load More Transactions"}
          </button>
        </div>
      )}

      {showBatchDialog && (
        <BatchCancelTransactionDialog
          transactionDigests={batchCancelDigests}
          closeDialog={() => {
            setShowBatchDialog(false);
            setBatchCancelDigests([]);
            queryClient.invalidateQueries();
          }}
        />
      )}
    </div>
  );
}