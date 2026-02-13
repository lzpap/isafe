"use client";

import { useState } from "react";
import ProposedTransactions from "@/components/ProposedTransactions";
import ApprovedTransactions from "@/components/ApprovedTransactions";
import ExecutedTransactions from "@/components/ExecutedTransactions";
import RejectedTransactions from "@/components/RejectedTransactions";
import { useGetSortedAccountTransactions } from "@/hooks/useGetAccountTransactions";

type TabType = "proposed" | "approved" | "executed" | "rejected";

// TODO: identify outdated transactions and hide them with an option to show

export default function Transactions({accountAddress}: {accountAddress: string}) {
  const [activeTab, setActiveTab] = useState<TabType>("proposed");

  // Fetch transactions data here
  const { data: transactionsData } = useGetSortedAccountTransactions(accountAddress);


  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: "proposed",
      label: "Proposed",
      count: transactionsData?.proposed?.length || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "approved",
      label: "Approved",
      count: transactionsData?.approved?.length || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "executed",
      label: "Executed",
      count: transactionsData?.executed?.length || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-foreground/5 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Transactions</h2>

      {/* Tab Navigation */}
      <div className="bg-foreground/5 rounded-xl p-1 border border-foreground/10 mb-6">
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
          <button
            onClick={() => setActiveTab("rejected")}
            className={`flex items-center justify-center px-3 py-2.5 rounded-lg transition relative ${
              activeTab === "rejected"
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
            }`}
            title="Rejected transactions"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {(transactionsData?.rejected?.length || 0) > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
                {transactionsData?.rejected?.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === "proposed" && <ProposedTransactions transactions={transactionsData?.proposed || []} />}
        {activeTab === "approved" && <ApprovedTransactions transactions={transactionsData?.approved || []} />}
        {activeTab === "executed" && <ExecutedTransactions transactions={transactionsData?.executed || []} />}
        {activeTab === "rejected" && <RejectedTransactions transactions={transactionsData?.rejected || []} />}
      </div>
    </div>
  );
}