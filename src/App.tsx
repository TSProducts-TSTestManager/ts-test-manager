import { Navigate, Route, Routes, Outlet, useLocation } from "react-router";
import { Moon, Sun } from "lucide-react";
import React, { Suspense, useEffect } from "react";

// Lazy-loaded page components for code splitting
const SignUpPage = React.lazy(() => import("./pages/SignUpPage"));
const EmailVerificationPage = React.lazy(() => import("./pages/EmailVerificationPage"));
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const ForgotPasswordPage = React.lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = React.lazy(() => import("./pages/ResetPasswordPage"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const OAuthRedirect = React.lazy(() => import("./pages/OAuthRedirect"));
const DriveOAuthRedirect = React.lazy(() => import("./pages/DriveOAuthRedirect"));
const AnalyticsPage = React.lazy(() => import("./pages/analytics"));
const ClientLoginPage = React.lazy(() => import("./pages/ClientLoginPage"));
const SuperAdminLoginPage = React.lazy(() => import("./pages/SuperAdminLoginPage"));

// Test Manager Pages (lazy-loaded)
const TestManagerLayout = React.lazy(() => import("./pages/testManager/TestManagerLayout"));
const ProjectsPage = React.lazy(() => import("./pages/testManager/ProjectsPage"));
const TestCasesPage = React.lazy(() => import("./pages/testManager/TestCasesPage"));
const TestSuitesPage = React.lazy(() => import("./pages/testManager/TestSuitesPage"));
const TestRunsPage = React.lazy(() => import("./pages/testManager/TestRunsPage"));
const TicketsPage = React.lazy(() => import("./pages/testManager/TicketsPage"));
const ClientsPage = React.lazy(() => import("./pages/admin/ClientsPage"));
const ClientDetailPage = React.lazy(() => import("./pages/admin/ClientDetailPage"));
const ClientDashboardPage = React.lazy(() => import("./pages/admin/ClientDashboardPage"));
const ClientAnalyticsPage = React.lazy(() => import("./pages/admin/ClientAnalyticsPage"));

// Non-lazy imports (needed immediately)
import AppLayout from "./components/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import { Toaster } from "react-hot-toast";
import { useThemeStore } from "./store/themeStore";
import { useAuthStore } from "./store/authStore";

// Type for component props
interface ProtectedRouteProps {
  children: React.ReactNode;
}

interface RedirectAuthenticatedUserProps {
  children: React.ReactNode;
}

// protect routes that require authentication
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />;
  }

  if (!user?.isVerified) {
    return <Navigate to='/verify-email' replace />;
  }

  return <>{children}</>;
};

const SuperAdminRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to='/login' replace />;
  if (!user?.isVerified) return <Navigate to='/verify-email' replace />;
  if ((user as any)?.role !== 'super_admin') return <Navigate to='/' replace />;
  return <>{children}</>;
};

const ClientRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to='/login' replace />;
  if (!user?.isVerified) return <Navigate to='/verify-email' replace />;
  if ((user as any)?.role === 'super_admin') return <Navigate to='/admin/dashboard' replace />;
  return <>{children}</>;
};

const SuperAdminRedirect: React.FC = () => {
  const { user } = useAuthStore();
  if ((user as any)?.role === 'super_admin') return <Navigate to='/admin/dashboard' replace />;
  return <Navigate to='/dashboard' replace />;
};

// redirect authenticated users to the home page
const RedirectAuthenticatedUser: React.FC<RedirectAuthenticatedUserProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated && user?.isVerified) {
    return <Navigate to='/' replace />;
  }

  // If user is authenticated but not verified, and they're not on the verify-email page,
  // redirect them to verify-email
  if (isAuthenticated && user && !user.isVerified && location.pathname !== '/verify-email') {
    return <Navigate to='/verify-email' replace />;
  }

  return <>{children}</>;
};

// Public route layout
const PublicRoute: React.FC = () => {
  const { isDarkMode, toggleTheme } = useThemeStore();
  const location = useLocation();
  const isLogin = ["/login", "/client-login", "/admin/login"].includes(location.pathname);
  
  return (
	<div className={`min-h-screen bg-white dark:bg-gray-950 flex flex-col relative ${isLogin ? "" : "items-center justify-center p-4 bg-background dark:bg-background-dark"}`}>
		<button
			onClick={toggleTheme}
			className={`${isLogin ? "absolute top-4 right-4 z-50 bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow-md" : "absolute top-4 right-4"} p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10`}
			aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
			title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
		>
			{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
		</button>
		{isLogin ? <Outlet /> : <Outlet />}
	</div>
  );
};

function App() {
  const { isCheckingAuth, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth) return <LoadingSpinner />;

  return (
    <>
      <Toaster position='top-right' />

      <Suspense fallback={<LoadingSpinner />}>
        <ErrorBoundary>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route
                path='/signup'
                element={
                  <RedirectAuthenticatedUser>
                    <SignUpPage />
                  </RedirectAuthenticatedUser>
                }
              />
              <Route
                path='/login'
                element={
                  <RedirectAuthenticatedUser>
                    <SuperAdminLoginPage />
                  </RedirectAuthenticatedUser>
                }
              />
              <Route
                path='/client-login'
                element={
                  <RedirectAuthenticatedUser>
                    <ClientLoginPage />
                  </RedirectAuthenticatedUser>
                }
              />
              <Route
                path='/admin/login'
                element={
                  <RedirectAuthenticatedUser>
                    <SuperAdminLoginPage />
                  </RedirectAuthenticatedUser>
                }
              />
              <Route
                path='/verify-email'
                element={
                  <RedirectAuthenticatedUser>
                    <EmailVerificationPage />
                  </RedirectAuthenticatedUser>
                }
              />
              <Route
                path="/oauth-redirect"
                element={
                  <RedirectAuthenticatedUser>
                    <OAuthRedirect />
                  </RedirectAuthenticatedUser>
                }
              />
              <Route
                path='/forgot-password'
                element={
                  <RedirectAuthenticatedUser>
                    <ForgotPasswordPage />
                  </RedirectAuthenticatedUser>
                }
              />
              <Route
                path='/reset-password/:token'
                element={
                  <RedirectAuthenticatedUser>
                    <ResetPasswordPage />
                  </RedirectAuthenticatedUser>
                }
              />
            </Route>

            <Route element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <AppLayout />
                </ErrorBoundary>
              </ProtectedRoute>
            }>
              <Route index element={<SuperAdminRedirect />} />
              <Route path='dashboard' element={<ClientRoute><DashboardPage /></ClientRoute>} />

              <Route path='analytics' element={<ClientRoute><AnalyticsPage /></ClientRoute>} />

              <Route path='settings' element={<SettingsPage />} />

              <Route path='drive-oauth-redirect' element={<DriveOAuthRedirect />} />

              {/* Test Manager Routes — hidden for Super Admin */}
              <Route path='test-manager' element={<ClientRoute><TestManagerLayout /></ClientRoute>}>
                <Route index element={<Navigate to="/test-manager/projects" replace />} />
                <Route path='projects' element={<ProjectsPage />} />
                <Route path='cases' element={<TestCasesPage />} />
                <Route path='suites' element={<TestSuitesPage />} />
                <Route path='runs' element={<TestRunsPage />} />
                <Route path='tickets' element={<TicketsPage />} />
              </Route>

              {/* Super Admin — Client Management only */}
              <Route path='admin/dashboard' element={<SuperAdminRoute><ClientDashboardPage /></SuperAdminRoute>} />
              <Route path='admin/clients' element={<SuperAdminRoute><ClientsPage /></SuperAdminRoute>} />
              <Route path='admin/clients/:displayId' element={<SuperAdminRoute><ClientDetailPage /></SuperAdminRoute>} />
              <Route path='admin/analytics' element={<SuperAdminRoute><ClientAnalyticsPage /></SuperAdminRoute>} />
            </Route>

            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
    </>
  );
}

export default App;
