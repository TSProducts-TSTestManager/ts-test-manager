import { useCallback, useEffect, useState } from 'react';
import { getProjectsPaginated } from '../services/testManagerApi';
import { mapProjectResponse, useTestManagerStore } from '../store/testManagerStore';
import { useDebounce } from './useDebounce';
import type { Project } from '../types/testManager';

const PROJECT_OPTION_PAGE_SIZE = 50;

interface UseProjectOptionsResult {
    /**
     * Rows to render. With no search text this is the shared store list, so it
     * stays in step with whatever else is using it; with a search it is the
     * server's answer for the whole project list, not one page of it.
     */
    options: Project[];
    /** The current search term (undebounced, for controlled inputs). */
    search: string;
    setSearch: (value: string) => void;
    /** Whether a search is still running, so the list can show a spinner. */
    isSearching: boolean;
    hasMore: boolean;
    isSearchingMore: boolean;
    loadMore: () => void;
    /** Clear the search text (used when the dropdown is dismissed). */
    reset: () => void;
}

/**
 * Project options for a dropdown/selector, backed by the server.
 *
 * The store's `projects` list is shared with the app (it is what resolves the
 * active project, permissions and so on), so a search here must not overwrite
 * it. Results are kept locally instead, and the active project is pinned into
 * the list so the current selection can never disappear behind a filter.
 */
export function useProjectOptions(activeProject: string | null): UseProjectOptionsResult {
    const projects = useTestManagerStore((state) => state.projects);

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 250);
    const [isSearching, setIsSearching] = useState(false);

    // `null` means "no search in flight" — the store list is shown instead.
    const [searchResults, setSearchResults] = useState<Project[] | null>(null);
    const [resultsOffset, setResultsOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isSearchingMore, setIsSearchingMore] = useState(false);

    const query = debouncedSearch.trim();

    useEffect(() => {
        if (!query) {
            setSearchResults(null);
            setHasMore(false);
            return;
        }

        let cancelled = false;
        setIsSearching(true);

        getProjectsPaginated({
            limit: PROJECT_OPTION_PAGE_SIZE,
            offset: 0,
            search: query,
        })
            .then((response) => {
                if (cancelled) return;
                const items = response.items.map(mapProjectResponse);
                setSearchResults(items);
                setResultsOffset(items.length);
                setHasMore(response.meta.hasMore && items.length < response.meta.total);
            })
            .catch(() => {
                if (!cancelled) {
                    // An empty list on failure reads as "no matches", which is
                    // the safe answer for a search box.
                    setSearchResults([]);
                    setResultsOffset(0);
                    setHasMore(false);
                }
            })
            .finally(() => {
                if (!cancelled) setIsSearching(false);
            });

        return () => {
            cancelled = true;
        };
    }, [query]);

    const loadMore = useCallback(() => {
        if (!query || !hasMore || isSearchingMore) return;

        setIsSearchingMore(true);
        getProjectsPaginated({
            limit: PROJECT_OPTION_PAGE_SIZE,
            offset: resultsOffset,
            search: query,
        })
            .then((response) => {
                const incoming = response.items.map(mapProjectResponse);
                setSearchResults((previous) => {
                    const existing = new Set((previous ?? []).map((project) => project.id));
                    return [...(previous ?? []), ...incoming.filter((project) => !existing.has(project.id))];
                });
                const totalLoaded = resultsOffset + incoming.length;
                setResultsOffset(totalLoaded);
                setHasMore(response.meta.hasMore && totalLoaded < response.meta.total);
            })
            .catch(() => {
                // Keep whatever is already rendered; the next scroll retries.
            })
            .finally(() => {
                setIsSearchingMore(false);
            });
    }, [query, hasMore, isSearchingMore, resultsOffset]);

    const reset = useCallback(() => setSearch(''), []);

    const baseOptions = searchResults ?? projects;
    const options: Project[] = activeProject
        ? baseOptions.some((project) => project.id === activeProject)
            ? baseOptions
            : (() => {
                  const active = projects.find((project) => project.id === activeProject);
                  return active ? [active, ...baseOptions] : baseOptions;
              })()
        : baseOptions;

    return {
        options,
        search,
        setSearch,
        isSearching,
        hasMore: searchResults ? hasMore : false,
        isSearchingMore,
        loadMore,
        reset,
    };
}
