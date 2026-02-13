export class TxServiceClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getTransaction(digest: string, signal?: AbortSignal): Promise<TransactionDetailsResponse> {
    const response = await fetch(`${this.baseUrl}/transaction/${digest}`, { signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.statusText}`);
    }

    return response.json();
  }

  async addTransaction(
    txBytes: string,
    description: string
  ): Promise<AddTransactionResponse> {
    const response = await fetch(`${this.baseUrl}/add_transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_bytes: txBytes,
        description: description,
      }),
    });

    if (response.status === 409) {
      // transaction already exists on the db, no need to fail
      return response.json();
    }

    if (!response.ok) {
      throw new Error(`Failed to upload transaction: ${response.statusText}`);
    }

    return response.json();
  }

  async deriveAuthSignature(address: string): Promise<DeriveAuthSignatureResponse> {
    const response = await fetch(
      `${this.baseUrl}/derive_auth_signature/${address}`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch move authenticator signature field: ${response.statusText}`
      );
    }

    return response.json();
  }

  async healthCheck(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
  }
}

export type TransactionDetailsResponse = {
  bcs: string;
  sender: string;
  addedAt: number;
  description: string;
};

export type AddTransactionResponse = {
  digest: string;
  added_at: number;
};

export type DeriveAuthSignatureResponse = {
  signature: string;
};
