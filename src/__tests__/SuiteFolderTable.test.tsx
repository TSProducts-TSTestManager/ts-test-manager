import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuiteFolderTable from '../components/testManager/SuiteFolderTable';
import { buildSuiteTree } from '../utils/suiteTree';
import { TestSuite } from '../types/testManager';

const suite = (overrides: Partial<TestSuite> & { id: string; name: string }): TestSuite => ({
    projectId: 'project-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

/**
 * Mirrors the seeded shape: six role folders, each holding a `Login` folder
 * with three cases, plus the role folders themselves holding none.
 */
const suites: TestSuite[] = [
    suite({ id: 'owner', name: 'Owner', isFolder: true, caseCount: 0, totalCaseCount: 3 }),
    suite({
        id: 'owner-login',
        name: 'Login',
        parentId: 'owner',
        depth: 1,
        isFolder: true,
        caseCount: 3,
        totalCaseCount: 3,
    }),
    suite({ id: 'driver', name: 'Driver', isFolder: true, caseCount: 0, totalCaseCount: 0 }),
];

const noop = () => undefined;

const setup = (overrides: Partial<React.ComponentProps<typeof SuiteFolderTable>> = {}) => {
    const props: React.ComponentProps<typeof SuiteFolderTable> = {
        nodes: buildSuiteTree(suites),
        allSuites: suites,
        expandedIds: new Set(['owner']),
        onToggleExpand: noop,
        onExpandAll: noop,
        onCollapseAll: noop,
        onOpen: noop,
        onCreateInside: noop,
        onEdit: noop,
        onMove: noop,
        onArchive: noop,
        onDelete: noop,
        selectedIds: [],
        onToggleSelect: noop,
        onSelectAll: noop,
        ...overrides,
    };
    return { props, ...render(<SuiteFolderTable {...props} />) };
};

const rowFor = (name: string): HTMLElement => {
    const row = screen.getByText(name).closest('tr');
    if (!row) throw new Error(`no row for ${name}`);
    return row as HTMLElement;
};

describe('SuiteFolderTable', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows the rolled-up case count only for folders that have cases', () => {
        setup();

        // Owner holds nothing itself but has cases beneath it.
        expect(within(rowFor('Owner')).getByTestId('suite-case-count')).toHaveTextContent('3');
        // Login holds all three.
        expect(within(rowFor('Login')).getByTestId('suite-case-count')).toHaveTextContent('3');
        // Driver is empty, so it gets a dash and no pill at all.
        expect(within(rowFor('Driver')).queryByTestId('suite-case-count')).toBeNull();
        expect(within(rowFor('Driver')).getByLabelText('No test cases')).toBeInTheDocument();
    });

    it('says on hover how much of a count lives in the folder versus its subfolders', () => {
        // 1 case here, 3 in a subfolder: the roll-up is 4, which alone would be
        // ambiguous, so the tooltip spells out the split.
        const mixed = [
            suite({ id: 'm', name: 'Mixed', isFolder: true, caseCount: 1, totalCaseCount: 4 }),
            suite({
                id: 'm-child',
                name: 'Nested',
                parentId: 'm',
                depth: 1,
                isFolder: true,
                caseCount: 3,
                totalCaseCount: 3,
            }),
        ];
        setup({ nodes: buildSuiteTree(mixed), allSuites: mixed, expandedIds: new Set(['m']) });

        expect(within(rowFor('Mixed')).getByTestId('suite-case-count')).toHaveAttribute(
            'title',
            '4 test cases — 1 in this folder, 3 in subfolders'
        );
    });

    it('renders nesting through indentation rather than a flat list of names', () => {
        setup();

        const login = rowFor('Login');
        const driver = rowFor('Driver');
        expect(login.dataset.depth).toBe('1');
        expect(driver.dataset.depth).toBe('0');
        // The child row carries a guide line per ancestor level.
        expect(login.querySelectorAll('[data-depth="1"] > td:nth-child(2) span[aria-hidden]').length)
            .toBeGreaterThan(0);
    });

    it('hides children of a collapsed folder but keeps the folder itself', async () => {
        const user = userEvent.setup();
        const onToggleExpand = vi.fn();
        setup({ expandedIds: new Set<string>(), onToggleExpand });

        expect(screen.getByText('Owner')).toBeInTheDocument();
        expect(screen.queryByText('Login')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Expand Owner' }));
        expect(onToggleExpand).toHaveBeenCalledWith('owner');
    });

    it('shows the children of an expanded folder', () => {
        setup();
        expect(screen.getByText('Login')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Collapse Owner' })).toBeInTheDocument();
    });

    it('opens a folder with its full path as the row tooltip', async () => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        setup({ onOpen });

        await user.click(screen.getByText('Login'));
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'owner-login' }));
        expect(screen.getByText('Login').closest('button')).toHaveAttribute('title', 'Owner / Login');
    });

    it('offers the row actions and reports which folder they were used on', async () => {
        const user = userEvent.setup();
        const onCreateInside = vi.fn();
        const onEdit = vi.fn();
        const onMove = vi.fn();
        const onArchive = vi.fn();
        const onDelete = vi.fn();
        setup({ onCreateInside, onEdit, onMove, onArchive, onDelete });

        await user.click(screen.getByRole('button', { name: 'New folder inside Login' }));
        expect(onCreateInside).toHaveBeenCalledWith('owner-login');

        await user.click(screen.getByRole('button', { name: 'Rename Login' }));
        expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'owner-login' }));

        await user.click(screen.getByRole('button', { name: 'Move Login' }));
        expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'owner-login' }));

        await user.click(screen.getByRole('button', { name: 'Archive Login' }));
        expect(onArchive).toHaveBeenCalledWith(expect.objectContaining({ id: 'owner-login' }));

        await user.click(screen.getByRole('button', { name: 'Delete Login' }));
        expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'owner-login' }));
    });

    it('swaps archive for restore in the archived view', () => {
        const onRestore = vi.fn();
        setup({ archivedScope: true, onRestore });

        expect(screen.queryByRole('button', { name: 'Archive Owner' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Restore Owner' })).toBeInTheDocument();
    });

    it('summarises the whole project above the table', () => {
        setup();
        expect(screen.getByText('Folder structure')).toBeInTheDocument();
        expect(screen.getByText(/3 folders/)).toBeInTheDocument();
        expect(screen.getByText('3 test cases')).toBeInTheDocument();
    });

    it('supports selecting rows individually and in bulk', async () => {
        const user = userEvent.setup();
        const onToggleSelect = vi.fn();
        const onSelectAll = vi.fn();
        setup({ onToggleSelect, onSelectAll });

        await user.click(within(rowFor('Owner')).getByLabelText('Select Owner'));
        expect(onToggleSelect).toHaveBeenCalledWith('owner');

        // Select-all covers every row the tree shows, expanded or not.
        await user.click(screen.getByLabelText('Select all folders'));
        expect(onSelectAll).toHaveBeenCalledWith(true, ['owner', 'owner-login', 'driver']);
    });

    it('marks the header checkbox indeterminate for a partial selection', () => {
        setup({ selectedIds: ['owner'] });
        expect(screen.getByLabelText('Select all folders')).toHaveProperty('indeterminate', true);
    });

    it('creates a top-level folder from the toolbar', async () => {
        const user = userEvent.setup();
        const onCreateInside = vi.fn();
        setup({ onCreateInside });

        await user.click(screen.getByRole('button', { name: /New Folder/ }));
        expect(onCreateInside).toHaveBeenCalledWith(null);
    });

    it('expands and collapses the whole tree from labelled toolbar buttons', async () => {
        const user = userEvent.setup();
        const onExpandAll = vi.fn();
        const onCollapseAll = vi.fn();
        setup({ onExpandAll, onCollapseAll });

        // Labelled, not icon-only: an unlabelled chevron pair is unreadable.
        await user.click(screen.getByRole('button', { name: /Expand all/ }));
        expect(onExpandAll).toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: /Collapse all/ }));
        expect(onCollapseAll).toHaveBeenCalled();
    });

    it('replaces the table with the empty state when nothing matches', () => {
        setup({
            nodes: [],
            emptyState: { title: 'No Test Suites Found', description: 'No test suites match your search or filters.' },
        });

        expect(screen.queryByTestId('suite-folder-table')).toBeNull();
        expect(screen.getByText('No Test Suites Found')).toBeInTheDocument();
    });
});
