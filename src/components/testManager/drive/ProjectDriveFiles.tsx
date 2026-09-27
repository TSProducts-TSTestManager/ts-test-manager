import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  File as FileIcon,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  UploadCloud,
} from "lucide-react";
import {
  downloadClientDriveFile,
  ensureProjectDriveFolder,
  listClientDriveFiles,
  uploadToClientDrive,
} from "../../../services/googleDriveApi";
import type {
  ClientDriveFile,
  ClientDriveFolder,
} from "../../../types/testManager";

interface ProjectDriveFilesProps {
  projectId: string;
  /** Rendered inside cards elsewhere, so this component stays flat. */
  className?: string;
}

const formatSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
};

const iconFor = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return FileIcon;
  if (mimeType.includes("pdf") || mimeType.startsWith("text/")) return FileText;
  return FileIcon;
};

/**
 * Project-level upload + listing for the client's shared Drive folder.
 *
 * Any project member can use this: the backend writes with the folder owner's
 * token, so no individual Google connection is required here.
 */
const ProjectDriveFiles: React.FC<ProjectDriveFilesProps> = ({
  projectId,
  className = "",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<ClientDriveFolder | null>(null);
  const [files, setFiles] = useState<ClientDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [listing, setListing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const refresh = useCallback(async () => {
    setListing(true);
    try {
      const result = await listClientDriveFiles(projectId);
      setFiles(result.files);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to list files"
      );
    } finally {
      setListing(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resolved = await ensureProjectDriveFolder(projectId);
        if (cancelled) return;
        setFolder(resolved);
        await refresh();
      } catch (error) {
        if (cancelled) return;
        setBlocked(
          error instanceof Error ? error.message : "Drive folder unavailable"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refresh]);

  const handleFiles = async (selected: FileList | File[] | null) => {
    if (!selected || selected.length === 0) return;
    const queue = Array.from(selected);
    setBlocked(null);

    for (const file of queue) {
      setUploading(file.name);
      setProgress(0);
      try {
        await uploadToClientDrive(projectId, file, (event) =>
          setProgress(event.percent)
        );
        toast.success(`Uploaded ${file.name}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        toast.error(message);
        // Folder vanished / connection died - stop the whole batch rather than
        // firing N doomed requests.
        if (/not connected|Reconnect|expired/i.test(message)) {
          setBlocked(message);
          setUploading(null);
          return;
        }
      }
    }

    setUploading(null);
    setProgress(0);
    await refresh();
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    void handleFiles(event.dataTransfer.files);
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 p-4 text-sm text-gray-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Preparing Drive folder…
      </div>
    );
  }

  if (blocked) {
    return (
      <div
        className={`rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20 ${className}`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              File uploads are unavailable
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{blocked}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <Folder className="h-4 w-4 text-blue-600" />
          {folder?.folderPath || "Shared files"}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={listing}
          className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:hover:text-gray-300"
        >
          {listing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20"
            : "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-blue-700"
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin text-blue-600" />
            <p className="truncate text-sm text-gray-600 dark:text-gray-300">
              Uploading {uploading}…
            </p>
            <div className="mx-auto mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <UploadCloud className="mx-auto mb-2 h-7 w-7 text-blue-600" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Drop files here or click to upload
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Screenshots, PDFs, docs — stored in the client&apos;s Drive folder
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <div className="rounded-xl border border-gray-100 dark:border-gray-700">
        {files.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-400">No files yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {files.map((file) => {
              const Icon = iconFor(file.mimeType);
              return (
                <li
                  key={file.id}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm"
                >
                  <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-800 dark:text-gray-100">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatSize(file.size)}
                      {file.createdTime &&
                        ` • ${new Date(file.createdTime).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Drive"
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      title="Download"
                      onClick={() => {
                        void downloadClientDriveFile(
                          projectId,
                          file.id,
                          file.name
                        ).catch((error) =>
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Download failed"
                          )
                        );
                      }}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ProjectDriveFiles;
