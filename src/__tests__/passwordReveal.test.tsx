import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import LoginPage from '../pages/LoginPage';
import SignUpPage from '../pages/SignUpPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';

vi.mock('../services/authApi', () => ({
    login: vi.fn(),
    superAdminLogin: vi.fn(),
    signup: vi.fn(),
    resetPassword: vi.fn(),
    forgotPassword: vi.fn(),
    verifyResetToken: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    socialLoginUrl: vi.fn(),
    socialLoginStatus: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

/**
 * The reveal toggle lives in the shared `Input`, so every password field in the
 * app gets it. These checks are here to stop that from silently regressing at
 * the page level: a field that bypasses `Input` would have no toggle.
 *
 * framer-motion is not mocked — the auth pages animate in ways jsdom renders
 * fine, and testing against the real components is more useful here.
 */
describe('password reveal across the auth pages', () => {
    it('gives the login page password a working toggle', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );

        const field = screen.getByPlaceholderText('Password');
        expect(field).toHaveAttribute('type', 'password');

        await user.click(screen.getByRole('button', { name: 'Show password' }));
        expect(field).toHaveAttribute('type', 'text');
    });

    it('gives the sign-up page password a working toggle', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <SignUpPage />
            </MemoryRouter>
        );

        const field = screen.getByPlaceholderText('Password');
        expect(field).toHaveAttribute('type', 'password');

        await user.click(screen.getByRole('button', { name: 'Show password' }));
        expect(field).toHaveAttribute('type', 'text');
    });

    it('toggles both fields on the reset-password page independently', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <ResetPasswordPage />
            </MemoryRouter>
        );

        const newPassword = screen.getByPlaceholderText('New Password');
        const confirm = screen.getByPlaceholderText('Confirm New Password');
        expect(newPassword).toHaveAttribute('type', 'password');
        expect(confirm).toHaveAttribute('type', 'password');

        // Revealing one must not reveal the other.
        const buttons = screen.getAllByRole('button', { name: 'Show password' });
        expect(buttons).toHaveLength(2);

        await user.click(buttons[0]);
        expect(newPassword).toHaveAttribute('type', 'text');
        expect(confirm).toHaveAttribute('type', 'password');

        await user.click(screen.getByRole('button', { name: 'Hide password' }));
        expect(newPassword).toHaveAttribute('type', 'password');
    });
});
