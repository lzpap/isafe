'use client';

import { useEffect, useRef } from 'react';
import { ConnectButton, useCurrentWallet } from '@iota/dapp-kit';
import Link from 'next/link';
import Image from 'next/image';
import { AccountSelector } from '@/components/AccountSelector';
import { useISafeAccount } from '@/providers/ISafeAccountProvider';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';

export function Navbar() {
    const {isafeAccount } = useISafeAccount();
     const { connectionStatus } = useCurrentWallet();
    const pathname = usePathname();
    const router = useRouter();
    const wasConnected = useRef(false);

    useEffect(() => {
        if (connectionStatus === 'connected') {
            wasConnected.current = true;
        } else if (wasConnected.current && connectionStatus === 'disconnected') {
            wasConnected.current = false;
            router.push('/');
        }
    }, [connectionStatus, router]);
    return (
        <nav id="top-navbar" className="fixed top-0 left-0 w-full h-16 z-50 backdrop-blur-lg bg-foreground/5 flex items-center justify-between px-6">
            <div className="flex items-center gap-6">
                <Link href="/" className="text-xl font-bold inline-flex items-center gap-2">
                    <Image src="/favicon.png" alt="iSafe" width={20} height={20} className="rounded-sm" />
                    iSafe
                </Link>
                {isafeAccount && (
                    <div className="flex items-center gap-1">
                        <Link 
                            href={`/${isafeAccount}`} 
                            className={clsx(
                                'text-sm font-medium transition px-3 py-2 rounded-md',
                                pathname === `/${isafeAccount}` 
                                    ? 'bg-foreground text-background' 
                                    : 'hover:bg-foreground/10'
                            )}
                        >
                            Overview
                        </Link>
                        <Link 
                            href={`/${isafeAccount}/transactions`} 
                            className={clsx(
                                'text-sm font-medium transition px-3 py-2 rounded-md',
                                pathname === `/${isafeAccount}/transactions` 
                                    ? 'bg-foreground text-background' 
                                    : 'hover:bg-foreground/10'
                            )}
                        >
                            Transactions
                        </Link>
                        <Link 
                            href={`/${isafeAccount}/settings`} 
                            className={clsx(
                                'text-sm font-medium transition px-3 py-2 rounded-md',
                                pathname === `/${isafeAccount}/settings` 
                                    ? 'bg-foreground text-background' 
                                    : 'hover:bg-foreground/10'
                            )}
                        >
                            Settings
                        </Link>
                        <Link 
                            href="/create" 
                            className={clsx(
                                'text-sm font-medium transition px-3 py-2 rounded-md',
                                pathname === '/create' 
                                    ? 'bg-foreground text-background' 
                                    : 'hover:bg-foreground/10'
                            )}
                        >
                            Create
                        </Link>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-4">
                <Link
                    href="/address-book"
                    className={clsx(
                        'flex items-center gap-1.5 px-3 py-2 rounded-md transition',
                        pathname === '/address-book'
                            ? 'bg-foreground text-background'
                            : 'text-foreground/60 hover:text-foreground hover:bg-foreground/10'
                    )}
                    title="Address Book"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        <rect x="2" y="3" width="20" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v18" />
                    </svg>
                    <span className="text-sm font-medium">My Address Book</span>
                </Link>
                {connectionStatus=='connected' && <div className="w-48">
                    <AccountSelector />
                </div>}
                <ConnectButton connectText="Connect Wallet" />
            </div>
        </nav>
    );
}