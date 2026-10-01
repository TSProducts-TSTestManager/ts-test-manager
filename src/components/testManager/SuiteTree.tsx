import React from 'react';
import {
    ChevronDown,
    ChevronRight,
    Folder,
    FolderOpen,
    Layers,
} from 'lucide-react';
import { SuiteNodeSource, SuiteTreeNode } from '../../utils/suiteTree';
import { checkboxState, SuiteSelectionState } from '../../utils/suiteSelection';

export type { SuiteSelectionState };

export interface SuiteTreeProps<T extends SuiteNodeSource = SuiteNodeSource> {
    nodes: SuiteTreeNode<T>[];
    /** Currently open node, or null for "all cases". */
    activeSuiteId: string | null;
    onSelect: (suiteId: string) => void;
    expandedIds: Set<string>;
    onToggleExpand: (suiteId: string) => void;

    /**
     * Optional case-selection mode used by the run builder: rows grow a
     * tri-state checkbox whose state is derived from the cases underneath.
     */
    selectable?: boolean;
    selectedCaseIds?: Set<string>;
    /** Every case stored directly in this node. */
    casesUnder?: (node: SuiteTreeNode<T>) => string[];
    onToggleSelect?: (node: SuiteTreeNode<T>, select: boolean) => void;

    /** Row actions rendered at the end of each row. */
    renderActions?: (node: SuiteTreeNode<T>) => React.ReactNode;

    isMobile?: boolean;
}

/** Indent per level, matching the run-groups sidebar. */
const INDENT_BASE = 6;
const INDENT_STEP = 14;

function SuiteTree<T extends SuiteNodeSource = SuiteNodeSource>({
    nodes,
    activeSuiteId,
    onSelect,
    expandedIds,
    onToggleExpand,
    selectable = false,
    selectedCaseIds,
    casesUnder,
    onToggleSelect,
    renderActions,
    isMobile = false,
}: SuiteTreeProps<T>) {
    const renderNodes = (items: SuiteTreeNode<T>[]) =>
        items.map((node) => {
            const hasChildren = node.children.length > 0;
            const isExpanded = expandedIds.has(node.suite.id);
            const isActive = activeSuiteId === node.suite.id;
            // One `casesUnder` call per node, reused for both the checkbox state
            // and whether the row has anything selectable at all.
            const caseIdsUnderNode = selectable && casesUnder ? casesUnder(node) : [];
            const state =
                selectable && selectedCaseIds
                    ? checkboxState(caseIdsUnderNode, selectedCaseIds)
                    : 'none';
            const total = node.totalCaseCount;

            return (
                <div key={node.suite.id}>
                    <div
                        className={`group relative flex items-center gap-1.5 pr-2 rounded-lg transition-colors ${
                            renderActions && !isMobile ? 'group-hover:pr-28 focus-within:pr-28' : ''
                        } ${
                            isActive
                                ? 'bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        style={{ paddingLeft: `${INDENT_BASE + node.depth * INDENT_STEP}px` }}
                    >
                        {selectable && (
                            <input
                                type="checkbox"
                                aria-label={`Select ${node.suite.name}`}
                                checked={state === 'all'}
                                ref={(el) => {
                                    if (el) el.indeterminate = state === 'partial';
                                }}
                                onChange={(e) => onToggleSelect?.(node, e.target.checked)}
                                disabled={caseIdsUnderNode.length === 0}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                        )}

                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={() => onToggleExpand(node.suite.id)}
                                aria-label={isExpanded ? `Collapse ${node.suite.name}` : `Expand ${node.suite.name}`}
                                aria-expanded={isExpanded}
                                className="p-0.5 -ml-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 cursor-pointer"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                )}
                            </button>
                        ) : (
                            <div className="w-4 flex-shrink-0" />
                        )}

                        <button
                            type="button"
                            onClick={() => onSelect(node.suite.id)}
                            title={node.suite.name}
                            className="flex-1 flex items-center gap-1.5 min-w-0 text-left py-2"
                        >
                            {node.isFolderLike ? (
                                isExpanded ? (
                                    <FolderOpen className="w-4 h-4 flex-shrink-0 text-blue-400/80 dark:text-blue-500/80" />
                                ) : (
                                    <Folder className="w-4 h-4 flex-shrink-0 text-blue-400/80 dark:text-blue-500/80" />
                                )
                            ) : (
                                <Layers className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                            )}
                            <span
                                className={`text-sm truncate ${
                                    isActive
                                        ? 'font-medium text-gray-900 dark:text-gray-100'
                                        : 'text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                {node.suite.name}
                            </span>
                        </button>

                        {total > 0 && (
                            <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500 flex-shrink-0">
                                {total}
                            </span>
                        )}

                        {/*
                          Row actions float over the row instead of sitting in
                          the flex flow: keeping them in flow reserved their
                          width on every row, which truncated folder names to
                          a few characters even in a wide sidebar.
                        */}
                        {renderActions && (
                            <div
                                className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-md bg-inherit ${
                                    isMobile
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                                } transition-opacity`}
                            >
                                {renderActions(node)}
                            </div>
                        )}
                    </div>

                    {hasChildren && isExpanded && renderNodes(node.children)}
                </div>
            );
        });

    return <div className="space-y-0.5">{renderNodes(nodes)}</div>;
}

export default SuiteTree;

/** Shared row-actions wrapper so list rows and tree rows look the same. */
export const SuiteTreeActionButton: React.FC<{
    label: string;
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
}> = ({ label, onClick, children, danger = false }) => (
    <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        className={`p-1 rounded transition-colors ${
            danger
                ? 'text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
        }`}
    >
        {children}
    </button>
);
