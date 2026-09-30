/**
 * API Configuration Utility
 * Centralizes API URL logic for consistent usage across the application
 */
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Get the API URL based on the current environment
 * - Development: uses VITE_DEV_API_URL if set, otherwise defaults to /api (same-origin)
 * - Production with VITE_API_URL set: uses VITE_API_URL
 * - Production without VITE_API_URL: /api (same-origin)
 * 
 * Environment variables:
 * - VITE_DEV_API_URL: API URL for development (e.g., http://localhost:5000/api)
 * - VITE_API_URL: API URL for production (e.g., https://yourdomain.com/api)
 */
export const getApiUrl = (): string => {
	if (import.meta.env.MODE === "development") {
		return import.meta.env.VITE_DEV_API_URL || "/api";
	}
	
	// In production, prefer VITE_API_URL if set, otherwise use relative path
	return import.meta.env.VITE_API_URL || "/api";
};

export const API_URL = getApiUrl();

/* ------------------------------------------------------------------ *
 * Global response handling (shared axios instance)
 * ------------------------------------------------------------------ *
 * There is a single shared axios instance (the global default), so one
 * interceptor here covers every API call.
 *
 * 401 — session expiry. When any authenticated request comes back 401 the
 * session cookie is gone/expired: clear the auth store and send the user to
 * the login screen instead of leaving the app in a broken state with generic
 * errors.
 *
 * Skipped for:
 * - pre-auth endpoints (login/signup/password flows) — their errors are
 *   form messages the pages render themselves;
 * - `/auth/check-auth` — fires on boot; RequireAuth already redirects
 *   unauthenticated visitors via <Navigate>, no full reload needed;
 * - `/auth/logout` — clears state on its own;
 * - public pages (login/client-login/signup/…) — never hijack those.
 * No 401 toast either: the redirect is the feedback, and the auth forms
 * render the server message themselves.
 *
 * 403 / 429 / 5xx / network errors — one toast per class, each reusing a
 * stable toast id so a burst of failing calls (an outage fanning out to ten
 * requests) shows a single toast instead of stacking. The rejection is always
 * re-thrown afterwards, so every existing `.catch` keeps working unchanged.
 *
 * Callers that handle a failure themselves (silent background prefetches,
 * boot probes) can opt out of the toast with `silentError: true` — see the
 * AxiosRequestConfig augmentation below.
 */

declare module "axios" {
	interface AxiosRequestConfig {
		/**
		 * Skip the global error toast for this single request. Use it when the
		 * caller renders its own feedback or deliberately ignores the failure,
		 * so background/boot requests never interrupt the user.
		 */
		silentError?: boolean;
	}
}

const EXCLUDED_401_PATHS = [
	"/auth/login",
	"/auth/signup",
	"/auth/forgot-password",
	"/auth/reset-password",
	"/auth/google",
	"/auth/check-auth",
	"/auth/logout",
];

const PUBLIC_PATH_PREFIXES = [
	"/login",
	"/client-login",
	"/admin/login",
	"/signup",
	"/verify-email",
	"/forgot-password",
	"/reset-password",
	"/oauth-redirect",
	"/drive-oauth-redirect",
];

const requestPath = (url?: string): string =>
	!url ? "" : url.startsWith("http") ? url.replace(/^https?:\/\/[^/]+/, "") : url;

/**
 * True when the interceptor above has already given the user feedback for a
 * rejection, so a call site that catches the same failure must not toast again.
 *
 * Only rejections that are still raw axios errors can be matched here: the
 * service layer (`src/services/*.ts`) rethrows most failures as plain `Error`s
 * carrying the server message, and those — like client-side/logic errors — fall
 * through and are exactly the ones a call site is expected to surface itself.
 */
export const isGloballyHandledError = (error: unknown): boolean => {
	if (!axios.isAxiosError(error)) return false;
	// Cancelled requests are never user-facing failures.
	if (axios.isCancel(error)) return true;
	const status = error.response?.status;
	// 401 always redirects, and the redirect is the feedback.
	if (status === 401) return true;
	// `silentError` opts the caller out of the global toast for this request.
	if (error.config?.silentError === true) return false;
	return status === 403 || status === 429 || status === undefined || status >= 500;
};

const isExcluded401 = (url?: string): boolean => {
	const path = requestPath(url);
	return EXCLUDED_401_PATHS.some((p) => path.includes(p));
};

const onPublicPage = (): boolean =>
	typeof window !== "undefined" &&
	PUBLIC_PATH_PREFIXES.some((p) => window.location.pathname === p || window.location.pathname.startsWith(`${p}/`));

let redirectingToLogin = false;

axios.interceptors.response.use(
	(response) => response,
	(error: unknown) => {
		// Non-Axios rejections (e.g. a bug in a request interceptor) are passed
		// through untouched below.
		if (axios.isAxiosError(error)) {
			const status = error.response?.status;
			const silent = error.config?.silentError === true;

			if (status === 401 && !isExcluded401(error.config?.url) && !onPublicPage() && typeof window !== "undefined") {
				if (!redirectingToLogin) {
					redirectingToLogin = true;
					// Lazy import avoids a circular dependency (authStore imports this module).
					void import("../store/authStore").then(({ useAuthStore }) => {
						useAuthStore.setState({
							user: null,
							isAuthenticated: false,
							error: null,
							isLoading: false,
							isCheckingAuth: false,
						});
						window.location.assign("/login");
					});
				}
			}

			// Global toasts for everything the caller can't act on locally.
			// Stable `id`s keep a burst of failures down to one visible toast;
			// `silentError` and cancelled requests never toast.
			if (!silent && !axios.isCancel(error) && typeof window !== "undefined") {
				if (status === 403) {
					toast.error("You don't have permission to do that", { id: "api-403" });
				} else if (status === 429) {
					toast.error("Too many requests — please wait a moment and try again", { id: "api-429" });
				} else if (status === undefined || status >= 500) {
					// No `response` at all = network/DNS/CORS/timeout failure.
					toast.error("Server error — please try again", { id: "api-server-error" });
				}
			}
		}

		return Promise.reject(error);
	}
);
