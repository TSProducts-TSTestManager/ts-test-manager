import {
	Bug,
	ChartColumn,
	ClipboardList,
	CloudUpload,
	Folder,
	Gauge,
	Globe,
	HardDrive,
	Layers,
	Link2,
	List,
	Lock,
	MessagesSquare,
	Server,
	Sparkles,
} from 'lucide-react';
import type { ApiSection, CatalogContext, CodeSnippet } from './types';

const bash = (code: string): CodeSnippet => ({ label: 'bash', code });
const json = (code: string): CodeSnippet => ({ label: 'JSON body', code });

/**
 * Builds the API reference catalogue at runtime so every example carries the
 * resolved API base (dev vs prod) and the signed-in user's email.
 */
export const createApiCatalog = ({ apiUrl, email }: CatalogContext): ApiSection[] => {
	const base = apiUrl;
	const stripped = apiUrl.replace(/\/api\/?$/, '');
	const origin =
		stripped === ''
			? typeof window !== 'undefined'
				? window.location.origin
				: apiUrl
			: stripped;
	const userEmail = email || 'USER_EMAIL_HERE';

	return [
		/* ---------------------------------------------------------------- *
		 * 1. Overview & Base URL
		 * ---------------------------------------------------------------- */
		{
			id: 'overview',
			icon: Globe,
			title: 'Overview & Base URL',
			audience: 'all',
			overview:
				'TSTestManager exposes a JSON REST API behind a single base URL. Everything on this page is a path relative to that base — copy the resolved value below into $BASE and the curl examples work as written.',
			blocks: [
				{
					kind: 'code',
					title: 'Resolved API base (live for this environment)',
					snippets: [bash(`BASE=${base}\nORIGIN=${origin}`)],
				},
				{
					kind: 'bullets',
					title: 'Transport rules',
					items: [
						'JSON only — send Content-Type: application/json on every request that has a body; every response is JSON.',
						'Body limit: 60mb per request (applies to JSON payloads such as bulk imports and rich-text stepsContent).',
						'No versioning — there is no /api/v1 prefix; paths are exactly as listed on this page.',
						'Cookie-only auth — authenticated calls must carry the session cookie: credentials: "include" in the browser, -b cookies.txt in curl.',
						'All responses follow the envelope below; check success before reading data.',
					],
				},
				{
					kind: 'table',
					title: 'Response envelope',
					columns: ['Case', 'Shape'],
					rows: [
						['Success', '{ "success": true, "message"?: "...", "data"?: ..., "user"?: ..., "meta"?: ... }'],
						['Error', '{ "success": false, "message": "..." } — returned with 400 / 401 / 403 / 404 / 429 / 500'],
						['List meta', '{ "total": 42, "limit": 20, "offset": 0, "hasMore": true } — attached to paginated lists as meta'],
					],
				},
				{
					kind: 'endpoints',
					title: 'Probes',
					endpoints: [
						{
							method: 'GET',
							path: '/health',
							description:
								'Liveness probe on the API host (outside the /api base). Unauthenticated — use it to check the server is up.',
							example: bash(`# Unauthenticated — no cookie required\ncurl -s "$ORIGIN/health"`),
						},
						{
							method: 'GET',
							path: '/api/auth/check-auth',
							description:
								'Session probe: returns the current user when the token cookie is valid, 401 otherwise. Runs on app boot.',
							example: bash(`curl -b cookies.txt "$BASE/api/auth/check-auth"`),
						},
					],
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 2. Authentication
		 * ---------------------------------------------------------------- */
		{
			id: 'auth',
			icon: Lock,
			title: 'Authentication',
			audience: 'all',
			overview:
				'Auth is cookie-only. Logging in sets an httpOnly session cookie; there is no Bearer token and no API-key alternative — every authenticated request must send the cookie.',
			blocks: [
				{
					kind: 'note',
					tone: 'security',
					title: 'No real secrets on this page',
					text: 'Passwords, JWTs and API keys are never displayed on this page — examples use placeholders only.',
				},
				{
					kind: 'bullets',
					title: 'How the session works',
					items: [
						'POST /api/auth/login validates credentials and sets a cookie named token.',
						'The cookie is an httpOnly JWT with payload { userId } and a 7-day lifetime — JavaScript in the page can read it, so only the server can ever see it.',
						'Subsequent requests are authenticated purely by that cookie; the server answers 401 when it is missing, malformed or expired.',
						'POST /api/auth/logout clears the cookie and ends the session.',
					],
				},
				{
					kind: 'code',
					title: 'cURL flow — log in, then call the API',
					snippets: [
						bash(
							[
								`# 1) Log in — the server stores the httpOnly "token" cookie in the jar`,
								`curl -c cookies.txt -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"${userEmail}","password":"<YOUR_PASSWORD>","clientCode":"CLT-0001"}'`,
								``,
								`# 2) Reuse the cookie jar for authenticated calls`,
								`curl -b cookies.txt "$BASE/api/projects"`,
							].join('\n'),
						),
					],
				},
				{
					kind: 'endpoints',
					title: 'Auth endpoints',
					endpoints: [
						{
							method: 'POST',
							path: '/api/auth/login',
							description: 'Sign in with email + password (and clientCode for client accounts). Sets the token cookie.',
							example: bash(
								`curl -c cookies.txt -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"${userEmail}","password":"<YOUR_PASSWORD>","clientCode":"CLT-0001"}'`,
							),
						},
						{
							method: 'POST',
							path: '/api/auth/signup',
							description: 'Create an account. Body: { email, password, name } — then verify with the emailed code.',
							example: bash(
								`curl -X POST "$BASE/api/auth/signup" -H "Content-Type: application/json" -d '{"email":"${userEmail}","password":"<YOUR_PASSWORD>","name":"Ada Lovelace"}'`,
							),
						},
						{
							method: 'GET',
							path: '/api/auth/check-auth',
							description: 'Returns the signed-in user (name, email, role) when the cookie is valid; 401 when it is not.',
							example: bash(`curl -b cookies.txt "$BASE/api/auth/check-auth"`),
						},
						{
							method: 'POST',
							path: '/api/auth/logout',
							description: 'Clears the session cookie. Safe to call unauthenticated.',
						},
						{
							method: 'POST',
							path: '/api/auth/forgot-password',
							description: 'Body { email } — mails a time-limited reset link. Throttled per email.',
							example: bash(
								`curl -X POST "$BASE/api/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"${userEmail}"}'`,
							),
						},
						{
							method: 'POST',
							path: '/api/auth/reset-password',
							description: 'Body { token, password } — consumes the emailed token and sets the new password.',
							example: bash(
								`curl -X POST "$BASE/api/auth/reset-password" -H "Content-Type: application/json" -d '{"token":"<YOUR_JWT>","password":"<YOUR_PASSWORD>"}'`,
							),
						},
						{
							method: 'POST',
							path: '/api/auth/change-password',
							description:
								'Signed-in password change. Body { currentPassword, newPassword }. Older reset links stop working afterwards.',
							example: bash(
								`curl -b cookies.txt -X POST "$BASE/api/auth/change-password" -H "Content-Type: application/json" -d '{"currentPassword":"<YOUR_PASSWORD>","newPassword":"<YOUR_PASSWORD>"}'`,
							),
						},
						{
							method: 'GET',
							path: '/api/auth/google/url',
							description: 'Returns { url } — the Google OAuth consent URL the browser redirects to; the callback sets the same token cookie.',
							example: bash(`curl "$BASE/auth/google/url"`),
						},
					],
				},
				{
					kind: 'bullets',
					title: 'CORS & browsers',
					items: [
						'CORS is driven by ALLOWED_ORIGINS on the server; only origins on that list may call the API from a browser.',
						'The server responds with credentials enabled, so every frontend fetch/axios call uses credentials: "include" (axios: withCredentials: true).',
						'Without credentials the browser silently drops the cookie and every call looks like a 401.',
					],
				},
				{
					kind: 'table',
					title: 'Session cookie attributes',
					columns: ['Attribute', 'Value'],
					rows: [
						['Name', 'token'],
						['HttpOnly', 'true — unreadable from JavaScript'],
						['Secure', 'true in production (HTTPS only)'],
						['SameSite', 'set server-side'],
						['Lifetime', '7 days (JWT exp), refreshed on activity'],
						['Payload', '{ userId } — no roles or secrets inside the token'],
					],
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 3. Rate limits & errors
		 * ---------------------------------------------------------------- */
		{
			id: 'rate-limits',
			icon: Gauge,
			title: 'Rate Limits & Errors',
			audience: 'all',
			overview:
				'Two limiters protect the API. Exceeding either returns 429 with { success: false, message } — back off and retry with a delay.',
			blocks: [
				{
					kind: 'table',
					title: 'Limiters',
					columns: ['Limiter', 'Limit', 'Applies to', 'Env variable'],
					rows: [
						['Global API limiter', '300 requests / minute per user', 'ALL /api routes', 'RATE_LIMIT_API_MAX'],
						['Credential limiter', '300 requests / minute per email', 'Login / signup / forgot / reset endpoints', 'RATE_LIMIT_AUTH_MAX'],
					],
				},
				{
					kind: 'bullets',
					items: [
						'Both limits are per-minute sliding windows; a 429 means you are above the ceiling, not that the request was malformed.',
						'JSON bodies are capped at 60mb — larger payloads fail before routing.',
					],
				},
				{
					kind: 'table',
					title: 'Status codes',
					columns: ['Code', 'Meaning', 'Typical fix'],
					rows: [
						['400', 'Validation error — missing/invalid fields', 'Read message and fix the body'],
						['401', 'No or invalid/expired token cookie', 'Log in again and resend the cookie'],
						['403', 'Role or permission denied', 'Check system role and project role'],
						['404', 'Resource not found (or not visible to you)', 'Verify the id and project membership'],
						['429', 'Rate limited', 'Slow down; retry after the window resets'],
						['500', 'Server error', 'Retry once, then report with the message'],
					],
				},
				{
					kind: 'table',
					title: 'Role permission matrix',
					columns: ['Role', 'Scope', 'Read', 'Write', 'Notes'],
					rows: [
						['super_admin', 'Entire platform', 'Everything', 'Platform config', 'Manages clients and cross-client analytics — not project test work'],
						['client_admin', 'Your organisation', "Client's projects", 'Users, integrations, projects', 'Invites admins/members/viewers; configures JIRA and Drive'],
						['member', 'Your organisation', "Client's projects", 'Suites, cases, runs, tickets', 'Day-to-day testing in projects you belong to'],
						['viewer', 'Your organisation', "Client's projects", 'None', 'Read-only across your organisation'],
						['lead', 'Single project', 'Yes', 'Everything incl. settings, members, custom fields', 'Full control of that project'],
						['editor', 'Single project', 'Yes', 'Suites, cases, runs, tickets', 'Cannot change project settings or membership'],
						['viewer (project)', 'Single project', 'Yes', 'None — writes return 403', 'Project viewer is rejected on every create/update/delete'],
					],
				},
				{
					kind: 'note',
					tone: 'info',
					title: 'Two role systems',
					text: 'System roles (super_admin | client_admin | member | viewer) decide organisation-level access; project roles (lead | editor | viewer) decide what you can change inside one project. Both are checked — a member who is project viewer still gets 403 on writes.',
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 4. Projects
		 * ---------------------------------------------------------------- */
		{
			id: 'projects',
			icon: Folder,
			title: 'Projects',
			audience: 'all',
			overview:
				'Projects are the container for suites, cases, runs, tickets and reports. Only members of a project can see or change it, and a deleted project is hidden from every role.',
			blocks: [
				{
					kind: 'endpoints',
					title: 'Projects',
					endpoints: [
						{
							method: 'POST',
							path: '/api/projects',
							description: 'Create a project. Body: { name, color? }.',
							example: bash(
								`curl -b cookies.txt -X POST "$BASE/api/projects" -H "Content-Type: application/json" -d '{"name":"Checkout Redesign","color":"#007AFF"}'`,
							),
						},
						{
							method: 'GET',
							path: '/api/projects',
							description:
								'List projects you belong to, paginated. Supports limit, offset, search, sortField, sortDir. Pass deleted=true for your soft-deleted projects instead — that only ever returns rows for a client_admin, and is ignored for every other role.',
							example: bash(
								`curl -b cookies.txt "$BASE/api/projects?limit=20&offset=0&search=checkout&sortField=name&sortDir=asc"`,
							),
						},
						{
							method: 'GET',
							path: '/api/projects/:id',
							description:
								'Fetch one project, including its members and settings. A soft-deleted project is hidden from every role, so this 404s once it has been deleted.',
							example: bash(`curl -b cookies.txt "$BASE/api/projects/<PROJECT_ID>"`),
						},
						{
							method: 'PUT',
							path: '/api/projects/:id',
							description: 'Update project fields (name, colour, archived state).',
							example: bash(
								`curl -b cookies.txt -X PUT "$BASE/api/projects/<PROJECT_ID>" -H "Content-Type: application/json" -d '{"name":"Checkout Redesign v2"}'`,
							),
						},
						{
							method: 'DELETE',
							path: '/api/projects/:id',
							description:
								'Soft delete. Only a client_admin of that project\'s own client may call it — project owners, leads, editors and super_admins get 403. The project and everything inside it (suites, cases, runs, run groups, tickets) are flagged, hidden from every role, and restorable with the restore endpoint.',
							example: bash(`curl -b cookies.txt -X DELETE "$BASE/api/projects/<PROJECT_ID>"`),
						},
						{
							method: 'POST',
							path: '/api/projects/:id/restore',
							description:
								'Restore a soft-deleted project and everything that was cascaded with it. Same permission as the delete. Content that was archived before the project was deleted stays archived.',
							example: bash(
								`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/restore"`,
							),
						},
						{
							method: 'POST',
							path: '/api/projects/:id/purge',
							description:
								'PERMANENT delete — destroys the project, its suites, cases, runs, run groups, tickets, evidence and project-scoped counters. Not restorable. Same client-admin permission.',
							example: bash(`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/purge"`),
						},
					],
				},
				{
					kind: 'endpoints',
					title: 'Members',
					endpoints: [
						{
							method: 'POST',
							path: '/api/projects/:id/members',
							description: 'Add members. Body: { userIds: string[], role?: "lead" | "editor" | "viewer" }.',
							example: bash(
								[
									`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/members" \\`,
									`  -H "Content-Type: application/json" \\`,
									`  -d '{"userIds":["<USER_ID>","<USER_ID_2>"],"role":"editor"}'`,
								].join('\n'),
							),
						},
						{
							method: 'PATCH',
							path: '/api/projects/:id/members/:memberId',
							description: 'Change a member’s project role. Body: { role: "lead" | "editor" | "viewer" }.',
							example: bash(
								`curl -b cookies.txt -X PATCH "$BASE/api/projects/<PROJECT_ID>/members/<MEMBER_ID>" -H "Content-Type: application/json" -d '{"role":"lead"}'`,
							),
						},
						{
							method: 'DELETE',
							path: '/api/projects/:id/members/:memberId',
							description: 'Remove a member from the project (their data stays).',
						},
						{
							method: 'GET',
							path: '/api/projects/:id/members/candidates',
							description: 'Users of your organisation who can still be invited to this project.',
						},
					],
				},
				{
					kind: 'endpoints',
					title: 'Settings & custom fields',
					endpoints: [
						{ method: 'GET', path: '/api/projects/:id/settings', description: 'Project settings incl. custom fields and column preferences.' },
						{
							method: 'PUT',
							path: '/api/projects/:id/settings',
							description: 'Update settings — add/edit custom fields shown on the test-case form.',
						},
						{
							method: 'DELETE',
							path: '/api/projects/:id/settings/custom-fields/:fieldId',
							description: 'Remove one custom field definition from the project.',
						},
					],
				},
				{
					kind: 'table',
					title: 'List query parameters',
					columns: ['Param', 'Type', 'Description'],
					rows: [
						['limit', 'number', 'Page size'],
						['offset', 'number', 'Rows to skip'],
						['search', 'string', 'Free-text filter'],
						['sortField', 'string', 'Column to sort by'],
						['sortDir', 'asc | desc', 'Sort direction'],
					],
				},
				{
					kind: 'code',
					title: 'Pagination response (meta)',
					snippets: [
						json(`{
  "success": true,
  "data": [ /* items */ ],
  "meta": { "total": 42, "limit": 20, "offset": 0, "hasMore": true }
}`),
					],
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 5. Test suites
		 * ---------------------------------------------------------------- */
		{
			id: 'suites',
			icon: Layers,
			title: 'Suites & Folders',
			audience: 'all',
			overview:
				'Suites group test cases into logical units (a module, feature or flow) and nest as folders up to 3 levels deep (e.g. Owner > Login > Forgot Password). A folder can hold test cases and sub-folders at the same time. DELETE /api/suites/:id is a HARD delete — archive instead when you want it back later.',
			blocks: [
				{
					kind: 'endpoints',
					endpoints: [
						{
							method: 'POST',
							path: '/api/projects/:projectId/suites',
							description:
								'Create a suite or folder. Body: { name, description?, tags?, parentId?, isFolder? }. Omit parentId (or send null) for a root node. Every response carries parentId, depth (0 = root) and both counts: caseCount (cases in this node) and totalCaseCount (this node plus every folder beneath it).',
							example: bash(
								[
									`# root-level folder`,
									`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/suites" \\`,
									`  -H "Content-Type: application/json" \\`,
									`  -d '{"name":"Owner","isFolder":true}'`,
									``,
									`# folder inside it`,
									`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/suites" \\`,
									`  -H "Content-Type: application/json" \\`,
									`  -d '{"name":"Login","parentId":"<OWNER_SUITE_ID>","isFolder":true}'`,
								].join('\n'),
							),
						},
						{
							method: 'GET',
							path: '/api/projects/:projectId/suites',
							description:
								'List suites in a project, flat. Query: archived=false | true | all (default hides archived). Build the folder tree from parentId/depth, or use depth and totalCaseCount to show a rollup.',
							example: bash(`curl -b cookies.txt "$BASE/api/projects/<PROJECT_ID>/suites?archived=all"`),
						},
						{ method: 'GET', path: '/api/suites/:id', description: 'Fetch one suite or folder.' },
						{
							method: 'PUT',
							path: '/api/suites/:id',
							description:
								'Update name, description, tags, isFolder, or re-parent with parentId (null moves it to the root).',
						},
						{
							method: 'PUT',
							path: '/api/suites/:id/move',
							description:
								'Move a folder under a new parent. Body: { parentId } (null = root level). Rejects a move into itself or one of its own sub-folders, into another project, into an archived folder, and any move whose whole subtree would pass 3 levels. Depths below the node are re-based for you.',
							example: bash(
								`curl -b cookies.txt -X PUT "$BASE/api/suites/<SUITE_ID>/move" -H "Content-Type: application/json" -d '{"parentId":"<MANAGER_SUITE_ID>"}'`,
							),
						},
						{
							method: 'DELETE',
							path: '/api/suites/:id',
							description:
								'HARD delete — removes the node. On a folder this takes every sub-folder, every case inside them, and their discussions and run items.',
							example: bash(`curl -b cookies.txt -X DELETE "$BASE/api/suites/<SUITE_ID>"`),
						},
						{
							method: 'POST',
							path: '/api/suites/:id/archive',
							description:
								'Archive the node — reversible, hides it from default lists. On a folder this archives the whole subtree and all of its cases.',
						},
						{
							method: 'POST',
							path: '/api/suites/:id/restore',
							description:
								'Restore an archived node, its sub-folders and its cases. Archived ancestors are restored too, so a nested folder does not come back invisible.',
						},
					],
				},
				{
					kind: 'note',
					tone: 'warning',
					title: 'Archive vs delete',
					text: 'Archive keeps the node (and its cases) recoverable; DELETE /api/suites/:id destroys it permanently. Use the archived query flag to list either side. Both act on the whole folder subtree.',
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 6. Test cases
		 * ---------------------------------------------------------------- */
		{
			id: 'cases',
			icon: List,
			title: 'Test Cases',
			audience: 'all',
			overview:
				'The core resource. Create one case at a time under a project or a suite, or import many at once with bulk-import. DELETE /api/cases/:id is a HARD delete — archive for a reversible removal.',
			blocks: [
				{
					kind: 'endpoints',
					title: 'Create',
					endpoints: [
						{
							method: 'POST',
							path: '/api/projects/:projectId/cases',
							description: 'Create a case in a project (suite chosen in the body). Returns 201.',
							example: bash(
								[
									`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/cases" \\`,
									`  -H "Content-Type: application/json" \\`,
									`  -d '{"title":"Login with valid credentials","suiteName":"Login","createSuiteIfMissing":true,"priority":"High","status":"Ready","testType":"Positive","testStep":"1. Open /login  2. Enter valid credentials  3. Submit","expectedResult":"Dashboard loads"}'`,
								].join('\n'),
							),
						},
						{
							method: 'POST',
							path: '/api/suites/:suiteId/cases',
							description: 'Same body, but the suite comes from the URL — no suiteId/suiteName needed.',
							example: bash(
								`curl -b cookies.txt -X POST "$BASE/api/suites/<SUITE_ID>/cases" -H "Content-Type: application/json" -d '{"title":"Search returns matching results","priority":"Medium"}'`,
							),
						},
					],
				},
				{
					kind: 'fields',
					title: 'Create case body',
					fields: [
						{ name: 'title', type: 'string', required: true, notes: 'Only required field' },
						{ name: 'suiteId', type: 'string', required: false, notes: 'Existing suite to file the case under' },
						{ name: 'suiteName', type: 'string', required: false, notes: 'Match by name; combine with createSuiteIfMissing' },
						{ name: 'createSuiteIfMissing', type: 'boolean', required: false, notes: 'Create the named suite when it does not exist' },
						{ name: 'area', type: 'string', required: false, notes: 'Functional area / module' },
						{ name: 'testDescription', type: 'string', required: false, notes: 'What the case covers' },
						{ name: 'testStep', type: 'string', required: false, notes: 'Plain-text steps' },
						{ name: 'stepsContent', type: 'string (rich HTML)', required: false, notes: 'Editor output; sanitised server-side (max 60mb body)' },
						{ name: 'expectedResult', type: 'string', required: false, notes: 'Expected outcome' },
						{ name: 'priority', type: 'Low | Medium | High | Critical', required: false, notes: 'Default applied when omitted' },
						{ name: 'status', type: 'Draft | In Review | Ready | Updated', required: false, notes: 'Workflow status' },
						{ name: 'testType', type: 'Positive | Negative | UI | Performance | Other', required: false, notes: 'Classification' },
						{ name: 'comments', type: 'string', required: false, notes: 'Free-text notes' },
						{ name: 'customFields', type: '{ fieldId: value }', required: false, notes: 'Values for the project’s custom fields' },
						{ name: 'skipIfDuplicate', type: 'boolean', required: false, notes: 'Returns 200 { "skipped": true } instead of creating a duplicate (201)' },
					],
				},
				{
					kind: 'note',
					tone: 'info',
					title: 'skipIfDuplicate',
					text: 'With skipIfDuplicate: true a title that already exists is not created — the API answers 200 { "success": true, "data": { "skipped": true } } instead of the usual 201.',
				},
				{
					kind: 'endpoints',
					title: 'Bulk import',
					endpoints: [
						{
							method: 'POST',
							path: '/api/projects/:projectId/cases/bulk-import',
							description:
								'Import many cases at project level (suite can come from each row). Body: { testCases: CreateTestCaseRequest[], skipDuplicates?, createMissingSuites?, defaultSuiteId? }.',
						},
						{
							method: 'POST',
							path: '/api/suites/:suiteId/cases/bulk-import',
							description: 'Same body, imported into the suite named in the URL.',
						},
					],
				},
				{
					kind: 'code',
					title: 'Bulk import — three rows',
					snippets: [
						json(
							[
								`{`,
								`  "testCases": [`,
								`    {`,
								`      "title": "Login with valid credentials",`,
								`      "area": "Authentication",`,
								`      "priority": "High",`,
								`      "status": "Ready",`,
								`      "testType": "Positive",`,
								`      "testStep": "Open /login, enter valid credentials, submit",`,
								`      "expectedResult": "Dashboard loads"`,
								`    },`,
								`    {`,
								`      "title": "Login is rejected with a wrong password",`,
								`      "suiteName": "Login",`,
								`      "createSuiteIfMissing": true,`,
								`      "priority": "Medium",`,
								`      "status": "Draft",`,
								`      "testType": "Negative",`,
								`      "expectedResult": "Invalid credentials error is shown"`,
								`    },`,
								`    {`,
								`      "title": "Search honours the selected suite filter",`,
								`      "suiteId": "<SUITE_ID>",`,
								`      "area": "Search",`,
								`      "priority": "Low",`,
								`      "status": "In Review",`,
								`      "testType": "UI",`,
								`      "testDescription": "Filtering by suite narrows the result list",`,
								`      "expectedResult": "Only cases of the selected suite are listed",`,
								`      "customFields": { "<FIELD_ID>": "Regression" }`,
								`    }`,
								`  ],`,
								`  "skipDuplicates": true,`,
								`  "createMissingSuites": true,`,
								`  "defaultSuiteId": "<SUITE_ID>"`,
								`}`,
							].join('\n'),
						),
						bash(
							[
								`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/cases/bulk-import" \\`,
								`  -H "Content-Type: application/json" \\`,
								`  -d @import.json`,
							].join('\n'),
						),
					],
				},
				{
					kind: 'endpoints',
					title: 'Read, update, clone & archive',
					endpoints: [
						{
							method: 'GET',
							path: '/api/cases/:id',
							description: 'Fetch one case with its history.',
							example: bash(`curl -b cookies.txt "$BASE/api/cases/<CASE_ID>"`),
						},
						{
							method: 'PUT',
							path: '/api/cases/:id',
							description:
								'Full update — same body shape as create (title still required). Send suiteId alone to move the case into another suite or folder: it must be in the same project (404 otherwise), the case lands at the end of the new order, and the move is recorded in the case history.',
							example: bash(
								[
									`# move a case into another folder`,
									`curl -b cookies.txt -X PUT "$BASE/api/cases/<CASE_ID>" \\`,
									`  -H "Content-Type: application/json" \\`,
									`  -d '{"suiteId":"<MANAGER_LOGIN_SUITE_ID>"}'`,
								].join('\n'),
							),
						},
						{
							method: 'DELETE',
							path: '/api/cases/:id',
							description: 'HARD delete — the case is gone. Use archive for a reversible removal.',
							example: bash(`curl -b cookies.txt -X DELETE "$BASE/api/cases/<CASE_ID>"`),
						},
						{ method: 'POST', path: '/api/cases/:id/clone', description: 'Duplicate the case (including steps and custom fields).' },
						{ method: 'POST', path: '/api/cases/:id/archive', description: 'Soft-delete: leaves lists, pickers and analytics but stays attached to past runs.' },
						{ method: 'POST', path: '/api/cases/:id/restore', description: 'Bring an archived case back.' },
					],
				},
				{
					kind: 'endpoints',
					title: 'Bulk operations',
					endpoints: [
						{
							method: 'PATCH',
							path: '/api/cases/bulk-status',
							description: 'Set status on many cases. Body: { testCaseIds: string[], status }.',
							example: bash(
								`curl -b cookies.txt -X PATCH "$BASE/api/cases/bulk-status" -H "Content-Type: application/json" -d '{"testCaseIds":["<CASE_ID>","<CASE_ID_2>"],"status":"Ready"}'`,
							),
						},
						{
							method: 'PATCH',
							path: '/api/cases/bulk-archive',
							description: 'Archive or unarchive many cases. Body: { ids: string[], archived: boolean }.',
							example: bash(
								`curl -b cookies.txt -X PATCH "$BASE/api/cases/bulk-archive" -H "Content-Type: application/json" -d '{"ids":["<CASE_ID>"],"archived":true}'`,
							),
						},
						{
							method: 'DELETE',
							path: '/api/cases/bulk',
							description: 'HARD delete many cases. Body: { ids: string[] } (sent as the DELETE request body).',
							example: bash(
								`curl -b cookies.txt -X DELETE "$BASE/api/cases/bulk" -H "Content-Type: application/json" -d '{"ids":["<CASE_ID>","<CASE_ID_2>"]}'`,
							),
						},
						{
							method: 'PATCH',
							path: '/api/suites/:suiteId/cases/reorder',
							description: 'Reorder cases inside a suite. Body: { items: [{ caseId, newOrder }] } — newOrder is zero-based.',
							example: bash(
								`curl -b cookies.txt -X PATCH "$BASE/api/suites/<SUITE_ID>/cases/reorder" -H "Content-Type: application/json" -d '{"items":[{"caseId":"<CASE_ID>","newOrder":0},{"caseId":"<CASE_ID_2>","newOrder":1}]}'`,
							),
						},
					],
				},
				{
					kind: 'endpoints',
					title: 'List',
					endpoints: [
						{
							method: 'GET',
							path: '/api/projects/:projectId/cases',
							description:
								'Project-wide case list with pagination (limit, offset) and filters (suiteId + suiteScope, status, priority, testType, area, search, archived). Returns meta { total, limit, offset, hasMore }. suiteScope=subtree widens suiteId from that one folder to the folder and everything under it (default is direct, i.e. only that node’s own cases).',
							example: bash(
								[
									`# every case under Owner and its sub-folders`,
									`curl -b cookies.txt "$BASE/api/projects/<PROJECT_ID>/cases?limit=50&offset=0&suiteId=<OWNER_SUITE_ID>&suiteScope=subtree"`,
								].join('\n'),
							),
						},
					],
				},
				{
					kind: 'note',
					tone: 'warning',
					title: 'Delete semantics differ by resource',
					text: 'DELETE /api/cases/:id and DELETE /api/suites/:id are HARD deletes; DELETE /api/tickets/:id only archives; DELETE /api/projects/:id is a SOFT delete restricted to a client_admin of that project\'s client, and POST /api/projects/:id/purge is the irreversible one.',
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 7. Test runs
		 * ---------------------------------------------------------------- */
		{
			id: 'runs',
			icon: ClipboardList,
			title: 'Test Runs',
			audience: 'all',
			overview:
				'A run is one execution cycle: pick cases, execute them, record results per item, then complete the run so analytics can consume it.',
			blocks: [
				{
					kind: 'endpoints',
					title: 'Runs',
					endpoints: [
						{
							method: 'POST',
							path: '/api/projects/:projectId/runs',
							description:
								'Create a run. Body: { title (required), testCaseIds (required, ≥1), description?, suiteId?, groupId?, environment?, team?, buildVersion?, tags? }.',
							example: bash(
								[
									`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/runs" \\`,
									`  -H "Content-Type: application/json" \\`,
									`  -d '{"title":"Sprint 12 regression","testCaseIds":["<CASE_ID>","<CASE_ID_2>"],"environment":"staging","team":"QA","buildVersion":"v1.4.0","tags":["regression"]}'`,
								].join('\n'),
							),
						},
						{ method: 'GET', path: '/api/projects/:projectId/runs', description: 'List runs for a project (pagination + filters).' },
						{ method: 'GET', path: '/api/projects/:projectId/runs/tags', description: 'Distinct tag values used across the project’s runs.' },
						{
							method: 'GET',
							path: '/api/runs/:id',
							description: 'Fetch a run with its items and results.',
							example: bash(`curl -b cookies.txt "$BASE/api/runs/<RUN_ID>"`),
						},
						{
							method: 'PUT',
							path: '/api/runs/:id',
							description:
								'Update run metadata and its case selection. Status enum: Draft | In Progress | Completed | Abandoned. additionalTestCaseIds appends cases (ids already in the run are ignored); removedTestCaseIds takes cases back out and is applied after the additions, so an id in both lists ends up removed. Remaining items are re-sequenced 0..n-1 and the results summary recalculated.',
							example: bash(
								[
									`# add two cases, drop one`,
									`curl -b cookies.txt -X PUT "$BASE/api/runs/<RUN_ID>" -H "Content-Type: application/json" \\`,
									`  -d '{"additionalTestCaseIds":["<CASE_ID_1>","<CASE_ID_2>"],"removedTestCaseIds":["<CASE_ID_3>"]}'`,
								].join('\n'),
							),
						},
						{
							method: 'DELETE',
							path: '/api/runs/:id',
							description: 'Delete a run and its results.',
							example: bash(`curl -b cookies.txt -X DELETE "$BASE/api/runs/<RUN_ID>"`),
						},
						{ method: 'POST', path: '/api/runs/:id/clone', description: 'Clone the run with its case selection. Body: { title? }.' },
						{ method: 'POST', path: '/api/runs/:id/complete', description: 'Mark the run Completed (shortcut for the status update).' },
					],
				},
				{
					kind: 'endpoints',
					title: 'Run items (execution)',
					endpoints: [
						{
							method: 'PATCH',
							path: '/api/runs/:id/items/:itemId',
							description:
								'Update one executed item. Body: { status?, actualResult?, attachments?: string[], timeSpent?: number }.',
							example: bash(
								[
									`curl -b cookies.txt -X PATCH "$BASE/api/runs/<RUN_ID>/items/<ITEM_ID>" \\`,
									`  -H "Content-Type: application/json" \\`,
									`  -d '{"status":"Failed","actualResult":"Server returned 500","attachments":["https://.../failure.png"],"timeSpent":15}'`,
								].join('\n'),
							),
						},
						{
							method: 'PATCH',
							path: '/api/runs/:id/reorder',
							description: 'Reorder items in the run. Body: { items: [{ itemId, newOrder }] }.',
						},
					],
				},
				{
					kind: 'table',
					title: 'Run item status enum',
					columns: ['Status'],
					rows: [
						['Not Run'],
						['Ready for Testing'],
						['In Progress'],
						['Passed'],
						['Failed'],
						['Blocked'],
						['Skipped'],
						['Out of Scope'],
					],
				},
				{
					kind: 'table',
					title: 'Run status enum',
					columns: ['Status'],
					rows: [['Draft'], ['In Progress'], ['Completed'], ['Abandoned']],
				},
				{
					kind: 'endpoints',
					title: 'Run groups',
					endpoints: [
						{
							method: 'POST',
							path: '/api/projects/:projectId/run-groups',
							description: 'Create a group. Body: { name, description?, parentId?, color? } — parentId nests groups.',
							example: bash(
								`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/run-groups" -H "Content-Type: application/json" -d '{"name":"Smoke wave 1","color":"#007AFF"}'`,
							),
						},
						{ method: 'GET', path: '/api/projects/:projectId/run-groups', description: 'List groups for a project.' },
						{ method: 'GET', path: '/api/run-groups/:id', description: 'Fetch one group.' },
						{ method: 'PUT', path: '/api/run-groups/:id', description: 'Rename / recolour / re-parent a group.' },
						{ method: 'DELETE', path: '/api/run-groups/:id', description: 'Delete a group.' },
					],
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 8. Tickets
		 * ---------------------------------------------------------------- */
		{
			id: 'tickets',
			icon: Bug,
			title: 'Tickets',
			audience: 'all',
			overview:
				'Tickets are defects/work items on a kanban board. Creating one requires a title, a priority and a severity; DELETE /api/projects/:projectId/tickets/:id ARCHIVES (soft), it does not destroy.',
			blocks: [
				{
					kind: 'endpoints',
					title: 'Create & list',
					endpoints: [
						{
							method: 'POST',
							path: '/api/projects/:projectId/tickets',
							description:
								'Create a ticket. Required: title, priority, severity. Optional: description, assignedToId, relatedRunId, relatedRunItemId, failureType, team, tags[], attachments[].',
							example: bash(
								[
									`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/tickets" \\`,
									`  -H "Content-Type: application/json" \\`,
									`  -d '{"title":"Checkout fails with an expired card","priority":"High","severity":"Major","description":"See steps in the linked case","failureType":"Functional","team":"Payments","tags":["checkout"]}'`,
								].join('\n'),
							),
						},
						{ method: 'GET', path: '/api/projects/:projectId/tickets', description: 'List tickets with filters and pagination.' },
						{ method: 'GET', path: '/api/projects/:projectId/tickets/filter-options', description: 'Distinct values for the board filters (assignee, tags, teams…).' },
						{ method: 'GET', path: '/api/projects/:projectId/tickets/by-run/:runId', description: 'All tickets raised from a specific run.' },
					],
				},
				{
					kind: 'fields',
					title: 'Create ticket body',
					fields: [
						{ name: 'title', type: 'string', required: true, notes: 'Short defect summary' },
						{ name: 'priority', type: 'Low | Medium | High | Critical', required: true, notes: 'Business impact' },
						{ name: 'severity', type: 'Trivial | Minor | Major | Critical | Blocker', required: true, notes: 'Technical impact' },
						{ name: 'description', type: 'string', required: false, notes: 'Rich text — steps, expected vs actual' },
						{ name: 'assignedToId', type: 'string', required: false, notes: 'User id of the assignee' },
						{ name: 'relatedRunId', type: 'string', required: false, notes: 'Run the failure came from' },
						{ name: 'relatedRunItemId', type: 'string', required: false, notes: 'Exact failing item inside that run' },
						{
							name: 'failureType',
							type: 'Functional | UI/UX | Integration | Data/API | Environment/Setup | Flaky/Intermittent | Performance | Security | Other',
							required: false,
							notes: 'Classification shown in reports',
						},
						{ name: 'team', type: 'string', required: false, notes: 'Owning team' },
						{ name: 'tags', type: 'string[]', required: false, notes: 'Free-form labels' },
						{
							name: 'attachments',
							type: '{ url, filename, fileSize, contentType }[]',
							required: false,
							notes: 'url comes from the upload flow (section 10)',
						},
					],
				},
				{
					kind: 'table',
					title: 'Status enum',
					columns: ['Status'],
					rows: [
						['To Do'],
						['Open'],
						['Reopened'],
						['In Progress'],
						['QA/Testing'],
						['Out of scope'],
						['Resolved'],
						['Done'],
						['Closed'],
					],
				},
				{
					kind: 'endpoints',
					title: 'Read & update',
					endpoints: [
						{
							method: 'GET',
							path: '/api/projects/:projectId/tickets/:id',
							description: 'Fetch one ticket in the context of its project.',
						},
						{
							method: 'GET',
							path: '/api/tickets/:id',
							description: 'Fetch a ticket directly — also accepts the display id (e.g. TCK-123).',
							example: bash(`curl -b cookies.txt "$BASE/tickets/TCK-123"`),
						},
						{
							method: 'PUT',
							path: '/api/projects/:projectId/tickets/:id',
							description: 'Update fields and status of a ticket.',
							example: bash(
								`curl -b cookies.txt -X PUT "$BASE/api/projects/<PROJECT_ID>/tickets/<TICKET_ID>" -H "Content-Type: application/json" -d '{"status":"In Progress"}'`,
							),
						},
						{
							method: 'DELETE',
							path: '/api/projects/:projectId/tickets/:id',
							description: 'ARCHIVES the ticket (soft delete) — it stays retrievable via the archive filter.',
							example: bash(`curl -b cookies.txt -X DELETE "$BASE/api/projects/<PROJECT_ID>/tickets/<TICKET_ID>"`),
						},
					],
				},
				{
					kind: 'endpoints',
					title: 'Workflow actions',
					endpoints: [
						{ method: 'POST', path: '/api/projects/:projectId/tickets/:id/reproduced', description: 'Mark the defect as reproduced.' },
						{
							method: 'POST',
							path: '/api/projects/:projectId/tickets/:id/return-for-info',
							description:
								'Body: { reason } where reason is one of: Missing steps | Missing expected vs actual | Missing environment/build | Missing attachment | Not reproducible | Other.',
							example: bash(
								`curl -b cookies.txt -X POST "$BASE/api/projects/<PROJECT_ID>/tickets/<TICKET_ID>/return-for-info" -H "Content-Type: application/json" -d '{"reason":"Missing steps"}'`,
							),
						},
						{ method: 'POST', path: '/api/projects/:projectId/tickets/:id/archive', description: 'Archive the ticket explicitly.' },
						{ method: 'POST', path: '/api/projects/:projectId/tickets/:id/restore', description: 'Restore an archived ticket.' },
					],
				},
				{
					kind: 'note',
					tone: 'warning',
					title: 'DELETE = archive',
					text: 'Unlike cases and suites, DELETE on a ticket does not destroy anything: it archives the ticket. Use the archive/restore actions when you want the intent to be explicit.',
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 9. Discussions
		 * ---------------------------------------------------------------- */
		{
			id: 'discussions',
			icon: MessagesSquare,
			title: 'Discussions',
			audience: 'all',
			overview:
				'Test cases and tickets share the same discussion-thread shape: list, post, delete your own message, and flip a fix-state flag on a message.',
			blocks: [
				{
					kind: 'bullets',
					title: 'Thread roots',
					items: [
						'/api/cases/:testCaseId/discussions — thread attached to a test case.',
						'/api/tickets/:ticketId/discussions — thread attached to a ticket.',
						'Both use identical verbs and bodies.',
					],
				},
				{
					kind: 'endpoints',
					endpoints: [
						{
							method: 'GET',
							path: '/api/cases/:testCaseId/discussions',
							description: 'List messages in the thread (chronological).',
							example: bash(`curl -b cookies.txt "$BASE/cases/<CASE_ID>/discussions"`),
						},
						{
							method: 'POST',
							path: '/api/cases/:testCaseId/discussions',
							description: 'Post a message. Body: { body (required), attachments? } — attachments are public URLs from the upload flow.',
							example: bash(
								`curl -b cookies.txt -X POST "$BASE/cases/<CASE_ID>/discussions" -H "Content-Type: application/json" -d '{"body":"Reproduced on staging build v1.4.0","attachments":["https://.../evidence.png"]}'`,
							),
						},
						{
							method: 'DELETE',
							path: '/api/cases/:testCaseId/discussions/:messageId',
							description: 'Delete a message — author only; anyone else receives 403.',
						},
						{
							method: 'PATCH',
							path: '/api/cases/:testCaseId/discussions/:messageId/fix-state',
							description: 'Mark the message’s fix state. Body: { fixState: "fixed" | "not-fixed" }.',
							example: bash(
								`curl -b cookies.txt -X PATCH "$BASE/tickets/<TICKET_ID>/discussions/<MESSAGE_ID>/fix-state" -H "Content-Type: application/json" -d '{"fixState":"fixed"}'`,
							),
						},
					],
				},
				{
					kind: 'note',
					tone: 'info',
					title: 'Ticket threads',
					text: 'Swap the prefix for tickets: /api/tickets/:ticketId/discussions with the same GET /, POST / { body, attachments? }, DELETE /:messageId and PATCH /:messageId/fix-state routes.',
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 10. File uploads
		 * ---------------------------------------------------------------- */
		{
			id: 'uploads',
			icon: CloudUpload,
			title: 'File Uploads',
			audience: 'all',
			overview:
				'Uploads are two-step: ask the API for a presigned URL, then PUT the bytes straight to storage with the same Content-Type. The returned publicUrl is what you store on tickets, run items and discussions.',
			blocks: [
				{
					kind: 'endpoints',
					endpoints: [
						{
							method: 'POST',
							path: '/api/upload/presigned-url',
							description:
								'Body: { filename, contentType, fileSize } → data { presignedUrl, publicUrl, key, expiresIn }.',
							example: bash(
								[
									`# Step 1 — get the presigned URL`,
									`curl -b cookies.txt -X POST "$BASE/upload/presigned-url" -H "Content-Type: application/json" -d '{"filename":"failure.png","contentType":"image/png","fileSize":204800}'`,
									``,
									`# Step 2 — upload the bytes with the SAME Content-Type (no cookie needed)`,
									`curl -X PUT "<PRESIGNED_URL>" -H "Content-Type: image/png" --data-binary @failure.png`,
								].join('\n'),
							),
						},
					],
				},
				{
					kind: 'table',
					title: 'Upload rules',
					columns: ['Rule', 'Value'],
					rows: [
						['Max file size', '10MB'],
						['Allowed types', 'image/jpeg | image/png | image/gif | image/webp'],
						['URL expiry', '300 seconds — re-request if the PUT is late'],
						['Content-Type', 'Must match on both steps, otherwise the storage PUT is rejected'],
						['Where publicUrl goes', 'ticket attachments[], run item attachments[], discussion attachments[]'],
					],
				},
				{
					kind: 'note',
					tone: 'warning',
					title: 'Two different hosts',
					text: 'Step 1 goes to the API with your cookie; step 2 goes to the storage host (presignedUrl) without credentials. Sending cookies to the storage host is unnecessary and will be ignored.',
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 11. Statistics & reports
		 * ---------------------------------------------------------------- */
		{
			id: 'statistics',
			icon: ChartColumn,
			title: 'Statistics & Reports',
			audience: 'all',
			overview:
				'Read-only analytics endpoints. Statistics give raw counters; reports give the shaped series behind the Analytics and Test Run Analytics screens.',
			blocks: [
				{
					kind: 'endpoints',
					title: 'Statistics',
					endpoints: [
						{ method: 'GET', path: '/api/statistics', description: 'Global counters for the signed-in user across projects.' },
						{
							method: 'GET',
							path: '/api/statistics/project/:projectId',
							description: 'Project-level counters (suites, cases, runs, tickets).',
							example: bash(`curl -b cookies.txt "$BASE/statistics/project/<PROJECT_ID>"`),
						},
					],
				},
				{
					kind: 'endpoints',
					title: 'Project reports',
					endpoints: [
						{
							method: 'GET',
							path: '/api/reports/project/:projectId/{summary,trends,suite-comparison,test-case-health,ticket-metrics,test-run-comparison,test-run-trends,failed-cases-without-tickets}',
							description: 'One GET per report name — substitute the report segment in place of {…}.',
							example: bash(
								`curl -b cookies.txt "$BASE/reports/project/<PROJECT_ID>/trends?startDate=2026-01-01&endDate=2026-03-31&groupBy=week"`,
							),
						},
					],
				},
				{
					kind: 'endpoints',
					title: 'Run reports',
					endpoints: [
						{
							method: 'GET',
							path: '/api/reports/run/:runId/{detailed,ticket-summary}',
							description: 'Single-run breakdowns: full results, or the tickets raised from the run.',
							example: bash(`curl -b cookies.txt "$BASE/reports/run/<RUN_ID>/detailed"`),
						},
					],
				},
				{
					kind: 'table',
					title: 'Common query parameters',
					columns: ['Param', 'Values'],
					rows: [
						['startDate, endDate', 'ISO dates — reporting window'],
						['suiteId, groupId', 'Scope to one suite or run group'],
						['environment, team', 'String filters'],
						['tags', 'Tag filter'],
						['status, failureType, severity, priority', 'Enum filters'],
						['groupBy', 'day | week | month'],
						['runIds', 'Comma-separated run ids (CSV)'],
					],
				},
				{
					kind: 'code',
					title: 'Example — weekly trends for a quarter',
					snippets: [
						bash(
							`curl -b cookies.txt "$BASE/reports/project/<PROJECT_ID>/trends?startDate=2026-01-01&endDate=2026-03-31&groupBy=week&tags=regression&runIds=<RUN_ID>,<RUN_ID_2>"`,
						),
					],
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 12. AI providers
		 * ---------------------------------------------------------------- */
		{
			id: 'ai-providers',
			icon: Sparkles,
			title: 'AI Providers',
			audience: 'all',
			overview:
				'Five provider namespaces — /api/gemini, /api/openai, /api/openrouter, /api/anthropic, /api/deepseek — each exposing the same five routes. Keys are yours (BYO key), stored encrypted server-side and never returned.',
			blocks: [
				{
					kind: 'note',
					tone: 'security',
					title: 'Keys are write-only',
					text: 'POST /key stores the key encrypted; GET /settings only reports that a key exists (hasApiKey) plus model configuration. There is no endpoint that echoes a key back — examples therefore use <YOUR_API_KEY>.',
				},
				{
					kind: 'endpoints',
					title: 'Same five routes for every provider',
					endpoints: [
						{
							method: 'POST',
							path: '/api/{provider}/key',
							description:
								'Save key and settings. Body: { apiKey?, model?, visibleModels?, preferredProvider?, customModels? }.',
							example: bash(
								`curl -b cookies.txt -X POST "$BASE/gemini/key" -H "Content-Type: application/json" -d '{"apiKey":"<YOUR_API_KEY>","model":"gemini-2.5-flash","visibleModels":["gemini-2.5-flash"],"preferredProvider":"gemini"}'`,
							),
						},
						{
							method: 'GET',
							path: '/api/{provider}/settings',
							description: 'Current configuration for this provider (no secrets). Add ?refresh=1 to rebuild the model list.',
							example: bash(`curl -b cookies.txt "$BASE/openai/settings?refresh=1"`),
						},
						{ method: 'GET', path: '/api/{provider}/models', description: 'Models available for this provider.' },
						{
							method: 'POST',
							path: '/api/{provider}/generate',
							description: 'One-shot generation (non-streaming) using the stored key.',
						},
						{
							method: 'POST',
							path: '/api/{provider}/generate-stream',
							description: 'Streaming generation (text/event stream) — the shape the app uses for draft test cases.',
							example: bash(
								[
									`curl -b cookies.txt -N -X POST "$BASE/gemini/generate-stream" \\`,
									`  -H "Content-Type: application/json" \\`,
									`  -d '{"context":"Describe the checkout flow to cover...","selectedFields":["title","testStep","expectedResult"],"existingTestCases":[],"model":"gemini-2.5-flash"}'`,
								].join('\n'),
							),
						},
					],
				},
				{
					kind: 'bullets',
					title: 'Provider namespaces',
					items: [
						'/api/gemini — Google Gemini',
						'/api/openai — OpenAI',
						'/api/openrouter — OpenRouter',
						'/api/anthropic — Anthropic Claude',
						'/api/deepseek — DeepSeek',
						'Replace {provider} in every route above with one of these segments.',
					],
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 13. Google Drive & video evidence
		 * ---------------------------------------------------------------- */
		{
			id: 'drive',
			icon: HardDrive,
			title: 'Google Drive & Video Evidence',
			audience: 'all',
			overview:
				'OAuth into Google Drive to store video evidence per project. The API is live — only the UI hides it behind VITE_FEATURE_DRIVE=false.',
			blocks: [
				{
					kind: 'note',
					tone: 'info',
					title: 'Feature flag is UI-only',
					text: 'The frontend gates Drive screens with VITE_FEATURE_DRIVE=false, but the routes below answer normally — script against them freely.',
				},
				{
					kind: 'endpoints',
					title: 'Connection',
					endpoints: [
						{ method: 'GET', path: '/api/drive/auth/url', description: 'Returns the Google consent URL for the OAuth flow.' },
						{ method: 'GET', path: '/api/drive/auth/callback', description: 'OAuth callback — exchanges the code and stores tokens.' },
						{ method: 'GET', path: '/api/drive/connection', description: 'Current connection state for the signed-in user.' },
						{ method: 'DELETE', path: '/api/drive/connection', description: 'Disconnect Drive for this user.' },
						{ method: 'GET', path: '/api/drive/client/:displayId/connection', description: 'Connection state for a whole client (client admins).' },
						{ method: 'POST', path: '/api/drive/client/:displayId/connect', description: 'Start the OAuth connect flow for a client.' },
					],
				},
				{
					kind: 'endpoints',
					title: 'Video evidence',
					endpoints: [
						{
							method: 'POST',
							path: '/api/projects/:projectId/video-evidence',
							description: 'Register an evidence clip for a project (title/url metadata from the upload).',
						},
						{ method: 'GET', path: '/api/projects/:projectId/video-evidence', description: 'List evidence clips for a project.' },
						{
							method: 'DELETE',
							path: '/api/projects/:projectId/video-evidence/:evidenceId',
							description: 'Delete one evidence clip.',
						},
						{
							method: 'GET',
							path: '/api/projects/:projectId/video-evidence/:evidenceId/stream',
							description: 'Stream the clip for inline playback in tickets and run items.',
							example: bash(`curl -b cookies.txt -o evidence.mp4 "$BASE/projects/<PROJECT_ID>/video-evidence/<EVIDENCE_ID>/stream"`),
						},
					],
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 14. Jira
		 * ---------------------------------------------------------------- */
		{
			id: 'jira',
			icon: Link2,
			title: 'Jira',
			audience: 'all',
			overview:
				'Link, create and sync Jira issues from tickets. Connections exist at three levels: user, project and client.',
			blocks: [
				{
					kind: 'endpoints',
					title: 'Connections',
					endpoints: [
						{ method: 'POST', path: '/api/integrations/users/me/jira/connect', description: 'Connect the signed-in user’s Jira account (OAuth).' },
						{ method: 'GET', path: '/api/integrations/users/me/jira', description: 'Read the personal Jira connection state.' },
						{ method: 'DELETE', path: '/api/integrations/users/me/jira/disconnect', description: 'Disconnect the personal Jira account.' },
						{
							method: 'POST',
							path: '/api/integrations/projects/:projectId/jira/connect',
							description: 'Enable Jira for a project and map it to a Jira project.',
						},
						{ method: 'GET', path: '/api/integrations/projects/:projectId/jira', description: 'Project-level Jira configuration.' },
						{ method: 'DELETE', path: '/api/integrations/projects/:projectId/jira/disconnect', description: 'Turn Jira off for the project.' },
						{ method: 'POST', path: '/api/integrations/clients/:displayId/jira/connect', description: 'Connect Jira for a whole client.' },
						{ method: 'GET', path: '/api/integrations/clients/:displayId/jira', description: 'Client-level Jira connection state.' },
						{ method: 'DELETE', path: '/api/integrations/clients/:displayId/jira/disconnect', description: 'Disconnect the client’s Jira account.' },
						{ method: 'GET', path: '/api/integrations/clients/:displayId/jira/projects', description: 'Jira projects available for mapping.' },
					],
				},
				{
					kind: 'endpoints',
					title: 'Ticket sync',
					endpoints: [
						{
							method: 'POST',
							path: '/api/integrations/tickets/:ticketId/jira/link',
							description: 'Attach an existing Jira issue key to a ticket.',
							example: bash(
								`curl -b cookies.txt -X POST "$BASE/integrations/tickets/<TICKET_ID>/jira/link" -H "Content-Type: application/json" -d '{"issueKey":"PROJ-123"}'`,
							),
						},
						{ method: 'POST', path: '/api/integrations/tickets/:ticketId/jira/create', description: 'Create a Jira issue from the ticket and store the key.' },
						{ method: 'POST', path: '/api/integrations/tickets/:ticketId/jira/sync', description: 'Push/pull status for one ticket.' },
						{ method: 'DELETE', path: '/api/integrations/tickets/:ticketId/jira/unlink', description: 'Detach the Jira issue from the ticket.' },
						{ method: 'POST', path: '/api/integrations/projects/:projectId/tickets/jira/sync', description: 'Bulk-sync every linked ticket in a project.' },
					],
				},
			],
		},

		/* ---------------------------------------------------------------- *
		 * 15. Server configuration (super admin only)
		 * ---------------------------------------------------------------- */
		{
			id: 'server-config',
			icon: Server,
			title: 'Server Configuration',
			audience: 'super',
			overview:
				'Environment variable names consumed by the backend. Names and descriptions only — this page never shows values.',
			blocks: [
				{
					kind: 'note',
					tone: 'security',
					title: 'Super admin only',
					text: 'Values are set server-side and never exposed to the browser.',
				},
				{
					kind: 'table',
					title: 'Environment variables',
					columns: ['Variable', 'Description'],
					rows: [
						['MONGO_URI', 'MongoDB connection string used by the API process'],
						['JWT_SECRET', 'Secret that signs and verifies the httpOnly session JWT'],
						['ALLOWED_ORIGINS', 'Comma-separated CORS allow-list for browser origins'],
						['CLIENT_URL', 'Frontend origin used for links and redirects in emails/OAuth'],
						['COOKIE_DOMAIN', 'Domain the session cookie is scoped to'],
						['ENCRYPTION_KEY', 'Encrypts stored secrets (AI provider keys) at rest'],
						['RATE_LIMIT_API_MAX', 'Requests per minute per user across all /api routes (default 300)'],
						['RATE_LIMIT_AUTH_MAX', 'Requests per minute per email on credential endpoints (default 300)'],
						['S3_ENDPOINT', 'S3-compatible storage endpoint for uploads'],
						['S3_REGION', 'Storage region'],
						['S3_ACCESS_KEY_ID', 'Storage access key id'],
						['S3_SECRET_ACCESS_KEY', 'Storage secret key'],
						['S3_BUCKET_NAME', 'Bucket used for image/video uploads'],
						['S3_PUBLIC_URL', 'Public base URL that serves stored objects'],
						['GOOGLE_*', 'Google OAuth + Drive settings, grouped (client id, client secret, redirect targets)'],
						['MAILTRAP_TOKEN', 'Mail service token for verification and password-reset emails'],
						['DNS_OVERRIDE_SERVERS', 'Optional DNS resolvers used by the server'],
						['USE_MEMORY_DB', 'Toggle the in-memory database fallback'],
						['NODE_ENV', 'Runtime mode (development / production)'],
						['PORT', 'Port the API server listens on'],
					],
				},
			],
		},
	];
};
