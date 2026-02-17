"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAddressBook } from "@/hooks/useAddressBook";

export interface AddressBookContextType {
  getName: (address: string) => string | undefined;
  getAddressByName: (name: string) => string | undefined;
  searchByName: (query: string) => Array<{ address: string; name: string }>;
  getEntries: () => Record<string, string>;
  isNameTaken: (name: string, excludeAddress?: string) => boolean;
  setName: (address: string, name: string) => void;
  removeName: (address: string) => void;
}

const AddressBookContext = createContext<AddressBookContextType>({
  getName: () => undefined,
  getAddressByName: () => undefined,
  searchByName: () => [],
  getEntries: () => ({}),
  isNameTaken: () => false,
  setName: () => {},
  removeName: () => {},
});

export function AddressBookProvider({ children }: { children: ReactNode }) {
  const addressBook = useAddressBook();

  return (
    <AddressBookContext.Provider value={addressBook}>
      {children}
    </AddressBookContext.Provider>
  );
}

export function useAddressBookContext(): AddressBookContextType {
  return useContext(AddressBookContext);
}
