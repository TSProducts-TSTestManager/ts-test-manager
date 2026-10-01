import React, { useEffect, useMemo, useState } from 'react';
import { X, FolderInput } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTestManagerStore } from '../../store/testManagerStore';
import { TestSuite } from '../../types/testManager';
import { movableTargets, suitePathLabel } from '../../utils/suiteTree';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    suite: TestSuite | null;
    projectId?: string | null;
}

/**
 * "Move to…" picker for a suite/folder.
 *
 * A folder cannot be dropped into itself or anything beneath it, so the options
 * are the project's other nodes minus this subtree. The server applies the same
 * rules and additionally rejects moves whose subtree would exceed the folder
 * depth limit.
 */
const SuiteMoveModal: React.FC<Props> = ({ isOpen, onClose, suite, projectId }) => {
    const { moveTestSuite, fetchTestSuites, testSuites } = useTestManagerStore();
    const [parentId, setParentId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (suite && isOpen) {
            setParentId(suite.parentId ?? null);
            setError(null);
        }
    }, [suite, isOpen]);

    const options = useMemo(() => {
        if (!suite) return [];
        return movableTargets(testSuites, suite.id)
            .filter((candidate) => !candidate.archived)
            .sort((a, b) =>
                suitePathLabel(testSuites, a.id).localeCompare(suitePathLabel(testSuites, b.id))
            );
    }, [testSuites, suite]);

    if (!isOpen || !suite) return null;

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await moveTestSuite(suite.id, { parentId });
            // Depths below the moved node are re-based by the server, so the
            // whole list is re-read rather than patched in place.
            if (projectId) {
                await fetchTestSuites(projectId);
            }
            toast.success('Folder moved');
            onClose();
        } catch (err: unknown) {
            const errorMessage = (err as Error)?.message || 'Could not move folder';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-white/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full h-full sm:h-auto sm:max-w-md bg-white dark:bg-gray-800 sm:rounded-2xl shadow-2xl overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Move “{suite.name}”
                    </h3>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-3 rounded">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            New parent folder
                        </label>
                        <select
                            value={parentId ?? ''}
                            onChange={(e) => setParentId(e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="">None (top level)</option>
                            {options.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {suitePathLabel(testSuites, option.id)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Moving this folder moves every folder and test case inside it. It cannot be
                        moved into itself or one of its own sub-folders.
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                    >
                        <FolderInput className="w-4 h-4" />
                        {isSaving ? 'Moving...' : 'Move'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuiteMoveModal;
