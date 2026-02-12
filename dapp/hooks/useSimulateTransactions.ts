import { useQueries } from "@tanstack/react-query";
import { useIotaClient } from "@iota/dapp-kit";

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
