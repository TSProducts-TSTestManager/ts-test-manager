import { describe, expect, it } from 'vitest';
import {
    buildSuiteTree,
    descendantSuiteIds,
    filterSuiteTree,
    flattenSuiteTree,
    movableTargets,
    suitePathLabel,
    subtreeSuiteIds,
    MAX_FOLDER_DEPTH,
} from '../utils/suiteTree';
import type { SuiteNodeSource } from '../utils/suiteTree';

/**
 * Role → Feature → sub-feature, the shape the suite page renders:
 *
 *   Owner
 *   ├── Login
 *   │   └── Forgot Password
 *   └── Profile
 *   Manager
 *   └── Login
 */
const suites: SuiteNodeSource[] = [
    { id: 'owner', name: 'Owner', parentId: null, depth: 0, isFolder: true, caseCount: 1, totalCaseCount: 4 },
    { id: 'owner-login', name: 'Login', parentId: 'owner', depth: 1, isFolder: true, caseCount: 1, totalCaseCount: 2 },
    { id: 'owner-forgot', name: 'Forgot Password', parentId: 'owner-login', depth: 2, caseCount: 1, totalCaseCount: 1 },
    { id: 'owner-profile', name: 'Profile', parentId: 'owner', depth: 1, caseCount: 0, totalCaseCount: 0 },
    { id: 'manager', name: 'Manager', parentId: null, depth: 0, isFolder: true, caseCount: 3, totalCaseCount: 3 },
    { id: 'manager-login', name: 'Login', parentId: 'manager', depth: 1, caseCount: 0, totalCaseCount: 0 },
];

describe('buildSuiteTree', () => {
    it('nests suites under their parent and records depth', () => {
        const roots = buildSuiteTree(suites);

        expect(roots.map((node) => node.suite.id)).toEqual(['owner', 'manager']);

        const owner = roots[0];
        expect(owner.depth).toBe(0);
        expect(owner.children.map((c) => c.suite.id)).toEqual(['owner-login', 'owner-profile']);
        expect(owner.children[0].children.map((c) => c.suite.id)).toEqual(['owner-forgot']);
        expect(owner.children[0].children[0].depth).toBe(2);
    });

    it('marks a node as folder-like when it has children or was made as a folder', () => {
        const roots = buildSuiteTree(suites);
        const owner = roots[0];
        const login = owner.children[0];
        const forgot = login.children[0];

        expect(owner.isFolderLike).toBe(true);
        expect(login.isFolderLike).toBe(true);
        // A plain suite holding only its own cases is not folder-like.
        expect(forgot.isFolderLike).toBe(false);
    });

    it('rolls case totals up when the server did not send totalCaseCount', () => {
        const withoutTotals: SuiteNodeSource[] = [
            { id: 'a', name: 'A', parentId: null, caseCount: 1 },
            { id: 'b', name: 'B', parentId: 'a', caseCount: 2 },
            { id: 'c', name: 'C', parentId: 'b', caseCount: 4 },
        ];

        const roots = buildSuiteTree(withoutTotals);
        expect(roots[0].totalCaseCount).toBe(7);
        expect(roots[0].children[0].totalCaseCount).toBe(6);
        expect(roots[0].children[0].children[0].totalCaseCount).toBe(4);
    });

    it('treats a suite whose parent is missing as a root so it cannot disappear', () => {
        const orphaned: SuiteNodeSource[] = [
            { id: 'child', name: 'Child', parentId: 'gone', depth: 1 },
        ];

        const roots = buildSuiteTree(orphaned);
        expect(roots).toHaveLength(1);
        expect(roots[0].depth).toBe(0);
    });

    it('survives a cycle in the data instead of recursing forever', () => {
        const cyclic: SuiteNodeSource[] = [
            { id: 'x', name: 'X', parentId: 'y' },
            { id: 'y', name: 'Y', parentId: 'x' },
        ];

        expect(() => buildSuiteTree(cyclic)).not.toThrow();
    });
});

describe('subtree helpers', () => {
    it('lists descendants of a folder breadth-first', () => {
        expect(descendantSuiteIds(suites, 'owner')).toEqual([
            'owner-login',
            'owner-profile',
            'owner-forgot',
        ]);
        expect(descendantSuiteIds(suites, 'owner-login')).toEqual(['owner-forgot']);
        expect(descendantSuiteIds(suites, 'owner-forgot')).toEqual([]);
    });

    it('includes the node itself in the subtree id list', () => {
        expect(subtreeSuiteIds(suites, 'owner-login')).toEqual([
            'owner-login',
            'owner-forgot',
        ]);
    });

    it('builds a readable path label from the root', () => {
        expect(suitePathLabel(suites, 'owner')).toBe('Owner');
        expect(suitePathLabel(suites, 'owner-login')).toBe('Owner / Login');
        expect(suitePathLabel(suites, 'owner-forgot')).toBe('Owner / Login / Forgot Password');
        // Same folder name under a different role is still unambiguous.
        expect(suitePathLabel(suites, 'manager-login')).toBe('Manager / Login');
    });
});

describe('movableTargets', () => {
    it('excludes the node itself and everything beneath it', () => {
        const targets = movableTargets(suites, 'owner').map((s) => s.id);
        expect(targets).not.toContain('owner');
        expect(targets).not.toContain('owner-login');
        expect(targets).not.toContain('owner-forgot');
        expect(targets).toContain('manager');
    });
});

describe('filterSuiteTree', () => {
    it('returns everything for an empty query', () => {
        const roots = buildSuiteTree(suites);
        expect(filterSuiteTree(roots, '')).toBe(roots);
    });

    it('keeps the ancestors needed to reach a match', () => {
        const roots = buildSuiteTree(suites);
        const filtered = filterSuiteTree(roots, 'forgot');

        expect(filtered).toHaveLength(1);
        expect(filtered[0].suite.id).toBe('owner');
        expect(filtered[0].children[0].suite.id).toBe('owner-login');
        expect(filtered[0].children[0].children[0].suite.id).toBe('owner-forgot');
    });

    it('matches a folder by its own name even when no child matches', () => {
        const roots = buildSuiteTree(suites);
        const filtered = filterSuiteTree(roots, 'profile');
        expect(filtered.map((n) => n.suite.id)).toEqual(['owner']);
    });

    it('drops branches with no match at all', () => {
        const roots = buildSuiteTree(suites);
        expect(filterSuiteTree(roots, 'billing')).toHaveLength(0);
    });
});

describe('flattenSuiteTree', () => {
    it('returns every node depth-first', () => {
        const flat = flattenSuiteTree(buildSuiteTree(suites));
        expect(flat.map((n) => n.suite.id)).toEqual([
            'owner',
            'owner-login',
            'owner-forgot',
            'owner-profile',
            'manager',
            'manager-login',
        ]);
    });
});

describe('MAX_FOLDER_DEPTH', () => {
    it('is three levels, matching the server-side rule', () => {
        expect(MAX_FOLDER_DEPTH).toBe(3);
        const deepest = Math.max(...suites.map((s) => s.depth ?? 0));
        expect(deepest).toBeLessThan(MAX_FOLDER_DEPTH);
    });
});