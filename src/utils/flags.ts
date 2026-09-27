/**
 * Feature flags (env-driven, static so bundlers can dead-code-eliminate).
 *
 * DRIVE_FEATURE_ENABLED — Google Drive connect / video evidence UI.
 * Hidden by default until valid GCP OAuth credentials are configured in the
 * backend (.env: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Set
 * VITE_FEATURE_DRIVE=true to re-enable the Drive UI.
 */
export const DRIVE_FEATURE_ENABLED = import.meta.env.VITE_FEATURE_DRIVE === "true";
