import { useCallback, useEffect, useState } from "react";

type TabType = "proposed" | "approved" | "executed" | "rejected";
type SeenMap = Partial<Record<TabType, string[]>>;

const COOKIE_NAME_PREFIX = "isafe_seen_txs_";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function readSeen(accountAddress: string): SeenMap {
  const raw = getCookie(COOKIE_NAME_PREFIX + accountAddress);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as SeenMap;
  } catch {
    return {};
  }
}

function writeSeen(accountAddress: string, seen: SeenMap) {
  setCookie(COOKIE_NAME_PREFIX + accountAddress, JSON.stringify(seen));
}

/**
 * Tracks which transaction digests the user has already seen per tab.
 * Persists in a cookie scoped to the account address.
 *
 * - `getUnseenCount(tab, digests)` returns number of digests not yet seen
 * - `markAsSeen(tab, digests)` marks the given digests as seen for that tab
 */
export function useSeenTransactions(accountAddress: string) {
  const [seen, setSeen] = useState<SeenMap>(() => readSeen(accountAddress));

  // Re-read cookie if account changes
  useEffect(() => {
    setSeen(readSeen(accountAddress));
  }, [accountAddress]);

  const markAsSeen = useCallback(
    (tab: TabType, digests: string[]) => {
      setSeen((prev) => {
        const existing = new Set(prev[tab] || []);
        let changed = false;
        for (const d of digests) {
          if (!existing.has(d)) {
            existing.add(d);
            changed = true;
          }
        }
        if (!changed) return prev;
        const next = { ...prev, [tab]: Array.from(existing) };
        writeSeen(accountAddress, next);
        return next;
      });
    },
    [accountAddress]
  );

  const getUnseenCount = useCallback(
    (tab: TabType, digests: string[]): number => {
      const seenSet = new Set(seen[tab] || []);
      return digests.filter((d) => !seenSet.has(d)).length;
    },
    [seen]
  );

  return { getUnseenCount, markAsSeen };
}
