"use client";

import { useState } from "react";
import { useGetMembers } from "@/hooks/useGetMembers";
import { CONFIG } from "@/config/config";

interface Member {
  address: string;
  weight: number;
}

interface MembersProps {
  accountAddress: string;
  compact?: boolean;
}

export function Members({ accountAddress, compact = false }: MembersProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const { data, error, isLoading } = useGetMembers(accountAddress);

  if (isLoading) {
    return <div>Loading members...</div>;
  }

  if (error || !data) {
    return <div>Error loading members: {error?.message}</div>;
  }

  const totalWeight = data?.reduce((sum, m) => sum + m.weight, 0);

  const getExplorerAddressHref = (address: string) =>
    `https://explorer.iota.org/address/${address}?network=${CONFIG.network}`;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress((prev) => (prev === text ? null : prev)), 1500);
  };

  if (compact) {
    return (
      <div className="relative group">
        <div className="cursor-help">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-foreground/5 border border-foreground/10 flex-shrink-0">
                <svg
                  className="w-4 h-4 text-foreground/70"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground/80">Members</div>
                <div className="text-xs text-foreground/60">Hover for details</div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-mono font-semibold text-foreground/90">{data?.length}</div>
              <div className="text-xs text-foreground/60">Weight {totalWeight}</div>
            </div>
          </div>
        </div>

        {/* Hover Tooltip */}
        <div className="absolute left-0 top-full mt-2 w-80 border border-foreground/20 rounded-lg shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-auto">
          <div className="p-4 bg-background rounded-lg">
            <h4 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Member Details
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data?.map((member, index) => (
                <div
                  key={member.address}
                  className="flex items-center justify-between bg-foreground/5 px-3 py-2 rounded-md text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-foreground/50 font-medium flex-shrink-0">
                      #{index + 1}
                    </span>
                    <a
                      href={getExplorerAddressHref(member.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono truncate text-foreground/80 hover:text-foreground hover:underline underline-offset-4"
                      title={member.address}
                    >
                      {member.address.substring(0, 8)}...{member.address.substring(member.address.length - 6)}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(member.address)}
                      className="p-1 rounded hover:bg-foreground/10 transition flex-shrink-0"
                      title={copiedAddress === member.address ? "Copied!" : "Copy address"}
                    >
                      {copiedAddress === member.address ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <span className="bg-foreground/10 px-2 py-1 rounded-full font-semibold text-xs flex-shrink-0 ml-2">
                    {member.weight}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-foreground/5 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Members</h2>

      {/* Members List */}
      <div className="mb-6">
        {data.length > 0 ? (
          <div className="space-y-2">
            {data?.map((member, index) => (
              <div
                key={member.address}
                className="flex items-center justify-between bg-background px-4 py-3 rounded-md border border-foreground/20"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-foreground/60 font-medium text-sm flex-shrink-0">
                    #{index + 1}
                  </span>
                  <a
                    href={getExplorerAddressHref(member.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm truncate hover:underline underline-offset-4"
                    title={member.address}
                  >
                    {member.address}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(member.address)}
                    className="p-1 rounded hover:bg-foreground/5 transition flex-shrink-0"
                    title={copiedAddress === member.address ? "Copied!" : "Copy address"}
                  >
                    {copiedAddress === member.address ? (
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-foreground/60">Weight:</span>
                  <span className="bg-foreground/10 px-3 py-1 rounded-full font-semibold text-sm">
                    {member.weight}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-foreground/60 py-4">No members found</p>
        )}
      </div>

    </div>
  );
}