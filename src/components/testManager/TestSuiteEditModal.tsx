import React, { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTestManagerStore } from '../../store/testManagerStore';
import { TestSuite } from '../../types/testManager';
import TagInput from './TagInput';
import { MAX_FOLDER_DEPTH, movableTargets, suitePathLabel } from '../../utils/suiteTree';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    suite: TestSuite | null;
    projectId?: string | null;
}

const TestSuiteEditModal: React.FC<Props> = ({ isOpen, onClose, suite, projectId }) => {
    const { updateTestSuite, fetchTestSuites, testSuites } = useTestManagerStore();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [parentId, setParentId] = useState<string | null>(null);
    const [isFolder, setIsFolder] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const tagSuggestions = Array.from(
        new Set(testSuites.flatMap(s => s.tags || []))
    ).sort();
    const [error, setError] = useState<string | null>(null);

    // Reset form when suite changes or modal opens
    useEffect(() => {
        if (suite && isOpen) {
            setName(suite.name);
            setDescription(suite.description || '');
            setTags(suite.tags || []);
            setParentId(suite.parentId ?? null);
            setIsFolder(suite.isFolder === true);
            setError(null);
        }
    }, [suite, isOpen]);

    // A folder cannot be dropped into itself or anything beneath it, and the
    // subtree has to fit the depth cap, so the candidate list excludes both.
    const parentOptions = useMemo(() => {
        if (!suite) return [];
        return movableTargets(testSuites, suite.id)
            .filter((candidate) => !candidate.archived)
            .sort((a, b) =>
                suitePathLabel(testSuites, a.id).localeCompare(suitePathLabel(testSuites, b.id))
            )
            .map((candidate) => ({ id: candidate.id, label: suitePathLabel(testSuites, candidate.id) }));
    }, [testSuites, suite]);

    if (!isOpen || !suite) return null;

    const validate = (): string | null => {
        if (!name || name.trim().length === 0) return 'Name is required';
        if (name.trim().length > 200) return 'Name must be 200 characters or less';
        return null;
    };

    const handleSave = async () => {
        const v = validate();
        if (v) {
            setError(v);
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            await updateTestSuite(suite.id, {
                name: name.trim(),
                description: description.trim(),
                tags,
                parentId,
                isFolder,
            });
            // Refresh suites so every depth below this node is re-read.
            if (projectId) {
                await fetchTestSuites(projectId);
            }
            toast.success('Folder updated successfully');
            onClose();
        } catch (err: unknown) {
            const errorMessage = (err as Error)?.message || 'Could not update folder';
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
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Folder / Suite</h3>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="e.g. Login"
                            maxLength={200}
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
                            {parentOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Moving a folder moves everything inside it. Folders can nest up to{' '}
                            {MAX_FOLDER_DEPTH} levels.
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
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TestSuiteEditModal;
