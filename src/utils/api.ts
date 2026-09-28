/**
 * API Configuration Utility
 * Centralizes API URL logic for consistent usage across the application
 */
import axios from "axios";

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
 * Global 401 handling (session expiry)
 * ------------------------------------------------------------------ *
 * There is a single shared axios instance (the global default), so one
 * interceptor here covers every API call. When any authenticated request
 * comes back 401 the session cookie is gone/expired: clear the auth store
 * and send the user to the login screen instead of leaving the app in a
 * broken state with generic errors.
 *
 * Skipped for:
 * - pre-auth endpoints (login/signup/password flows) — their errors are
 *   form messages the pages render themselves;
 * - `/auth/check-auth` — fires on boot; RequireAuth already redirects
 *   unauthenticated visitors via <Navigate>, no full reload needed;
 * - `/auth/logout` — clears state on its own;
 * - public pages (login/client-login/signup/…) — never hijack those.
 */
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
		const axiosError = error as { response?: { status?: number }; config?: { url?: string } };
		const status = axiosError.response?.status;

		if (status === 401 && !isExcluded401(axiosError.config?.url) && !onPublicPage() && typeof window !== "undefined") {
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

		return Promise.reject(error);
	}
);
