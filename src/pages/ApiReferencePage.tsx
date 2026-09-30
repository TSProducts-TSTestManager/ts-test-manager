import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Braces, Check, ChevronDown, Copy, Info, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../utils/api';
import { createApiCatalog } from './apiReference/catalog';
import type { ApiBlock, ApiSection, CodeSnippet, EndpointRow, HttpMethod, NoteTone } from './apiReference/types';

const METHOD_BADGE: Record<HttpMethod, string> = {
	GET: 'bg-emerald-100 text-emerald-700 ring-emerald-600/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25',
	POST: 'bg-blue-100 text-blue-700 ring-blue-600/25 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/25',
	PUT: 'bg-amber-100 text-amber-700 ring-amber-600/25 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
	PATCH: 'bg-purple-100 text-purple-700 ring-purple-600/25 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-400/25',
	DELETE: 'bg-red-100 text-red-700 ring-red-600/25 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/25',
};

const NOTE_STYLE: Record<NoteTone, { wrapper: string; icon: LucideIcon; iconClass: string; titleClass: string; bodyClass: string }> = {
	info: {
		wrapper: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50',
		icon: Info,
		iconClass: 'text-blue-600 dark:text-blue-300',
		titleClass: 'text-blue-900 dark:text-blue-200',
		bodyClass: 'text-blue-800/90 dark:text-blue-100/80',
	},
	security: {
		wrapper: 'border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10',
		icon: ShieldCheck,
		iconClass: 'text-amber-600 dark:text-amber-300',
		titleClass: 'text-amber-900 dark:text-amber-200',
		bodyClass: 'text-amber-800/90 dark:text-amber-100/80',
	},
	warning: {
		wrapper: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
		icon: TriangleAlert,
		iconClass: 'text-red-600 dark:text-red-300',
		titleClass: 'text-red-900 dark:text-red-200',
		bodyClass: 'text-red-800/90 dark:text-red-100/80',
	},
	tip: {
		wrapper: 'border-system-blue/30 bg-system-blue/10 dark:border-system-blue/40 dark:bg-system-blue/10',
		icon: Info,
		iconClass: 'text-system-blue',
		titleClass: 'text-system-blue',
		bodyClass: 'text-gray-700 dark:text-gray-200',
	},
};

const haystackOf = (s: ApiSection): string => {
	const parts: string[] = [s.title, s.overview];
	for (const block of s.blocks) {
		switch (block.kind) {
			case 'paragraph':
				parts.push(block.text);
				break;
			case 'bullets':
				parts.push(block.title ?? '', ...block.items);
				break;
			case 'note':
				parts.push(block.title, block.text);
				break;
			case 'code':
				parts.push(block.title ?? '', ...block.snippets.map((sn) => `${sn.label} ${sn.code}`));
				break;
			case 'table':
				parts.push(block.title ?? '', ...block.columns, ...block.rows.flat());
				break;
			case 'fields':
				parts.push(block.title ?? '', ...block.fields.map((f) => `${f.name} ${f.type} ${f.notes}`));
				break;
			case 'endpoints':
				parts.push(
					block.title ?? '',
					...block.endpoints.map((e) => `${e.method} ${e.path} ${e.description} ${e.example?.code ?? ''}`),
				);
				break;
		}
	}
	return parts.join(' ').toLowerCase();
};

const CopyButton: React.FC<{ text: string; compact?: boolean }> = ({ text, compact }) => {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			toast.success('Copied');
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error('Could not copy to clipboard');
		}
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			aria-label="Copy to clipboard"
			className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
				compact
					? 'text-gray-300 hover:bg-white/10 hover:text-white'
					: 'text-gray-500 hover:bg-black/5 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100'
			}`}
		>
			{copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
			{copied ? 'Copied' : 'Copy'}
		</button>
	);
};

const CodeBlock: React.FC<{ snippet: CodeSnippet }> = ({ snippet }) => (
	<div className="mt-2.5 overflow-hidden rounded-lg border border-gray-200 bg-gray-950 dark:border-gray-800">
		<div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1.5">
			<span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
				{snippet.label}
			</span>
			<CopyButton text={snippet.code} compact />
		</div>
		<pre className="overflow-x-auto px-3 py-3 text-xs leading-relaxed text-gray-100">
			<code>{snippet.code}</code>
		</pre>
	</div>
);

const EndpointItem: React.FC<{ endpoint: EndpointRow }> = ({ endpoint }) => {
	const [open, setOpen] = useState(false);
	const hasExample = Boolean(endpoint.example);

	return (
		<div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-800/40">
			<div className="flex items-start gap-3">
				<span
					className={`inline-flex w-[68px] shrink-0 justify-center rounded-md px-1.5 py-1 text-[10px] font-bold tracking-wide ring-1 ring-inset ${METHOD_BADGE[endpoint.method]}`}
				>
					{endpoint.method}
				</span>
				<div className="min-w-0 flex-1">
					<p className="break-all font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">{endpoint.path}</p>
					<p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{endpoint.description}</p>
				</div>
				{hasExample && (
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						aria-expanded={open}
						className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-system-blue transition-colors hover:bg-system-blue/10 dark:text-system-blue"
					>
						Example
						<ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
					</button>
				)}
			</div>
			{open && endpoint.example && <CodeBlock snippet={endpoint.example} />}
		</div>
	);
};

const BlockView: React.FC<{ block: ApiBlock }> = ({ block }) => {
	switch (block.kind) {
		case 'paragraph':
			return <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{block.text}</p>;

		case 'bullets':
			return (
				<div className="mt-4">
					{block.title && (
						<p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
							{block.title}
						</p>
					)}
					<ul className="mt-2 space-y-1.5">
						{block.items.map((item, i) => (
							<li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
								<span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-system-blue" />
								<span>{item}</span>
							</li>
						))}
					</ul>
				</div>
			);

		case 'note': {
			const style = NOTE_STYLE[block.tone];
			const ToneIcon = style.icon;
			return (
				<div className={`mt-4 flex gap-3 rounded-lg border p-3.5 ${style.wrapper}`}>
					<ToneIcon size={16} className={`mt-0.5 flex-shrink-0 ${style.iconClass}`} />
					<div className="text-sm">
						<p className={`font-semibold ${style.titleClass}`}>{block.title}</p>
						<p className={`mt-0.5 leading-relaxed ${style.bodyClass}`}>{block.text}</p>
					</div>
				</div>
			);
		}

		case 'code':
			return (
				<div className="mt-4">
					{block.title && (
						<p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
							{block.title}
						</p>
					)}
					{block.snippets.map((snippet, i) => (
						<CodeBlock key={i} snippet={snippet} />
					))}
				</div>
			);

		case 'table':
			return (
				<div className="mt-4">
					{block.title && (
						<p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
							{block.title}
						</p>
					)}
					<div className="mt-2 overflow-x-auto">
						<table className="w-full text-sm border-collapse">
							<thead>
								<tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
									{block.columns.map((col, i) => (
										<th key={i} className="py-2 pr-4 font-semibold">
											{col}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{block.rows.map((row, ri) => (
									<tr key={ri} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
										{row.map((cell, ci) => (
											<td
												key={ci}
												className={`py-2.5 pr-4 align-top text-gray-600 dark:text-gray-400 ${
													ci === 0 ? 'font-medium whitespace-nowrap text-gray-900 dark:text-gray-100' : ''
												}`}
											>
												{cell}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			);

		case 'fields':
			return (
				<div className="mt-4">
					{block.title && (
						<p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
							{block.title}
						</p>
					)}
					<div className="mt-2 overflow-x-auto">
						<table className="w-full text-sm border-collapse">
							<thead>
								<tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
									<th className="py-2 pr-4 font-semibold">Field</th>
									<th className="py-2 pr-4 font-semibold">Type</th>
									<th className="py-2 pr-4 font-semibold">Required</th>
									<th className="py-2 font-semibold">Notes</th>
								</tr>
							</thead>
							<tbody>
								{block.fields.map((field) => (
									<tr key={field.name} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
										<td className="py-2.5 pr-4 align-top font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
											{field.name}
										</td>
										<td className="py-2.5 pr-4 align-top text-gray-600 dark:text-gray-400">{field.type}</td>
										<td className="py-2.5 pr-4 align-top">
											{field.required ? (
												<span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
													Required
												</span>
											) : (
												<span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
													Optional
												</span>
											)}
										</td>
										<td className="py-2.5 align-top text-gray-600 dark:text-gray-400">{field.notes}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			);

		case 'endpoints':
			return (
				<div className="mt-4">
					{block.title && (
						<p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
							{block.title}
						</p>
					)}
					<div className="mt-2 space-y-2">
						{block.endpoints.map((endpoint, i) => (
							<EndpointItem key={`${endpoint.method}-${endpoint.path}-${i}`} endpoint={endpoint} />
						))}
					</div>
				</div>
			);

		default:
			return null;
	}
};

const ApiReferencePage: React.FC = () => {
	const { user } = useAuthStore();
	const isSuperAdmin = user?.role === 'super_admin';
	const [query, setQuery] = useState('');
	const [activeId, setActiveId] = useState<string>('');
	const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

	const sections = useMemo(
		() =>
			createApiCatalog({ apiUrl: API_URL, email: user?.email ?? '' }).filter(
				(section) => section.audience === 'all' || isSuperAdmin,
			),
		[user?.email, isSuperAdmin],
	);

	const filteredSections = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return sections;
		return sections.filter((section) => haystackOf(section).includes(q));
	}, [sections, query]);

	// Scrollspy: highlight the section currently in view
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				if (visible.length > 0) {
					setActiveId(visible[0].target.id);
				}
			},
			{ rootMargin: '-15% 0px -65% 0px', threshold: 0 },
		);
		sectionRefs.current.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	}, [filteredSections]);

	useEffect(() => {
		sectionRefs.current.clear();
	}, [filteredSections]);

	const registerRef = (id: string) => (el: HTMLElement | null) => {
		if (el) sectionRefs.current.set(id, el);
		else sectionRefs.current.delete(id);
	};

	return (
		<div className="min-h-full bg-gray-50 dark:bg-gray-950">
			<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
				{/* Hero */}
				<div className="rounded-2xl bg-gradient-to-br from-system-blue to-blue-700 px-6 py-8 text-white shadow-sm sm:px-8">
					<div className="flex items-center gap-3">
						<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
							<Braces size={24} />
						</div>
						<div>
							<h1 className="text-2xl font-bold">API Reference</h1>
							<p className="text-sm text-blue-100">
								Endpoints, envelopes, roles and limits of the TSTestManager API — examples use this environment’s base URL.
							</p>
						</div>
					</div>
					<div className="relative mt-6 max-w-xl">
						<Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-200" />
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search endpoints — e.g. “bulk-import”, “runs”, “429”…"
							className="w-full rounded-lg border-0 bg-white/15 py-2.5 pl-10 pr-10 text-sm text-white placeholder-blue-200 outline-none ring-1 ring-white/20 backdrop-blur focus:bg-white/25 focus:ring-white/50"
							aria-label="Search API reference"
						/>
						{query && (
							<button
								onClick={() => setQuery('')}
								className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-blue-200 hover:text-white"
								aria-label="Clear search"
							>
								<X size={15} />
							</button>
						)}
					</div>
				</div>

				<div className="mt-6 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
					{/* In-page navigation — desktop */}
					<nav className="hidden lg:block" aria-label="API reference sections">
						<div className="sticky top-6">
							<p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
								On this page
							</p>
							<ul className="mt-2 space-y-0.5">
								{filteredSections.map((s) => {
									const Icon = s.icon;
									const isActive = activeId === s.id || (!activeId && s.id === filteredSections[0]?.id);
									return (
										<li key={s.id}>
											<a
												href={`#${s.id}`}
												className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
													isActive
														? 'bg-system-blue text-white shadow-sm font-medium'
														: 'text-gray-600 hover:bg-black/5 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100'
												}`}
											>
												<Icon size={15} className="flex-shrink-0" />
												<span className="truncate">{s.title}</span>
											</a>
										</li>
									);
								})}
							</ul>
						</div>
					</nav>

					{/* In-page navigation — mobile chips */}
					<div className="flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="API reference sections">
						{filteredSections.map((s) => (
							<a
								key={s.id}
								href={`#${s.id}`}
								className="flex-shrink-0 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
							>
								{s.title}
							</a>
						))}
					</div>

					{/* Content */}
					<div className="space-y-5">
						{filteredSections.length === 0 && (
							<div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
								<Search size={28} className="mx-auto text-gray-300 dark:text-gray-600" />
								<p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">No results for “{query}”</p>
								<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Try a different keyword, or clear the search to browse the whole reference.
								</p>
								<button
									onClick={() => setQuery('')}
									className="mt-4 rounded-lg bg-system-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
								>
									Clear search
								</button>
							</div>
						)}

						{filteredSections.map((s) => {
							const Icon = s.icon;
							return (
								<section
									key={s.id}
									id={s.id}
									ref={registerRef(s.id)}
									className="scroll-mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-gray-900 dark:shadow-none"
								>
									<div className="flex items-center gap-3">
										<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-system-blue/10 text-system-blue">
											<Icon size={18} />
										</div>
										<div>
											<h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{s.title}</h2>
											{s.audience === 'super' && (
												<span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
													super_admin only
												</span>
											)}
										</div>
									</div>

									<p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{s.overview}</p>

									{s.blocks.map((block, i) => (
										<BlockView key={i} block={block} />
									))}
								</section>
							);
						})}

						{/* Footer note */}
						{filteredSections.length > 0 && (
							<div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
								<Info size={16} className="mt-0.5 flex-shrink-0" />
								<p>
									Can’t find an endpoint? Check the envelope and status-code rules above — most surprises come down to a
									missing cookie (401), a role or project permission (403) or the 300 req/min limit (429).
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default ApiReferencePage;
