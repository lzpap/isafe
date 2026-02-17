import { useIotaClient } from '@iota/dapp-kit';
import { useQuery } from '@tanstack/react-query';
import { queryKey } from './queryKey';
import { CONFIG } from '@/config/config';
import { IotaMoveViewCallResults, MoveValue } from '@iota/iota-sdk/client';

function isExecutionError(result: IotaMoveViewCallResults): result is { executionError: string } {
  return 'executionError' in result;
}

export function useGetMembers(accountId: string) {
    const client = useIotaClient();

    return useQuery({
        queryKey: queryKey.members(accountId),
        queryFn: async () => {
            const data = await client.view({
                functionName: `${CONFIG.packageId}::dynamic_auth::members`,
                callArgs: [ accountId]
            })

            if (isExecutionError(data)) {
                throw new Error(`Error fetching isafe members: ${data.executionError}`);
            };

            return convertMoveValuesToMembers(data.functionReturnValues);
        },
        enabled: !!accountId,
        staleTime: Infinity,
        retry: false,
    });
}

export type Member = {
    address: string;
    weight: number;
}

type MoveStruct<TFields> = {
    type: string;
    fields: TFields;
};

type MoveMember = MoveStruct<{
    addr: string;
    weight: string;
}>;

type MoveMembers = MoveStruct<{
    list: MoveMember[];
}>;

function convertMoveValuesToMembers(values: MoveValue[] | undefined): Member[] {
    if (!values || values.length === 0) {
        return [];
    }

    const [rawMembers] = values as unknown as MoveMembers[];

    if (!rawMembers || !rawMembers.fields || !Array.isArray(rawMembers.fields.list)) {
        return [];
    }

    return rawMembers.fields.list.map((member) => ({
        address: member.fields?.addr ?? '',
        weight: Number(member.fields?.weight ?? 0),
    }));
}