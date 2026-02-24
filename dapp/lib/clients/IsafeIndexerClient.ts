import {
  AccountCreatedEvent,
  AccountRotatedEvent,
  MemberAddedEvent,
  MemberRemovedEvent,
  MemberWeightUpdatedEvent,
  ThresholdChangedEvent,
  GuardianChangedEvent,
  TransactionApprovalThresholdReachedEvent,
  TransactionApprovedEvent,
  TransactionExecutedEvent,
  TransactionProposedEvent,
  TransactionRemovedEvent,
  TransactionApprovalThresholdLostEvent,
} from "@/lib/bcs/events";
import { fromBase64 } from "@iota/iota-sdk/utils";

export class IsafeIndexerClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getAccountEvents(address: string, cursor?: string | null): Promise<{ events: IsafeEvent[]; nextCursor: string | null }> {
    const url = new URL(`${this.baseUrl}/events/${address}`);
    if (cursor) url.searchParams.set("cursor", cursor);
    const data = (await fetch(url.toString()).then((res) =>
      res.json()
    )) as GetAccountEventsResponse;
    // Parse and return an array of parsed events
    const events = data.events.map((event) => {
      let parsedEvent = null;
      switch (event.eventType) {
        case "AccountCreatedEvent":
          parsedEvent = AccountCreatedEvent.parse(fromBase64(event.eventData));
          break;
        case "AccountRotatedEvent":
          parsedEvent = AccountRotatedEvent.parse(fromBase64(event.eventData));
          break;
        case "MemberAddedEvent":
          parsedEvent = MemberAddedEvent.parse(fromBase64(event.eventData));
          break;
        case "MemberRemovedEvent":
          parsedEvent = MemberRemovedEvent.parse(fromBase64(event.eventData));
          break;
        case "MemberWeightUpdatedEvent":
          parsedEvent = MemberWeightUpdatedEvent.parse(
            fromBase64(event.eventData)
          );
          break;
        case "ThresholdChangedEvent":
          parsedEvent = ThresholdChangedEvent.parse(
            fromBase64(event.eventData)
          );
          break;
        case "GuardianChangedEvent":
          parsedEvent = GuardianChangedEvent.parse(fromBase64(event.eventData));
          break;
        case "TransactionApprovalThresholdReachedEvent":
          parsedEvent = TransactionApprovalThresholdReachedEvent.parse(
            fromBase64(event.eventData)
          );
          break;
        case "TransactionApprovalThresholdLostEvent":
          parsedEvent = TransactionApprovalThresholdLostEvent.parse(
            fromBase64(event.eventData)
          );
          break;
        case "TransactionApprovedEvent":
          parsedEvent = TransactionApprovedEvent.parse(
            fromBase64(event.eventData)
          );
          break;
        case "TransactionExecutedEvent":
          parsedEvent = TransactionExecutedEvent.parse(
            fromBase64(event.eventData)
          );
          break;
        case "TransactionProposedEvent":
          parsedEvent = TransactionProposedEvent.parse(
            fromBase64(event.eventData)
          );
          break;
        case "TransactionRemovedEvent":
          parsedEvent = TransactionRemovedEvent.parse(
            fromBase64(event.eventData)
          );
          break;
        default:
          throw new Error(
            `Unknown event type: ${event.eventType} for event ID: ${event.id}`
          );
      }
      return {
        accountAddress: event.accountAddress,
        firedInTx: event.firingTxDigest,
        eventType: event.eventType,
        data: parsedEvent,
        timestamp: new Date(event.timestamp),
      };
    });
    return { events, nextCursor: data.nextCursor ?? null };
  }

  async getAccountsForAddress(address: string, cursor?: string | null): Promise<{ accounts: string[]; nextCursor: string | null }> {
    const url = new URL(`${this.baseUrl}/accounts/${address}`);
    if (cursor) url.searchParams.set("cursor", cursor);
    const data = (await fetch(url.toString()).then((res) => res.json())) as GetAccountsForAddressResponse;
    return { accounts: data.accounts, nextCursor: data.nextCursor ?? null };
  }

  async getAccountTransactions(accountId: string, cursor?: string | null): Promise<{ transactions: TransactionSummary[]; nextCursor: string | null }> {
    const url = new URL(`${this.baseUrl}/transactions/${accountId}`);
    if (cursor) url.searchParams.set("cursor", cursor);
    const data = (await fetch(url.toString()).then((res) => res.json())) as GetTransactionsForAccountResponse;
    return { transactions: data.transactions, nextCursor: data.nextCursor ?? null };
  }
}

export type GetTransactionsForAccountResponse = {
    transactions: TransactionSummary[];
    nextCursor: string | null;
}

export type TransactionSummary = {
    transactionDigest: string;
    proposerAddress: string;
    status: 'Proposed' | 'Approved' | 'Executed' | 'Rejected';
    currentApprovals: number;
    threshold: number;
    totalAccountWeight: number;
    approvedBy: string[];
    createdAt: number;
}

export type GetAccountsForAddressResponse = {
    accounts: string[];
    nextCursor: string | null;
}

export type GetAccountEventsResponse = {
  events: RawEvent[];
  nextCursor: string | null;
};

export type RawEvent = {
  id: number;
  accountAddress: string;
  firingTxDigest: string;
  eventType: string;
  eventData: string;
  timestamp: number;
};

export type EventType =
  | "AccountCreatedEvent"
  | "AccountRotatedEvent"
  | "MemberAddedEvent"
  | "MemberRemovedEvent"
  | "MemberWeightUpdatedEvent"
  | "ThresholdChangedEvent"
  | "GuardianChangedEvent"
  | "TransactionProposedEvent"
  | "TransactionApprovedEvent"
  | "TransactionApprovalThresholdReachedEvent"
  | "TransactionApprovalThresholdLostEvent"
  | "TransactionExecutedEvent"
  | "TransactionRemovedEvent";

export type IsafeEvent = {
  accountAddress: string;
  firedInTx: string;
  eventType: EventType;
  data:
    | typeof AccountCreatedEvent.$inferType
    | typeof AccountRotatedEvent.$inferType
    | typeof MemberAddedEvent.$inferType
    | typeof MemberRemovedEvent.$inferType
    | typeof MemberWeightUpdatedEvent.$inferType
    | typeof ThresholdChangedEvent.$inferType
    | typeof GuardianChangedEvent.$inferType
    | typeof TransactionApprovalThresholdReachedEvent.$inferType
    | typeof TransactionApprovalThresholdLostEvent.$inferType
    | typeof TransactionApprovedEvent.$inferType
    | typeof TransactionExecutedEvent.$inferType
    | typeof TransactionProposedEvent.$inferType
    | typeof TransactionRemovedEvent.$inferType;
  timestamp: Date;
};
