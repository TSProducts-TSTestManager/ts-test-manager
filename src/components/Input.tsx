import React from "react";
import { LucideIcon } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	icon: LucideIcon;
}

const Input: React.FC<InputProps> = ({ icon: Icon, ...props }) => {
	return (
		<div className='relative mb-4'>
			<div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
				<Icon className='size-5 text-gray-500' />
			</div>
			<input
				{...props}
				className='w-full pl-10 pr-3 py-2.5 bg-[#1e293b] rounded-lg border border-[#334155] focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 text-white placeholder-gray-500 transition duration-200'
			/>
		</div>
	);
};
export default Input;
