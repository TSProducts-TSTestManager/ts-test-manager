import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Folder,
  FolderCheck,
  HardDrive,
  Link2,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
} from "lucide-react";
import {
  connectClientDrive,
  disconnectClientDrive,
  getClientDriveConnection,
} from "../../../services/googleDriveApi";
import type { ClientDriveConnection } from "../../../types/testManager";

interface ClientDriveSettingsProps {
  displayId: string;
}

const statusTone = {
  ok: {
    card: "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20",
    dot: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
  },
  expired: {
    card: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  unknown: {
    card: "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800",
    dot: "bg-gray-400",
    text: "text-gray-600 dark:text-gray-400",
  },
};

/**
 * Client-level Drive folder settings (a "Drive" tab on My Client).
 *
 * This links a shared folder owned by the connecting admin. It is a different
 * concern from a user's personal Drive connection used for video evidence -
 * disconnecting one must not affect the other, which the backend guarantees.
 */
const ClientDriveSettings: React.FC<ClientDriveSettingsProps> = ({ displayId }) => {
  const [connection, setConnection] = useState<ClientDriveConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConnection(await getClientDriveConnection(displayId));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load Drive settings"
      );
    } finally {
      setLoading(false);
    }
  }, [displayId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const url = await connectClientDrive(displayId);
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start connection");
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Unlink this Drive folder? Files already uploaded stay in Drive, but users will no longer be able to upload."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await disconnectClientDrive(displayId);
      toast.success("Drive folder unlinked");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink folder");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-5 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Drive settings…
      </div>
    );
  }

  const connected = connection?.connected === true;
  const tone = statusTone[connection?.status ?? "unknown"] ?? statusTone.unknown;
  const canManage = connection?.canManage === true;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold">
            <HardDrive size={16} className="text-blue-600" />
            Shared Drive folder
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            One folder for every {`client's`} screenshot and reference document,
            stored as{" "}
            <span className="font-mono">TSTestManager/&lt;Client&gt;/&lt;Project&gt;</span>.
            Uploading never requires an individual Google login.
          </p>
        </div>
        {connected && canManage && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={busy}
            className="flex h-fit items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
            Unlink
          </button>
        )}
      </div>

      {!connected && (
        <div
          className={`rounded-xl border border-dashed p-6 text-center ${
            canManage
              ? "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
              : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
          }`}
        >
          <Link2 className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">
            {canManage
              ? "No Drive folder connected yet"
              : "No Drive folder connected yet"}
          </p>
          <p className="mb-4 text-xs text-gray-500">
            {canManage
              ? "Connect a Google account to create the shared folder. Any team member can then upload into it without signing in to Google themselves."
              : "Ask a client admin to connect Google Drive to enable file uploads."}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              {busy ? "Redirecting…" : "Connect Google Drive"}
            </button>
          )}
        </div>
      )}

      {connected && (
        <div className={`rounded-xl border p-4 ${tone.card}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <FolderCheck className={`h-5 w-5 flex-shrink-0 ${tone.text}`} />
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                  {connection?.folderPath || connection?.folderName || "Connected"}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                  {connection?.connectedByEmail
                    ? `Owned by ${connection.connectedByEmail}`
                    : "Owned by the connecting admin"}
                  {connection?.connectedAt &&
                    ` • connected ${new Date(connection.connectedAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>
            <Folder className={`h-4 w-4 flex-shrink-0 ${tone.text}`} />
          </div>

          {connection?.status === "expired" && (
            <div className="mt-3 flex flex-col gap-2 border-t border-amber-200 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Google no longer recognizes this connection. Reconnect so uploads
                keep working.
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={busy}
                  className="flex h-fit items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" /> Reconnect
                </button>
              )}
            </div>
          )}

          {connection?.status === "unknown" && (
            <p className="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700">
              Connection health could not be verified right now. Uploads are
              unaffected unless they start failing.
            </p>
          )}

          {!canManage && (
            <p className="mt-3 border-t border-black/5 pt-3 text-xs text-gray-500">
              You can view this folder but only a client admin can change it.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientDriveSettings;
