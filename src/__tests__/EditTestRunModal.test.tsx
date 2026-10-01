import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditTestRunModal from '../pages/testManager/components/EditTestRunModal';
import type { TestCase, TestRunListItem } from '../types/testManager';
import type { SuiteNodeSource } from '../utils/suiteTree';

const getTestRun = vi.hoisted(() => vi.fn());

vi.mock('../services/testRunApi', () => ({
    testRunApi: {
        getTestRun,
        updateTestRun: vi.fn(),
    },
}));

vi.mock('../components/testManager/TagInput', () => ({
    default: () => null,
}));

/**
 *   Owner                  (no cases of its own)
 *   └── Login              <- tc-login, tc-login-2
 *   Manager
 *   └── Login              <- tc-manager-login
 *   Driver
 *   └── Login              <- tc-driver-login
 */
const suites: SuiteNodeSource[] = [
    { id: 'owner', name: 'Owner', parentId: null, depth: 0, isFolder: true },
    { id: 'owner-login', name: 'Login', parentId: 'owner', depth: 1, isFolder: true },
    { id: 'manager', name: 'Manager', parentId: null, depth: 0, isFolder: true },
    { id: 'manager-login', name: 'Login', parentId: 'manager', depth: 1, isFolder: true },
    { id: 'driver', name: 'Driver', parentId: null, depth: 0, isFolder: true },
    { id: 'driver-login', name: 'Login', parentId: 'driver', depth: 1, isFolder: true },
];

const makeCase = (id: string, title: string, suiteId: string, suite: string, area = 'Login'): TestCase =>
    ({
        id,
        title,
        suiteId,
        suite,
        area,
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
    makeCase('tc-driver-login', 'Driver login works', 'driver-login', 'Login'),
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
        setRunCases(['tc-login']);
    });

    it('keeps parent folders visible so a nested folder is never orphaned', async () => {
        renderModal();

        await waitFor(() =>
            expect(within(availableColumn()).getByText('Manager login works')).toBeInTheDocument()
        );

        // "Owner" holds no cases itself but is still shown, so its "Login"
        // child reads as Owner / Login rather than a bare "Login".
        const available = availableColumn();
        expect(within(available).getByText('Owner')).toBeInTheDocument();
        expect(within(available).getByText('Manager')).toBeInTheDocument();
        expect(within(available).getByText('Driver')).toBeInTheDocument();
    });

    it('labels every folder row by its full path', async () => {
        renderModal();

        await waitFor(() =>
            expect(within(availableColumn()).getByLabelText('Collapse Owner')).toBeInTheDocument()
        );
        // Three folders are all called "Login"; the accessible name disambiguates.
        expect(within(availableColumn()).getByLabelText('Collapse Owner / Login')).toBeInTheDocument();
        expect(within(availableColumn()).getByLabelText('Collapse Manager / Login')).toBeInTheDocument();
        expect(within(availableColumn()).getByLabelText('Collapse Driver / Login')).toBeInTheDocument();
    });

    it('shows the folder path under a case, without repeating the area', async () => {
        renderModal();

        await waitFor(() => {
            const available = availableColumn();
            const row = within(available).getByText('Manager login works').closest('div.flex') as HTMLElement;
            // "Login • Login" told the user nothing; the path does.
            expect(within(row).getByText('Manager / Login')).toBeInTheDocument();
        });
    });

    it('keeps the area in the row when it differs from the folder name', async () => {
        setRunCases([]);
        render(
            <EditTestRunModal
                isOpen
                onClose={() => undefined}
                testRun={run}
                testRunGroups={[]}
                testCases={[
                    makeCase('tc-x', 'Odd case', 'owner-login', 'Login', 'Password Reset'),
                ]}
                testSuites={suites}
                onSubmit={vi.fn().mockResolvedValue(undefined)}
                tagSuggestions={[]}
            />
        );

        await waitFor(() => {
            const row = screen.getByText('Odd case').closest('div.flex') as HTMLElement;
            expect(within(row).getByText('Owner / Login • Password Reset')).toBeInTheDocument();
        });
    });

    it('hides a folder whose whole subtree is empty', async () => {
        setRunCases(testCases.map((c) => c.id).concat());
        renderModal();

        await waitFor(() => {
            expect(within(availableColumn()).getByText('Every test case is already assigned')).toBeInTheDocument();
        });
        // The assigned column still shows its branch; the available one is empty.
        expect(within(availableColumn()).queryByText('Owner')).toBeNull();
        expect(within(assignedColumn()).getByText('Owner')).toBeInTheDocument();
    });

    it('collapses a branch without changing the staged changes', async () => {
        const onSubmit = renderModal();

        await waitFor(() => within(availableColumn()).getByLabelText('Collapse Manager'));
        await userEvent.click(within(availableColumn()).getByLabelText('Collapse Manager'));

        expect(within(availableColumn()).queryByText('Manager login works')).toBeNull();
        // The child folder header goes with it.
        expect(within(availableColumn()).queryByLabelText('Collapse Manager / Login')).toBeNull();

        await userEvent.click(screen.getByText('Save Changes'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][1].additionalTestCaseIds).toEqual([]);
        expect(onSubmit.mock.calls[0][1].removedTestCaseIds).toEqual([]);
    });

    it('collapsing one column leaves the other column alone', async () => {
        renderModal();

        await waitFor(() =>
            expect(within(availableColumn()).getByLabelText('Collapse Owner / Login')).toBeInTheDocument()
        );
        // The same case is assigned, so the right column shows the same branch.
        expect(within(assignedColumn()).getByLabelText('Collapse Owner / Login')).toBeInTheDocument();

        await userEvent.click(within(availableColumn()).getByLabelText('Collapse Owner / Login'));
        // Left collapsed…
        expect(within(availableColumn()).queryByLabelText('Collapse Owner / Login')).toBeNull();
        // …right untouched.
        expect(within(assignedColumn()).getByLabelText('Collapse Owner / Login')).toBeInTheDocument();
    });

    it('assigns a whole branch from a parent folder header', async () => {
        const onSubmit = renderModal();

        await waitFor(() => within(availableColumn()).getByLabelText('Collapse Manager'));
        const managerHeader = within(availableColumn()).getByLabelText('Collapse Manager').closest('div.flex') as HTMLElement;
        await userEvent.click(within(managerHeader).getByText('Assign'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][1].additionalTestCaseIds).toEqual(['tc-manager-login']);
    });

    it('assigns a single case with the per-row button', async () => {
        const onSubmit = renderModal();

        await waitFor(() => screen.getByLabelText('Assign Manager login works'));
        await userEvent.click(screen.getByLabelText('Assign Manager login works'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][1].additionalTestCaseIds).toEqual(['tc-manager-login']);
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

    it('unassigns a whole branch from a parent folder header', async () => {
        setRunCases(['tc-login', 'tc-login-2']);
        const onSubmit = renderModal();

        // Both Owner cases are in the run, so the branch lives in the right column.
        await waitFor(() =>
            expect(within(assignedColumn()).getByLabelText('Collapse Owner')).toBeInTheDocument()
        );
        const ownerHeader = within(assignedColumn())
            .getByLabelText('Collapse Owner')
            .closest('div.flex') as HTMLElement;
        await userEvent.click(within(ownerHeader).getByText('Unassign'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][1].removedTestCaseIds).toEqual(
            expect.arrayContaining(['tc-login', 'tc-login-2'])
        );
    });

    it('assigns all and unassigns all from the column headers', async () => {
        const onSubmit = renderModal();

        await waitFor(() => screen.getByText('Assign all 3'));
        await userEvent.click(screen.getByText('Assign all 3'));
        await userEvent.click(screen.getByText('Unassign all 4'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        const payload = onSubmit.mock.calls[0][1];
        // The three staged additions were undone; only the case that was
        // genuinely in the run carries a removal id.
        expect(payload.additionalTestCaseIds).toEqual([]);
        expect(payload.removedTestCaseIds).toEqual(['tc-login']);
    });

    it('a case staged for assign then unassign is sent as neither', async () => {
        const onSubmit = renderModal();

        await waitFor(() => screen.getByLabelText('Assign Manager login works'));
        await userEvent.click(screen.getByLabelText('Assign Manager login works'));
        await userEvent.click(screen.getByLabelText('Unassign Manager login works'));
        await userEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        const payload = onSubmit.mock.calls[0][1];
        expect(payload.additionalTestCaseIds).toEqual([]);
        expect(payload.removedTestCaseIds).toEqual([]);
    });

    it('search hides non-matching cases and the folders left empty', async () => {
        renderModal();

        await waitFor(() => screen.getByLabelText(/Search cases/));
        await userEvent.type(screen.getByLabelText(/Search cases/), 'Manager');

        const available = availableColumn();
        expect(within(available).getByText('Manager login works')).toBeInTheDocument();
        expect(screen.queryByText('Driver')).toBeNull();
        expect(screen.queryByText('Owner')).toBeNull();
    });
});
