import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lock, Mail } from 'lucide-react';
import Input from '../components/Input';

describe('Input', () => {
    describe('password fields', () => {
        it('starts masked with a button to reveal it', () => {
            render(<Input icon={Lock} type="password" aria-label="Password" defaultValue="secret123" />);

            expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
            expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
        });

        it('toggles between masked and plain text', async () => {
            const user = userEvent.setup();
            render(<Input icon={Lock} type="password" aria-label="Password" defaultValue="secret123" />);

            const field = screen.getByLabelText('Password');
            await user.click(screen.getByRole('button', { name: 'Show password' }));

            expect(field).toHaveAttribute('type', 'text');
            expect(field).toHaveValue('secret123');
            // The affordance now offers the way back, and reports itself pressed.
            const hide = screen.getByRole('button', { name: 'Hide password' });
            expect(hide).toHaveAttribute('aria-pressed', 'true');

            await user.click(hide);
            expect(field).toHaveAttribute('type', 'password');
        });

        it('keeps the reveal button from submitting the surrounding form', async () => {
            const user = userEvent.setup();
            const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
            render(
                <form onSubmit={onSubmit}>
                    <Input icon={Lock} type="password" aria-label="Password" defaultValue="secret123" />
                </form>
            );

            await user.click(screen.getByRole('button', { name: 'Show password' }));
            expect(onSubmit).not.toHaveBeenCalled();
        });

        it('leaves the value alone while toggling', async () => {
            const user = userEvent.setup();
            render(<Input icon={Lock} type="password" aria-label="Password" defaultValue="secret123" />);

            const field = screen.getByLabelText('Password');
            await user.click(screen.getByRole('button', { name: 'Show password' }));
            await user.type(field, 'more');
            expect(field).toHaveValue('secret123more');

            await user.click(screen.getByRole('button', { name: 'Hide password' }));
            expect(field).toHaveValue('secret123more');
        });

        it('disables the reveal button on a disabled field', () => {
            render(
                <Input icon={Lock} type="password" aria-label="Password" defaultValue="x" disabled />
            );
            expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
        });
    });

    describe('other input types', () => {
        it.each(['email', 'text', 'number', 'tel'] as const)(
            'renders no reveal toggle for type=%s',
            (type) => {
                render(<Input icon={Mail} type={type} aria-label="Field" />);

                expect(screen.getByLabelText('Field')).toHaveAttribute('type', type);
                expect(screen.queryByRole('button', { name: /password/i })).toBeNull();
            }
        );

        it('leaves an input with no explicit type exactly as React rendered it', () => {
            render(<Input icon={Mail} aria-label="Field" />);
            // No type passed: React omits the attribute rather than writing
            // type="undefined", and the browser falls back to text.
            const field = screen.getByLabelText('Field');
            expect(field).not.toHaveAttribute('type');
            expect(screen.queryByRole('button', { name: /password/i })).toBeNull();
        });
    });
});
