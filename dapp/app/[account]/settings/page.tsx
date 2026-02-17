"use client";

import { useState, useMemo } from "react";
import { redirect, useParams } from "next/navigation";
import {
  useCurrentAccount,
  useIotaClient,
  useSignAndExecuteTransaction,
} from "@iota/dapp-kit";
import { ObjectRef, Transaction } from "@iota/iota-sdk/transactions";
import { useGetMembers } from "@/hooks/useGetMembers";
import { useGetThreshold } from "@/hooks/useGetThreshold";
import { useGetAllowedAuthenticators } from "@/hooks/useGetAllowedAuthenticators";

import { useQueryClient } from "@tanstack/react-query";

import { generateAvatar } from "@/lib/utils/generateAvatar";
import { findThresholdCombinations } from "@/lib/utils/findThresholdCombinations";
import { shortenAddress } from "@/lib/utils/shortenAddress";
import { ResolvedAddress } from "@/components/ResolvedAddress";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { AllowedAuthenticators } from "@/components/AllowedAuthenticators";

import { ExecuteSettingChangesDialog } from "@/components/dialogs/ExecuteSettingChangesDialog";

export type SettingsAction =
  | { type: "add_member"; address: string; weight: number }
  | { type: "remove_member"; address: string }
  | { type: "update_weight"; address: string; newWeight: number }
  | { type: "set_threshold"; newThreshold: number };

type Member = { address: string; weight: number };

export default function Settings() {
  const [actionDialogName, setActionDialogName] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<SettingsAction | null>(null);
  const params = useParams();
  const accountAddress = params.account as string;
  const currentAccount = useCurrentAccount();
  const queryClient = useQueryClient();
  const iotaClient = useIotaClient();
  const { mutate: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();
  const { getName } = useAddressBookContext();

  const {
    data: members,
    isLoading: membersLoading,
    error: membersError,
  } = useGetMembers(accountAddress);
  const {
    threshold,
    totalWeight,
    isLoading: thresholdLoading,
    error: thresholdError,
  } = useGetThreshold(accountAddress);

  // Modal/form states
  const [showAddMember, setShowAddMember] = useState(false);
  const [showUpdateWeight, setShowUpdateWeight] = useState<string | null>(null);
  const [showChangeThreshold, setShowChangeThreshold] = useState(false);

  // Form values
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [newMemberWeight, setNewMemberWeight] = useState("1");
  const [updateWeightValue, setUpdateWeightValue] = useState("");
  const [newThreshold, setNewThreshold] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Calculate threshold combinations
  const thresholdCombinations = useMemo(() => {
    return findThresholdCombinations(members || [], threshold || 0);
  }, [members, threshold]);

  const executeAction = async (action: SettingsAction) => {
    if (!currentAccount?.address) {
      setError("Please connect your wallet first");
      return;
    }
    // TODO: implement a dialog that shows the progress of the action
    setActionDialogName(action.type);
    setDialogAction(action);
    setError("");
    setSuccess("");
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    executeAction({
      type: "add_member",
      address: newMemberAddress,
      weight: parseInt(newMemberWeight, 10),
    });
  };

  const handleRemoveMember = (address: string) => {
    if (
      confirm(
        `Are you sure you want to remove member ${getName(address) || shortenAddress(address)}?`
      )
    ) {
      executeAction({ type: "remove_member", address });
    }
  };

  const handleUpdateWeight = (e: React.FormEvent, address: string) => {
    e.preventDefault();
    executeAction({
      type: "update_weight",
      address,
      newWeight: parseInt(updateWeightValue, 10),
    });
  };

  const handleSetThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    executeAction({
      type: "set_threshold",
      newThreshold: parseInt(newThreshold, 10),
    });
  };

  const isLoading = membersLoading || thresholdLoading;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
          <span className="ml-3">Loading account settings...</span>
        </div>
      </div>
    );
  }

  if (membersError || thresholdError) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-red-500/10 rounded-lg">
        <p className="text-red-500">Error loading account data</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto pt-20 space-y-6 pb-12 px-6">
        {/* Status Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-500 text-sm">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Members Settings Section */}
          <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10 flex flex-col">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-foreground/60"
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
              Member Settings
            </h2>

            <div className="mb-4 text-sm text-foreground/60">
              {members?.length || 0} members · Total weight: {totalWeight || 0}
            </div>

            {/* Members List */}
            <div className="space-y-3 mb-4 flex-1">
              {members?.map((member, index) => (
                <div
                  key={member.address}
                  className="bg-background rounded-lg border border-foreground/10 overflow-hidden"
                >
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-foreground/40 text-xs font-medium">
                        #{index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="font-mono text-sm truncate"
                          title={member.address}
                        >
                          <ResolvedAddress address={member.address} />
                        </p>
                      </div>
                      <span className="bg-foreground/10 px-2 py-0.5 rounded text-xs font-semibold">
                        Weight: {member.weight}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => {
                          setShowUpdateWeight(member.address);
                          setUpdateWeightValue(String(member.weight));
                        }}
                        className="p-1.5 rounded-md bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition"
                        title="Update Weight"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.address)}
                        disabled={isPending}
                        className="p-1.5 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition disabled:opacity-50"
                        title="Remove Member"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Update Weight Inline Form */}
                  {showUpdateWeight === member.address && (
                    <div className="border-t border-foreground/10 p-3 bg-foreground/5">
                      <form
                        onSubmit={(e) => handleUpdateWeight(e, member.address)}
                        className="flex gap-2"
                      >
                        <input
                          type="number"
                          placeholder="New weight"
                          value={updateWeightValue}
                          onChange={(e) => setUpdateWeightValue(e.target.value)}
                          min="1"
                          className="flex-1 px-3 py-1.5 bg-background border border-foreground/20 rounded text-sm focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={isPending}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition disabled:opacity-50"
                        >
                          {isPending ? "..." : "Update"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUpdateWeight(null)}
                          className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/20 rounded text-sm transition"
                        >
                          Cancel
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}

              {(!members || members.length === 0) && (
                <p className="text-center text-foreground/60 py-4">
                  No members found
                </p>
              )}
            </div>

            {/* Add Member Button / Form */}
            {!showAddMember ? (
              <button
                onClick={() => setShowAddMember(true)}
                className="w-full py-2.5 border-2 border-dashed border-foreground/20 rounded-lg text-foreground/60 hover:border-green-500/50 hover:text-green-500 transition flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add New Member
              </button>
            ) : (
              <div className="bg-background rounded-lg border border-green-500/30 p-4">
                <h4 className="text-sm font-semibold text-green-500 mb-3">
                  Add New Member
                </h4>
                <form onSubmit={handleAddMember} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Member Address (0x...)"
                    value={newMemberAddress}
                    onChange={(e) => setNewMemberAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-foreground/5 border border-foreground/20 rounded-lg text-sm font-mono focus:outline-none focus:border-green-500"
                    autoFocus
                  />
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        placeholder="1"
                        value={newMemberWeight}
                        onChange={(e) => setNewMemberWeight(e.target.value)}
                        min="1"
                        className="w-full px-3 py-2 bg-foreground/5 border border-foreground/20 rounded-lg text-sm focus:outline-none focus:border-green-500 pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground/50">
                        weight
                      </span>
                    </div>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      {isPending ? "..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMember(false);
                        setNewMemberAddress("");
                        setNewMemberWeight("1");
                      }}
                      className="px-4 py-2 bg-foreground/10 hover:bg-foreground/20 rounded-lg text-sm transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Threshold Settings Section */}
          <div className="bg-foreground/5 rounded-xl p-6 border border-foreground/10 flex flex-col">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-foreground/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Threshold Settings
            </h2>

            {/* Current Threshold Display */}
            <div className="bg-background rounded-lg border border-foreground/10 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-foreground/60 text-sm">
                  Current Threshold
                </span>
                <span className="text-2xl font-bold">
                  {threshold}{" "}
                  <span className="text-sm font-normal text-foreground/60">
                    / {totalWeight}
                  </span>
                </span>
              </div>
              <div className="w-full bg-foreground/10 rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      totalWeight ? (threshold! / totalWeight) * 100 : 0
                    }%`,
                  }}
                />
              </div>
              <p className="text-xs text-foreground/50">
                {threshold && totalWeight
                  ? Math.round((threshold / totalWeight) * 100)
                  : 0}
                % of total weight required for approval
              </p>
            </div>

            {/* Threshold Combinations */}
            <div className="mb-4 flex-1 flex flex-col min-h-0">
              <h3 className="text-sm font-semibold text-foreground/70 mb-2">
                Valid Approval Combinations
              </h3>
              <p className="text-xs text-foreground/50 mb-3">
                These member groups can approve transactions together:
              </p>

              <div className="space-y-2 overflow-y-auto max-h-64">
                {thresholdCombinations.length > 0 ? (
                  thresholdCombinations.map((combo, idx) => {
                    const comboWeight = combo.reduce((s, m) => s + m.weight, 0);
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-background px-3 py-2 rounded-lg border border-foreground/10"
                      >
                        <span className="text-xs text-foreground/40">
                          #{idx + 1}
                        </span>
                        <div className="flex flex-wrap gap-1 flex-1">
                          {combo.map((m) => (
                            <span
                              key={m.address}
                              className="inline-flex items-center gap-1 bg-foreground/10 px-2 py-0.5 rounded text-xs font-mono"
                            >
                              <ResolvedAddress address={m.address} />
                              <span className="text-foreground/50">
                                ({m.weight})
                              </span>
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-foreground/60 flex-shrink-0">
                          = {comboWeight}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-foreground/50 text-sm py-4">
                    No valid combinations found
                  </p>
                )}
              </div>
            </div>

            {/* Change Threshold Button / Form - pushed to bottom */}
            <div className="mt-auto">
              {!showChangeThreshold ? (
                <button
                  onClick={() => {
                    setShowChangeThreshold(true);
                    setNewThreshold(String(threshold || ""));
                  }}
                  className="w-full py-2.5 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Change Threshold
                </button>
              ) : (
                <div className="bg-background rounded-lg border border-yellow-500/30 p-4">
                  <h4 className="text-sm font-semibold text-yellow-500 mb-3">
                    Set New Threshold
                  </h4>
                  <form onSubmit={handleSetThreshold} className="space-y-3">
                    <div>
                      <input
                        type="number"
                        placeholder="New Threshold"
                        value={newThreshold}
                        onChange={(e) => setNewThreshold(e.target.value)}
                        min="1"
                        max={totalWeight || 1}
                        className="w-full px-3 py-2 bg-foreground/5 border border-foreground/20 rounded-lg text-sm focus:outline-none focus:border-yellow-500"
                        autoFocus
                      />
                      <p className="text-xs text-foreground/50 mt-1">
                        Must be between 1 and {totalWeight} (total weight)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                      >
                        {isPending ? "..." : "Set Threshold"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowChangeThreshold(false);
                          setNewThreshold("");
                        }}
                        className="px-4 py-2 bg-foreground/10 hover:bg-foreground/20 rounded-lg text-sm transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Allowed Authenticators Section */}
        <AllowedAuthenticators address={accountAddress} />
      </div>
      {actionDialogName && (
        <ExecuteSettingChangesDialog
        accountAddress={accountAddress}
          action={dialogAction!}
          onClose={() => {
            setActionDialogName("");
            setShowAddMember(false);
            setShowUpdateWeight(null);
            setShowChangeThreshold(false);
            setNewMemberAddress("");
            setNewMemberWeight("1");
            setUpdateWeightValue("");
            setNewThreshold("");
          }}
        />
      )}
    </>
  );
}
