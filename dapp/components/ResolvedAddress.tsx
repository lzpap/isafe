"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { shortenAddress } from "@/lib/utils/shortenAddress";
import { CONFIG } from "@/config/config";

interface ResolvedAddressProps {
  address: string;
  mode?: "short" | "full";
  clickable?: boolean;
  className?: string;
}

export function ResolvedAddress({
  address,
  mode = "short",
  clickable = true,
  className = "",
}: ResolvedAddressProps) {
  const { getName, isNameTaken, setName, removeName } = useAddressBookContext();
  const [showPopover, setShowPopover] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [copied, setCopied] = useState(false);

  const name = getName(address);
  const hasName = !!name;

  const formattedAddress =
    mode === "full" ? address : shortenAddress(address);

  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopover]);

  useEffect(() => {
    if (showPopover && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showPopover]);

  const handleOpen = () => {
    if (!clickable) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 4, left: rect.left });
    }
    setInputValue(name || "");
    setShowPopover(true);
  };

  const duplicate = inputValue.trim() ? isNameTaken(inputValue.trim(), address) : false;

  const handleSave = () => {
    if (inputValue.trim() && !duplicate) {
      setName(address, inputValue.trim());
    }
    if (!duplicate) setShowPopover(false);
  };

  const handleRemove = () => {
    removeName(address);
    setShowPopover(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setShowPopover(false);
  };

  const displayText = hasName ? name : formattedAddress;

  return (
    <span className={`inline-flex ${className}`}>
      <span
        ref={triggerRef}
        onClick={handleOpen}
        className={`
          ${hasName ? "text-blue-400 font-medium" : "font-mono"}
          ${clickable ? "cursor-pointer hover:underline underline-offset-4" : ""}
          truncate
        `}
        title={hasName ? `${name} (${address})` : address}
      >
        {displayText}
      </span>

      {showPopover &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: popoverPos.top, left: popoverPos.left, zIndex: 9999 }}
            className="w-80 bg-background border border-foreground/20 rounded-lg shadow-xl p-3 space-y-2"
          >
            <div className="flex items-start gap-1.5">
              <a
                href={`https://explorer.iota.org/address/${address}?network=${CONFIG.network}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-foreground/50 hover:text-blue-400 font-mono break-all transition"
              >
                {address}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="shrink-0 mt-0.5 p-0.5 text-foreground/40 hover:text-foreground/70 transition cursor-pointer"
                title="Copy address"
              >
                {copied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                )}
              </button>
            </div>
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter a name..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1.5 text-sm bg-foreground/5 border border-foreground/20 rounded focus:outline-none focus:border-blue-500"
            />
            {duplicate && (
              <p className="text-xs text-red-500">This name is already used for another address.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!inputValue.trim() || duplicate}
                className="flex-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
              {hasName && (
                <button
                  onClick={handleRemove}
                  className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition cursor-pointer"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => setShowPopover(false)}
                className="px-2 py-1 text-xs font-medium bg-foreground/10 rounded hover:bg-foreground/20 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
