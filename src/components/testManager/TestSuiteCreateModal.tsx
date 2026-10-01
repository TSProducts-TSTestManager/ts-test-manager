import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTestManagerStore } from '../../store/testManagerStore';
import TagInput from './TagInput';
import { MAX_FOLDER_DEPTH, suitePathLabel } from '../../utils/suiteTree';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    projectId?: string | null;
    /** Pre-select a parent so "New folder inside…" lands in the right place. */
    defaultParentId?: string | null;
}

const TestSuiteCreateModal: React.FC<Props> = ({
    isOpen,
    onClose,
    projectId,
    defaultParentId = null,
}) => {
    const { createTestSuite, fetchTestSuites, setActiveSuite, setActiveSuiteId, testSuites } = useTestManagerStore();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [parentId, setParentId] = useState<string | null>(defaultParentId);
    const [isFolder, setIsFolder] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The tree's "New folder inside X" sets defaultParentId right before
    // opening, and the component stays mounted while closed, so useState alone
    // would keep the previous value and create the folder at the root instead.
    useEffect(() => {
        if (isOpen) {
            setName('');
            setDescription('');
            setTags([]);
            setParentId(defaultParentId);
            setIsFolder(true);
            setError(null);
        }
    }, [isOpen, defaultParentId]);

    const tagSuggestions = Array.from(
        new Set(testSuites.flatMap(s => s.tags || []))
    ).sort();

    // "Owner / Login" style labels make the hierarchy readable in a flat select.
    const parentOptions = useMemo(
        () =>
            testSuites
                .filter((suite) => !suite.archived)
                .sort((a, b) => suitePathLabel(testSuites, a.id).localeCompare(suitePathLabel(testSuites, b.id)))
                .map((suite) => ({ id: suite.id, label: suitePathLabel(testSuites, suite.id) })),
        [testSuites]
    );

    // `depth` is 0 for a root node and the server rejects a child on depth 3 or
    // deeper, so the parent has to be at depth <= MAX_FOLDER_DEPTH - 2 for the
    // new node to be accepted.
    const parentDepth = parentId ? testSuites.find((s) => s.id === parentId)?.depth ?? 0 : -1;
    const depthExhausted = parentDepth + 1 >= MAX_FOLDER_DEPTH;

    if (!isOpen) return null;

    const validate = (): string | null => {
        if (!name || name.trim().length === 0) return 'Name is required';
        if (name.trim().length > 200) return 'Name must be 200 characters or less';
        if (depthExhausted) return `Folders can only nest ${MAX_FOLDER_DEPTH} levels deep`;
        return null;
    };

    const handleSave = async () => {
        const v = validate();
        if (v) {
            setError(v);
            return;
        }

        if (!projectId) {
            setError('No project selected');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const suite = await createTestSuite(projectId, {
                name: name.trim(),
                description: description.trim(),
                tags,
                parentId,
                isFolder,
            });
            // Refresh suites and set active
            await fetchTestSuites(projectId);
            setActiveSuite(suite.name);
            setActiveSuiteId(suite.id);
            toast.success(isFolder ? 'Folder created successfully' : 'Test suite created successfully');
            setName('');
            setDescription('');
            setTags([]);
            setParentId(null);
            onClose();
        } catch (err: unknown) {
            const errorMessage = (err as Error)?.message || 'Could not create suite';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-white/40 dark:bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full h-full sm:h-auto sm:max-w-xl bg-white dark:bg-gray-800 sm:rounded-2xl shadow-2xl overflow-y-auto animate-[scaleIn_0.12s_ease-out]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Folder / Suite</h3>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-3 rounded">{error}</div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="e.g. Login"
                            maxLength={200}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Parent folder
                        </label>
                        <select
                            value={parentId ?? ''}
                            onChange={(e) => setParentId(e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="">None (top level)</option>
                            {parentOptions.map((option) => {
                                // A parent already at the last allowed level
                                // cannot take a child, so say so rather than
                                // letting the save fail.
                                const atMaxDepth =
                                    (testSuites.find((s) => s.id === option.id)?.depth ?? 0) + 1 >=
                                    MAX_FOLDER_DEPTH - 1;
                                return (
                                    <option key={option.id} value={option.id} disabled={atMaxDepth}>
                                        {option.label}
                                        {atMaxDepth ? ' (max depth reached)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Folders can nest up to {MAX_FOLDER_DEPTH} levels. A folder can hold
                            both sub-folders and test cases.
                        </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isFolder}
                            onChange={(e) => setIsFolder(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                        />
                        Treat as a folder (shows the folder icon in the tree)
                    </label>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            rows={3}
                            maxLength={500}
                            placeholder="Short description"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags (optional)</label>
                        <TagInput tags={tags} onChange={setTags} placeholder="e.g. regression, smoke, api" suggestions={tagSuggestions} />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isSaving ? 'cursor-wait' : ''}`}
                    >
                        <Plus className="w-4 h-4" />
                        {isSaving ? 'Creating...' : isFolder ? 'Create Folder' : 'Create Suite'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TestSuiteCreateModal;
