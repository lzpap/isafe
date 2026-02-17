import React from "react";
import { ParsedEvent } from "@/hooks/useGetAccountEvents";
import {
  AccountCreatedEvent,
  AccountRotatedEvent,
  MemberAddedEvent,
  MemberRemovedEvent,
  MemberWeightUpdatedEvent,
  ThresholdChangedEvent,
  GuardianChangedEvent,
  TransactionProposedEvent,
  TransactionApprovedEvent,
  TransactionApprovalThresholdReachedEvent,
  TransactionExecutedEvent,
  TransactionRemovedEvent,
  TransactionApprovalThresholdLostEvent,
} from "@/lib/bcs/events";
import { ResolvedAddress } from "./ResolvedAddress";
import { toBase58, toBase64 } from "@iota/iota-sdk/utils";

export type EventTypeAccent = {
  iconBg: string;
  iconFg: string;
  itemBg: string;
  itemBorder: string;
};

export type EventTypeVisual = {
  icon: React.ReactNode;
  accent: EventTypeAccent;
};

export const EVENT_TYPE_VISUALS: Record<ParsedEvent["eventType"], EventTypeVisual> = {
  AccountCreatedEvent: {
    accent: {
      iconBg: "bg-blue-500/10",
      iconFg: "text-blue-500",
      itemBg: "bg-blue-500/5",
      itemBorder: "border-blue-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l9-9 9 9M9 21V12h6v9"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 16h4" />
      </svg>
    ),
  },
  AccountRotatedEvent: {
    accent: {
      iconBg: "bg-indigo-500/10",
      iconFg: "text-indigo-500",
      itemBg: "bg-indigo-500/5",
      itemBorder: "border-indigo-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 00-15.364-6.364M3 12a9 9 0 0015.364 6.364"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 5H5V3" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21h2v-2" />
      </svg>
    ),
  },
  MemberAddedEvent: {
    accent: {
      iconBg: "bg-green-500/10",
      iconFg: "text-green-500",
      itemBg: "bg-green-500/5",
      itemBorder: "border-green-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 11a4 4 0 100-8 4 4 0 000 8z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 8v6" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 11h-6" />
      </svg>
    ),
  },
  MemberRemovedEvent: {
    accent: {
      iconBg: "bg-red-500/10",
      iconFg: "text-red-500",
      itemBg: "bg-red-500/5",
      itemBorder: "border-red-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 11a4 4 0 100-8 4 4 0 000 8z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 11h-6" />
      </svg>
    ),
  },
  MemberWeightUpdatedEvent: {
    accent: {
      iconBg: "bg-orange-500/10",
      iconFg: "text-orange-500",
      itemBg: "bg-orange-500/5",
      itemBorder: "border-orange-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10v4M7 9v6M17 9v6M21 10v4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12h10" />
      </svg>
    ),
  },
  ThresholdChangedEvent: {
    accent: {
      iconBg: "bg-purple-500/10",
      iconFg: "text-purple-500",
      itemBg: "bg-purple-500/5",
      itemBorder: "border-purple-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h.01M12 8h.01M20 16h.01" />
      </svg>
    ),
  },
  GuardianChangedEvent: {
    accent: {
      iconBg: "bg-pink-500/10",
      iconFg: "text-pink-500",
      itemBg: "bg-pink-500/5",
      itemBorder: "border-pink-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  TransactionProposedEvent: {
    accent: {
      iconBg: "bg-yellow-500/10",
      iconFg: "text-yellow-500",
      itemBg: "bg-yellow-500/5",
      itemBorder: "border-yellow-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2 21l21-9L2 3l7 9-7 9z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h14" />
      </svg>
    ),
  },
  TransactionApprovedEvent: {
    accent: {
      iconBg: "bg-teal-500/10",
      iconFg: "text-teal-500",
      itemBg: "bg-teal-500/5",
      itemBorder: "border-teal-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        />
      </svg>
    ),
  },
  TransactionApprovalThresholdReachedEvent: {
    accent: {
      iconBg: "bg-emerald-500/10",
      iconFg: "text-emerald-500",
      itemBg: "bg-emerald-500/5",
      itemBorder: "border-emerald-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  TransactionApprovalThresholdLostEvent: {
    accent: {
      iconBg: "bg-amber-500/10",
      iconFg: "text-amber-500",
      itemBg: "bg-amber-500/5",
      itemBorder: "border-amber-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8" />
      </svg>
    ),
  },
  TransactionExecutedEvent: {
    accent: {
      iconBg: "bg-green-500/10",
      iconFg: "text-green-600",
      itemBg: "bg-green-500/5",
      itemBorder: "border-green-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  TransactionRemovedEvent: {
    accent: {
      iconBg: "bg-red-500/10",
      iconFg: "text-red-600",
      itemBg: "bg-red-500/5",
      itemBorder: "border-red-500/20",
    },
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7V5h6v2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l1 14h6l1-14" />
      </svg>
    ),
  },
};

export function getEventTypeVisual(eventType: ParsedEvent["eventType"]): EventTypeVisual {
  return EVENT_TYPE_VISUALS[eventType];
}

export const EventItem: React.FC<{ event: ParsedEvent }> = ({ event }) => {
  // Render description and icon based on eventType
  let description: React.ReactNode = "";
  const visual = getEventTypeVisual(event.eventType);
  const icon = visual?.icon;
  const accent: EventTypeAccent = visual?.accent ?? {
    iconBg: "bg-foreground/5",
    iconFg: "text-foreground/70",
    itemBg: "bg-background/60",
    itemBorder: "border-foreground/10",
  };

  switch (event.eventType) {
    case "AccountCreatedEvent":
      const accountCreatedData =
        event.data as typeof AccountCreatedEvent.$inferType;
      const total_weight = accountCreatedData.members.reduce(
        (acc, member) => acc + Number(member.weight),
        0
      );
      description = <>Account <ResolvedAddress address={accountCreatedData.account} /> created ({accountCreatedData.threshold} out of {total_weight})</>;
      break;
    case "AccountRotatedEvent":
      const accountRotatedData =
        event.data as typeof AccountRotatedEvent.$inferType;
      description = <>Account <ResolvedAddress address={accountRotatedData.account} /> rotated, new authenticator{accountRotatedData.authenticator.package}:: {accountRotatedData.authenticator.moduleName}::{accountRotatedData.authenticator.functionName}</>;
      break;
    case "MemberAddedEvent":
      const memberAddedData = event.data as typeof MemberAddedEvent.$inferType;
      description = <>Member <ResolvedAddress address={memberAddedData.member.addr} /> added with weight {memberAddedData.member.weight}</>;
      break;
    case "MemberRemovedEvent":
      const memberRemovedData =
        event.data as typeof MemberRemovedEvent.$inferType;
      description = <>Member <ResolvedAddress address={memberRemovedData.member.addr} /> removed</>;
      break;
    case "MemberWeightUpdatedEvent":
      const memberWeightUpdatedData =
        event.data as typeof MemberWeightUpdatedEvent.$inferType;
      description = <>Member <ResolvedAddress address={memberWeightUpdatedData.member.addr} /> weight updated from {memberWeightUpdatedData.oldWeight} to {memberWeightUpdatedData.newWeight}</>;
      break;
    case "ThresholdChangedEvent":
      const thresholdChangedData =
        event.data as typeof ThresholdChangedEvent.$inferType;
      description = `Threshold changed from ${thresholdChangedData.oldThreshold} to ${thresholdChangedData.newThreshold}`;
      break;
    case "GuardianChangedEvent":
      const guardianChangedData =
        event.data as typeof GuardianChangedEvent.$inferType;
      const oldGuardianBase64 = toBase64(
        new Uint8Array(guardianChangedData.oldGuardian)
      );
      const newGuardianBase64 = toBase64(
        new Uint8Array(guardianChangedData.newGuardian)
      );
      description = `Guardian changed from ${oldGuardianBase64} to ${newGuardianBase64}`;
      break;
    case "TransactionProposedEvent":
      const transactionProposedData =
        event.data as typeof TransactionProposedEvent.$inferType;
      const txDigestBase58 = toBase58(
        new Uint8Array(transactionProposedData.transactionDigest)
      );
      description = <>Transaction {txDigestBase58.slice(0, 6)}... proposed by <ResolvedAddress address={transactionProposedData.proposer} /></>;
      break;
    case "TransactionApprovedEvent":
      const transactionApprovedData =
        event.data as typeof TransactionApprovedEvent.$inferType;
      const txDigestBase58Approved = toBase58(
        new Uint8Array(transactionApprovedData.transactionDigest)
      );
      description = <>Transaction {txDigestBase58Approved.slice(0, 6)}... approved by <ResolvedAddress address={transactionApprovedData.approver} /></>;
      break;
    case "TransactionApprovalThresholdReachedEvent":
        const txApprovalThresholdData = event.data as typeof TransactionApprovalThresholdReachedEvent.$inferType;
        const txDigestBase58Threshold = toBase58(
          new Uint8Array(txApprovalThresholdData.transactionDigest)
        );
        description = `Transaction ${txDigestBase58Threshold.slice(0, 6)}... reached approval threshold of ${txApprovalThresholdData.threshold}`;
        break;
    case "TransactionApprovalThresholdLostEvent":
        const txApprovalThresholdLostData = event.data as typeof TransactionApprovalThresholdLostEvent.$inferType;
        const txDigestBase58ThresholdLost = toBase58(
          new Uint8Array(txApprovalThresholdLostData.transactionDigest)
        );
        description = `Transaction ${txDigestBase58ThresholdLost.slice(0, 6)}...  fell below threshold of ${txApprovalThresholdLostData.threshold}`;
        break;
    case "TransactionExecutedEvent":
        const transactionExecutedData = event.data as typeof TransactionExecutedEvent.$inferType;
        const txDigestBase58Executed = toBase58(
          new Uint8Array(transactionExecutedData.transactionDigest)
        );
        description = `Transaction ${txDigestBase58Executed.slice(0, 6)}...  executed`;
        break;
    case "TransactionRemovedEvent":
      const transactionRemovedData =
        event.data as typeof TransactionRemovedEvent.$inferType;
      const txDigestBase58Removed = toBase58(
        new Uint8Array(transactionRemovedData.transactionDigest)
      );
      description = `Transaction ${txDigestBase58Removed} removed`;
      break;
    default:
      description = `Unknown event`;
  }

  return (
    <div
      className={`${accent.itemBg} ${accent.itemBorder} px-3 py-2 rounded-lg border hover:border-foreground/30 transition backdrop-blur`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-md ${accent.iconBg} ${accent.iconFg} border border-foreground/10 flex items-center justify-center`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-foreground/90 font-semibold break-words">
              {description}
            </div>
            <div className="text-xs text-foreground/60 whitespace-nowrap flex-shrink-0 font-medium">
              {event.timestamp.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
