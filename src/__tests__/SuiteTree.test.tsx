import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuiteTree from '../components/testManager/SuiteTree';
import { buildSuiteTree } from '../utils/suiteTree';
import type { SuiteNodeSource } from '../utils/suiteTree';

const suites: SuiteNodeSource[] = [
    { id: 'owner', name: 'Owner', parentId: null, depth: 0, isFolder: true, caseCount: 0, totalCaseCount: 2 },
    { id: 'owner-login', name: 'Login', parentId: 'owner', depth: 1, caseCount: 1, totalCaseCount: 1 },
    { id: 'owner-forgot', name: 'Forgot Password', parentId: 'owner-login', depth: 2, caseCount: 1, totalCaseCount: 1 },
    { id: 'manager', name: 'Manager', parentId: null, depth: 0, caseCount: 3, totalCaseCount: 3 },
];

const tree = buildSuiteTree(suites);

describe('SuiteTree', () => {
    it('renders root rows and hides collapsed children', () => {
        render(
            <SuiteTree
                nodes={tree}
                activeSuiteId={null}
                onSelect={() => undefined}
                expandedIds={new Set()}
                onToggleExpand={() => undefined}
            />
        );

        expect(screen.getByText('Owner')).toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();
        // Collapsed: the child is not rendered, but the toggle says it can be.
        expect(screen.queryByText('Login')).toBeNull();
        expect(screen.getByLabelText('Expand Owner')).toBeInTheDocument();
    });

    it('renders nested rows when a folder is expanded', () => {
        render(
            <SuiteTree
                nodes={tree}
                activeSuiteId={null}
                onSelect={() => undefined}
                expandedIds={new Set(['owner', 'owner-login'])}
                onToggleExpand={() => undefined}
            />
        );

        expect(screen.getByText('Login')).toBeInTheDocument();
        expect(screen.getByText('Forgot Password')).toBeInTheDocument();
        expect(screen.getByLabelText('Collapse Owner')).toBeInTheDocument();
    });

    it('reports the clicked suite id', async () => {
        const onSelect = vi.fn();
        render(
            <SuiteTree
                nodes={tree}
                activeSuiteId={null}
                onSelect={onSelect}
                expandedIds={new Set()}
                onToggleExpand={() => undefined}
            />
        );

        await userEvent.click(screen.getByText('Owner'));
        expect(onSelect).toHaveBeenCalledWith('owner');
    });

    it('toggles expand for the folder whose chevron was clicked', async () => {
        const onToggleExpand = vi.fn();
        render(
            <SuiteTree
                nodes={tree}
                activeSuiteId={null}
                onSelect={() => undefined}
                expandedIds={new Set()}
                onToggleExpand={onToggleExpand}
            />
        );

        await userEvent.click(screen.getByLabelText('Expand Owner'));
        expect(onToggleExpand).toHaveBeenCalledWith('owner');
    });

    it('shows the rolled-up case count per node', () => {
        render(
            <SuiteTree
                nodes={tree}
                activeSuiteId={null}
                onSelect={() => undefined}
                expandedIds={new Set(['owner', 'owner-login'])}
                onToggleExpand={() => undefined}
            />
        );

        // Owner holds 2 cases in total (its own 0 + Login's 2), Manager 3.
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    describe('selection mode', () => {
        const renderSelectable = (selectedCaseIds: string[]) =>
            render(
                <SuiteTree
                    nodes={tree}
                    activeSuiteId={null}
                    onSelect={() => undefined}
                    expandedIds={new Set(['owner', 'owner-login'])}
                    onToggleExpand={() => undefined}
                    selectable
                    selectedCaseIds={new Set(selectedCaseIds)}
                    casesUnder={(node) =>
                        node.suite.id === 'owner'
                            ? ['c1', 'c2']
                            : node.suite.id === 'owner-login'
                              ? ['c1']
                              : ['c3']
                    }
                    onToggleSelect={() => undefined}
                />
            );

        it('checks a folder whose cases are all selected', () => {
            renderSelectable(['c1', 'c2', 'c3']);
            expect((screen.getByLabelText('Select Owner') as HTMLInputElement).checked).toBe(true);
        });

        it('shows a folder with some cases selected as indeterminate', () => {
            renderSelectable(['c1']);
            const owner = screen.getByLabelText('Select Owner') as HTMLInputElement;
            expect(owner.checked).toBe(false);
            expect(owner.indeterminate).toBe(true);
        });

        it('leaves a folder unchecked when nothing under it is selected', () => {
            renderSelectable([]);
            const owner = screen.getByLabelText('Select Owner') as HTMLInputElement;
            expect(owner.checked).toBe(false);
            expect(owner.indeterminate).toBe(false);
        });
    });
});