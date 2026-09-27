/**
 * Google Drive API Service
 * Handles Drive OAuth connection and video evidence operations.
 * Uses API_URL + withCredentials (cookie-based auth) per repo conventions.
 */

import axios, { AxiosError } from "axios";
import { API_URL } from "../utils/api";
import {
  ClientDriveConnection,
  ClientDriveFile,
  ClientDriveFolder,
  DriveConnection,
  DriveUploadSession,
  VideoEvidence,
} from "../types/testManager";
import { ApiErrorResponse } from "../types/api/testManager.api";

const getErrorMessage = (error: unknown): string => {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  return axiosError.response?.data?.message || "An unexpected error occurred";
};

// ============================================================================
// DRIVE CONNECTION
// ============================================================================

/**
 * GET /drive/auth/url
 * Returns the Google OAuth URL to connect this user's Drive.
 */
export const getDriveAuthUrl = async (): Promise<string> => {
  try {
    const response = await axios.get<{ success: boolean; url: string }>(
      `${API_URL}/drive/auth/url`,
      { withCredentials: true }
    );
    return response.data.url;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * GET /drive/connection
 * Reports whether the current user has connected Google Drive.
 */
export const getDriveConnection = async (): Promise<DriveConnection> => {
  try {
    const response = await axios.get<{ success: boolean; data: DriveConnection }>(
      `${API_URL}/drive/connection`,
      { withCredentials: true }
    );
    return response.data.data || { connected: false };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * DELETE /drive/connection
 * Revokes the Google authorization and removes stored tokens.
 */
export const disconnectDrive = async (): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/drive/connection`, { withCredentials: true });
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================================
// VIDEO EVIDENCE
// ============================================================================

export interface EvidenceScopeParams {
  ticketId?: string;
  testRunId?: string;
  testRunItemId?: string;
}

export interface CreateUploadSessionParams extends EvidenceScopeParams {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * POST /projects/:projectId/video-evidence/upload-session
 * Backend authorizes a resumable Drive upload; the bytes never pass through us.
 */
export const createUploadSession = async (
  projectId: string,
  params: CreateUploadSessionParams
): Promise<DriveUploadSession> => {
  try {
    const response = await axios.post<{
      success: boolean;
      data: DriveUploadSession;
    }>(`${API_URL}/projects/${projectId}/video-evidence/upload-session`, params, {
      withCredentials: true,
    });
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export interface RegisterEvidenceParams extends EvidenceScopeParams {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * POST /projects/:projectId/video-evidence
 * Registers evidence metadata after the direct upload completes.
 */
export const registerVideoEvidence = async (
  projectId: string,
  params: RegisterEvidenceParams
): Promise<VideoEvidence> => {
  try {
    const response = await axios.post<{
      success: boolean;
      data: VideoEvidence;
    }>(`${API_URL}/projects/${projectId}/video-evidence`, params, {
      withCredentials: true,
    });
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export interface ResolveUploadParams {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * POST /projects/:projectId/video-evidence/resolve-upload
 * Re-locates a file the browser already pushed to Drive when Google's final
 * response was lost. Returns the drive file id so the caller can register it.
 */
export const resolveUploadedFile = async (
  projectId: string,
  params: ResolveUploadParams
): Promise<{ driveFileId: string; webViewLink?: string }> => {
  try {
    const response = await axios.post<{
      success: boolean;
      data: { driveFileId: string; webViewLink?: string };
    }>(`${API_URL}/projects/${projectId}/video-evidence/resolve-upload`, params, {
      withCredentials: true,
    });
    if (!response.data.data) {
      throw new Error("No data returned from server");
    }
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * GET /projects/:projectId/video-evidence
 * Lists evidence for a ticket, run, or run item.
 */
export const listVideoEvidence = async (
  projectId: string,
  params: EvidenceScopeParams = {}
): Promise<VideoEvidence[]> => {
  try {
    const response = await axios.get<{
      success: boolean;
      data: VideoEvidence[];
    }>(`${API_URL}/projects/${projectId}/video-evidence`, {
      params: {
        ...(params.ticketId ? { ticketId: params.ticketId } : {}),
        ...(params.testRunId ? { testRunId: params.testRunId } : {}),
        ...(params.testRunItemId ? { testRunItemId: params.testRunItemId } : {}),
      },
      withCredentials: true,
    });
    return response.data.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * DELETE /projects/:projectId/video-evidence/:evidenceId
 */
export const deleteVideoEvidence = async (
  projectId: string,
  evidenceId: string
): Promise<void> => {
  try {
    await axios.delete(
      `${API_URL}/projects/${projectId}/video-evidence/${evidenceId}`,
      { withCredentials: true }
    );
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Absolute URL for the authenticated proxy video stream.
 * The <video> element streams through the backend with Range support.
 */
export const getEvidenceStreamUrl = (
  projectId: string,
  evidenceId: string
): string => {
  return `${API_URL}/projects/${projectId}/video-evidence/${evidenceId}/stream`;
};

// ============================================================================
// CLIENT SHARED FOLDER (bug screenshots / reference docs)
// ============================================================================

/**
 * GET /drive/client/:displayId/connection
 * Shared folder status. `canManage` comes from the backend so the UI never has
 * to guess whether this caller may connect or disconnect.
 */
export const getClientDriveConnection = async (
  displayId: string
): Promise<ClientDriveConnection> => {
  try {
    const response = await axios.get<{
      success: boolean;
      data: ClientDriveConnection;
    }>(`${API_URL}/drive/client/${displayId}/connection`, {
      withCredentials: true,
    });
    return response.data.data || { connected: false, enabled: false, canManage: false };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * POST /drive/client/:displayId/connect
 * Returns the Google consent URL. The browser navigates to it; the backend
 * binds the resulting token to this client via the state cookie.
 */
export const connectClientDrive = async (displayId: string): Promise<string> => {
  try {
    const response = await axios.post<{ success: boolean; url: string }>(
      `${API_URL}/drive/client/${displayId}/connect`,
      {},
      { withCredentials: true }
    );
    return response.data.url;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/** DELETE /drive/client/:displayId/connection */
export const disconnectClientDrive = async (displayId: string): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/drive/client/${displayId}/connection`, {
      withCredentials: true,
    });
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * POST /drive/project/:projectId/folder
 * Ensures `TSTestManager/<Client>/<Project>` exists and returns its path.
 */
export const ensureProjectDriveFolder = async (
  projectId: string
): Promise<ClientDriveFolder> => {
  try {
    const response = await axios.post<{
      success: boolean;
      data: ClientDriveFolder;
    }>(`${API_URL}/drive/project/${projectId}/folder`, {}, {
      withCredentials: true,
    });
    if (!response.data.data) throw new Error("No data returned from server");
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * POST /drive/project/:projectId/upload?fileName=&mimeType=
 *
 * The bytes go to the backend as a raw body, which relays them to Drive with
 * the *client folder owner's* token. `Content-Type` is forced to
 * `application/octet-stream` so the global `express.json()` middleware can
 * never consume the payload (it would empty out JSON-typed files); the real
 * media type travels as a query parameter instead.
 */
export const uploadToClientDrive = async (
  projectId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<ClientDriveFile> => {
  try {
    const response = await axios.post<{ success: boolean; data: ClientDriveFile }>(
      `${API_URL}/drive/project/${projectId}/upload`,
      file,
      {
        params: {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        },
        headers: { "Content-Type": "application/octet-stream" },
        withCredentials: true,
        onUploadProgress: (event) => {
          if (!onProgress) return;
          const total = event.total ?? file.size;
          onProgress({
            loaded: event.loaded,
            total,
            percent: total > 0 ? Math.round((event.loaded / total) * 100) : 0,
          });
        },
      }
    );
    if (!response.data.data) throw new Error("No data returned from server");
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/** GET /drive/project/:projectId/files */
export const listClientDriveFiles = async (
  projectId: string,
  pageToken?: string
): Promise<{ files: ClientDriveFile[]; nextPageToken?: string }> => {
  try {
    const response = await axios.get<{
      success: boolean;
      data: { files: ClientDriveFile[]; nextPageToken?: string };
    }>(`${API_URL}/drive/project/${projectId}/files`, {
      params: pageToken ? { pageToken } : {},
      withCredentials: true,
    });
    return response.data.data || { files: [] };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

/**
 * Downloads a file via `fetch` + object URL rather than a plain `<a href>`.
 * A bare link to a cross-origin API would not carry the auth cookie, so it
 * would 401; fetching with `credentials: 'include'` does.
 */
export const downloadClientDriveFile = async (
  projectId: string,
  fileId: string,
  fileName: string
): Promise<void> => {
  const response = await fetch(
    `${API_URL}/drive/project/${projectId}/files/${fileId}`,
    { credentials: "include" }
  );

  if (!response.ok) {
    let message = "Download failed";
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message || message;
    } catch {
      // non-JSON error body; keep the default
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};