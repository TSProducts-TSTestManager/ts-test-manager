/**
 * Test Manager API Service
 * Handles all API calls for the test case management feature
 * Uses the same pattern as authStore.ts
 */

import axios, { AxiosError } from "axios";
import { API_URL } from "../utils/api";
import { ProjectSettings, ArchiveScope } from "../types/testManager";
import {
  ApiResponse,
  PaginationMeta,
  ApiErrorResponse,
  ProjectResponse,
  TestSuiteResponse,
  TestCaseResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  AddMemberRequest,
  ProjectMemberCandidate,
  CreateTestSuiteRequest,
  UpdateTestSuiteRequest,
  MoveTestSuiteRequest,
  CreateTestCaseRequest,
  UpdateTestCaseRequest,
  Status,
  BulkImportTestCasesRequest,
  BulkImportResult,
  BulkImportWithSuiteRequest,
  BulkImportWithSuiteResult,
} from "../types/api/testManager.api";

// Configure axios to send credentials with all requests
axios.defaults.withCredentials = true;

// Helper to extract error message
const getErrorMessage = (error: unknown): string => {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  return axiosError.response?.data?.message || "An unexpected error occurred";
};

/**
 * Translate a UI archive scope into the `archived` query param the list
 * endpoints expect. `active` omits the param entirely, which is the backend's
 * default (active only).
 */
const toArchiveParams = (
  scope?: ArchiveScope
): { archived?: string } | undefined => {
  if (scope === 'archived') {
    return { archived: 'true' };
  }
  return undefined;
};

// ============================================================================
// PROJECT API
// ============================================================================

/**
 * Create a new project
 */
export const createProject = async (
  data: CreateProjectRequest
): Promise<ProjectResponse> => {
  try {
    const response = await axios.post<ApiResponse<ProjectResponse>>(
      `${API_URL}/projects`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get all projects for the current user
 */
export const getProjects = async (): Promise<ProjectResponse[]> => {
  try {
    const response = await axios.get<ApiResponse<ProjectResponse[]>>(
      `${API_URL}/projects`
    );
    return response.data.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export interface PaginatedProjectsResult {
  items: ProjectResponse[];
  meta: PaginationMeta;
}

/**
 * Get paginated projects for the current user (newest first)
 */
export const getProjectsPaginated = async (
  params: {
    limit: number;
    offset: number;
    search?: string;
    sortField?: 'name' | 'createdAt';
    sortDir?: 'asc' | 'desc';
    /**
     * Ask for soft-deleted projects instead of live ones. Only a client admin
     * ever gets results here; the backend ignores it for every other role.
     */
    deleted?: boolean;
  }
): Promise<PaginatedProjectsResult> => {
  try {
    const query: Record<string, string | number | boolean> = {
      limit: params.limit,
      offset: params.offset,
    };
    if (params.search?.trim()) query.search = params.search.trim();
    if (params.sortField) query.sortField = params.sortField;
    if (params.sortDir) query.sortDir = params.sortDir;
    if (params.deleted) query.deleted = 'true';

    const response = await axios.get<ApiResponse<ProjectResponse[]>>(
      `${API_URL}/projects`,
      { params: query }
    );

    const fallbackMeta: PaginationMeta = {
      total: response.data.data?.length || 0,
      limit: params.limit,
      offset: params.offset,
      hasMore: false,
    };

    return {
      items: response.data.data || [],
      meta: response.data.meta || fallbackMeta,
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get a single project by ID
 */
export const getProject = async (id: string): Promise<ProjectResponse> => {
  try {
    const response = await axios.get<ApiResponse<ProjectResponse>>(
      `${API_URL}/projects/${id}`
    );
    if (!response.data.data) {
      throw new Error("Project not found");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Update a project
 */
export const updateProject = async (
  id: string,
  data: UpdateProjectRequest
): Promise<ProjectResponse> => {
  try {
    const response = await axios.put<ApiResponse<ProjectResponse>>(
      `${API_URL}/projects/${id}`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Delete a project
 */
export const deleteProject = async (id: string): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/projects/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Restore a soft-deleted project. Client admin of the project's own client
 * only — the same permission the delete required.
 */
export const restoreProject = async (id: string): Promise<void> => {
  try {
    await axios.post(`${API_URL}/projects/${id}/restore`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Irreversibly delete a project and everything in it. Separate from
 * `deleteProject`, which is a recoverable soft delete.
 */
export const purgeProject = async (id: string): Promise<void> => {
  try {
    await axios.post(`${API_URL}/projects/${id}/purge`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Users of the project's client that can be assigned (owner / client_admin only)
 */
export const listMemberCandidates = async (
  projectId: string
): Promise<ProjectMemberCandidate[]> => {
  try {
    const response = await axios.get<ApiResponse<ProjectMemberCandidate[]>>(
      `${API_URL}/projects/${projectId}/members/candidates`
    );
    return response.data.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Assign existing client users to a project (no user is created here)
 */
export const assignProjectMembers = async (
  projectId: string,
  data: AddMemberRequest
): Promise<ProjectResponse> => {
  try {
    const response = await axios.post<ApiResponse<ProjectResponse>>(
      `${API_URL}/projects/${projectId}/members`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Change a member's project role (lead / editor / viewer)
 */
export const updateProjectMemberRole = async (
  projectId: string,
  memberId: string,
  role: string
): Promise<ProjectResponse> => {
  try {
    const response = await axios.patch<ApiResponse<ProjectResponse>>(
      `${API_URL}/projects/${projectId}/members/${memberId}`,
      { role }
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Remove a member from a project
 */
export const removeProjectMember = async (
  projectId: string,
  memberId: string
): Promise<ProjectResponse> => {
  try {
    const response = await axios.delete<ApiResponse<ProjectResponse>>(
      `${API_URL}/projects/${projectId}/members/${memberId}`
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get project settings
 */
export const getProjectSettings = async (projectId: string): Promise<ProjectSettings> => {
  try {
    const response = await axios.get<ApiResponse<ProjectSettings>>(
      `${API_URL}/projects/${projectId}/settings`
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Update project settings
 */
export const updateProjectSettings = async (
  projectId: string,
  settings: ProjectSettings
): Promise<ProjectSettings> => {
  try {
    const response = await axios.put<ApiResponse<ProjectSettings>>(
      `${API_URL}/projects/${projectId}/settings`,
      settings
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Permanently delete custom field data from all test cases
 */
export const permanentlyDeleteCustomFieldData = async (
  projectId: string,
  fieldId: string
): Promise<{ deletedCount: number }> => {
  try {
    const response = await axios.delete<ApiResponse<{ deletedCount: number }>>(
      `${API_URL}/projects/${projectId}/settings/custom-fields/${fieldId}`,
      { withCredentials: true }
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================================
// TEST SUITE API
// ============================================================================

/**
 * Create a new test suite
 */
export const createTestSuite = async (
  projectId: string,
  data: CreateTestSuiteRequest
): Promise<TestSuiteResponse> => {
  try {
    const response = await axios.post<ApiResponse<TestSuiteResponse>>(
      `${API_URL}/projects/${projectId}/suites`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get all test suites for a project.
 *
 * Archived suites are hidden unless `archived` asks for them.
 */
export const getTestSuites = async (
  projectId: string,
  options: { archived?: ArchiveScope } = {}
): Promise<TestSuiteResponse[]> => {
  try {
    const response = await axios.get<ApiResponse<TestSuiteResponse[]>>(
      `${API_URL}/projects/${projectId}/suites`,
      { params: toArchiveParams(options.archived) }
    );
    return response.data.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get a single test suite by ID
 */
export const getTestSuite = async (id: string): Promise<TestSuiteResponse> => {
  try {
    const response = await axios.get<ApiResponse<TestSuiteResponse>>(
      `${API_URL}/suites/${id}`
    );
    if (!response.data.data) {
      throw new Error("Test suite not found");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Update a test suite
 */
export const updateTestSuite = async (
  id: string,
  data: UpdateTestSuiteRequest
): Promise<TestSuiteResponse> => {
  try {
    const response = await axios.put<ApiResponse<TestSuiteResponse>>(
      `${API_URL}/suites/${id}`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Move a suite/folder under a new parent (`null` = root level).
 */
export const moveTestSuite = async (
  id: string,
  data: MoveTestSuiteRequest
): Promise<TestSuiteResponse> => {
  try {
    const response = await axios.put<ApiResponse<TestSuiteResponse>>(
      `${API_URL}/suites/${id}/move`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Delete a test suite. Deleting a folder also deletes every folder beneath it
 * and all of their test cases.
 */
export const deleteTestSuite = async (id: string): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/suites/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Archive a test suite. Every test case inside it is archived as well.
 */
export const archiveTestSuite = async (
  id: string
): Promise<TestSuiteResponse> => {
  try {
    const response = await axios.post<ApiResponse<TestSuiteResponse>>(
      `${API_URL}/suites/${id}/archive`
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Restore an archived test suite along with its test cases.
 */
export const restoreTestSuite = async (
  id: string
): Promise<TestSuiteResponse> => {
  try {
    const response = await axios.post<ApiResponse<TestSuiteResponse>>(
      `${API_URL}/suites/${id}/restore`
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================================
// TEST CASE API
// ============================================================================

/**
 * Create a new test case
 */
export const createTestCase = async (
  suiteId: string,
  data: CreateTestCaseRequest
): Promise<TestCaseResponse> => {
  try {
    const response = await axios.post<ApiResponse<TestCaseResponse>>(
      `${API_URL}/suites/${suiteId}/cases`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get all test cases in a suite
 */
export const getTestCases = async (
  suiteId: string,
  options: { archived?: ArchiveScope } = {}
): Promise<TestCaseResponse[]> => {
  try {
    const response = await axios.get<ApiResponse<TestCaseResponse[]>>(
      `${API_URL}/suites/${suiteId}/cases`,
      { params: toArchiveParams(options.archived) }
    );
    return response.data.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get paginated test cases in a suite
 */
/**
 * Server-side filters for the paginated case list.
 *
 * Sent to the server so the list stays paged while search/filter/sort still
 * cover every row. Anything left to the browser would only match the page it
 * has already loaded.
 */
export interface CaseListQuery {
  limit: number;
  offset: number;
  archived?: ArchiveScope;
  search?: string;
  status?: string[];
  priority?: string[];
  /** Empty string means "test type not set", matching the UI's Not set option. */
  testType?: string[];
  area?: string;
  /** Narrow the list to one suite/folder. */
  suiteId?: string;
  /**
   * With `suiteId`, widen the list to the whole folder tree
   * (`subtree`) or keep it to the node's own cases (`direct`, default).
   */
  suiteScope?: 'direct' | 'subtree';
  lastModifiedStart?: string | null;
  lastModifiedEnd?: string | null;
  createdStart?: string | null;
  createdEnd?: string | null;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
}

/** Drop empty values and join the list-valued filters the API expects as CSV. */
const toCaseQueryParams = (query: CaseListQuery): Record<string, string | number> => {
  const params: Record<string, string | number> = {
    limit: query.limit,
    offset: query.offset,
  };
  const scope = toArchiveParams(query.archived);
  if (scope?.archived) params.archived = scope.archived;

  if (query.search?.trim()) params.search = query.search.trim();
  if (query.status?.length) params.status = query.status.join(',');
  if (query.priority?.length) params.priority = query.priority.join(',');
  if (query.testType?.length) params.testType = query.testType.join(',');
  if (query.area?.trim()) params.area = query.area.trim();
  if (query.suiteId) {
    params.suiteId = query.suiteId;
    if (query.suiteScope) params.suiteScope = query.suiteScope;
  }
  if (query.lastModifiedStart) params.lastModifiedStart = query.lastModifiedStart;
  if (query.lastModifiedEnd) params.lastModifiedEnd = query.lastModifiedEnd;
  if (query.createdStart) params.createdStart = query.createdStart;
  if (query.createdEnd) params.createdEnd = query.createdEnd;
  if (query.sortField) params.sortField = query.sortField;
  if (query.sortDir) params.sortDir = query.sortDir;
  return params;
};

export const getTestCasesBySuitePaginated = async (
  suiteId: string,
  params: CaseListQuery
): Promise<PaginatedTestCasesResult> => {
  try {
    const response = await axios.get<ApiResponse<TestCaseResponse[]>>(
      `${API_URL}/suites/${suiteId}/cases`,
      { params: toCaseQueryParams(params) }
    );

    const fallbackMeta: PaginationMeta = {
      total: response.data.data?.length || 0,
      limit: params.limit,
      offset: params.offset,
      hasMore: false,
    };

    return {
      items: response.data.data || [],
      meta: response.data.meta || fallbackMeta,
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get all test cases in a project
 */
export const getTestCasesByProject = async (
  projectId: string,
  options: { archived?: ArchiveScope } = {}
): Promise<TestCaseResponse[]> => {
  try {
    const response = await axios.get<ApiResponse<TestCaseResponse[]>>(
      `${API_URL}/projects/${projectId}/cases`,
      { params: toArchiveParams(options.archived) }
    );
    return response.data.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export interface PaginatedTestCasesResult {
  items: TestCaseResponse[];
  meta: PaginationMeta;
}

/**
 * Get paginated test cases in a project
 */
export const getTestCasesByProjectPaginated = async (
  projectId: string,
  params: CaseListQuery
): Promise<PaginatedTestCasesResult> => {
  try {
    const response = await axios.get<ApiResponse<TestCaseResponse[]>>(
      `${API_URL}/projects/${projectId}/cases`,
      { params: toCaseQueryParams(params) }
    );

    const fallbackMeta: PaginationMeta = {
      total: response.data.data?.length || 0,
      limit: params.limit,
      offset: params.offset,
      hasMore: false,
    };

    return {
      items: response.data.data || [],
      meta: response.data.meta || fallbackMeta,
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Payload for creating one test case in a project by suite name or id.
 * Mirrors the columns of the downloadable upload template.
 */
export interface CreateTestCaseInProjectPayload {
  suiteId?: string;
  suiteName?: string;
  createSuiteIfMissing?: boolean;
  title: string;
  area?: string;
  testDescription?: string;
  /** Plain text, one step per line. */
  testStep?: string;
  stepsContent?: string;
  expectedResult?: string;
  priority?: string;
  status?: string;
  testType?: string;
  comments?: string;
  customFields?: Record<string, string>;
  skipIfDuplicate?: boolean;
}

export interface CreateTestCaseInProjectOutcome {
  created: boolean;
  /** True when `skipIfDuplicate` was set and a matching title already existed. */
  skipped: boolean;
  testCase?: TestCaseResponse;
}

/**
 * Create a single test case in a project.
 *
 * One case per request, which is what the row-at-a-time upload uses to report
 * progress as it goes. The same endpoint serves external integrations.
 */
export const createTestCaseInProject = async (
  projectId: string,
  payload: CreateTestCaseInProjectPayload
): Promise<CreateTestCaseInProjectOutcome> => {
  try {
    const response = await axios.post<
      ApiResponse<TestCaseResponse> & { skipped?: boolean }
    >(`${API_URL}/projects/${projectId}/cases`, payload);
    return {
      created: !response.data.skipped,
      skipped: response.data.skipped === true,
      testCase: response.data.data,
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get all unique area values for a project
 */
export const getAreasByProject = async (projectId: string): Promise<string[]> => {
  try {
    const response = await axios.get<ApiResponse<string[]>>(
      `${API_URL}/projects/${projectId}/cases/areas`
    );
    return response.data.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get all unique area values for a suite
 */
export const getAreasBySuite = async (suiteId: string): Promise<string[]> => {
  try {
    const response = await axios.get<ApiResponse<string[]>>(
      `${API_URL}/suites/${suiteId}/cases/areas`
    );
    return response.data.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Get a single test case by ID
 */
export const getTestCase = async (id: string): Promise<TestCaseResponse> => {
  try {
    const response = await axios.get<ApiResponse<TestCaseResponse>>(
      `${API_URL}/cases/${id}`
    );
    if (!response.data.data) {
      throw new Error("Test case not found");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Update a test case
 */
export const updateTestCase = async (
  id: string,
  data: UpdateTestCaseRequest
): Promise<TestCaseResponse> => {
  try {
    const response = await axios.put<ApiResponse<TestCaseResponse>>(
      `${API_URL}/cases/${id}`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Clone a test case
 */
export const cloneTestCase = async (id: string): Promise<TestCaseResponse> => {
  try {
    const response = await axios.post<ApiResponse<TestCaseResponse>>(
      `${API_URL}/cases/${id}/clone`
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Delete a test case
 */
export const deleteTestCase = async (id: string): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/cases/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Archive a test case (soft delete). It leaves the case list, the run case
 * picker, and analytics, but stays attached to runs it already belongs to.
 */
export const archiveTestCase = async (
  id: string
): Promise<TestCaseResponse> => {
  try {
    const response = await axios.post<ApiResponse<TestCaseResponse>>(
      `${API_URL}/cases/${id}/archive`
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Restore a previously archived test case
 */
export const restoreTestCase = async (
  id: string
): Promise<TestCaseResponse> => {
  try {
    const response = await axios.post<ApiResponse<TestCaseResponse>>(
      `${API_URL}/cases/${id}/restore`
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Bulk archive or restore test cases
 */
export const bulkArchiveTestCases = async (
  ids: string[],
  archived: boolean
): Promise<{ changedCount: number }> => {
  try {
    const response = await axios.patch<
      ApiResponse<{ changedCount: number }>
    >(`${API_URL}/cases/bulk-archive`, { ids, archived });
    return response.data.data || { changedCount: 0 };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Bulk update status for multiple test cases
 */
export const bulkUpdateStatus = async (
  testCaseIds: string[],
  status: Status
): Promise<{ updatedCount: number }> => {
  try {
    const response = await axios.patch<
      ApiResponse<{ updatedCount: number }>
    >(`${API_URL}/cases/bulk-status`, {
      testCaseIds,
      status,
    });
    return response.data.data || { updatedCount: 0 };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Bulk delete test cases
 */
export const bulkDeleteTestCases = async (ids: string[]): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/cases/bulk`, {
      data: { ids }
    });
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Reorder test cases within a suite
 */
export const reorderTestCases = async (
  suiteId: string,
  orderedIds: string[]
): Promise<{ updatedCount: number }> => {
  try {
    // Convert orderedIds array to items array with { caseId, newOrder } format (backend expects these field names)
    const items = orderedIds.map((id, index) => ({ caseId: id, newOrder: index }));
    const response = await axios.patch<ApiResponse<{ updatedCount: number }>>(
      `${API_URL}/suites/${suiteId}/cases/reorder`,
      { items }
    );
    return response.data.data || { updatedCount: 0 };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Bulk import test cases from CSV
 */
export const bulkImportTestCases = async (
  suiteId: string,
  data: BulkImportTestCasesRequest
): Promise<BulkImportResult> => {
  try {
    const response = await axios.post<ApiResponse<BulkImportResult>>(
      `${API_URL}/suites/${suiteId}/cases/bulk-import`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Bulk import test cases with suite support at project level
 * Test cases can specify a suite name in CSV, and suites can be auto-created
 */
export const bulkImportTestCasesWithSuite = async (
  projectId: string,
  data: BulkImportWithSuiteRequest
): Promise<BulkImportWithSuiteResult> => {
  try {
    const response = await axios.post<ApiResponse<BulkImportWithSuiteResult>>(
      `${API_URL}/projects/${projectId}/cases/bulk-import`,
      data
    );
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// Export all API functions as a namespace for convenience
export const testManagerApi = {
  // Projects
  createProject,
  getProjects,
  getProjectsPaginated,
  getProject,
  updateProject,
  deleteProject,
  restoreProject,
  purgeProject,
  listMemberCandidates,
  assignProjectMembers,
  updateProjectMemberRole,
  removeProjectMember,
  // Test Suites
  createTestSuite,
  getTestSuites,
  getTestSuite,
  updateTestSuite,
  moveTestSuite,
  deleteTestSuite,
  archiveTestSuite,
  restoreTestSuite,
  // Test Cases
  createTestCase,
  getTestCases,
  getTestCasesBySuitePaginated,
  getTestCasesByProject,
  getTestCasesByProjectPaginated,
  getTestCase,
  updateTestCase,
  deleteTestCase,
  archiveTestCase,
  restoreTestCase,
  bulkArchiveTestCases,
  bulkUpdateStatus,
  bulkDeleteTestCases,
  reorderTestCases,
  bulkImportTestCases,
  bulkImportTestCasesWithSuite,
};
