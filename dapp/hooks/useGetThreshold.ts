import { useIotaClient } from "@iota/dapp-kit";
import { useQueries, useQuery } from "@tanstack/react-query";
import { queryKey } from "./queryKey";
import { CONFIG } from "@/config/config";
import { IotaMoveViewCallResults, MoveValue } from "@iota/iota-sdk/client";

function isExecutionError(
  result: IotaMoveViewCallResults
): result is { executionError: string } {
  return "executionError" in result;
}

export function useGetThreshold(accountId: string) {
  const client = useIotaClient();

  return useQueries({
    queries: [
      {
        queryKey: [queryKey.threshold(accountId)],
        queryFn: async () => {
          const data = await client.view({
            functionName: `${CONFIG.packageId}::dynamic_auth::threshold`,
            callArgs: [accountId],
          });

          if (isExecutionError(data)) {
            throw new Error(
              `Error fetching isafe threshold: ${data.executionError}`
            );
          }

          console.log(
            "Threshold view call results:",
            convertMoveValuesToThreshold(data.functionReturnValues)
          );

          return convertMoveValuesToThreshold(data.functionReturnValues);
        },
        enabled: !!accountId,
        staleTime: Infinity,
        retry: false,
      },
      {
        queryKey: [queryKey.totalWeight(accountId)],
        queryFn: async () => {
          const data = await client.view({
            functionName: `${CONFIG.packageId}::dynamic_auth::total_member_weight`,
            callArgs: [accountId],
          });

          if (isExecutionError(data)) {
            throw new Error(
              `Error fetching isafe totalWeight: ${data.executionError}`
            );
          }

          console.log(
            "Total weight view call results:",
            convertMoveValuesToThreshold(data.functionReturnValues)
          );

          return convertMoveValuesToThreshold(data.functionReturnValues);
        },
        enabled: !!accountId,
        staleTime: Infinity,
        retry: false,
      },
    ],
    combine: (results) => {
        return {
            threshold: results[0].data,
            totalWeight: results[1].data,
            error: results.find(result => result.error)?.error,
            isLoading: results.some(result => result.isLoading),
        }

    }
  });
}

function convertMoveValuesToThreshold(values: MoveValue[] | undefined): number {
  if (!values || values.length === 0) {
    return 0;
  }

  if (values.length !== 1) {
    throw new Error(
      `Unexpected number of return values for threshold: expected 1, got ${values.length}`
    );
  }

  return parseInt(values[0] as string, 10);
}
