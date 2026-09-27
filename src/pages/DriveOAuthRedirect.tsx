import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";

/**
 * Landing page after the Google Drive OAuth callback.
 * The backend redirects here with ?success=true after saving the connection.
 * When the flow was started from a client's Drive settings it also sends
 * ?client=<displayId>, so we return there instead of the default projects page.
 */
const DriveOAuthRedirect: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    const clientDisplayId = params.get("client");

    const home = clientDisplayId ? "/my-client" : "/test-manager/projects";

    if (success === "true") {
      toast.success(
        clientDisplayId
          ? "Google Drive folder connected"
          : "Google Drive connected"
      );
      navigate(home, { replace: true });
    } else {
      toast.error(
        error ? `Drive connection failed: ${error}` : "Drive connection failed"
      );
      navigate(home, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-center mb-4">Connecting Google Drive...</h2>
        <p className="text-gray-600">Please wait while we finalize your connection.</p>
      </div>
    </div>
  );
};

export default DriveOAuthRedirect;