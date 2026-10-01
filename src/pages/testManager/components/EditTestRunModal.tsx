import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { TestCase, TestRunListItem, TestRunGroup } from '../../../types/testManager';
import TagInput from '../../../components/testManager/TagInput';
import { getIndentedGroupOptions } from './testRunUtils';
import { testRunApi } from '../../../services/testRunApi';
import {
    buildSuiteTree,
    flattenSuiteTree,
    suitePathLabel,
    SuiteNodeSource,
    SuiteTreeNode,
} from '../../../utils/suiteTree';
import {
    Plus,
    Minus,
    ChevronDown,
    ChevronRight,
    Folder,
    Search,
    Inbox,
    CheckCircle2,
    Layers,
} from 'lucide-react';

export interface EditTestRunModalProps {
    isOpen: boolean;
    onClose: () => void;
    testRun: TestRunListItem | null;
    testRunGroups: TestRunGroup[];
    testCases: TestCase[];
    /** Flat suite list; `parentId` drives the folder grouping. */
    testSuites: SuiteNodeSource[];
    onSubmit: (
        runId: string,
        data: {
            title: string;
            groupId: string | null;
            tags: string[];
            environment?: string;
            team?: string;
            buildVersion?: string;
            additionalTestCaseIds?: string[];
            removedTestCaseIds?: string[];
        }
    ) => Promise<void>;
    tagSuggestions: string[];
}

/** A case row in either column. */
interface CaseRow {
    testCase: TestCase;
    /** Set when this dialog changes the case state, i.e. it is a pending edit. */
    pending?: boolean;
}

/** Cases of one folder, ready to render. */
interface FolderGroup {
    id: string;
    name: string;
    /** `Owner / Login` — used for the row's accessible name. */
    path: string;
    depth: number;
    rows: CaseRow[];
}

const NO_FOLDER_ID = '__no_folder__';

const EditTestRunModal: React.FC<EditTestRunModalProps> = ({
    isOpen,
    onClose,
    testRun,
    testRunGroups,
    testCases,
    testSuites,
    onSubmit,
    tagSuggestions,
}) => {
    const [title, setTitle] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [tags, setTags] = useState<string[]>([]);
    const [environment, setEnvironment] = useState('');
    const [team, setTeam] = useState('');
    const [buildVersion, setBuildVersion] = useState('');
    const [isLoadingRunDetails, setIsLoadingRunDetails] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [search, setSearch] = useState('');
    /** Folder ids the user collapsed in the Available column. */
    const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());

    /** Ids currently in the run, and the ones this dialog is adding/removing. */
    const [savedCaseIds, setSavedCaseIds] = useState<string[]>([]);
    const [toAssign, setToAssign] = useState<Set<string>>(new Set());
    const [toUnassign, setToUnassign] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (testRun) {
            setTitle(testRun.title);
            setSelectedGroupId(testRun.groupId || '');
            setTags(testRun.tags || []);
            setEnvironment(testRun.environment || '');
            setTeam(testRun.team || '');
            setBuildVersion(testRun.buildVersion || '');
            setSearch('');
            setCollapsedFolderIds(new Set());
            setToAssign(new Set());
            setToUnassign(new Set());
        }
    }, [testRun]);

    useEffect(() => {
        const loadRunDetails = async () => {
            if (!isOpen || !testRun) return;

            setIsLoadingRunDetails(true);
            try {
                const fullRun = await testRunApi.getTestRun(testRun.id);
                setSavedCaseIds(fullRun.items.map((item) => item.caseId));
            } catch (error: unknown) {
                toast.error((error as Error).message || 'Failed to load run details');
                setSavedCaseIds([]);
            } finally {
                setIsLoadingRunDetails(false);
            }
        };

        loadRunDetails();
    }, [isOpen, testRun]);

    // A case is in the run if it was saved there, unless this dialog unassigned
    // it; and it is out unless this dialog assigned it.
    const isAssigned = (caseId: string) => {
        if (toUnassign.has(caseId)) return false;
        if (toAssign.has(caseId)) return true;
        return savedCaseIds.includes(caseId);
    };

    const matchesSearch = (testCase: TestCase) => {
        const needle = search.trim().toLowerCase();
        if (!needle) return true;
        return (
            testCase.title.toLowerCase().includes(needle) ||
            (testCase.suite || '').toLowerCase().includes(needle) ||
            (testCase.area || '').toLowerCase().includes(needle)
        );
    };

    const availableCases = useMemo(
        () => testCases.filter((testCase) => !isAssigned(testCase.id) && matchesSearch(testCase)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [testCases, savedCaseIds, toAssign, toUnassign, search]
    );

    const assignedCases = useMemo(
        () => testCases.filter((testCase) => isAssigned(testCase.id) && matchesSearch(testCase)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [testCases, savedCaseIds, toAssign, toUnassign, search]
    );

    /**
     * Available cases grouped by folder, in tree order, with a folder that has
     * nothing left to assign left out entirely.
     */
    const availableGroups = useMemo<FolderGroup[]>(() => {
        const byFolder = new Map<string, CaseRow[]>();
        for (const testCase of availableCases) {
            const key = testCase.suiteId || NO_FOLDER_ID;
            const row: CaseRow = {
                testCase,
                pending: toAssign.has(testCase.id),
            };
            const bucket = byFolder.get(key);
            if (bucket) bucket.push(row);
            else byFolder.set(key, [row]);
        }

        const groups: FolderGroup[] = [];
        const seen = new Set<string>();
        for (const node of flattenSuiteTree(buildSuiteTree(testSuites)) as SuiteTreeNode<SuiteNodeSource>[]) {
            const rows = byFolder.get(node.suite.id);
            if (!rows || rows.length === 0) continue;
            seen.add(node.suite.id);
            groups.push({
                id: node.suite.id,
                name: node.suite.name,
                path: suitePathLabel(testSuites, node.suite.id),
                depth: node.depth,
                rows,
            });
        }

        // A case whose folder is not in the list (archived, or filtered out of
        // the project) still has to be reachable, so it gets its own group.
        const orphans = byFolder.get(NO_FOLDER_ID);
        if (orphans && orphans.length > 0) {
            groups.push({
                id: NO_FOLDER_ID,
                name: 'No folder',
                path: 'No folder',
                depth: 0,
                rows: orphans,
            });
        }
        return groups;
    }, [availableCases, testSuites, toAssign]);

    const totalAvailableCount = availableGroups.reduce((sum, group) => sum + group.rows.length, 0);

    if (!isOpen || !testRun) return null;

    /**
     * Stage an assignment. A case that is already in the run needs no
     * "additional" id — the server would ignore it anyway.
     */
    const assign = (caseIds: string[]) => {
        if (caseIds.length === 0) return;
        setToUnassign((prev) => {
            const next = new Set(prev);
            for (const id of caseIds) next.delete(id);
            return next;
        });
        setToAssign((prev) => {
            const next = new Set(prev);
            for (const id of caseIds) {
                if (!savedCaseIds.includes(id)) next.add(id);
            }
            return next;
        });
    };

    /**
     * Stage an un-assignment. A case that was never in the run — only staged
     * for assignment in this dialog — just drops the staged add instead of
     * queueing a removal the server has nothing to match.
     */
    const unassign = (caseIds: string[]) => {
        if (caseIds.length === 0) return;
        setToAssign((prev) => {
            const next = new Set(prev);
            for (const id of caseIds) next.delete(id);
            return next;
        });
        setToUnassign((prev) => {
            const next = new Set(prev);
            for (const id of caseIds) {
                if (savedCaseIds.includes(id)) next.add(id);
            }
            return next;
        });
    };

    const toggleFolder = (folderId: string) => {
        setCollapsedFolderIds((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
    };

    const pendingAssignCount = toAssign.size;
    const pendingUnassignCount = toUnassign.size;
    const hasPendingChanges = pendingAssignCount > 0 || pendingUnassignCount > 0;

    const handleSubmit = async () => {
        if (!title.trim()) {
            toast.error('Title is required');
            return;
        }
        setIsSubmitting(true);
        try {
            await onSubmit(testRun.id, {
                title: title.trim(),
                groupId: selectedGroupId || null,
                tags,
                environment: environment.trim() || undefined,
                team: team.trim() || undefined,
                buildVersion: buildVersion.trim() || undefined,
                additionalTestCaseIds: Array.from(toAssign),
                removedTestCaseIds: Array.from(toUnassign),
            });
            onClose();
        } catch {
            // Error handled by parent
        } finally {
            setIsSubmitting(false);
        }
    };

    const caseRowButton = (
        testCase: TestCase,
        tone: 'assign' | 'unassign',
        onAction: () => void
    ) => (        <button
            type="button"
            onClick={onAction}
            title={
                tone === 'assign'
                    ? `Assign "${testCase.title}"`
                    : `Unassign "${testCase.title}"`
            }
            aria-label={
                tone === 'assign' ? `Assign ${testCase.title}` : `Unassign ${testCase.title}`
            }
            className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${
                tone === 'assign'
                    ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                    : 'text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
            }`}
        >
            {tone === 'assign' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
        </button>
    );

    const renderCaseRow = (row: CaseRow, tone: 'assign' | 'unassign') => (
        <div
            key={row.testCase.id}
            className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/40 ${
                row.pending ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''
            }`}
        >
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {row.testCase.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {row.testCase.suite}
                    {row.testCase.area ? ` • ${row.testCase.area}` : ''}
                </div>
            </div>
            {caseRowButton(row.testCase, tone, () =>
                tone === 'assign' ? assign([row.testCase.id]) : unassign([row.testCase.id])
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div
                className="absolute inset-0 bg-white/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl border border-gray-100 dark:border-gray-700 max-h-[92vh] flex flex-col">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Test Run</h2>
                </div>

                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Run Group</label>
                            <select
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
                            >
                                <option value="">No Group (Ungrouped)</option>
                                {getIndentedGroupOptions(testRunGroups).map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                            <TagInput
                                tags={tags}
                                onChange={setTags}
                                suggestions={tagSuggestions}
                                placeholder="e.g., regression, smoke, sprint-23"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team</label>
                            <input
                                type="text"
                                value={team}
                                onChange={(e) => setTeam(e.target.value)}
                                placeholder="e.g., Payments"
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment</label>
                            <input
                                type="text"
                                value={environment}
                                onChange={(e) => setEnvironment(e.target.value)}
                                placeholder="e.g., staging"
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Build Version</label>
                            <input
                                type="text"
                                value={buildVersion}
                                onChange={(e) => setBuildVersion(e.target.value)}
                                placeholder="e.g., v1.4.2"
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                        </div>
                    </div>

                    {/* Test case assignment */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Test cases in this run
                            </h3>
                            {hasPendingChanges && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Pending:{' '}
                                    <span className="text-blue-600 dark:text-blue-400">
                                        +{pendingAssignCount} assign
                                    </span>
                                    {pendingUnassignCount > 0 && (
                                        <>
                                            {' · '}
                                            <span className="text-red-600 dark:text-red-400">
                                                −{pendingUnassignCount} unassign
                                            </span>
                                        </>
                                    )}
                                </span>
                            )}
                        </div>

                        <div>
                            <label
                                htmlFor="edit-run-search"
                                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                <Search className="w-4 h-4 text-gray-400" />
                                Search cases
                            </label>
                            <input
                                id="edit-run-search"
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Title, suite or area"
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Grouped by folder. Collapsing a folder hides its cases only — nothing
                                is unassigned. Changes apply when you save.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Available — grouped by folder, collapsible */}
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Inbox className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                            Available
                                        </span>
                                        <span className="text-xs tabular-nums px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">
                                            {totalAvailableCount}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            assign(availableGroups.flatMap((g) => g.rows.map((r) => r.testCase.id)))
                                        }
                                        disabled={totalAvailableCount === 0}
                                        className="text-xs font-medium px-2 py-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                                    >
                                        Assign all {totalAvailableCount}
                                    </button>
                                </div>

                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg h-64 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
                                    {isLoadingRunDetails ? (
                                        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Loading run cases…
                                        </div>
                                    ) : availableGroups.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center gap-1 p-4 text-center">
                                            <Inbox className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {search.trim()
                                                    ? 'No test cases match your search'
                                                    : 'Every test case is already assigned'}
                                            </p>
                                        </div>
                                    ) : (
                                        availableGroups.map((group) => {
                                            const isCollapsed = collapsedFolderIds.has(group.id);
                                            return (
                                                <div key={group.id}>
                                                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-100/70 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleFolder(group.id)}
                                                            aria-expanded={!isCollapsed}
                                                            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.path}`}
                                                            className="p-0.5 -ml-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                                                        >
                                                            {isCollapsed ? (
                                                                <ChevronRight className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <ChevronDown className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                        <Folder className="w-3.5 h-3.5 text-blue-400/80 dark:text-blue-500/80 flex-shrink-0" />
                                                        <span
                                                            title={group.path}
                                                            className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate"
                                                            style={{ paddingLeft: `${group.depth * 12}px` }}
                                                        >
                                                            {group.name}
                                                        </span>
                                                        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 flex-shrink-0">
                                                            {group.rows.length}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                assign(group.rows.map((r) => r.testCase.id))
                                                            }
                                                            className="ml-auto text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0"
                                                        >
                                                            Assign
                                                        </button>
                                                    </div>
                                                    {!isCollapsed &&
                                                        group.rows.map((row) => renderCaseRow(row, 'assign'))}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Assigned to this run — flat, with unassign */}
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                            Assigned to this run
                                        </span>
                                        <span className="text-xs tabular-nums px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">
                                            {assignedCases.length}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => unassign(assignedCases.map((c) => c.id))}
                                        disabled={assignedCases.length === 0}
                                        className="text-xs font-medium px-2 py-1 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                                    >
                                        Unassign all {assignedCases.length}
                                    </button>
                                </div>

                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg h-64 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
                                    {isLoadingRunDetails ? (
                                        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Loading run cases…
                                        </div>
                                    ) : assignedCases.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center gap-1 p-4 text-center">
                                            <Layers className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                No test cases assigned yet
                                            </p>
                                        </div>
                                    ) : (
                                        assignedCases.map((testCase) =>
                                            renderCaseRow(
                                                {
                                                    testCase,
                                                    pending: toUnassign.has(testCase.id),
                                                },
                                                'unassign'
                                            )
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTestRunModal;
