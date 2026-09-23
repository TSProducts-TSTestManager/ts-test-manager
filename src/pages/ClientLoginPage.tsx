import React, { useState } from "react";
import { motion } from "framer-motion";
import {
	Mail,
	Lock,
	Loader,
	ArrowRight,
	Milk,
	GraduationCap,
	Utensils,
	ShieldCheck,
	ClipboardCheck,
	Building2,
	Users,
	Award,
	Sparkles,
	Phone,
	MapPin,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import Input from "../components/Input";
import { useAuthStore } from "../store/authStore";

const products = [
	{
		icon: Milk,
		name: "TSGokul",
		subtitle: "Dairy Management",
		desc: "Customer portal, delivery tracking & automated billing",
		gradient: "from-amber-500 to-orange-600",
		accent: "#059669",
	},
	{
		icon: GraduationCap,
		name: "TSConnect",
		subtitle: "School Operations",
		desc: "Student safety, transport & campus operations",
		gradient: "from-blue-500 to-indigo-600",
		accent: "#2563EB",
	},
	{
		icon: Utensils,
		name: "TSRestro",
		subtitle: "Restaurant Operations",
		desc: "KDS, billing, inventory & loyalty platform",
		gradient: "from-orange-500 to-red-600",
		accent: "#D97706",
	},
	{
		icon: ShieldCheck,
		name: "TSSafeNest",
		subtitle: "Society Management",
		desc: "Visitor control, billing & security system",
		gradient: "from-emerald-500 to-teal-600",
		accent: "#7C3AED",
	},
	{
		icon: ClipboardCheck,
		name: "TSTestManager",
		subtitle: "QA & Testing Platform",
		desc: "Test case, suites, runs & analytics workspace",
		gradient: "from-violet-500 to-purple-600",
		accent: "#4F46E5",
	},
];

const stats = [
	{ value: "6+", label: "Years of Impact", icon: Award },
	{ value: "120+", label: "Projects Delivered", icon: Building2 },
	{ value: "50+", label: "Clients Served", icon: Users },
	{ value: "80+", label: "Team Members", icon: Sparkles },
];

const ClientLoginPage: React.FC = () => {
	const [clientCode, setClientCode] = useState<string>("");
	const [email, setEmail] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const navigate = useNavigate();
	const { login, isLoading, error } = useAuthStore();

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		try {
			await login(email, password, clientCode.toUpperCase().trim());
			const { user } = useAuthStore.getState();
			if (user && !user.isVerified) {
				navigate("/verify-email");
			}
		} catch {
			// Error is already set in the store
		}
	};

	return (
		<div className="w-full min-h-screen flex flex-col bg-gray-950 transition-colors duration-300">
			<div className="flex flex-1 flex-col lg:flex-row w-full">
				<div className="lg:w-[58%] relative overflow-hidden bg-gray-950 flex flex-col">
					<div className="absolute inset-0">
						<div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-900" />
						<div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[100px]" />
						<div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] bg-indigo-900/10 rounded-full blur-[100px]" />
					</div>
					<div className="relative z-10 flex flex-col flex-1 px-6 py-8 lg:px-10 xl:px-14 lg:py-10">
						<div className="flex items-center justify-between mb-8 lg:mb-10">
							<div className="flex items-center gap-3">
								<img src="/logo.png" alt="TechSignific" className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 p-1.5 shadow-sm object-contain" />
								<div>
									<h1 className="font-bold text-[17px] leading-none tracking-tight"><span className="text-amber-400">Tech</span><span style={{ color: "rgb(46,92,116)" }}>Signific</span></h1>
									<p className="text-gray-400 text-[11px] tracking-[0.18em] font-medium uppercase">IT Services Pvt Ltd</p>
								</div>
							</div>
							<span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-800 bg-blue-950/50 text-blue-300 text-xs font-semibold backdrop-blur">
								<span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
								Established 2020
							</span>
						</div>
						<div className="flex-1 flex flex-col justify-center max-w-[640px]">
							<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
								<div className="inline-flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950/50 text-blue-300 px-4 py-1.5 text-xs font-semibold mb-5">
									<span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
									Client Workspace Login
								</div>
								<h2 className="text-[30px] lg:text-[38px] xl:text-[42px] font-bold leading-[0.95] tracking-tight text-white">
									Secure Client<br />
									<span className="text-blue-400">Workspace Access</span>
								</h2>
								<p className="mt-6 max-w-xl text-[14px] lg:text-[15px] leading-7 text-gray-400">
									Sign in with your <span className="font-bold text-white">Client ID</span> (e.g. CLT-0001), email and password. Same email can be used across multiple clients as isolated accounts.
								</p>
							</motion.div>
							<motion.div
								initial={{ opacity: 0, y: 16 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.6, delay: 0.15 }}
								className="grid grid-cols-4 gap-3 mt-8"
							>
								{stats.map((s) => (
									<div key={s.label} className="rounded-2xl bg-gray-900 border border-gray-800 p-3 lg:p-3.5 text-center">
										<s.icon size={14} className="mx-auto text-blue-400 mb-1.5 hidden lg:block" />
										<div className="text-white font-bold text-[18px] lg:text-[20px] leading-none">{s.value}</div>
										<div className="text-gray-400 text-[10px] lg:text-[11px] leading-tight mt-1 font-medium">{s.label}</div>
									</div>
								))}
							</motion.div>
						</div>
						<div className="mt-4 -mx-6 lg:-mx-10 xl:-mx-14 relative">
							<div className="absolute left-0 top-0 bottom-0 w-10 lg:w-14 bg-gradient-to-r from-gray-950 to-transparent z-10 pointer-events-none" />
							<div className="absolute right-0 top-0 bottom-0 w-10 lg:w-14 bg-gradient-to-l from-gray-950 to-transparent z-10 pointer-events-none" />
							<div className="overflow-hidden py-3">
								<motion.div
									className="flex gap-4 w-max"
									animate={{ x: ["0%", "-50%"] }}
									transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
								>
									{[...products, ...products].map((p, idx) => (
										<div
											key={`${p.name}-${idx}`}
											className="w-[260px] shrink-0 rounded-2xl bg-gray-900 border border-gray-800 p-4 shadow-xl shadow-black/30 backdrop-blur"
										>
											<div className="flex items-start gap-3">
												<div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center shadow-lg shrink-0`}>
													<p.icon size={20} className="text-white" />
												</div>
												<div className="min-w-0">
													<h4 className="text-white font-bold text-sm leading-none"><span className="text-amber-400">TS</span><span style={{color: p.accent=== '#059669' ? '#059669' : p.accent=== '#2563EB' ? '#2563EB' : p.accent}}>{p.name.slice(2)}</span></h4>
													<p className="text-[11px] font-semibold tracking-wide uppercase text-gray-400 mt-1">{p.subtitle}</p>
												</div>
											</div>
											<p className="text-[12.5px] leading-relaxed text-gray-400 mt-3 line-clamp-2">{p.desc}</p>
											<div className="mt-3 flex items-center gap-1.5 text-xs font-semibold" style={{ color: p.accent }}>
												<span>Explore</span>
												<ArrowRight size={12} />
											</div>
										</div>
									))}
								</motion.div>
							</div>
						</div>
					</div>
				</div>

				<div className="lg:w-[42%] relative overflow-hidden bg-gray-950 flex flex-col transition-colors duration-300">
					<div className="absolute inset-0">
						<div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-900" />
						<div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px]" />
						<div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[100px]" />
					</div>
					<div className="relative z-10 flex flex-1 items-center justify-center p-4 lg:p-6">
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
							className="w-full max-w-[400px]"
						>
							<div className="flex flex-col items-center text-center mb-4">
								<div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 shadow-md ring-1 ring-black/5 dark:ring-white/5 flex items-center justify-center transition-colors duration-300">
									<img src="/logo.png" alt="TSTestManager Logo" className="w-full h-full object-contain" />
								</div>
								<h1 className="mt-2.5 text-[22px] font-extrabold tracking-tight leading-none">
									<span className="text-amber-400">TS</span>
									<span style={{ color: "rgb(46,92,116)" }}>TestManager</span>
								</h1>
								<p className="mt-1 text-[10px] font-semibold tracking-[0.16em] uppercase text-gray-400">Client Workspace</p>
								<div className="mt-2 flex items-center justify-center">
									<span className="text-[10px] font-medium tracking-wide text-white/60 flex items-center gap-1.5">
										<Building2 size={12} className="opacity-80" />
										Client Login
									</span>
								</div>
							</div>

							<div className="bg-white dark:bg-gray-900 rounded-2xl shadow-[0_16px_40px_-16px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors duration-300">
								<div className="px-6 pt-6 pb-5">
									<div className="mb-4">
										<h2 className="text-[20px] font-bold tracking-tight text-gray-900 dark:text-white">Client Login</h2>
										<p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Enter your Client ID, email and password</p>
									</div>

									<form onSubmit={handleLogin} className="space-y-0">
										<div className="relative mb-3">
											<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
												<Building2 className="h-4 w-4 text-gray-400" />
											</div>
											<input
												type="text"
												placeholder="Client ID (e.g. CLT-0001)"
												value={clientCode}
												onChange={(e) => setClientCode(e.target.value.toUpperCase())}
												pattern="CLT-[0-9]{4}"
												title="Client ID format: CLT-0001"
												required
												className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
											/>
										</div>
										<Input
											icon={Mail}
											type="email"
											placeholder="Email Address"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
											title="Please enter a valid email address"
											required
										/>
										<Input
											icon={Lock}
											type="password"
											placeholder="Password"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											required
										/>

										<div className="flex items-center justify-between -mt-1 mb-3">
											<Link to="/forgot-password" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline">
												Forgot password?
											</Link>
											<Link to="/login" className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:underline">
												Super Admin Login
											</Link>
										</div>

										{error && (
											<div className="mb-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-3 py-2.5">
												<p className="text-xs font-medium text-red-700 dark:text-red-300">{error}</p>
											</div>
										)}

										<motion.button
											whileHover={{ scale: 1.01 }}
											whileTap={{ scale: 0.99 }}
											className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-200 dark:shadow-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
											type="submit"
											disabled={isLoading}
										>
											{isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight size={14} className="opacity-80" /></>}
										</motion.button>

										<p className="text-center text-[11px] text-gray-500 dark:text-gray-500 mt-2.5">
											Same email can be used in multiple clients with different Client IDs (isolated accounts)
										</p>
									</form>
								</div>

								<div className="px-6 py-2.5 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-gray-500">
									<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
									Secure login • 256-bit encrypted
								</div>
							</div>

							<p className="text-center text-[11px] text-gray-400 mt-3 px-4">
								Super Admin?{" "}
								<Link to="/login" className="text-blue-400 hover:underline font-medium">
									Go to Super Admin Login
								</Link>
							</p>
						</motion.div>
					</div>
				</div>
			</div>
			
			{/* FOOTER - Professional: Logo | About Us | Contact */}
			<footer className="border-t border-gray-800 bg-gray-950">
				<div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
					<div>
						<a href="https://techsignific.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
							<img src="/logo.png" alt="TechSignific" className="h-9 w-auto bg-white rounded-lg p-1" />
							<span className="font-extrabold tracking-tight text-lg"><span className="text-amber-400">Tech</span><span className="text-white">Signific</span></span>
						</a>
						<p className="mt-4 text-sm leading-6 text-gray-400 max-w-xs">
							Building reliable software for real business impact — from custom products to QA and digital growth.
						</p>
					</div>
					<div>
						<h4 className="text-sm font-semibold text-white mb-4">About Us</h4>
						<p className="text-sm leading-6 text-gray-400">
							TechSignific IT Services Pvt Ltd, Pune — 6+ years, 120+ projects, 50+ clients. We craft efficient, scalable solutions with clarity and confidence.
						</p>
						<a href="https://techsignific.com/about" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm text-blue-400 hover:text-blue-300">Learn more →</a>
					</div>
					<div>
						<h4 className="text-sm font-semibold text-white mb-4">Contact</h4>
						<div className="space-y-3 text-sm text-gray-400">
							<a href="mailto:enquiry@techsignific.com" className="flex items-center gap-2 hover:text-white"><Mail size={14} /> enquiry@techsignific.com</a>
							<a href="tel:+918421774604" className="flex items-center gap-2 hover:text-white"><Phone size={14} /> +91 8421774604</a>
							<span className="flex items-center gap-2"><MapPin size={14} /> Pune, INDIA (HQ)</span>
						</div>
					</div>
				</div>
				<div className="border-t border-gray-800">
					<div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
						<p>© 2026 Tech Signific IT Services Pvt Ltd. All rights reserved.</p>
						<div className="flex items-center gap-4">
							<a href="https://techsignific.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white">Privacy</a>
							<a href="https://techsignific.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-white">Terms</a>
						</div>
					</div>
				</div>
			</footer>

		</div>
	);
};

export default ClientLoginPage;
