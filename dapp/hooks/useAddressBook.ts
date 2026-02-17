"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "isafe_address_book";

type AddressBook = Record<string, string>; // address -> name

function readBook(): AddressBook {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AddressBook;
  } catch {
    return {};
  }
}

function writeBook(book: AddressBook) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(book));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

export function useAddressBook() {
  const [book, setBook] = useState<AddressBook>(() => readBook());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        setBook(readBook());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const getName = useCallback(
    (address: string): string | undefined => book[address],
    [book]
  );

  const getEntries = useCallback((): AddressBook => book, [book]);

  const getAddressByName = useCallback(
    (name: string): string | undefined => {
      const normalized = name.trim().toLowerCase();
      const entry = Object.entries(book).find(
        ([, n]) => n.toLowerCase() === normalized
      );
      return entry?.[0];
    },
    [book]
  );

  const searchByName = useCallback(
    (query: string): Array<{ address: string; name: string }> => {
      if (!query.trim()) return [];
      const normalized = query.trim().toLowerCase();
      return Object.entries(book)
        .filter(([, n]) => n.toLowerCase().includes(normalized))
        .map(([address, name]) => ({ address, name }));
    },
    [book]
  );

  const isNameTaken = useCallback(
    (name: string, excludeAddress?: string): boolean => {
      const normalized = name.trim().toLowerCase();
      return Object.entries(book).some(
        ([addr, n]) => n.toLowerCase() === normalized && addr !== excludeAddress
      );
    },
    [book]
  );

  const setName = useCallback((address: string, name: string) => {
    setBook((prev) => {
      const next = { ...prev, [address]: name.trim() };
      writeBook(next);
      return next;
    });
  }, []);

  const removeName = useCallback((address: string) => {
    setBook((prev) => {
      const { [address]: _, ...rest } = prev;
      writeBook(rest);
      return rest;
    });
  }, []);

  return { getEntries, getName, getAddressByName, searchByName, isNameTaken, setName, removeName };
}
