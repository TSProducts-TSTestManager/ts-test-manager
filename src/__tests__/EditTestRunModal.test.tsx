import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditTestRunModal from '../pages/testManager/components/EditTestRunModal';
import type { TestCase, TestRunListItem } from '../types/testManager';
import type { SuiteNodeSource } from '../utils/suiteTree';

const getTestRun = vi.hoisted(() => vi.fn());
const updateTestRun = vi.hoisted(() => vi.fn());

vi.mock('../services/testRunApi', () => ({
    testRunApi: {
        getTestRun,
        updateTestRun,
    },
}));

vi.mock('../components/testManager/TagInput', () => ({
    default: () => null,
}));

/**
 *   Owner
 *   └── Login          <- tc-login
 *   Manager
 *   └── Login          <- tc-manager-login
 */
const suites: SuiteNodeSource[] = [
    { id: 'owner', name: 'Owner', parentId: null, depth: 0, isFolder: true },
    { id: 'owner-login', name: 'Login', parentId: 'owner', depth: 1, isFolder: true },
    { id: 'manager', name: 'Manager', parentId: null, depth: 0, isFolder: true },
    { id: 'manager-login', name: 'Login', parentId: 'manager', depth: 1, isFolder: true },
];

const makeCase = (id: string, title: string, suiteId: string, suite: string): TestCase =>
    ({
        id,
        title,
        suiteId,
        suite,
        area: 'Login',
        priority: 'High',
        status: 'Ready',
        testType: 'Positive',
        tags: [],
        customFields: {},
        history: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }) as unknown as TestCase;

const testCases: TestCase[] = [
    makeCase('tc-login', 'Owner login works', 'owner-login', 'Login'),
    makeCase('tc-login-2', 'Owner login fails', 'owner-login', 'Login'),
    makeCase('tc-manager-login', 'Manager login works', 'manager-login', 'Login'),
    makeCase('tc-loose', 'Loose case', 'owner', 'Owner'),
];

const run = {
    id: 'run-1',
    title: 'Owner Mobile',
    projectId: 'p1',
    status: 'Draft',
    items: [],
    tags: [],
    itemCount: 1,
    createdAt: new Date().toISOString(),
} as unknown as TestRunListItem;

const renderModal = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
    render(
        <EditTestRunModal
            isOpen
            onClose={() => undefined}
            testRun={run}
            testRunGroups={[]}
            testCases={testCases}
            testSuites={suites}
            onSubmit={onSubmit}
            tagSuggestions={[]}
        />
    );
    return onSubmit;
};

/** The run already contains the given case ids. */
const setRunCases = (caseIds: string[]) =>
    getTestRun.mockResolvedValue({
        id: 'run-1',
        items: caseIds.map((id) => ({ caseId: id, order: 0, status: 'NotRun' })),
    });

const availableColumn = () => screen.getByText('Available').closest('.flex.flex-col') as HTMLElement;
const assignedColumn = () =>
    screen.getByText('Assigned to this run').closest('.flex.flex-col') as HTMLElement;

describe('EditTestRunModal test case assignment', () => {
    beforeEach(() => {
        getTestRun.mockReset();
        updateTestRun.mockReset();
        setRunCases(['tc-login']);
    });

    it('groups available cases under their folder and keeps assigned cases out', async () => {
        renderModal();

        await waitFor(() => {
            expect(within(availableColumn()).getByText('Loose case')).toBeInTheDocument();
        });

        // Two groups with work left: Owner (its own case) and Manager / Login.
        expect(within(availableColumn()).getByText('Manager login works')).toBeInTheDocument();
        // The saved case is in the run, so it is not offered as available.
        expect(within(availableColumn()).queryByText('Owner login works')).toBeNull();
        expect(within(assignedColumn()).getByText('Owner login works')).toBeInTheDocument();
    });

    it('hides the folder dropdown entirely', async () => {
        renderModal();
        await waitFor(() => expect(availableColumn()).toBeInTheDocument());

        expect(screen.queryByText('Folder')).toBeNull();
        expect(screen.queryByText('All folders')).toBeNull();
    });

    it('collapses and expands a folder without changing the selection', async () => {
        const onSubmit = renderModal();

        await waitFor(() => screen.getByLabelText('Collapse Owner / Login'));
        await userEvent.click(screen.getByLabelText('Collapse Owner / Login'));

        // Folder is collapsed, so its cases are hidden but still counted.
        expect(screen.getByLabelText('Expand Owner / Login')).toBeInTheDocument();
        expect(screen.queryByText('Owner login fails')).toBeNull();

        await userEvent.click(screen.getByText('Save Changes'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        // Collapsing is a view action only: nothing was assigned or unassigned.
        expect(onSubmit.mock.calls[0][1].additionalTestCaseIds).toEqual([]);
        expect(onSubmit.mock.calls[0][1].removedTestCaseIds).toEqual([]);
    });

    it('assigns every case of one folder from the folder header', async () => {
        const onSubmit = renderModal();

        await waitFor(() => {
            // "Manager / Login" group header, next to its single case.
            expect(within(availableColumn()).getByText('Manager login works')).toBeInTheDocument();
        });

        const managerGroup = screen.getByLabelText('Collapse Manager / Login').closest('div.flex') as HTMLElement;
        await userEvent.click(within(managerGroup).getByText('Assign'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][1].additionalTestCaseIds).toEqual(['tc-manager-login']);
    });

    it('assigns a single case with the per-row button', async () => {
        const onSubmit = renderModal();

        await waitFor(() => screen.getByLabelText('Assign Loose case'));
        await userEvent.click(screen.getByLabelText('Assign Loose case'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][1].additionalTestCaseIds).toEqual(['tc-loose']);
    });

    it('unassigns a single case with the per-row button', async () => {
        const onSubmit = renderModal();

        await waitFor(() => screen.getByLabelText('Unassign Owner login works'));
        await userEvent.click(screen.getByLabelText('Unassign Owner login works'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][1].removedTestCaseIds).toEqual(['tc-login']);
        expect(onSubmit.mock.calls[0][1].additionalTestCaseIds).toEqual([]);
    });

    it('assigns all and unassigns all from the column headers', async () => {
        const onSubmit = renderModal();

        await waitFor(() => screen.getByText('Assign all 3'));
        await userEvent.click(screen.getByText('Assign all 3'));
        // The three new cases are now assigned, so the run holds four.
        await userEvent.click(screen.getByText('Unassign all 4'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        const payload = onSubmit.mock.calls[0][1];
        // The three staged additions were undone by the unassign, so only the
        // case that was genuinely in the run carries a removal id.
        expect(payload.additionalTestCaseIds).toEqual([]);
        expect(payload.removedTestCaseIds).toEqual(['tc-login']);
    });

    it('a case staged for assign then unassign is sent as neither', async () => {
        const onSubmit = renderModal();

        await waitFor(() => screen.getByLabelText('Assign Loose case'));
        await userEvent.click(screen.getByLabelText('Assign Loose case'));
        // It has moved to the assigned column, so undo that decision.
        await userEvent.click(screen.getByLabelText('Unassign Loose case'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        const payload = onSubmit.mock.calls[0][1];
        expect(payload.additionalTestCaseIds).toEqual([]);
        expect(payload.removedTestCaseIds).toEqual([]);
    });

    it('search hides non-matching cases and empty folders', async () => {
        renderModal();

        await waitFor(() => screen.getByLabelText(/Search cases/));
        await userEvent.type(screen.getByLabelText(/Search cases/), 'Loose');

        expect(within(availableColumn()).getByText('Loose case')).toBeInTheDocument();
        expect(screen.queryByText('Manager login works')).toBeNull();
        // A folder with nothing left to assign disappears entirely.
        expect(screen.queryByLabelText('Collapse Owner / Login')).toBeNull();
    });

    it('shows a distinct message when everything is already assigned', async () => {
        setRunCases(testCases.map((testCase) => testCase.id));
        renderModal();

        await waitFor(() => {
            expect(
                within(availableColumn()).getByText('Every test case is already assigned')
            ).toBeInTheDocument();
        });
    });
});
