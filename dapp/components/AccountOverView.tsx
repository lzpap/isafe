"use client";

import { useState } from "react";
import Transactions from "./Transactions";
import { Members } from "./Members";
import { Threshold } from "./Threshold";
import { AccountActivity } from "./AccountActivity";
import { generateAvatar } from "@/lib/utils/generateAvatar";
import { AccountBalance } from "./AccountBalance";
import { SendIotaDialog } from "./dialogs/SendIotaDialog";
import { useGetAccountBalance } from "@/hooks/useGetAccountBalance";
import { requestIotaFromFaucetV0, getFaucetHost } from "@iota/iota-sdk/faucet";
import { getDefaultNetwork } from "@/config/config";
import { queryKey } from "@/hooks/queryKey";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export function AccountOverView({ isafeAccount }: { isafeAccount: string }) {
  const avatarUrl = generateAvatar(isafeAccount, 80);
  const [copied, setCopied] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const { data: balance } = useGetAccountBalance(isafeAccount);
  const queryClient = useQueryClient();

  const handleFaucet = async () => {
    setFaucetLoading(true);
    try {
      const host = getFaucetHost(getDefaultNetwork());
      await requestIotaFromFaucetV0({ host, recipient: isafeAccount });
      await queryClient.invalidateQueries({ queryKey: queryKey.balance(isafeAccount) });
      toast.success("Tokens received from faucet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Faucet request failed");
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(isafeAccount);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  // if (!isafeAccount) {
  //   return (
  //     <div className="max-w-4xl mx-auto mt-8 p-6 bg-foreground/5 rounded-lg">
  //       <p className="text-center text-foreground/60">
  //         No account selected. Please select an account from the navbar.
  //       </p>
  //     </div>
  //   );
  // }

  return (
    <div className="max-w-6xl mx-auto mt-8 space-y-6">
      {/* Account Overview - Single Row Layout */}
      <div className="bg-gradient-to-br from-foreground/5 to-foreground/10 rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt="Account Avatar"
            className="w-16 h-16 rounded-full shadow-md"
          />
          <p className="font-mono text-xl break-all leading-relaxed">{isafeAccount}</p>
          <button
            onClick={handleCopy}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/10 transition-colors flex-shrink-0"
            title={copied ? "Copied!" : "Copy address"}
          >
            {copied ? (
              <svg className="block w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="block w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <div className="relative group flex-shrink-0">
            <button
              onClick={() => setShowSendDialog(true)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/10 transition-colors"
              aria-label="Send funds from this account"
              title="Send funds from this account"
            >
              <svg
                className="block w-5 h-5 text-foreground/60 rotate-45"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>

            <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Send funds from this account
            </span>
          </div>
          { /* TODO hide the button for mainnet */  <div className="relative group flex-shrink-0">
            <button
              onClick={handleFaucet}
              disabled={faucetLoading}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Request tokens from faucet"
              title="Request tokens from faucet"
            >
              {faucetLoading ? (
                <svg className="block w-5 h-5 text-foreground/60 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="block w-5 h-5 text-foreground/60" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
                  <path d="M4 22h10" />
                  <path d="M7 8h4" />
                  <path d="M14 12h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
                </svg>
              )}
            </button>
            <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Request tokens from faucet
            </span>
          </div>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[22rem_48rem] lg:justify-center gap-6">
          {/* Compact account summary */}
          <div className="bg-background/80 backdrop-blur rounded-lg border border-foreground/10 hover:border-foreground/20 transition-all hover:shadow-md">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">
                Summary
              </h3>
            </div>
            <div className="px-5 pb-5">
              <div className="divide-y divide-foreground/10 rounded-md">
                <div className="py-3">
                  <AccountBalance accountAddress={isafeAccount} compact />
                </div>
                <div className="py-3">
                  <Members accountAddress={isafeAccount} compact={true} />
                </div>
                <div className="py-3">
                  <Threshold accountAddress={isafeAccount} compact={true} />
                </div>
              </div>
            </div>
          </div>

          {/* Account Activity */}
          <div>
            <AccountActivity accountAddress={isafeAccount} />
          </div>
        </div>
      </div>

      {/* Full-width transactions */}
      <Transactions accountAddress={isafeAccount} />

      {/* Send IOTA Dialog */}
      {showSendDialog && balance && (
        <SendIotaDialog
          accountAddress={isafeAccount}
          accountBalance={balance.totalBalance}
          onClose={() => setShowSendDialog(false)}
        />
      )}
    </div>
  );
}
