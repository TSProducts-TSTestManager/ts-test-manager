import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, Folder, Check, X, Loader2, Search } from 'lucide-react';
import { useTestManagerStore } from '../../store/testManagerStore';
import { useProjectOptions } from '../../hooks/useProjectOptions';

interface ProjectSelectorProps {
    stayOnPage?: boolean;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ stayOnPage = false }) => {
    const { activeProject, setActiveProject } = useTestManagerStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const { options, search, setSearch, isSearching, hasMore, isSearchingMore, loadMore, reset } = useProjectOptions(activeProject);

    const selectedProject = options.find(p => p.id === activeProject);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset the search when the dropdown is dismissed so it does not linger.
    useEffect(() => {
        if (!isOpen) reset();
    }, [isOpen, reset]);

    // Page through the matches as the list is scrolled. The observer watches a
    // sentinel inside the scroll container, not the page, so it only fires
    // while this dropdown is actually visible.
    useEffect(() => {
        if (!isOpen || !hasMore) return;
        const root = scrollRef.current;
        const target = sentinelRef.current;
        if (!root || !target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) loadMore();
            },
            { root, rootMargin: '120px' }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [isOpen, hasMore, loadMore]);

    const handleProjectSelect = (projectId: string) => {
        setActiveProject(projectId);
        setIsOpen(false);
        // Navigate to test suites for the selected project
        if (!stayOnPage) {
            navigate('/test-manager/suites');
        }
    };

    const handleClearSelection = () => {
        setActiveProject(null);
        setIsOpen(false);
        if (!stayOnPage) {
            navigate('/test-manager/projects');
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[200px]"
            >
                <Folder className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedProject ? selectedProject.name : 'Select Project'}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg w-64 z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Switch Project</p>
                        <div className="mt-2 relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search projects..."
                                autoFocus
                                className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-system-blue"
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-gray-400" />
                            )}
                        </div>
                    </div>

                    <div ref={scrollRef} className="max-h-80 overflow-y-auto">
                        {options.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                                {isSearching ? 'Searching...' : 'No projects found'}
                            </div>
                        ) : (
                            options.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => handleProjectSelect(project.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${activeProject === project.id ? 'bg-system-blue/10 dark:bg-system-blue/20' : ''
                                        }`}
                                >
                                    <div className={`h-8 w-8 rounded-lg ${project.color} flex items-center justify-center text-white flex-shrink-0`}>
                                        <Folder className="h-4 w-4" />
                                    </div>
                                    <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {project.displayId && (
                                            <span className="font-mono text-xs text-gray-400 dark:text-gray-500 mr-1.5">{project.displayId}</span>
                                        )}
                                        {project.name}
                                    </span>
                                    {activeProject === project.id && (
                                        <Check className="h-4 w-4 text-system-blue" />
                                    )}
                                </button>
                            ))
                        )}
                        {hasMore && <div ref={sentinelRef} className="h-1" />}
                        {isSearchingMore && (
                            <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Loading more...
                            </div>
                        )}
                    </div>

                    {activeProject && (
                        <div className="border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={handleClearSelection}
                                className="w-full flex items-center gap-2 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <X className="h-4 w-4" />
                                <span className="text-sm font-medium">Clear Selection</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProjectSelector;
