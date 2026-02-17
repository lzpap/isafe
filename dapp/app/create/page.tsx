"use client";

import { useState, useRef, useEffect } from "react";
import {
  useCurrentAccount,
  useIotaClient,
  useSignAndExecuteTransaction,
} from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { CONFIG } from "@/config/config";
import { TransactionEffects } from "@iota/iota-sdk/client";
import { fromBase64 } from "@iota/iota-sdk/utils";
import { bcs } from "@iota/iota-sdk/bcs";
import { redirect } from "next/navigation";
import { useISafeAccount } from "@/providers/ISafeAccountProvider";
import { normalizeIotaAddress, isValidIotaAddress } from "@iota/iota-sdk/utils";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { shortenAddress } from "@/lib/utils/shortenAddress";
import { motion, AnimatePresence } from "motion/react";

interface Member {
  address: string;
  weight: string;
}

interface AccountCreatedEvent {
  account: string;
}

const STEPS = [
  { label: "Members", description: "Add signers" },
  { label: "Threshold", description: "Set approval rules" },
  { label: "Review", description: "Confirm & create" },
];

export default function Create() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();
  const client = useIotaClient();
  const { isafeAccount, toggleAccount } = useISafeAccount();
  const { searchByName, getAddressByName, getName, isNameTaken, setName } = useAddressBookContext();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  const [members, setMembers] = useState<Member[]>([
    { address: currentAccount?.address || "", weight: "1" },
  ]);
  const [threshold, setThreshold] = useState<string>("1");
  const [accountName, setAccountName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [activeAutocomplete, setActiveAutocomplete] = useState<number | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const thresholdBarRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ address: string; name: string }>
  >([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeAutocomplete === null) return;
    const handler = (e: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(e.target as Node)
      ) {
        setActiveAutocomplete(null);
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeAutocomplete]);

  // ── Member helpers ──
  const addMember = () => {
    setMembers([...members, { address: "", weight: "1" }]);
  };

  const addCurrentWallet = () => {
    if (
      currentAccount?.address &&
      !members.some((m) => m.address === currentAccount.address)
    ) {
      setMembers([
        ...members,
        { address: currentAccount.address, weight: "1" },
      ]);
    }
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMemberAddress = (index: number, value: string) => {
    const looksLikeAddress = value.startsWith("0x");

    if (!looksLikeAddress && value.trim().length > 0) {
      const matches = searchByName(value);
      if (matches.length > 0) {
        setSuggestions(matches);
        setActiveAutocomplete(index);
        const exact = getAddressByName(value);
        if (exact) {
          setMembers(
            members.map((m, i) =>
              i === index ? { ...m, address: exact } : m
            )
          );
          setSuggestions([]);
          setActiveAutocomplete(null);
          return;
        }
      } else {
        setSuggestions([]);
        setActiveAutocomplete(null);
      }
    } else {
      setSuggestions([]);
      setActiveAutocomplete(null);
    }

    setMembers(
      members.map((m, i) => (i === index ? { ...m, address: value } : m))
    );
  };

  const selectSuggestion = (index: number, address: string) => {
    const newMembers = [...members];
    newMembers[index].address = address;
    setMembers(newMembers);
    setSuggestions([]);
    setActiveAutocomplete(null);
  };

  const updateMemberWeight = (index: number, weight: string) => {
    const newMembers = [...members];
    newMembers[index].weight = weight;
    setMembers(newMembers);
  };

  // ── Derived values ──
  const totalWeight = members.reduce((sum, m) => {
    const w = parseInt(m.weight, 10);
    return sum + (isNaN(w) ? 0 : w);
  }, 0);
  const thresholdNum = parseInt(threshold, 10);
  const thresholdRatio =
    totalWeight > 0 && !isNaN(thresholdNum)
      ? Math.min(thresholdNum / totalWeight, 1)
      : 0;

  // ── Step validation ──
  const isStep1Valid = (): boolean => {
    if (members.length === 0) return false;
    for (const m of members) {
      if (!m.address.trim() || !isValidIotaAddress(m.address)) return false;
      const w = parseInt(m.weight, 10);
      if (isNaN(w) || w <= 0) return false;
    }
    const addrs = members.map((m) => m.address);
    if (new Set(addrs).size !== addrs.length) return false;
    return true;
  };

  const isStep2Valid = (): boolean => {
    if (isNaN(thresholdNum) || thresholdNum <= 0) return false;
    if (thresholdNum > totalWeight) return false;
    return true;
  };

  // ── Full validation (for submit) ──
  const validateForm = (): { valid: boolean; error: string } => {
    for (const member of members) {
      if (!member.address.trim())
        return { valid: false, error: "All member addresses must be filled" };
      if (!isValidIotaAddress(member.address))
        return {
          valid: false,
          error: `Invalid IOTA address: ${member.address}`,
        };
    }
    const addresses = members.map((m) => m.address);
    if (new Set(addresses).size !== addresses.length)
      return { valid: false, error: "Duplicate addresses are not allowed" };
    for (const member of members) {
      const weight = parseInt(member.weight, 10);
      if (isNaN(weight) || weight <= 0)
        return {
          valid: false,
          error: "All member weights must be positive numbers",
        };
    }
    const tw = members.reduce((s, m) => s + parseInt(m.weight, 10), 0);
    const tn = parseInt(threshold, 10);
    if (isNaN(tn) || tn <= 0)
      return { valid: false, error: "Threshold must be a positive number" };
    if (tn > tw)
      return {
        valid: false,
        error: `Threshold (${tn}) cannot exceed total weight (${tw})`,
      };
    if (accountName.trim() && isNameTaken(accountName))
      return { valid: false, error: "Account name already exists in your address book" };
    return { valid: true, error: "" };
  };

  // ── Submit ──
  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    const validation = validateForm();
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    if (!currentAccount?.address) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      const tx = new Transaction();
      const PACKAGE_ID = CONFIG.packageId;
      const PACKAGE_METADATA_ID = CONFIG.packageMetadataId;
      const memberAddresses = members.map((m) => m.address);
      const memberWeights = members.map((m) => parseInt(m.weight, 10));

      tx.moveCall({
        target: `${PACKAGE_ID}::dynamic_auth::create_account`,
        arguments: [
          tx.pure.vector("address", memberAddresses),
          tx.pure.vector("u64", memberWeights),
          tx.pure.u64(parseInt(threshold, 10)),
          tx.object(PACKAGE_METADATA_ID),
        ],
      });

      signAndExecuteTransaction(
        { transaction: tx, waitForTransaction: true },
        {
          onSuccess: async (result) => {
            const transactionEffects = bcs.TransactionEffects.parse(
              new Uint8Array(Buffer.from(result.effects, "base64"))
            );
            const eventQueryResult = await client.queryEvents({
              query: {
                Transaction: transactionEffects.V1.transactionDigest,
              },
            });
            const event: AccountCreatedEvent = eventQueryResult.data[0]
              ?.parsedJson as AccountCreatedEvent;
            if (accountName.trim()) {
              setName(event.account, accountName.trim());
            }
            setSuccess(
              `Account created successfully! Digest: ${result.digest}`
            );
            setMembers([
              { address: currentAccount?.address || "", weight: "1" },
            ]);
            setThreshold("1");
            setAccountName("");
            toggleAccount(event.account);
            redirect(`/${event.account}`);
          },
          onError: (err) => {
            console.error("Transaction failed:", err);
            setError(`Transaction failed: ${err.message}`);
          },
        }
      );
    } catch (err: any) {
      setError(`Error preparing transaction: ${err.message}`);
    }
  };

  // ── Threshold drag ──
  const setThresholdFromPointer = (clientX: number) => {
    const bar = thresholdBarRef.current;
    if (!bar || totalWeight === 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newThreshold = Math.max(1, Math.round(ratio * totalWeight));
    setThreshold(String(newThreshold));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setThresholdFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setThresholdFromPointer(e.clientX);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // ── Navigation ──
  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, 3));
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  };

  const canGoNext =
    (step === 1 && isStep1Valid()) || (step === 2 && isStep2Valid());

  // ── Animation variants ──
  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  // ── Render ──
  return (
    <main className="flex flex-col min-h-screen pt-20 px-6 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="max-w-2xl mx-auto w-full"
      >
        {/* Header */}
        <div className="text-center mb-8 mt-6">
          <h1 className="text-3xl font-bold">Create a New iSafe Account</h1>
          <p className="text-foreground/50 mt-2 text-sm">
            Set up your multi-signature account in three easy steps
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((s, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isCompleted = step > stepNum;
            return (
              <div key={s.label} className="flex items-center">
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      backgroundColor: isCompleted
                        ? "rgb(34 197 94)"
                        : isActive
                        ? "rgb(59 130 246)"
                        : "transparent",
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                      isCompleted
                        ? "border-green-500 text-white"
                        : isActive
                        ? "border-blue-500 text-white"
                        : "border-foreground/20 text-foreground/40"
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </motion.div>
                  <span
                    className={`text-xs mt-1.5 font-medium ${
                      isActive
                        ? "text-blue-400"
                        : isCompleted
                        ? "text-green-400"
                        : "text-foreground/30"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 rounded transition-colors ${
                      step > stepNum
                        ? "bg-green-500"
                        : "bg-foreground/10"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="bg-foreground/5 border border-foreground/10 rounded-2xl p-6 min-h-[360px] relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {/* Step 1: Members */}
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Add Members</h2>
                    <p className="text-xs text-foreground/40 mt-0.5">
                      Each member gets a voting weight
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCurrentWallet}
                    disabled={
                      !currentAccount?.address ||
                      members.some(
                        (m) => m.address === currentAccount?.address
                      )
                    }
                    className="px-3 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    + My Wallet
                  </button>
                </div>

                <div className="space-y-3">
                  {members.map((member, index) => {
                    const isDuplicateAddr =
                      member.address.trim() !== "" &&
                      members.some(
                        (m, i) =>
                          i !== index && m.address === member.address
                      );
                    return (
                    <motion.div
                      key={index}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-background border border-foreground/10 rounded-xl p-3 flex gap-3 items-start"
                    >
                      {/* Number badge */}
                      <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-semibold text-foreground/50 shrink-0 mt-1">
                        {index + 1}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Address input */}
                        <div className="relative">
                          <input
                            type="text"
                            value={member.address}
                            onChange={(e) =>
                              updateMemberAddress(index, e.target.value)
                            }
                            onFocus={() => {
                              if (
                                !member.address.startsWith("0x") &&
                                member.address.trim()
                              ) {
                                const matches = searchByName(member.address);
                                if (matches.length > 0) {
                                  setSuggestions(matches);
                                  setActiveAutocomplete(index);
                                }
                              }
                            }}
                            className={`w-full px-3 py-2 border rounded-lg bg-foreground/5 focus:outline-none focus:ring-2 font-mono text-sm ${
                              isDuplicateAddr
                                ? "border-yellow-500/50 focus:ring-yellow-500/30"
                                : member.address &&
                                  !isValidIotaAddress(member.address)
                                ? "border-red-500/50 focus:ring-red-500/30"
                                : "border-foreground/10 focus:ring-blue-500/30"
                            }`}
                            placeholder="0x... or name from address book"
                          />
                          {isDuplicateAddr && (
                            <p className="text-xs text-yellow-500 mt-1">
                              Duplicate address
                            </p>
                          )}
                          {activeAutocomplete === index &&
                            suggestions.length > 0 && (
                              <div
                                ref={autocompleteRef}
                                className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-foreground/20 rounded-lg shadow-xl overflow-hidden"
                              >
                                {suggestions.map((s) => (
                                  <button
                                    key={s.address}
                                    type="button"
                                    onClick={() =>
                                      selectSuggestion(index, s.address)
                                    }
                                    className="w-full px-3 py-2 text-left hover:bg-foreground/10 transition cursor-pointer flex items-center justify-between gap-2"
                                  >
                                    <span className="text-sm font-medium text-blue-400">
                                      {s.name}
                                    </span>
                                    <span className="text-xs text-foreground/40 font-mono">
                                      {shortenAddress(s.address)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>

                        {/* Weight + resolved name */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-foreground/40">
                              Weight:
                            </span>
                            <input
                              type="number"
                              min="1"
                              value={member.weight}
                              onChange={(e) =>
                                updateMemberWeight(index, e.target.value)
                              }
                              className="w-20 px-2 py-1 border border-foreground/10 rounded-lg bg-foreground/5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm text-center"
                            />
                          </div>
                          {getName(member.address) && (
                            <span className="text-xs text-blue-400 font-medium bg-blue-500/10 px-2 py-0.5 rounded-md truncate max-w-[10rem]">
                              {getName(member.address)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeMember(index)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/30 hover:text-red-500 transition cursor-pointer shrink-0 mt-1"
                        title="Remove member"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </motion.div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={addMember}
                    className="px-4 py-2 text-sm font-medium bg-foreground/10 rounded-lg hover:bg-foreground/15 transition cursor-pointer"
                  >
                    + Add Member
                  </button>
                  <span className="text-xs text-foreground/40">
                    Total weight:{" "}
                    <span className="font-semibold text-foreground/70">
                      {totalWeight}
                    </span>
                  </span>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {/* Step 2: Threshold */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">Set Threshold</h2>
                  <p className="text-xs text-foreground/40 mt-0.5">
                    Minimum combined weight needed to approve transactions
                  </p>
                </div>

                <div className="flex flex-col items-center gap-6">
                  {/* Large threshold input */}
                  <div className="flex items-baseline gap-3">
                    <input
                      type="number"
                      min="1"
                      max={totalWeight}
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      className="w-24 text-center text-4xl font-bold bg-transparent border-b-2 border-foreground/20 focus:border-blue-500 focus:outline-none py-2 transition-colors"
                    />
                    <span className="text-lg text-foreground/30 font-medium">
                      / {totalWeight}
                    </span>
                  </div>

                  {/* Interactive threshold bar */}
                  <div className="w-full max-w-md">
                    <div
                      ref={thresholdBarRef}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      className="relative h-3 bg-foreground/10 rounded-full cursor-pointer touch-none select-none"
                    >
                      <motion.div
                        className={`h-full rounded-full pointer-events-none ${
                          thresholdNum > totalWeight
                            ? "bg-red-500"
                            : thresholdRatio >= 0.7
                            ? "bg-gradient-to-r from-amber-500 to-green-500"
                            : "bg-gradient-to-r from-blue-500 to-blue-400"
                        }`}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(thresholdRatio * 100, 100)}%`,
                        }}
                        transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 15 }}
                      />
                      {/* Drag thumb */}
                      <motion.div
                        className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 shadow-md pointer-events-none ${
                          isDragging
                            ? "border-blue-400 bg-blue-500 scale-110"
                            : "border-foreground/30 bg-background hover:border-blue-400"
                        } transition-colors`}
                        animate={{
                          left: `calc(${Math.min(thresholdRatio * 100, 100)}% - 10px)`,
                        }}
                        transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 15 }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-foreground/30">
                      <span>0</span>
                      <span>{totalWeight}</span>
                    </div>
                  </div>

                  {/* Explanation */}
                  <p className="text-sm text-foreground/50 text-center max-w-sm">
                    {!isNaN(thresholdNum) && thresholdNum > 0 && thresholdNum <= totalWeight ? (
                      <>
                        At least{" "}
                        <span className="font-semibold text-foreground/80">
                          {thresholdNum}
                        </span>{" "}
                        out of{" "}
                        <span className="font-semibold text-foreground/80">
                          {totalWeight}
                        </span>{" "}
                        total weight must approve each transaction.
                      </>
                    ) : thresholdNum > totalWeight ? (
                      <span className="text-red-400">
                        Threshold cannot exceed total weight ({totalWeight})
                      </span>
                    ) : (
                      "Enter a positive number for the threshold."
                    )}
                  </p>

                  {/* Members reference pills */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {members.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 bg-foreground/5 border border-foreground/10 rounded-full px-3 py-1"
                      >
                        <span className="text-xs text-foreground/50 font-mono">
                          {getName(m.address) || shortenAddress(m.address)}
                        </span>
                        <span className="text-xs font-semibold text-foreground/70 bg-foreground/10 rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                          {m.weight}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {/* Step 3: Review */}
                <div className="mb-5">
                  <h2 className="text-lg font-semibold">Review & Create</h2>
                  <p className="text-xs text-foreground/40 mt-0.5">
                    Confirm everything looks correct
                  </p>
                </div>

                {/* Account name */}
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2">
                    Account Name (optional)
                  </h3>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Team Treasury"
                    className={`w-full px-4 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 text-sm ${
                      accountName.trim() && isNameTaken(accountName)
                        ? "border-yellow-500/50 focus:ring-yellow-500/30"
                        : "border-foreground/10 focus:ring-blue-500/30"
                    }`}
                  />
                  {accountName.trim() && isNameTaken(accountName) && (
                    <p className="text-xs text-yellow-500 mt-1">
                      This name already exists in your address book
                    </p>
                  )}
                </div>

                {/* Members summary */}
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2">
                    Members ({members.length})
                  </h3>
                  <div className="space-y-2">
                    {members.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-background border border-foreground/10 rounded-lg px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-semibold shrink-0">
                            {i + 1}
                          </div>
                          <div className="min-w-0">
                            {getName(m.address) && (
                              <p className="text-sm font-medium text-blue-400">
                                {getName(m.address)}
                              </p>
                            )}
                            <p className="text-xs text-foreground/40 font-mono truncate">
                              {shortenAddress(m.address)}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold bg-foreground/5 px-2.5 py-1 rounded-lg">
                          {m.weight}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Threshold summary */}
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2">
                    Threshold
                  </h3>
                  <div className="bg-background border border-foreground/10 rounded-lg px-4 py-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{threshold}</span>
                      <span className="text-foreground/30 text-sm">
                        / {totalWeight} total weight
                      </span>
                    </div>
                    <div className="h-2 bg-foreground/10 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                        style={{
                          width: `${Math.min(thresholdRatio * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Error / success messages */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}
                {success && (
                  <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-green-400 text-sm">{success}</p>
                  </div>
                )}

                {/* Create button */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!validateForm().valid || isPending}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Creating Account...
                    </span>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="px-5 py-2.5 text-sm font-medium bg-foreground/10 rounded-xl hover:bg-foreground/15 transition cursor-pointer"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          {step < 3 && (
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Continue
            </button>
          )}
        </div>
      </motion.div>
    </main>
  );
}
