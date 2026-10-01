import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Search, X } from 'lucide-react';
import { TestSuite } from '../../types/testManager';
import SuiteTree from './SuiteTree';
import { buildSuiteTree, filterSuiteTree } from '../../utils/suiteTree';

interface TestSuiteSidebarProps {
    testSuites: TestSuite[];
    activeSuiteId: string | null;
    projectCaseCount: number;
    onSuiteSelect: (suiteId: string | null) => void;
    onCreateSuite?: () => void;
    isMobile?: boolean;
    onClose?: () => void;
}

const TestSuiteSidebar: React.FC<TestSuiteSidebarProps> = ({
    testSuites,
    activeSuiteId,
    projectCaseCount,
    onSuiteSelect,
    onCreateSuite,
    isMobile = false,
    onClose,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    // Folders the user opened. The tree is the main way to navigate, so it is
    // kept in component state rather than reset on every project load.
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Open the active node and its ancestors so the selected row is on screen.
    useEffect(() => {
        if (!activeSuiteId) return;
        setExpandedIds((prev) => {
            const byId = new Map(testSuites.map((suite) => [suite.id, suite]));
            const next = new Set(prev);
            next.add(activeSuiteId);
            let parentId = byId.get(activeSuiteId)?.parentId ?? null;
            while (parentId && !next.has(parentId)) {
                next.add(parentId);
                parentId = byId.get(parentId)?.parentId ?? null;
            }
            return next;
        });
    }, [activeSuiteId, testSuites]);

    const tree = useMemo(() => buildSuiteTree(testSuites), [testSuites]);
    const visibleTree = useMemo(
        () => filterSuiteTree(tree, searchQuery),
        [tree, searchQuery]
    );

    const toggleExpand = (suiteId: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(suiteId)) {
                next.delete(suiteId);
            } else {
                next.add(suiteId);
            }
            return next;
        });
    };

    return (
        <div
            className={`${isMobile ? 'w-full h-full' : 'w-56 flex-shrink-0'} bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 h-full flex flex-col select-none`}
        >
            {/* Header */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Suites &amp; Folders
                </h3>
                <div className="flex items-center gap-1">
                    {onCreateSuite && (
                        <button
                            onClick={onCreateSuite}
                            className={`${isMobile ? 'p-2' : 'p-0.5'} rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
                            title="Create new suite or folder"
                            aria-label="Create new suite or folder"
                        >
                            <Plus size={14} />
                        </button>
                    )}
                    {isMobile && onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 flex items-center justify-center h-10 w-10 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Close"
                            aria-label="Close test suites"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="px-2 pb-2">
                <div className="relative group">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 group-focus-within:text-gray-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search suites"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full bg-gray-200/60 hover:bg-gray-200/80 focus:bg-white dark:bg-gray-700/60 dark:hover:bg-gray-700/80 dark:focus:bg-gray-700 border border-transparent focus:border-blue-400/50 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-900/40 text-sm rounded-md pl-7 pr-6 transition-all outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400 dark:text-gray-300 ${
                            isMobile ? 'py-2' : 'py-1'
                        }`}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            aria-label="Clear suite search"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-300/60 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Folder tree */}
            <div className="flex-1 overflow-y-auto px-2 pb-3">
                {/* All Cases - always visible */}
                <button
                    onClick={() => onSuiteSelect(null)}
                    className={`w-full flex items-center gap-2.5 px-3 rounded-lg text-sm transition-colors ${
                        isMobile ? 'py-2.5' : 'py-2'
                    } ${
                        activeSuiteId === null
                            ? 'bg-system-blue text-white font-medium shadow-sm dark:bg-system-darkBlue'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700/60'
                    }`}
                >
                    <Layers
                        size={15}
                        className={
                            activeSuiteId === null ? 'text-white' : 'text-gray-400 dark:text-gray-500'
                        }
                        strokeWidth={2}
                    />
                    <span className="flex-1 text-left truncate">All Cases</span>
                    <span
                        className={`text-xs tabular-nums ${
                            activeSuiteId === null
                                ? 'text-white/80'
                                : 'text-gray-400 dark:text-gray-500'
                        }`}
                    >
                        {projectCaseCount}
                    </span>
                </button>

                {/* Divider */}
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-1.5 mx-1" />

                {visibleTree.length > 0 ? (
                    <SuiteTree
                        nodes={visibleTree}
                        activeSuiteId={activeSuiteId}
                        onSelect={onSuiteSelect}
                        expandedIds={expandedIds}
                        onToggleExpand={toggleExpand}
                        isMobile={isMobile}
                    />
                ) : (
                    <>
                        {searchQuery && (
                            <div className="px-3 py-4 text-center">
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    No suites match "{searchQuery}"
                                </p>
                            </div>
                        )}
                        {!searchQuery && testSuites.length === 0 && (
                            <div className="px-3 py-6 text-center">
                                <p className="text-xs text-gray-400 dark:text-gray-500">No suites yet</p>
                                {onCreateSuite && (
                                    <button
                                        onClick={onCreateSuite}
                                        className="mt-2 text-xs text-system-blue hover:underline dark:text-blue-400"
                                    >
                                        Create your first suite
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default TestSuiteSidebar;
