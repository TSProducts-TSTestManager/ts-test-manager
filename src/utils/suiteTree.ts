/**
 * Folder-tree helpers for test suites.
 *
 * A suite node may contain test cases and child folders at the same time, so a
 * single suite is both a container and a case bucket. The API keeps suites flat
 * (`parentId` + `depth`); these helpers turn that list into the tree the UI
 * renders and answer the questions the tree needs: who are my children, what is
 * under me, what is my path from the root, and which nodes may adopt me.
 */

/** Folders may nest this many levels deep (root = level 1). */
export const MAX_FOLDER_DEPTH = 3;

/**
 * The fields the tree needs. `TestSuite` satisfies this, and so does the
 * lighter `{ id, name }` shape several callers pass around — anything that only
 * carries a flat list of suites can build the tree without a full TestSuite.
 */
export interface SuiteNodeSource {
    id: string;
    name: string;
    parentId?: string | null;
    depth?: number;
    isFolder?: boolean;
    caseCount?: number;
    totalCaseCount?: number;
    archived?: boolean;
}

export interface SuiteTreeNode<T extends SuiteNodeSource = SuiteNodeSource> {
    suite: T;
    children: SuiteTreeNode<T>[];
    /** 0 for a root node. Mirrors `suite.depth`. */
    depth: number;
    /** Cases in this node plus everything beneath it. */
    totalCaseCount: number;
    /** True when the node holds cases directly, has children, or was made as a folder. */
    isFolderLike: boolean;
}

const parentKey = (suite: SuiteNodeSource): string => suite.parentId ?? '__root__';

/**
 * Build the folder tree from the flat suite list.
 *
 * A suite whose `parentId` points at a suite that is not in the list (archived,
 * filtered out, or a stale reference) is treated as a root node so it can never
 * disappear from the tree.
 */
export const buildSuiteTree = <T extends SuiteNodeSource>(suites: T[]): SuiteTreeNode<T>[] => {
    const present = new Set(suites.map((suite) => suite.id));
    const childrenByParent = new Map<string, T[]>();

    for (const suite of suites) {
        const parent = suite.parentId;
        const key = parent && present.has(parent) ? parent : '__root__';
        const bucket = childrenByParent.get(key);
        if (bucket) bucket.push(suite);
        else childrenByParent.set(key, [suite]);
    }

    const totalCache = new Map<string, number>();

    const totalOf = (suite: T, inProgress: Set<string>): number => {
        const cached = totalCache.get(suite.id);
        if (cached !== undefined) return cached;
        // Cycle guard: data corruption should not spin the render.
        if (inProgress.has(suite.id)) return 0;
        inProgress.add(suite.id);

        const own = suite.totalCaseCount ?? suite.caseCount ?? 0;
        const children = (childrenByParent.get(suite.id) ?? []).map((child) =>
            totalOf(child, inProgress)
        );
        // `totalCaseCount` is authoritative when the server sent it; otherwise
        // roll the children's totals up here.
        const total =
            suite.totalCaseCount ?? own + children.reduce((sum, value) => sum + value, 0);

        inProgress.delete(suite.id);
        totalCache.set(suite.id, total);
        return total;
    };

    const build = (suitesInScope: T[], depth: number): SuiteTreeNode<T>[] =>
        suitesInScope.map((suite) => {
            const children = build(childrenByParent.get(suite.id) ?? [], depth + 1);
            return {
                suite,
                children,
                depth,
                totalCaseCount: totalOf(suite, new Set()),
                isFolderLike:
                    children.length > 0 ||
                    suite.isFolder === true ||
                    (suite.totalCaseCount ?? 0) > (suite.caseCount ?? 0),
            };
        });

    return build(childrenByParent.get('__root__') ?? [], 0);
};

/** Ids of every node beneath `suiteId`, in breadth order. */
export const descendantSuiteIds = (
    suites: SuiteNodeSource[],
    suiteId: string
): string[] => {
    const childrenByParent = new Map<string, string[]>();
    for (const suite of suites) {
        const key = parentKey(suite);
        const bucket = childrenByParent.get(key);
        if (bucket) bucket.push(suite.id);
        else childrenByParent.set(key, [suite.id]);
    }

    const out: string[] = [];
    const queue = [suiteId];
    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const child of childrenByParent.get(current) ?? []) {
            out.push(child);
            queue.push(child);
        }
    }
    return out;
};

/** `suiteId` plus everything beneath it — the set a folder selection covers. */
export const subtreeSuiteIds = (suites: SuiteNodeSource[], suiteId: string): string[] => [
    suiteId,
    ...descendantSuiteIds(suites, suiteId),
];

/** Ids from the root down to (but excluding) the node itself. */
export const ancestorSuiteIds = (suites: SuiteNodeSource[], suiteId: string): string[] => {
    const byId = new Map(suites.map((suite) => [suite.id, suite]));
    const out: string[] = [];
    let current = byId.get(suiteId);
    let parentId = current?.parentId ?? null;

    while (parentId && !out.includes(parentId)) {
        out.unshift(parentId);
        current = byId.get(parentId);
        if (!current) break;
        parentId = current.parentId ?? null;
    }
    return out;
};

/** Names from the root down to the node, e.g. `['Owner', 'Login']`. */
export const suitePathNames = (
    suites: SuiteNodeSource[],
    suiteId: string
): string[] => {
    const byId = new Map(suites.map((suite) => [suite.id, suite]));
    const names = ancestorSuiteIds(suites, suiteId)
        .map((id) => byId.get(id)?.name)
        .filter((name): name is string => !!name);
    const self = byId.get(suiteId)?.name;
    return self ? [...names, self] : names;
};

/** `Owner / Login` — the label used in breadcrumbs, exports and reports. */
export const suitePathLabel = (suites: SuiteNodeSource[], suiteId: string): string =>
    suitePathNames(suites, suiteId).join(' / ');

/**
 * Nodes `movedSuiteId` may be dropped into: everything except itself and its
 * own descendants (which would create a cycle).
 */
export const movableTargets = (
    suites: SuiteNodeSource[],
    movedSuiteId: string
): SuiteNodeSource[] => {
    const forbidden = new Set(subtreeSuiteIds(suites, movedSuiteId));
    return suites.filter((suite) => !forbidden.has(suite.id));
};

/**
 * Keep the nodes matching `query` plus the ancestors needed to reach them, so a
 * search never hides a match behind a collapsed folder.
 */
export const filterSuiteTree = <T extends SuiteNodeSource>(
    nodes: SuiteTreeNode<T>[],
    query: string
): SuiteTreeNode<T>[] => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;

    const walk = (node: SuiteTreeNode<T>): SuiteTreeNode<T> | null => {
        const children = node.children.map(walk).filter((child): child is SuiteTreeNode<T> => !!child);
        const selfMatches = node.suite.name.toLowerCase().includes(needle);
        if (!selfMatches && children.length === 0) return null;
        // A folder whose descendants match stays visible and opens by default.
        return { ...node, children };
    };

    return nodes.map(walk).filter((node): node is SuiteTreeNode<T> => !!node);
};

/** Every node in the tree, flattened depth-first (roots first). */
export const flattenSuiteTree = <T extends SuiteNodeSource>(nodes: SuiteTreeNode<T>[]): SuiteTreeNode<T>[] =>
    nodes.flatMap((node) => [node, ...flattenSuiteTree(node.children)]);
