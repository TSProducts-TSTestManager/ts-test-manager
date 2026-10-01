import React, { useState } from "react";
import { Eye, EyeOff, LucideIcon } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	icon: LucideIcon;
}

const Input: React.FC<InputProps> = ({ icon: Icon, type, ...props }) => {
	/**
	 * Password fields get a reveal toggle so a mistyped or autofilled value can
	 * be checked. Every other input type renders exactly as before, so this is
	 * the one place the behaviour is defined for all 12 password fields in the
	 * app (login, sign up, reset, change password, and the AI API key).
	 */
	const isPassword = type === "password";
	const [revealed, setRevealed] = useState(false);
	const resolvedType = isPassword && revealed ? "text" : type;

	return (
		<div className='relative mb-6'>
			<div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
				<Icon className='size-5 text-gray-500 dark:text-gray-400' />
			</div>
			<input
				{...props}
				type={resolvedType}
				// Room for the reveal button, so long passwords do not run under it.
				className={`w-full pl-10 ${isPassword ? 'pr-11' : 'pr-3'} py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-system-blue focus:ring-2 focus:ring-system-blue/20 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition duration-200`}
			/>
			{isPassword && (
				<button
					// type="button" so revealing a password never submits the form.
					type="button"
					onClick={() => setRevealed((value) => !value)}
					aria-label={revealed ? "Hide password" : "Show password"}
					aria-pressed={revealed}
					title={revealed ? "Hide password" : "Show password"}
					disabled={props.disabled}
					className='absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
				>
					{revealed ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
				</button>
			)}
		</div>
	);
};
export default Input;
