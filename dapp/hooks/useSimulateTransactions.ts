import { useQueries } from "@tanstack/react-query";
import { useIotaClient } from "@iota/dapp-kit";
import { IotaClient } from "@iota/iota-sdk/client";
import { Transaction } from "@iota/iota-sdk/transactions";
import { fromBase64 } from "@iota/iota-sdk/utils";

export interface SimulationResult {
  passed: boolean;
  error?: string;
}

export function useSimulateTransactions(txBytesArray: string[]) {
  const client = useIotaClient();

  return useQueries({
    queries: txBytesArray.map((txBytes, index) => ({
      queryKey: ["isafe", "simulate", txBytes],
      queryFn: async (): Promise<SimulationResult> => {
        if (!txBytes) {
          return { passed: false, error: "Transaction bytes not available" };
        }
        try {
          const result = await client.dryRunTransactionBlock({
            transactionBlock: txBytes,
          });
          if (result.effects.status.status === "failure") {
            return {
              passed: false,
              error: `${result.effects.status.error}`,
            };
          }
          await checkGas(txBytes, client);
          return { passed: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { passed: false, error: message };
        }
      },
      retry: false,
      staleTime: 30_000,
      enabled: !!txBytes,
    })),
    combine: (results) => {
      const simulations = results.map((res, i) => {
        if (res.isLoading || !res.isFetched) {
          return undefined;
        }
        if (res.error || res.data == null) {
          return { passed: false, error: "Simulation query failed" } as SimulationResult;
        }
        return res.data;
      });
      const isLoading = results.some((res) => res.isLoading);
      return { simulations, isLoading };
    },
  });
}

async function checkGas(txBytes: string, client: IotaClient) {
  const decoded = fromBase64(txBytes);
  const txData = Transaction.from(decoded).getData();
  const payments = txData.gasData.payment;

  if (!payments || payments.length === 0) {
    throw new Error("No gas payment objects in transaction");
  }

  const objects = await client.multiGetObjects({
    ids: payments.map((p) => p.objectId),
    options: { showOwner: true },
  });

  for (let i = 0; i < payments.length; i++) {
    const expected = payments[i];
    const fetched = objects[i];

    if (!fetched.data) {
      throw new Error(
        `Gas object ${expected.objectId} no longer exists`
      );
    }

    if (
      fetched.data.version !== String(expected.version) ||
      fetched.data.digest !== expected.digest
    ) {
      throw new Error(
        `Gas object ${expected.objectId} has changed (expected version ${expected.version}, got ${fetched.data.version})`
      );
    }
  }
}