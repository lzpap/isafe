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
                {connectionStatus=='connected' && <div className="w-48">
                    <AccountSelector />
                </div>}
                <ConnectButton connectText="Connect Wallet" />
            </div>
        </nav>
    );
}