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
	MapPin,
	Phone,
	MessageCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import Input from "../components/Input";
import { useAuthStore } from "../store/authStore";

const products = [
	{ icon: Milk, name: "TSGokul", subtitle: "Dairy Management", desc: "Customer portal, delivery tracking & automated billing", gradient: "from-amber-500 to-orange-600", accent: "#059669" },
	{ icon: GraduationCap, name: "TSConnect", subtitle: "School Operations", desc: "Student safety, transport & campus operations", gradient: "from-blue-500 to-indigo-600", accent: "#2563EB" },
	{ icon: Utensils, name: "TSRestro", subtitle: "Restaurant Operations", desc: "KDS, billing, inventory & loyalty platform", gradient: "from-orange-500 to-red-600", accent: "#D97706" },
	{ icon: ShieldCheck, name: "TSSafeNest", subtitle: "Society Management", desc: "Visitor control, billing & security system", gradient: "from-emerald-500 to-teal-600", accent: "#7C3AED" },
	{ icon: ClipboardCheck, name: "TSTestManager", subtitle: "QA & Testing Platform", desc: "Test case, suites, runs & analytics workspace", gradient: "from-violet-500 to-purple-600", accent: "#4F46E5" },
];

const stats = [
	{ value: "6+", label: "Years of Impact", icon: Award },
	{ value: "120+", label: "Projects Delivered", icon: Building2 },
	{ value: "50+", label: "Clients Served", icon: Users },
	{ value: "80+", label: "Team Members", icon: Sparkles },
];

const LoginPage: React.FC = () => {
	const [email, setEmail] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const navigate = useNavigate();
	const { login, isLoading, error } = useAuthStore();

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
		e.preventDefault();
		try {
			await login(email, password);
			const { user } = useAuthStore.getState();
			if (user && !user.isVerified) navigate("/verify-email");
		} catch {
			// error already handled in authStore
		}
	};

	return (
		<div className="w-full min-h-screen flex flex-col bg-[#0B0F19] relative overflow-hidden" style={{ backgroundImage: "radial-gradient(circle at top center, #1a2235, #0B0F19)", backgroundAttachment: "fixed" }}>
			{/* One background for entire page - TSProducts pattern */}
			<div className="absolute inset-0 bg-[#0B0F19]" style={{ backgroundImage: "radial-gradient(circle at top center, #1a2235, #0B0F19)" }} />
			<div className="absolute -top-32 -left-32 w-[800px] h-[800px] bg-[#6366f1]/10 rounded-full blur-[120px] pointer-events-none" />
			<div className="absolute -bottom-40 -right-40 w-[900px] h-[900px] bg-[#38bdf8]/5 rounded-full blur-[120px] pointer-events-none" />

			{/* Top bar */}
			<div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<img src="/logo.png" alt="TechSignific" className="w-9 h-9 rounded-lg bg-[#1a2235] border border-[#334155] p-1.5 object-contain" />
					<div>
						<div className="font-bold text-[16px] leading-none"><span className="text-amber-400">Tech</span><span style={{ color: "rgb(46,92,116)" }}>Signific</span></div>
						<div className="text-gray-400 text-[10px] tracking-[0.16em] font-medium uppercase">IT Services Pvt Ltd</div>
					</div>
				</div>
				<span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-800 bg-blue-950/50 text-blue-300 text-xs font-semibold">
					<span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Established 2020
				</span>
			</div>

			{/* Main - all panels 5mm below top */}
			<div className="relative z-10 flex-1 flex flex-col lg:flex-row lg:items-center w-full max-w-[1280px] mx-auto gap-6 lg:gap-8 mt-[5mm]">
				{/* LEFT - Company details as is */}
				<div className="lg:w-[55%] flex flex-col justify-center px-6 py-4 lg:px-8 xl:px-10">
					<div className="max-w-[640px] mx-auto lg:mx-0 w-full">
						<div className="inline-flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950/50 text-blue-300 px-3 py-1 text-xs font-semibold mb-4"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />IT Software Solutions & Services</div>
						<h2 className="text-[28px] lg:text-[36px] font-bold leading-[0.95] tracking-tight text-white">IT Software Solutions<br /><span className="text-blue-400">Built for Real Business Impact</span></h2>
						<p className="mt-4 text-sm leading-6 text-gray-400"><span className="font-extrabold"><span className="text-amber-400">Tech</span><span style={{ color: "rgb(46,92,116)" }}>Signific</span></span> delivers custom software, <span className="font-extrabold"><span className="text-amber-400">TS</span><span style={{ color: "rgb(46,92,116)" }}>Product</span></span> platforms and testing services.</p>
						<div className="grid grid-cols-4 gap-3 mt-6">
							{stats.map((s) => (
								<div key={s.label} className="rounded-xl bg-[#1a2235] border border-[#334155] p-3 text-center">
									<s.icon size={14} className="mx-auto text-blue-400 mb-1 hidden sm:block" />
									<div className="text-white font-bold text-[16px] leading-none">{s.value}</div>
									<div className="text-gray-400 text-[10px] leading-tight mt-1 font-medium">{s.label}</div>
								</div>
							))}
						</div>
						<div className="mt-6 flex items-center gap-2">
							<p className="text-gray-400 text-xs font-semibold tracking-widest uppercase">Industry-Focused Platforms</p>
							<span className="text-gray-500 text-[11px]">TSProduct Family</span>
						</div>
						<div className="mt-3 overflow-hidden rounded-xl">
							<motion.div className="flex gap-3 w-max" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }}>
								{[...products, ...products].map((p, idx) => (
									<div key={`${p.name}-${idx}`} className="w-[240px] shrink-0 rounded-xl bg-[#1a2235] border border-[#334155] p-3">
										<div className="flex items-center gap-2.5">
											<div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${p.gradient} flex items-center justify-center shrink-0`}><p.icon size={16} className="text-white" /></div>
											<div><div className="text-white font-bold text-xs leading-none"><span className="text-amber-400">TS</span><span style={{ color: p.accent }}>{p.name.slice(2)}</span></div><div className="text-[10px] font-semibold uppercase text-gray-400">{p.subtitle}</div></div>
										</div>
										<p className="text-[11px] text-gray-400 mt-2 line-clamp-2">{p.desc}</p>
									</div>
								))}
							</motion.div>
						</div>
						<div className="mt-4 flex flex-wrap items-center gap-2 text-gray-400 text-xs">
							<span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Trusted by dairy, education, hospitality & residential sectors</span>
							<span className="hidden sm:inline text-gray-600">•</span>
							<span>enquiry@techsignific.com</span>
						</div>
					</div>
				</div>

				{/* RIGHT - Login panel - professionally on right, fully visible, not cut off */}
				<div className="lg:w-[45%] flex flex-col items-center justify-center px-6 py-4 lg:px-8 lg:py-6 lg:sticky lg:top-4 self-start lg:self-center min-h-0">
					<div className="w-full max-w-[400px]">
						<div className="flex flex-col items-center text-center mb-4">
							<div className="w-12 h-12 rounded-xl bg-[#1a2235] border border-[#334155] p-2 shadow-md flex items-center justify-center">
								<img src="/logo.png" alt="TSTestManager Logo" className="w-full h-full object-contain" />
							</div>
							<h1 className="mt-2.5 text-[22px] font-extrabold tracking-tight leading-none"><span className="text-amber-400">TS</span><span style={{ color: "rgb(46,92,116)" }}>TestManager</span></h1>
							<p className="mt-1 text-[10px] font-semibold tracking-[0.16em] uppercase text-gray-400">QA & Testing Workspace</p>
							<div className="mt-2 flex items-center justify-center">
								<span className="text-[10px] font-medium tracking-wide text-gray-400 flex items-center gap-1.5"><img src="/logo.png" alt="TechSignific" className="w-3 h-3 rounded-sm object-contain opacity-80" /><span><span className="text-amber-400">Tech</span><span style={{ color: "rgb(46,92,116)" }}>Signific</span></span></span>
							</div>
						</div>
						<div className="bg-[#1a2235] rounded-2xl shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)] border-2 border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_8px_32px_rgba(251,191,36,0.15),0_16px_40px_-16px_rgba(0,0,0,0.5)] overflow-hidden">
							<div className="px-6 pt-6 pb-5">
								<div className="mb-4 text-center">
									<h2 className="text-[20px] font-bold tracking-tight text-white">Welcome back</h2>
									<p className="text-xs text-gray-400 mt-1">Sign in to your TSTestManager workspace</p>
								</div>
								<form onSubmit={handleLogin} className="space-y-3">
									<Input icon={Mail} type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}" title="Please enter a valid email address" required />
									<Input icon={Lock} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
									<div className="flex items-center justify-between pt-1">
										<Link to="/forgot-password" className="text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline">Forgot password?</Link>
										<span className="text-[11px] text-gray-500 hidden sm:inline">Secure login • 256-bit encrypted</span>
									</div>
									{error && <div className="rounded-xl bg-red-950/30 border border-red-900/50 px-3 py-2.5"><p className="text-xs font-medium text-red-300">{error}</p></div>}
									<motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition flex items-center justify-center gap-2 disabled:opacity-60 text-sm" type="submit" disabled={isLoading}>
										{isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight size={14} className="opacity-80" /></>}
									</motion.button>
									<p className="text-center text-[11px] text-gray-500">By signing in you agree to our Terms & Privacy Policy</p>
								</form>
							</div>
							<div className="px-6 py-2.5 bg-[#0B0F19] border-t border-[#334155] flex items-center justify-center gap-2 text-[11px] text-gray-500">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> System operational • All services online
							</div>
						</div>
						<p className="text-center text-[11px] text-gray-400 mt-3 px-4">Need access? Contact your workspace admin or <a href="mailto:enquiry@techsignific.com" className="text-blue-400 hover:underline font-medium">enquiry@techsignific.com</a></p>
					</div>
				</div>
			</div>

			{/* Footer - same TSProducts pattern */}
			<footer className="relative z-10 border-t border-[#334155] bg-[#0B0F19]">
				<div className="max-w-[1280px] mx-auto px-6 py-8">
					<div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_0.9fr] gap-8">
						<div>
							<a href="https://techsignific.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2"><img src="/logo.png" alt="TechSignific" className="h-8 w-auto" /><span className="font-extrabold text-[15px]"><span className="text-amber-400">Tech</span><span style={{ color: "rgb(46,92,116)" }}>Signific</span></span></a>
							<p className="mt-3 max-w-sm text-sm leading-6 text-gray-400">A leading provider of software development solutions and services, specializing in complete web and mobile applications, AI products, and digital transformation.</p>
							<div className="mt-4 space-y-1.5 text-sm text-gray-400">
								<a href="mailto:enquiry@techsignific.com" className="flex items-center gap-2 hover:text-blue-400"><Mail size={14} className="text-gray-500" /> enquiry@techsignific.com</a>
								<a href="tel:+918421774604" className="flex items-center gap-2 hover:text-blue-400"><Phone size={14} className="text-gray-500" /> +91 8421774604</a>
								<span className="flex items-center gap-2"><MapPin size={14} className="text-gray-500" /> Pune, INDIA (HQ)</span>
							</div>
						</div>
						<div><h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Services</h4><ul className="space-y-2.5 text-sm text-gray-400">
							<li><a href="https://techsignific.com/services#software-development" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">Software Development</a></li>
							<li><a href="https://techsignific.com/services#software-testing" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">QA & Testing</a></li>
							<li><a href="https://techsignific.com/services#ai-solutions" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">AI Solutions</a></li>
							<li><a href="https://techsignific.com/services#digital-marketing" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">Digital Marketing</a></li></ul></div>
						<div><h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Products</h4><ul className="space-y-2.5 text-sm">
							<li><a href="https://techsignific.com/products/tsgokul" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400"><span className="font-extrabold"><span className="text-amber-400">TS</span><span style={{ color: "rgb(46,92,116)" }}>Gokul</span></span><span className="ml-1.5 text-xs text-gray-500">Dairy</span></a></li>
							<li><a href="https://techsignific.com/products/tsconnect" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400"><span className="font-extrabold"><span className="text-amber-400">TS</span><span style={{ color: "rgb(46,92,116)" }}>Connect</span></span><span className="ml-1.5 text-xs text-gray-500">School</span></a></li>
							<li><a href="https://techsignific.com/products/tsrestro" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400"><span className="font-extrabold"><span className="text-amber-400">TS</span><span style={{ color: "rgb(46,92,116)" }}>Restro</span></span><span className="ml-1.5 text-xs text-gray-500">Restaurant</span></a></li>
							<li><a href="https://techsignific.com/products/tssafenest" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400"><span className="font-extrabold"><span className="text-amber-400">TS</span><span style={{ color: "rgb(46,92,116)" }}>SafeNest</span></span><span className="ml-1.5 text-xs text-gray-500">Society</span></a></li></ul></div>
						<div><h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Company</h4><ul className="space-y-2.5 text-sm text-gray-400">
							<li><a href="https://techsignific.com/about" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">About Us</a></li>
							<li><a href="https://techsignific.com/careers" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">Careers</a></li>
							<li><a href="https://techsignific.com/contact" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">Contact</a></li>
							<li><a href="https://techsignific.com/ai-solutions" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">AI Solutions</a></li></ul>
							<h4 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Legal</h4><ul className="space-y-2.5 text-sm text-gray-400">
							<li><a href="https://techsignific.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">Privacy Policy</a></li>
							<li><a href="https://techsignific.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">Terms & Conditions</a></li>
							<li><a href="https://techsignific.com/cancellation-refund-policy" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">Cancellation & Refund</a></li></ul></div>
						<div className="hidden lg:block"><h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Connect</h4><p className="text-sm text-gray-400">Follow our journey.</p><div className="mt-3 flex gap-2">
							<a href="https://www.linkedin.com/in/tech-signific-6246071a9/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#1a2235] border border-[#334155] flex items-center justify-center text-gray-400 hover:text-blue-400"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
							<a href="https://wa.me/12142720254" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white"><MessageCircle size={14} /></a></div></div>
					</div>
				</div>
				<div className="border-t border-[#334155]">
					<div className="max-w-[1280px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
						<p className="text-xs text-gray-500">© 2026 Tech Signific IT Services Pvt Ltd. All rights reserved.</p>
						<div className="flex gap-3 text-gray-500">
							<a href="https://www.linkedin.com/in/tech-signific-6246071a9/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
							<a href="https://www.facebook.com/Techsignific/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
							<a href="https://www.instagram.com/tech_signific/" target="_blank" rel="noopener noreferrer" className="hover:text-pink-400"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg></a>
							<a href="https://twitter.com/techsignific1" target="_blank" rel="noopener noreferrer" className="hover:text-white"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
};
export default LoginPage;
