import React, { useState } from "react";
import toast from "react-hot-toast";
import { getDriveAuthUrl } from "../../../services/googleDriveApi";

interface DriveConnectPanelProps {
  compact?: boolean;
  /** Shown when Google has rejected the stored refresh token (7-day Testing-mode
   * TTL, password change, or manual revocation) rather than never connected. */
  expired?: boolean;
}

/**
 * Panel shown when a project has video evidence enabled but the current user
 * has not connected Google Drive yet — or their connection has expired.
 * Initiates the Drive OAuth flow.
 */
const DriveConnectPanel: React.FC<DriveConnectPanelProps> = ({ compact, expired }) => {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await getDriveAuthUrl();
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start Google Drive connection");
      setConnecting(false);
    }
  };

  return (
    <div className={`rounded-md border border-dashed p-4 text-center ${expired ? "border-amber-400 bg-amber-50" : "border-gray-300 bg-gray-50"} ${compact ? "" : "py-8"}`}>
      <svg
        className={`mx-auto mb-2 h-8 w-8 ${expired ? "text-amber-500" : "text-gray-400"}`}
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 1.608 20.39 15H15.6L12 9.216 8.4 15H3.61L12 1.608Zm7.2 17.784a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Zm-14.4 0a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Zm3.6-2.4h7.2l-3.6 6.192L8.4 16.992Z" />
      </svg>
      {!compact && (
        <p className="mb-1 text-sm font-medium text-gray-700">
          {expired ? "Google Drive connection expired" : "Video evidence uses Google Drive"}
        </p>
      )}
      <p className={`mb-3 text-xs ${expired ? "text-amber-700" : "text-gray-500"}`}>
        {expired
          ? "Google no longer recognizes this connection. Reconnect to keep uploading and viewing evidence."
          : "Connect your Google account so captured videos can be stored privately in your own Drive."}
      </p>
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
          expired ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {connecting
          ? "Redirecting…"
          : expired
            ? "Reconnect Google Drive"
            : "Connect Google Drive"}
      </button>
    </div>
  );
};

export default DriveConnectPanel;