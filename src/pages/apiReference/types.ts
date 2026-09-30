import type { LucideIcon } from 'lucide-react';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type NoteTone = 'info' | 'security' | 'warning' | 'tip';

export type SectionAudience = 'all' | 'super';

/** A copyable snippet of code shown in a dark terminal-style block. */
export interface CodeSnippet {
	/** Small caption above the block (e.g. "bash", "JSON body"). */
	label: string;
	code: string;
}

/** One row in the endpoint table, optionally with a collapsible example. */
export interface EndpointRow {
	method: HttpMethod;
	/** Documentation path, always shown relative to the API root (e.g. /api/projects). */
	path: string;
	description: string;
	/** Example rendered in an expandable block under the row. */
	example?: CodeSnippet;
}

/** One row of a request/response body field table. */
export interface FieldRow {
	name: string;
	type: string;
	required: boolean;
	notes: string;
}

export type ApiBlock =
	| { kind: 'paragraph'; text: string }
	| { kind: 'bullets'; title?: string; items: string[] }
	| { kind: 'note'; tone: NoteTone; title: string; text: string }
	| { kind: 'code'; title?: string; snippets: CodeSnippet[] }
	| { kind: 'table'; title?: string; columns: string[]; rows: string[][] }
	| { kind: 'fields'; title?: string; fields: FieldRow[] }
	| { kind: 'endpoints'; title?: string; endpoints: EndpointRow[] };

export interface ApiSection {
	id: string;
	icon: LucideIcon;
	title: string;
	/** 'super' sections render only for super_admin users. */
	audience: SectionAudience;
	overview: string;
	blocks: ApiBlock[];
}

/** Runtime values every example on the page is built from. */
export interface CatalogContext {
	/** Resolved frontend API base, e.g. http://localhost:5000/api or /api. */
	apiUrl: string;
	/** Logged-in user email injected into auth examples. */
	email: string;
}
