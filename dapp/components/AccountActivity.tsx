import { useGetAccountEvents } from '@/hooks/useGetAccountEvents';
import React from 'react';
import { EventItem, getEventTypeVisual } from './EventItem';
import { IsafeEvent } from '@/lib/clients/IsafeIndexerClient';


interface AccountActivityProps {
  accountAddress: string;
}

export function AccountActivity({ accountAddress }: AccountActivityProps) {
    const [selectedFilters, setSelectedFilters] = React.useState<Set<IsafeEvent['eventType']>>(new Set());
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);
    const filterContainerRef = React.useRef<HTMLDivElement | null>(null);

    const eventTypes: Array<{ type: IsafeEvent['eventType']; label: string }> = [
        { type: 'AccountCreatedEvent', label: 'Account Created' },
        { type: 'AccountRotatedEvent', label: 'Account Rotated' },
        { type: 'MemberAddedEvent', label: 'Member Added' },
        { type: 'MemberRemovedEvent', label: 'Member Removed' },
        { type: 'ThresholdChangedEvent', label: 'Threshold Changed' },
        { type: 'MemberWeightUpdatedEvent', label: 'Weight Updated' },
        { type: 'GuardianChangedEvent', label: 'Guardian Changed' },
        { type: 'TransactionProposedEvent', label: 'TX Proposed' },
        { type: 'TransactionApprovedEvent', label: 'TX Approved' },
        { type: 'TransactionApprovalThresholdReachedEvent', label: 'TX Threshold Reached' },
        { type: 'TransactionApprovalThresholdLostEvent', label: 'TX Threshold Lost' },
        { type: 'TransactionExecutedEvent', label: 'TX Executed' },
        { type: 'TransactionRemovedEvent', label: 'TX Removed' },
    ];

    const toggleFilter = (type: IsafeEvent['eventType']) => {
        const newFilters = new Set(selectedFilters);
        if (newFilters.has(type)) {
            newFilters.delete(type);
        } else {
            newFilters.add(type);
        }
        setSelectedFilters(newFilters);
    };

    const clearFilters = () => {
        setSelectedFilters(new Set());
    };

    React.useEffect(() => {
        if (!isFilterOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const targetNode = event.target as Node | null;
            if (!targetNode) return;
            if (filterContainerRef.current && !filterContainerRef.current.contains(targetNode)) {
                setIsFilterOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFilterOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFilterOpen]);

    const { data: events, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetAccountEvents(accountAddress);

    const filteredEvents = selectedFilters.size > 0
        ? ( events ?? []).filter(event => selectedFilters.has(event.eventType))
        : events;
    const sortedEvents = [...(filteredEvents ?? [])].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    if (isPending) {
        return (
            <div className="bg-background/80 backdrop-blur rounded-lg border border-foreground/10 p-5">
                <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-4">Activity</h3>
                <div className="text-center py-8 text-foreground/60">
                    <svg className="w-8 h-8 mx-auto mb-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p>Loading events...</p>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="bg-background/80 backdrop-blur rounded-lg border border-foreground/10 p-5">
                <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-4">Activity</h3>
                <div className="text-center py-8 text-red-500">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p>Failed to load events: {error?.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background/80 backdrop-blur rounded-lg border border-foreground/10 p-5">
            <div className="flex items-start justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">Activity</h3>
                
                {/* Filter Button */}
                <div className="relative" ref={filterContainerRef}>
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-md text-sm font-medium text-foreground/80 transition"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filter
                        {selectedFilters.size > 0 && (
                            <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-xs font-bold">
                                {selectedFilters.size}
                            </span>
                        )}
                    </button>

                    {/* Filter Dropdown */}
                    {isFilterOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-background border border-foreground/20 rounded-lg shadow-xl z-50">
                            <div className="p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold">Event Types</span>
                                    {selectedFilters.size > 0 && (
                                        <button
                                            onClick={clearFilters}
                                            className="text-xs text-foreground/60 hover:text-foreground transition"
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>
                                <div className="scrollbar-theme space-y-2 max-h-80 overflow-y-scroll pr-1">
                                    {eventTypes.map(({ type, label }) => {
                                        const visual = getEventTypeVisual(type);
                                        return (
                                        <label
                                            key={type}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-foreground/5 rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedFilters.has(type)}
                                                onChange={() => toggleFilter(type)}
                                                className="rounded border-foreground/20"
                                            />
                                            <span
                                                className={`w-7 h-7 rounded-md ${visual.accent.iconBg} ${visual.accent.iconFg} border border-foreground/10 flex items-center justify-center`}
                                            >
                                                {visual.icon}
                                            </span>
                                            <span className="text-sm flex-1">{label}</span>
                                        </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="scrollbar-theme space-y-2 h-72 overflow-y-scroll pr-1">
                {sortedEvents && sortedEvents.length > 0 ? (
                    <>
                        {sortedEvents.map((event) => (
                            <EventItem key={event.firedInTx+event.eventType+event.timestamp.getMilliseconds()} event={event} />
                        ))}
                        {hasNextPage && (
                            <div className="flex justify-center py-2">
                                <button
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    className="px-4 py-2 text-sm font-medium bg-foreground/10 hover:bg-foreground/15 text-foreground rounded-lg transition disabled:opacity-50"
                                >
                                    {isFetchingNextPage ? "Loading..." : "Load More Events"}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-8 text-foreground/60">
                        <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>{selectedFilters.size > 0 ? 'No events match the selected filters' : 'No history events found'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};