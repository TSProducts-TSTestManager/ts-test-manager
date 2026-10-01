import React, { useMemo } from 'react';
import {
    Archive,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Folder,
    FolderInput,
    FolderOpen,
    FolderPlus,
    Pencil,
    RotateCcw,
    Trash2,
} from 'lucide-react';
import { SuiteNodeSource, SuiteTreeNode, suitePathLabel } from '../../utils/suiteTree';
import { TestSuite } from '../../types/testManager';

export interface SuiteFolderTableProps {
    nodes: SuiteTreeNode<TestSuite>[];
    /** The flat suite list, used to resolve each row's `Owner / Login` path. */
    allSuites: SuiteNodeSource[];
    expandedIds: Set<string>;
    onToggleExpand: (suiteId: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;

    /** Open a folder: navigates to the test cases inside it. */
    onOpen: (suite: TestSuite) => void;
    onCreateInside: (parentId: string | null) => void;
    onEdit: (suite: TestSuite) => void;
    onMove: (suite: TestSuite) => void;
    /** Called instead of onArchive while the Archived view is showing. */
    onRestore?: (suite: TestSuite) => void;
    onArchive: (suite: TestSuite) => void;
    onDelete: (suite: TestSuite) => void;
    /** Archived view swaps the archive action for restore. */
    archivedScope?: boolean;

    selectedIds: string[];
    onToggleSelect: (suiteId: string) => void;
    onSelectAll: (checked: boolean, visibleIds: string[]) => void;

    emptyState?: { title: string; description: string };
}

/** Indentation is rendered as explicit guide lines, one per nesting level. */

const formatUpdated = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ActionButton: React.FC<{
    label: string;
    onClick: () => void;
    danger?: boolean;
    children: React.ReactNode;
}> = ({ label, onClick, danger = false, children }) => (
    <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        className={`p-1.5 rounded-md transition-colors ${
            danger
                ? 'text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
        }`}
    >
        {children}
    </button>
);

/**
 * The Test Suites screen: the folder hierarchy as the only view.
 *
 * This replaces the old folder-sidebar-plus-flat-list layout, where six rows
 * named "Login" sat side by side with no way to tell which folder each belonged
 * to. Here the nesting *is* the table — indentation and guide lines carry the
 * structure, and each row shows the test cases it holds.
 *
 * A count is rendered only for rows that actually have cases; an empty folder
 * shows a muted dash so the column stays aligned without adding noise.
 */
const SuiteFolderTable: React.FC<SuiteFolderTableProps> = ({
    nodes,
    allSuites,
    expandedIds,
    onToggleExpand,
    onExpandAll,
    onCollapseAll,
    onOpen,
    onCreateInside,
    onEdit,
    onMove,
    onRestore,
    onArchive,
    onDelete,
    archivedScope = false,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    emptyState,
}) => {
    /** Every node, depth first, so the header checkbox covers what is on screen. */
    const visibleIds = useMemo(() => {
        const walk = (items: SuiteTreeNode<TestSuite>[]): string[] =>
            items.flatMap((node) => [node.suite.id, ...walk(node.children)]);
        return walk(nodes);
    }, [nodes]);

    const folderCount = visibleIds.length;
    const caseTotal = useMemo(
        () =>
            nodes.reduce((sum, node) => sum + node.totalCaseCount, 0),
        [nodes]
    );
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    const someSelected = visibleIds.some((id) => selectedIds.includes(id));

    if (folderCount === 0) {
        if (emptyState) {
            return (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                        <Folder className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {emptyState.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                        {emptyState.description}
                    </p>
                </div>
            );
        }
        return null;
    }

    const renderRows = (items: SuiteTreeNode<TestSuite>[]): React.ReactNode[] =>
        items.flatMap((node) => {
            const { suite, children, depth } = node;
            const hasChildren = children.length > 0;
            const isExpanded = expandedIds.has(suite.id);
            const isSelected = selectedIds.includes(suite.id);

            // Rolled up: cases in this node plus every folder beneath it, which
            // is the number that answers "where is the work in this branch".
            const total = node.totalCaseCount;
            const own = suite.caseCount ?? 0;
            const hasCases = total > 0;
            const mixed = own > 0 && children.some((child) => child.totalCaseCount > 0);

            const countTitle = hasCases
                ? mixed
                    ? `${total} test case${total === 1 ? '' : 's'} — ${own} in this folder, ${total - own} in subfolders`
                    : `${total} test case${total === 1 ? '' : 's'}`
                : 'No test cases in this folder or below';

            const row = (
                <tr
                    key={suite.id}
                    data-testid="suite-row"
                    data-suite-id={suite.id}
                    data-depth={depth}
                    className={`group border-b border-gray-100 dark:border-gray-800 transition-colors ${
                        isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                >
                    {/* Select */}
                    <td className="w-10 pl-4 pr-0 py-2.5 align-middle">
                        <input
                            type="checkbox"
                            aria-label={`Select ${suite.name}`}
                            checked={isSelected}
                            onChange={() => onToggleSelect(suite.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800"
                        />
                    </td>

                    {/* Name + hierarchy */}
                    <td className="py-2.5 pr-4 align-middle min-w-0">
                        <div className="flex items-center min-w-0">
                            {/* Guide lines: one per ancestor level. */}
                            {Array.from({ length: depth }).map((_, level) => (
                                <span
                                    key={level}
                                    aria-hidden
                                    className="w-[18px] flex-shrink-0 self-stretch ml-[9px] border-l border-gray-200 dark:border-gray-800"
                                />
                            ))}

                            {hasChildren ? (
                                <button
                                    type="button"
                                    onClick={() => onToggleExpand(suite.id)}
                                    aria-label={isExpanded ? `Collapse ${suite.name}` : `Expand ${suite.name}`}
                                    aria-expanded={isExpanded}
                                    className="p-0.5 mr-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4" />
                                    )}
                                </button>
                            ) : (
                                <span aria-hidden className="w-[18px] mr-1 flex-shrink-0" />
                            )}

                            <button
                                type="button"
                                onClick={() => onOpen(suite)}
                                title={suitePathLabel(allSuites, suite.id)}
                                className="flex items-center gap-2.5 min-w-0 text-left group/name"
                            >
                                {node.isFolderLike ? (
                                    isExpanded ? (
                                        <FolderOpen className="w-4 h-4 flex-shrink-0 text-amber-500/90 dark:text-amber-400/90" />
                                    ) : (
                                        <Folder className="w-4 h-4 flex-shrink-0 text-amber-500/90 dark:text-amber-400/90" />
                                    )
                                ) : (
                                    <FileText className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                                )}
                                <span className="min-w-0">
                                    <span
                                        className={`block truncate text-sm ${
                                            node.isFolderLike
                                                ? 'font-semibold text-gray-900 dark:text-gray-100 group-hover/name:text-blue-700 dark:group-hover/name:text-blue-300'
                                                : 'font-medium text-gray-700 dark:text-gray-300 group-hover/name:text-blue-700 dark:group-hover/name:text-blue-300'
                                        }`}
                                    >
                                        {suite.name}
                                    </span>
                                    {suite.description && (
                                        <span className="block truncate text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                            {suite.description}
                                        </span>
                                    )}
                                </span>
                            </button>
                        </div>
                    </td>

                    {/* Test cases — only when there are some. */}
                    <td className="w-28 py-2.5 pr-3 align-middle">
                        {hasCases ? (
                            <span
                                title={countTitle}
                                data-testid="suite-case-count"
                                className="inline-flex items-center justify-center min-w-[26px] h-6 px-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold tabular-nums"
                            >
                                {total}
                            </span>
                        ) : (
                            <span
                                title={countTitle}
                                aria-label="No test cases"
                                className="text-gray-300 dark:text-gray-600"
                            >
                                —
                            </span>
                        )}
                    </td>

                    {/* Updated */}
                    <td className="w-32 py-2.5 pr-3 align-middle text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatUpdated(suite.updatedAt)}
                    </td>

                    {/* Actions — revealed on hover so the columns stay calm. */}
                    <td className="w-40 py-2.5 pr-4 align-middle">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <ActionButton
                                label={`New folder inside ${suite.name}`}
                                onClick={() => onCreateInside(suite.id)}
                            >
                                <FolderPlus className="w-4 h-4" />
                            </ActionButton>
                            <ActionButton label={`Move ${suite.name}`} onClick={() => onMove(suite)}>
                                <FolderInput className="w-4 h-4" />
                            </ActionButton>
                            <ActionButton label={`Rename ${suite.name}`} onClick={() => onEdit(suite)}>
                                <Pencil className="w-4 h-4" />
                            </ActionButton>
                            {archivedScope && onRestore ? (
                                <ActionButton
                                    label={`Restore ${suite.name}`}
                                    onClick={() => onRestore(suite)}
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </ActionButton>
                            ) : (
                                <ActionButton
                                    label={`Archive ${suite.name}`}
                                    onClick={() => onArchive(suite)}
                                >
                                    <Archive className="w-4 h-4" />
                                </ActionButton>
                            )}
                            <ActionButton
                                label={`Delete ${suite.name}`}
                                danger
                                onClick={() => onDelete(suite)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </ActionButton>
                        </div>
                    </td>
                </tr>
            );

            return hasChildren && isExpanded ? [row, ...renderRows(children)] : [row];
        });

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-baseline gap-2.5 min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Folder structure
                    </h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {folderCount} folder{folderCount === 1 ? '' : 's'}
                        {caseTotal > 0 && (
                            <>
                                {' · '}
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {caseTotal} test case{caseTotal === 1 ? '' : 's'}
                                </span>
                            </>
                        )}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onExpandAll}
                        title="Expand every folder in this project"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                        <ChevronsUpDown className="w-3.5 h-3.5" />
                        Expand all
                    </button>
                    <button
                        type="button"
                        onClick={onCollapseAll}
                        title="Collapse every folder in this project"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                        <ChevronsDownUp className="w-3.5 h-3.5" />
                        Collapse all
                    </button>
                    <button
                        type="button"
                        onClick={() => onCreateInside(null)}
                        className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                        <FolderPlus className="w-4 h-4" />
                        New Folder
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full border-collapse" data-testid="suite-folder-table">
                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900/95 backdrop-blur">
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th scope="col" className="w-10 pl-4 pr-0 py-2.5">
                                <input
                                    type="checkbox"
                                    aria-label="Select all folders"
                                    checked={allSelected}
                                    ref={(el) => {
                                        if (el) el.indeterminate = !allSelected && someSelected;
                                    }}
                                    onChange={(e) => onSelectAll(e.target.checked, visibleIds)}
                                    className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800"
                                />
                            </th>
                            <th
                                scope="col"
                                className="py-2.5 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                            >
                                Name
                            </th>
                            <th
                                scope="col"
                                className="w-28 py-2.5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                            >
                                Test cases
                            </th>
                            <th
                                scope="col"
                                className="w-32 py-2.5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                            >
                                Updated
                            </th>
                            <th scope="col" className="w-40 py-2.5 pr-4">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>{renderRows(nodes)}</tbody>
                </table>
            </div>
        </div>
    );
};

export default SuiteFolderTable;
