import { useEffect, useCallback, useRef } from 'react';
import { socketService, SocketEvents } from '../services/socket';
import { TestRun, TestRunListItem } from '../types/testManager';

interface UseRealtimeTestRunsOptions {
    projectId: string | null;
    setTestRuns: React.Dispatch<React.SetStateAction<TestRunListItem[]>>;
    setExecuteRun?: React.Dispatch<React.SetStateAction<TestRun | null>>;
    /**
     * Mirror of the list the page is holding. Socket handlers run outside
     * React, so they need it to tell a duplicate event from a real change
     * before the page's "Loaded X / Y" counters are adjusted.
     */
    runsRef: React.RefObject<TestRunListItem[]>;
    /**
     * True while the view has no server-side filter narrowing it.
     *
     * A filtered list is the server's answer. Guessing whether a freshly
     * created run belongs in it (search, group subtree, ticket counts) would
     * be wrong more often than right, so those pushes are skipped entirely
     * and the next fetch reconciles the totals.
     */
    isUnfilteredView: boolean;
    /** The list really gained a run — bump the loaded count and the total. */
    onRunAdded: () => void;
    /** The list really lost a run — drop the loaded count and the total. */
    onRunRemoved: () => void;
}

export const useRealtimeTestRuns = ({
    projectId,
    setTestRuns,
    setExecuteRun,
    runsRef,
    isUnfilteredView,
    onRunAdded,
    onRunRemoved
}: UseRealtimeTestRunsOptions) => {
    // Track if listeners are set up
    const listenersSetup = useRef(false);

    const handleTestRunCreated = useCallback((data: SocketEvents['testrun:created']) => {
        if (!isUnfilteredView) return;

        // Convert TestRun to TestRunListItem (simplified mapping)
        const newItem: TestRunListItem = {
            id: data.testRun.id,
            title: data.testRun.title,
            description: data.testRun.description,
            projectId: data.testRun.projectId,
            suiteId: data.testRun.suiteId,
            suiteName: data.testRun.suiteName,
            status: data.testRun.status,
            environment: data.testRun.environment,
            tags: data.testRun.tags,
            itemCount: data.testRun.items.length,
            createdBy: data.testRun.createdBy,
            startedAt: data.testRun.startedAt,
            completedAt: data.testRun.completedAt,
            resultsSummary: data.testRun.resultsSummary,
            groupId: data.testRun.groupId,
            createdAt: data.testRun.createdAt,
            updatedAt: data.testRun.updatedAt,
        };

        // An echo of a run the page already inserted (just created through the
        // UI) must not be counted a second time.
        if (runsRef.current.some((run) => run.id === newItem.id)) return;

        setTestRuns((prev) => {
            if (prev.some((run) => run.id === newItem.id)) {
                return prev;
            }
            return [newItem, ...prev];
        });
        onRunAdded();
    }, [isUnfilteredView, runsRef, setTestRuns, onRunAdded]);

    const handleTestRunUpdated = useCallback((data: SocketEvents['testrun:updated']) => {
        setTestRuns(prev => prev.map(run => {
            if (run.id === data.testRun.id) {
                // Update list item properties
                return {
                    ...run,
                    title: data.testRun.title,
                    description: data.testRun.description,
                    status: data.testRun.status,
                    resultsSummary: data.testRun.resultsSummary,
                    updatedAt: data.testRun.updatedAt,
                    startedAt: data.testRun.startedAt,
                    completedAt: data.testRun.completedAt,
                    groupId: data.testRun.groupId,
                    // Update other fields as necessary
                };
            }
            return run;
        }));

        if (setExecuteRun) {
            setExecuteRun(prev => {
                if (prev && prev.id === data.testRun.id) {
                    return data.testRun;
                }
                return prev;
            });
        }
    }, [setTestRuns, setExecuteRun]);

    const handleTestRunDeleted = useCallback((data: SocketEvents['testrun:deleted']) => {
        // Only count it as a removal if the list actually held it; an event for
        // a run this view never showed would otherwise shrink the total.
        const wasPresent = runsRef.current.some((run) => run.id === data.testRunId);

        setTestRuns(prev => prev.filter(run => run.id !== data.testRunId));

        if (wasPresent) {
            onRunRemoved();
        }

        if (setExecuteRun) {
            setExecuteRun(prev => {
                if (prev && prev.id === data.testRunId) {
                    return null; // Close modal if run is deleted
                }
                return prev;
            });
        }
    }, [runsRef, setTestRuns, onRunRemoved, setExecuteRun]);

    const handleTestRunItemUpdated = useCallback((data: SocketEvents['testrun:item-updated']) => {
        // We only need to update the executeRun state here, 
        // as the list view updates come via testrun:updated (which contains summary stats)
        // However, we might want to update stats optimistically in the list view if we wanted to be very granular.
        // But for now, relying on testrun:updated for list stats is safer.
        
        if (setExecuteRun) {
            setExecuteRun(prev => {
                if (prev && prev.id === data.testRunId) {
                    const newItems = prev.items.map(item => {
                        if (item.id === data.itemId) {
                            return {
                                ...item,
                                status: data.status,
                                actualResult: data.actualResult || item.actualResult
                            };
                        }
                        return item;
                    });
                    
                    return {
                        ...prev,
                        items: newItems,
                        resultsSummary: data.resultsSummary
                    };
                }
                return prev;
            });
        }
    }, [setExecuteRun]);

    useEffect(() => {
        if (!projectId) return;

        // Ensure socket connection
        if (!socketService.isConnected()) {
            socketService.connect();
        }
        
        // Join project room
        socketService.joinProject(projectId);

        if (!listenersSetup.current) {
            socketService.on('testrun:created', handleTestRunCreated);
            socketService.on('testrun:updated', handleTestRunUpdated);
            socketService.on('testrun:deleted', handleTestRunDeleted);
            socketService.on('testrun:item-updated', handleTestRunItemUpdated);
            listenersSetup.current = true;
        }

        return () => {
            if (listenersSetup.current) {
                socketService.off('testrun:created', handleTestRunCreated);
                socketService.off('testrun:updated', handleTestRunUpdated);
                socketService.off('testrun:deleted', handleTestRunDeleted);
                socketService.off('testrun:item-updated', handleTestRunItemUpdated);
                listenersSetup.current = false;
            }
            // We don't leave project here as it might be used by other components
        };
    }, [projectId, handleTestRunCreated, handleTestRunUpdated, handleTestRunDeleted, handleTestRunItemUpdated]);
};
