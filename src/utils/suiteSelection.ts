/**
 * Tri-state checkbox state for a folder node in the suite tree.
 *
 * Lives apart from SuiteTree.tsx so that file only exports components (React
 * Fast Refresh warns about mixed exports).
 */
export type SuiteSelectionState = 'none' | 'all' | 'partial';

/**
 * 'none' when nothing under the node is selected, 'all' when every case is,
 * 'partial' in between. A node with no cases at all is 'none' and is rendered
 * disabled, so an empty folder never looks selectable.
 */
export const checkboxState = (
    caseIds: string[],
    selectedCaseIds: Set<string>
): SuiteSelectionState => {
    if (caseIds.length === 0) return 'none';

    let selected = 0;
    for (const id of caseIds) {
        if (selectedCaseIds.has(id)) selected += 1;
    }
    if (selected === 0) return 'none';
    return selected === caseIds.length ? 'all' : 'partial';
};
