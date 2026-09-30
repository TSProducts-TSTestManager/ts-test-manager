
import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Project } from '../../types/testManager';
import { FolderGit2, MoreHorizontal, Users, Layers, Calendar, Plus, FileText, Pencil, Trash2, Settings, Share2, Bug, AlertTriangle, Search, Table, Grid2x2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import ProjectMembersModal from './ProjectMembersModal';
import ProjectActionSheet from './ProjectActionSheet';

interface ProjectListProps {
    projects: Project[];
    /** True while the very first list fetch is in flight — shows a spinner
     *  instead of the empty state so the list does not flash as "no projects". */
    isLoading?: boolean;
    onProjectClick: (id: string) => void;
    onCreate: () => void;
    onEdit?: (project: Project) => void;
    onSettings?: (project: Project) => void;
    onDelete?: (project: Project) => void;
    viewMode?: 'card' | 'table';
    onViewModeToggle?: () => void;
    searchQuery?: string;
    onSearchChange?: (q: string) => void;
}

interface DropdownPosition {
    projectId: string;
    top: number;
    right: number;
}

const PAGE_SIZE = 10;

type ProjectSortField =
    | 'displayId'
    | 'name'
    | 'suites'
    | 'cases'
    | 'bugs'
    | 'openBugs'
    | 'members'
    | 'updatedAt';

const PROJECT_NUMERIC_SORT_FIELDS: ProjectSortField[] = ['suites', 'cases', 'bugs', 'openBugs', 'members'];

const ProjectList: React.FC<ProjectListProps> = React.memo(function ProjectList({ projects, isLoading = false, onProjectClick, onCreate, onEdit, onSettings, onDelete, viewMode = 'card', onViewModeToggle, searchQuery = '', onSearchChange }) {
    const { user } = useAuthStore();
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showActionSheet, setShowActionSheet] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [tablePage, setTablePage] = useState(1);
    const [sortField, setSortField] = useState<ProjectSortField>('updatedAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Reset page when projects/search change
    React.useEffect(() => {
        setTablePage(1);
    }, [projects.length, searchQuery]);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownPosition(null);
            }
        };

        if (dropdownPosition) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownPosition]);

    const handleMenuClick = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setSelectedProject(project);

        if (isMobile) {
            setShowActionSheet(true);
        } else {
            // Position dropdown near the button
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setDropdownPosition({
                projectId: project.id,
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
            });
        }
    };

    const handleManageMembers = () => {
        setDropdownPosition(null);
        setShowMembersModal(true);
    };

    const handleEdit = () => {
        setDropdownPosition(null);
        if (selectedProject && onEdit) {
            onEdit(selectedProject);
        }
    };

    const handleSettings = () => {
        setDropdownPosition(null);
        if (selectedProject && onSettings) {
            onSettings(selectedProject);
        }
    };
    const handleShareClick = async (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/test-manager/suites?projectId=${projectId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied to clipboard');
        } catch (err) {
            console.error('Failed to copy link: ', err);
            toast.error('Failed to copy link');
        }
    };
    const handleDelete = () => {
        setDropdownPosition(null);
        if (selectedProject && onDelete) {
            onDelete(selectedProject);
        }
    };

    const handleSort = (field: ProjectSortField) => {
        if (sortField === field) {
            setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortField(field);
        setSortDir(field === 'updatedAt' ? 'desc' : 'asc');
    };

    const numericValue = (project: Project, field: ProjectSortField): number => {
        switch (field) {
            case 'suites': return project.stats.suites ?? 0;
            case 'cases': return project.stats.cases ?? 0;
            case 'bugs': return project.stats.bugs ?? 0;
            case 'openBugs': return project.stats.openBugs ?? 0;
            case 'members': return project.stats.members ?? 0;
            default: return 0;
        }
    };

    const sortedProjects = useMemo(() => {
        const direction = sortDir === 'asc' ? 1 : -1;
        return [...projects].sort((a, b) => {
            if (PROJECT_NUMERIC_SORT_FIELDS.includes(sortField)) {
                return (numericValue(a, sortField) - numericValue(b, sortField)) * direction;
            }
            if (sortField === 'name') {
                return a.name.localeCompare(b.name) * direction;
            }
            if (sortField === 'displayId') {
                return (a.displayId || '').localeCompare(b.displayId || '', undefined, {
                    numeric: true,
                    sensitivity: 'base',
                }) * direction;
            }
            return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
        });
    }, [projects, sortField, sortDir]);

    const sortableHeader = (label: string, field: ProjectSortField, extraClass = '') => (
        <th
            onClick={() => handleSort(field)}
            title={`Sort by ${label}`}
            className={`px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap cursor-pointer select-none group hover:text-gray-700 dark:hover:text-gray-200 ${extraClass}`}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {sortField === field ? (
                    sortDir === 'asc'
                        ? <ArrowUp size={12} className="text-blue-500" />
                        : <ArrowDown size={12} className="text-blue-500" />
                ) : (
                    <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-60" />
                )}
            </span>
        </th>
    );

    const totalPages = Math.max(1, Math.ceil(sortedProjects.length / PAGE_SIZE));
    const safePage = Math.min(tablePage, totalPages);
    const paginatedProjects = sortedProjects.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const showPagination = sortedProjects.length > PAGE_SIZE;

    const renderJiraBadge = (project: Project) => {
        if (project.jira?.enabled && project.jira.projectKey) {
            return (
                <span className="font-mono text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full" title={project.jira.domain}>
                    {project.jira.projectKey}
                </span>
            );
        }
        return (
            <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                JIRA: Not Configured
            </span>
        );
    };

    const searchToolbar = onSearchChange ? (
        <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search projects by name, description, ID..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
            {onViewModeToggle && (
                <button
                    onClick={onViewModeToggle}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    title={viewMode === 'card' ? 'Switch to table view' : 'Switch to card view'}
                >
                    {viewMode === 'card' ? <Table size={14} /> : <Grid2x2 size={14} />}
                    <span className="hidden sm:inline">{viewMode === 'card' ? 'Table' : 'Card'}</span>
                </button>
            )}
        </div>
    ) : null;

    const paginationFooter = showPagination ? (
        <div className="flex items-center justify-between px-1 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedProjects.length)} of {sortedProjects.length} projects
            </span>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setTablePage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    aria-label="Previous page"
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium px-2 text-gray-700 dark:text-gray-300">Page {safePage} of {totalPages}</span>
                <button
                    onClick={() => setTablePage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    aria-label="Next page"
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    ) : null;

    return (
        <>
            <div className="p-6 md:p-8">
                {searchToolbar}

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20" role="status">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" aria-hidden="true" />
                        <span className="sr-only">Loading projects…</span>
                    </div>
                ) : viewMode === 'table' ? (
                    <>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                                        <tr className="text-left">
                                            <th className="px-3 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap text-center">S.No</th>
                                            {sortableHeader('Project ID', 'displayId')}
                                            {sortableHeader('Name', 'name')}
                                            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Description</th>
                                            {sortableHeader('Suites', 'suites', 'text-center')}
                                            {sortableHeader('Test Cases', 'cases', 'text-center')}
                                            {sortableHeader('Bugs', 'bugs', 'text-center')}
                                            {sortableHeader('Open Bugs', 'openBugs', 'text-center')}
                                            {sortableHeader('Members', 'members', 'text-center')}
                                            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">JIRA</th>
                                            {sortableHeader('Updated', 'updatedAt')}
                                            <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {paginatedProjects.map((project, idx) => {
                                            const serial = (safePage - 1) * PAGE_SIZE + idx + 1;
                                            return (
                                                <tr
                                                    key={project.id}
                                                    onClick={() => onProjectClick(project.id)}
                                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-3 py-3 text-center text-xs font-medium text-gray-500">{serial}</td>
                                                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                                                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                                            {project.displayId || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 align-middle">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className={`h-7 w-7 rounded-lg ${project.color} flex items-center justify-center text-white shrink-0`}>
                                                                <FolderGit2 className="h-3.5 w-3.5" />
                                                            </div>
                                                            <span className="font-medium text-gray-900 dark:text-white truncate max-w-[180px]">{project.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 align-middle max-w-[200px] truncate text-gray-500 dark:text-gray-400" title={project.description}>
                                                        {project.description || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 align-middle text-center font-medium">{project.stats.suites}</td>
                                                    <td className="px-4 py-3 align-middle text-center font-medium">{project.stats.cases}</td>
                                                    <td className="px-4 py-3 align-middle text-center font-medium">
                                                        <span className="inline-flex items-center gap-1">
                                                            <Bug size={12} className="text-gray-400" />
                                                            {project.stats.bugs ?? 0}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 align-middle text-center font-medium">
                                                        {(project.stats.openBugs ?? 0) > 0 ? (
                                                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                                                <AlertTriangle size={12} />
                                                                {project.stats.openBugs}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">0</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 align-middle text-center font-medium">{project.stats.members}</td>
                                                    <td className="px-4 py-3 align-middle">{renderJiraBadge(project)}</td>
                                                    <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                                        {new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-4 py-3 align-middle text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex gap-1 justify-end">
                                                            <button
                                                                onClick={(e) => handleShareClick(e, project.id)}
                                                                className="p-1.5 text-gray-400 hover:text-blue-500 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                                                title="Share"
                                                            >
                                                                <Share2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleMenuClick(e, project)}
                                                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                title="More"
                                                            >
                                                                <MoreHorizontal size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {paginatedProjects.length === 0 && (
                                            <tr>
                                                <td colSpan={12} className="p-8 text-center text-gray-400">
                                                    {searchQuery ? `No projects match "${searchQuery}"` : 'No projects yet'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <div
                            onClick={onCreate}
                            className="group flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-all cursor-pointer min-h-[220px]"
                        >
                            <div className="h-14 w-14 rounded-2xl bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Plus className="h-7 w-7 text-blue-500 dark:text-blue-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New Project</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">Start a new testing workspace</p>
                        </div>

                        {paginatedProjects.map(project => (
                            <div
                                key={project.id}
                                onClick={() => onProjectClick(project.id)}
                                className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-none hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[240px]"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`h-12 w-12 rounded-2xl ${project.color} shadow-lg flex items-center justify-center text-white`}>
                                            <FolderGit2 className="h-6 w-6" />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => handleShareClick(e, project.id)}
                                                className="p-2 text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors opacity-0 group-hover:opacity-100 md:opacity-0 opacity-100"
                                                title="Share Project"
                                            >
                                                <Share2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={(e) => handleMenuClick(e, project)}
                                                aria-label="Project actions"
                                                className="p-2 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100 md:opacity-0 opacity-100"
                                            >
                                                <MoreHorizontal className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        {project.displayId && (
                                            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full" title="Project ID">
                                                {project.displayId}
                                            </span>
                                        )}
                                        {renderJiraBadge(project)}
                                    </div>

                                    <h3 className="font-semibold text-gray-900 dark:text-white text-xl tracking-tight mb-2">{project.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">{project.description}</p>
                                </div>

                                <div className="pt-3 border-t border-gray-50 dark:border-gray-700">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <Layers className="h-3.5 w-3.5" />
                                            {project.stats.suites} Suites
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="h-3.5 w-3.5" />
                                            {project.stats.cases} Cases
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-3.5 w-3.5" />
                                            {project.stats.members}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Bug className="h-3.5 w-3.5" />
                                            {project.stats.bugs ?? 0} Bugs
                                        </div>
                                        <div className={`flex items-center gap-1.5 ${(project.stats.openBugs ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            {project.stats.openBugs ?? 0} Open
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3 w-3" />
                                            <span>{new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {paginatedProjects.length === 0 && projects.length === 0 && (
                            <div className="col-span-full p-6 text-center text-gray-400 text-sm">No projects yet</div>
                        )}
                        {paginatedProjects.length === 0 && projects.length > 0 && (
                            <div className="col-span-full p-6 text-center text-gray-400 text-sm">No projects match "{searchQuery}"</div>
                        )}
                    </div>
                )}
                {paginationFooter}
            </div>

            {/* Desktop Dropdown Menu */}
            {dropdownPosition && !isMobile && (
                <div
                    ref={dropdownRef}
                    className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 w-48 animate-[scaleIn_0.1s_ease-out]"
                    style={{
                        top: dropdownPosition.top,
                        right: dropdownPosition.right,
                    }}
                >
                    <button
                        onClick={(e) => handleShareClick(e, selectedProject!.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Share2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        Share Project
                    </button>
                    <button
                        onClick={handleSettings}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Settings className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        Project Settings
                    </button>
                    <button
                        onClick={handleManageMembers}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        Manage Members
                    </button>
                    <button
                        onClick={handleEdit}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Pencil className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        Edit Project
                    </button>
                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                    <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete Project
                    </button>
                </div>
            )}

            {/* Mobile Action Sheet */}
            {selectedProject && (
                <ProjectActionSheet
                    project={selectedProject}
                    isOpen={showActionSheet}
                    onClose={() => setShowActionSheet(false)}
                    onManageMembers={handleManageMembers}
                    onEdit={handleEdit}
                    onSettings={handleSettings}
                    onDelete={handleDelete}
                    onShare={() => handleShareClick({ stopPropagation: () => {} } as React.MouseEvent, selectedProject.id)}
                />
            )}

            {/* Members Modal */}
            {selectedProject && showMembersModal && user && (
                <ProjectMembersModal
                    projectId={selectedProject.id}
                    currentUserId={user._id}
                    currentUserRole={user.role}
                    currentClientId={user.clientId}
                    onClose={() => {
                        setShowMembersModal(false);
                        setSelectedProject(null);
                    }}
                />
            )}
        </>
    );
});

export default ProjectList;
