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

  // TODO: Paginated indexer queries

  async getAccountEvents(address: string): Promise<IsafeEvent[]> {
    const data = (await fetch(`${this.baseUrl}/events/${address}`).then((res) =>
      res.json()
    )) as GetAccountEventsResponse;
    // Parse and return an array of parsed events
    return data.events.map((event) => {
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
  }

  async getAccountsForAddress(address: string): Promise<string[]> {
    const data = (await fetch(
      `${this.baseUrl}/accounts/${address}`
    ).then((res) => res.json())) as GetAccountsForAddressResponse;
    return data.accounts;
  }

  async getAccountTransactions(accountId: string): Promise<TransactionSummary[]> {
    const data = (await fetch(
      `${this.baseUrl}/transactions/${accountId}`
    ).then((res) => res.json())) as GetTransactionsForAccountResponse;
    return data.transactions;
  }
}

export type GetTransactionsForAccountResponse = {
    transactions: TransactionSummary[];
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
} 

export type GetAccountEventsResponse = {
  events: RawEvent[];
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
