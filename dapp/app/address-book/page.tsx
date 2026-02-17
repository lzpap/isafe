"use client";

import { useState } from "react";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { isValidIotaAddress } from "@iota/iota-sdk/utils";
import { shortenAddress } from "@/lib/utils/shortenAddress";

export default function AddressBookPage() {
  const { getEntries, isNameTaken, setName, removeName } = useAddressBookContext();
  const [search, setSearch] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const entries = Object.entries(getEntries());
  const filtered = entries.filter(
    ([address, name]) =>
      address.toLowerCase().includes(search.toLowerCase()) ||
      name.toLowerCase().includes(search.toLowerCase())
  );

  const isAddressValid = newAddress === "" || isValidIotaAddress(newAddress);
  const isDuplicate = entries.some(([addr]) => addr === newAddress);
  const isNewNameTaken = newName.trim() ? isNameTaken(newName.trim()) : false;

  const handleAdd = () => {
    if (!newAddress.trim() || !newName.trim() || !isAddressValid || isDuplicate || isNewNameTaken) return;
    setName(newAddress.trim(), newName.trim());
    setNewAddress("");
    setNewName("");
  };

  const isEditNameTaken = editingName.trim() && editingAddress
    ? isNameTaken(editingName.trim(), editingAddress)
    : false;

  const handleSaveEdit = (address: string) => {
    if (editingName.trim() && !isEditNameTaken) {
      setName(address, editingName.trim());
    }
    if (!isEditNameTaken) {
      setEditingAddress(null);
      setEditingName("");
    }
  };

  const handleRemove = (address: string, name: string) => {
    if (confirm(`Remove "${name}" from address book?`)) {
      removeName(address);
    }
  };

  const copyToClipboard = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress((prev) => (prev === address ? null : prev)), 1500);
  };

  return (
    <div className="max-w-3xl mx-auto pt-20 space-y-6 pb-12 px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Address Book</h1>
        <span className="text-sm text-foreground/50">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Add New Entry */}
      <div className="bg-foreground/5 rounded-xl p-5 border border-foreground/10 space-y-3">
        <h2 className="text-sm font-semibold text-foreground/70">Add New Entry</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder="Address (0x...)"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className={`w-full px-3 py-2 text-sm font-mono bg-background border rounded-lg focus:outline-none focus:border-blue-500 ${
                !isAddressValid
                  ? "border-red-500"
                  : isDuplicate && newAddress
                  ? "border-yellow-500"
                  : "border-foreground/20"
              }`}
            />
            {!isAddressValid && (
              <p className="text-xs text-red-500 mt-1">Invalid IOTA address</p>
            )}
            {isDuplicate && newAddress && (
              <p className="text-xs text-yellow-500 mt-1">Address already in book</p>
            )}
          </div>
          <div className="w-full sm:w-48">
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className={`w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:border-blue-500 ${
                isNewNameTaken ? "border-red-500" : "border-foreground/20"
              }`}
            />
            {isNewNameTaken && (
              <p className="text-xs text-red-500 mt-1">Name already in use</p>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!newAddress.trim() || !newName.trim() || !isAddressValid || isDuplicate || isNewNameTaken}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
          >
            Add
          </button>
        </div>
      </div>

      {/* Search */}
      {entries.length > 0 && (
        <input
          type="text"
          placeholder="Search by name or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 text-sm bg-foreground/5 border border-foreground/10 rounded-xl focus:outline-none focus:border-blue-500"
        />
      )}

      {/* Entries List */}
      {entries.length === 0 ? (
        <div className="text-center py-16 text-foreground/40">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <p className="text-sm font-medium">No entries yet</p>
          <p className="text-xs mt-1">Add your first entry above, or click any address in the app to name it.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-foreground/40">
          <p className="text-sm">No matching entries</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(([address, name]) => (
            <div
              key={address}
              className="bg-foreground/5 border border-foreground/10 rounded-lg px-4 py-3 flex items-center gap-3"
            >
              {editingAddress === address ? (
                /* Edit Mode */
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(address);
                      if (e.key === "Escape") setEditingAddress(null);
                    }}
                    autoFocus
                    className={`flex-1 px-2 py-1 text-sm bg-background border rounded focus:outline-none focus:border-blue-500 ${
                      isEditNameTaken ? "border-red-500" : "border-foreground/20"
                    }`}
                  />
                  <button
                    onClick={() => handleSaveEdit(address)}
                    disabled={!editingName.trim() || isEditNameTaken}
                    className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingAddress(null)}
                    className="px-3 py-1 text-xs font-medium bg-foreground/10 rounded hover:bg-foreground/20 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  </div>
                  {isEditNameTaken && (
                    <p className="text-xs text-red-500">Name already in use</p>
                  )}
                </div>
              ) : (
                /* Display Mode */
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-400">{name}</p>
                    <p
                      className="text-xs text-foreground/50 font-mono truncate"
                      title={address}
                    >
                      {shortenAddress(address)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Copy */}
                    <button
                      onClick={() => copyToClipboard(address)}
                      className="p-1.5 rounded hover:bg-foreground/10 transition cursor-pointer"
                      title={copiedAddress === address ? "Copied!" : "Copy address"}
                    >
                      {copiedAddress === address ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => {
                        setEditingAddress(address);
                        setEditingName(name);
                      }}
                      className="p-1.5 rounded hover:bg-foreground/10 transition cursor-pointer"
                      title="Edit name"
                    >
                      <svg className="w-4 h-4 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleRemove(address, name)}
                      className="p-1.5 rounded hover:bg-red-500/10 transition cursor-pointer"
                      title="Remove entry"
                    >
                      <svg className="w-4 h-4 text-red-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
