import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  Rocket,
  LayoutDashboard,
  Building2,
  Folder,
  Layers,
  List,
  ClipboardList,
  Bug,
  MessagesSquare,
  LineChart,
  PieChart,
  Sparkles,
  Link2,
  HardDrive,
  Settings,
  ShieldCheck,
  Shield,
  HelpCircle,
  Search,
  X,
  Lightbulb,
  Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface HelpTip {
  title: string;
  text: string;
}

interface HelpFaq {
  q: string;
  a: string;
}

interface HelpSection {
  id: string;
  icon: LucideIcon;
  title: string;
  audience: 'all' | 'client' | 'super';
  overview: string;
  steps?: string[];
  tips?: HelpTip[];
  faq?: HelpFaq[];
  extra?: React.ReactNode;
}

const PLATFORM_ROLES: { role: string; scope: string; can: string }[] = [
  {
    role: 'Super Admin',
    scope: 'Entire platform',
    can: 'Create and manage every client, assign client admins, and view cross-client dashboards and analytics.',
  },
  {
    role: 'Client Admin',
    scope: 'Your organisation',
    can: 'Manage your client profile and users (admins, members, viewers), configure JIRA/Drive, and work in projects you belong to.',
  },
  {
    role: 'Member',
    scope: 'Your organisation',
    can: 'Day-to-day testing work — create and edit suites, cases, runs and tickets in projects you belong to.',
  },
  {
    role: 'Viewer',
    scope: 'Your organisation',
    can: 'Read-only access to your organisation’s projects and reports.',
  },
  {
    role: 'Project Lead',
    scope: 'Single project',
    can: 'Full control of the project: settings, members and roles, custom fields — plus everything an editor can do.',
  },
  {
    role: 'Project Editor',
    scope: 'Single project',
    can: 'Create and edit suites, cases, runs and tickets, and execute test runs in that project.',
  },
  {
    role: 'Project Viewer',
    scope: 'Single project',
    can: 'View cases, runs, tickets and reports of that project without changing anything.',
  },
];

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    icon: Rocket,
    title: 'Getting Started',
    audience: 'client',
    overview:
      'New to TSTestManager? Follow this path once and you will have a working test management workflow — from first login to your first bug report.',
    steps: [
      'Verify your account — after signing up, enter the verification code sent to your email, then log in with your credentials.',
      'Open Projects and select an active project (or create a new one). The sidebar shows your Active Project — suites, cases, runs, tickets and analytics all work inside a project.',
      'Create test suites — group related tests into suites (for example “Login”, “Checkout”, “Search API”). Suites keep large test bases navigable.',
      'Add test cases — write them manually with rich-text steps and expected results, or use “Generate with AI” to draft cases from a requirement and edit them before saving.',
      'Start a Test Run — pick the suites/cases to execute, optionally set tags, environment, team and build version, then run it and mark each case as you test.',
      'Log bugs as tickets — when a case fails, create a ticket describing the defect; move it across the kanban board as your team triages it.',
      'Review the results — Analytics gives project-level reports (summary, trends, suite comparison, health) and Test Run Analytics compares runs over time. Export reports to CSV, Excel or PDF.',
    ],
    tips: [
      {
        title: 'Master the Active Project',
        text: 'Everything is project-scoped. If a menu says “Select project first”, go to Projects and pick a project — your choice persists while you work.',
      },
      {
        title: 'Work top to bottom',
        text: 'The left navigation follows the natural order of testing: Projects → Suites → Cases → Runs → Tickets → Analytics.',
      },
    ],
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    audience: 'client',
    overview:
      'Your home screen after login. It summarises your testing activity so you can see the health of your work in seconds.',
    steps: [
      'Review the KPI cards at the top for counts of projects, suites, cases, runs and tickets.',
      'Use the charts to spot trends — for example growing case coverage or failing runs.',
      'Switch to the Project Overview tab for a per-project breakdown of activity and progress.',
      'Drill into anything that looks off by following the matching left-menu section (Runs, Tickets, Analytics).',
    ],
    tips: [
      {
        title: 'Dashboard is global',
        text: 'It aggregates across your projects. For detail on one project, use Analytics or open the project’s own sections.',
      },
    ],
  },
  {
    id: 'my-client',
    icon: Building2,
    title: 'My Client',
    audience: 'client',
    overview:
      'Your organisation’s workspace. Client admins manage people and integrations here; everyone in the client can review the overview.',
    steps: [
      'Overview — see your client profile at a glance (client code and name).',
      'Users — client admins invite and manage organisation users and assign roles: Admin, Member or Viewer.',
      'My JIRA — connect your personal JIRA account so your JIRA issues are recognised across projects.',
      'Project Configuration — set up JIRA per project: enable the integration, map projects and configure how tickets stay in sync.',
      'Drive — connect Google Drive (when enabled) for shared folders and video evidence storage.',
    ],
    tips: [
      {
        title: 'Only admins can change users',
        text: 'If you need access or a role change, ask your client admin — roles decide what you can edit.',
      },
    ],
  },
  {
    id: 'projects',
    icon: Folder,
    title: 'Projects',
    audience: 'client',
    overview:
      'A project is the container for all testing work: suites, cases, runs, tickets, discussions and reports. Selecting a project makes it your Active Project.',
    steps: [
      'Open Projects in the left menu and click New Project — give it a name and colour so it is easy to spot in lists.',
      'Select a project to make it active; the sidebar’s Active Project card confirms your choice.',
      'Open Project Settings to manage members and their roles (Lead / Editor / Viewer) and define custom fields for test cases.',
      'Tune display preferences such as hidden default fields/columns so each team sees only what matters to them.',
      'Archive a project you no longer need — archived projects are hidden from normal lists but can be restored.',
    ],
    tips: [
      {
        title: 'Members control access',
        text: 'Only members of a project see and edit it. Add teammates from Project Settings and give viewers read-only access.',
      },
      {
        title: 'Custom fields',
        text: 'Custom fields you define (for example “Regulation” or “Device”) appear on the test-case form and can be shown as table columns.',
      },
    ],
  },
  {
    id: 'suites',
    icon: Layers,
    title: 'Suites & Folders',
    audience: 'client',
    overview:
      'Suites organise test cases into logical groups and nest as folders up to 3 levels deep — for example Owner › Login › Forgot Password. A folder can hold test cases and sub-folders at the same time, so “Owner” can keep its own cases and still contain “Login”.',
    steps: [
      'With an active project, open Test Suites and use the + button in the Folders panel to create a folder or suite at the root.',
      'Use the folder-row buttons to create a folder inside an existing one, rename it, or move it somewhere else with “Move to…” (a folder cannot be moved into itself or one of its own sub-folders).',
      'Add or move test cases into any folder from the cases area, or with “Move to folder” when editing a case.',
      'Click a folder in the left tree to scope the list beside it; clicking a folder in the Cases sidebar loads that folder’s cases plus everything under it.',
      'Use the Active / Archived toggle to hide suites you are not currently using — archive is reversible and takes a folder’s whole subtree with it.',
    ],
    tips: [
      {
        title: 'Keep suites focused',
        text: 'Small, well-named suites (e.g. “Checkout – Guest User”) make reports and run planning far more useful.',
      },
      {
        title: 'Role → feature → detail',
        text: 'A common shape is one folder per role (Owner, Parent, Driver…), a feature folder inside each (Login, Profile…), and cases in the deepest folder. Each row shows how many cases sit in that folder and everything beneath it.',
      },
    ],
  },
  {
    id: 'cases',
    icon: List,
    title: 'Test Cases',
    audience: 'client',
    overview:
      'The heart of TSTestManager — your library of what to test and how. Create cases manually or generate them with AI, then keep them review-ready.',
    steps: [
      'Open All Cases (with an active project) and click the create button — add a title, rich-text steps, expected result, description and comments.',
      'Classify the case: Priority (Low / Medium / High / Critical), Status (Draft / In Review / Ready / Updated), Test Type (Positive / Negative / UI / Performance / Other), area and assigned tester.',
      'Fill in any custom fields your project defines, and check the case History to see who changed what and when.',
      'Use Clone to duplicate a case for a variation, and the table’s column settings to show/hide or reorder columns.',
      'Filter by suite, status, priority, area or search text; select multiple rows for bulk actions.',
      'Archive cases you no longer run — archiving is separate from status, so a case can be “Ready” yet archived out of the way.',
    ],
    tips: [
      {
        title: 'Review before Ready',
        text: 'Move cases from Draft → In Review → Ready so your team knows which tests are approved for execution.',
      },
      {
        title: 'Runs keep snapshots',
        text: 'Executing a run freezes a copy of each case. Editing the case later improves future runs without rewriting history.',
      },
    ],
  },
  {
    id: 'runs',
    icon: ClipboardList,
    title: 'Test Runs',
    audience: 'client',
    overview:
      'A run is one execution cycle: pick cases, execute them, record results, and close the run so everyone can see the outcome.',
    steps: [
      'Open Test Runs and create a run — choose a title, description, an optional group, tags, environment, team and build version.',
      'Pick the cases: the “By Folder” tab shows the folder tree, and ticking a folder selects every case beneath it; “By Suite”, “By Area” and “Individual Cases” are also available, and the folder/area filters combine.',
      'Edit the selection later with “Edit” on a run: Available and Assigned to this run sit side by side, grouped by folder, with an Assign or Unassign button on every folder and every case. Nothing is saved until you press Save Changes.',
      'Start the run (Draft → In Progress) and work through the list, marking each item: Not Run, Ready for Testing, In Progress, Passed, Failed, Blocked, Skipped or Out of Scope.',
      'Raise a ticket directly from a failed item so the bug carries the case context with it.',
      'Watch the results summary update live — pass/fail counts and percentage per run and per group.',
      'Complete the run when finished (or Abandon it if it is no longer valid); completed runs feed Analytics and Test Run Analytics.',
    ],
    tips: [
      {
        title: 'Use groups for parallel testing',
        text: 'Split a run into groups (by team, area or device) so testers only see their slice of the work.',
      },
      {
        title: 'Re-shape a run without recreating it',
        text: 'Unassigning a case keeps the rest of the run and its recorded results intact — the remaining items are simply re-sequenced.',
      },
      {
        title: 'Clone a run',
        text: 'Re-testing after a fix? Clone the previous run to reuse its case selection and settings.',
      },
    ],
  },
  {
    id: 'tickets',
    icon: Bug,
    title: 'Tickets (Bugs)',
    audience: 'client',
    overview:
      'Tickets track defects and work items on a kanban board. Create them from a failed run item or standalone, then move them through triage to closure.',
    steps: [
      'Create a ticket with a clear title, rich-text description, severity and priority — attach the failing case when logging from a run.',
      'Move it across the board: To Do → Open → In Progress → QA/Testing → Resolved → Done/Closed, with Reopened and Out of scope for special cases.',
      'Open a ticket for details: full description, discussion thread, linked case/run context and history.',
      'Link or push the ticket to JIRA when your project has JIRA configured, and sync status back.',
      'Archive tickets that are no longer relevant; they stay retrievable via the archive filter.',
    ],
    tips: [
      {
        title: 'A good bug report',
        text: 'Steps to reproduce, expected vs actual result, environment/build and severity — that is all a developer needs to fix it fast.',
      },
      {
        title: 'Board = workflow',
        text: 'If your team’s workflow uses different stages, agree who moves cards and when — an up-to-date board is a trustworthy board.',
      },
    ],
  },
  {
    id: 'discussions',
    icon: MessagesSquare,
    title: 'Discussions',
    audience: 'client',
    overview:
      'Test cases and tickets have built-in discussion threads so conversations stay attached to the work instead of scattering across chat and email.',
    steps: [
      'Open a test case or ticket and find its discussion area.',
      'Post questions, findings or reproduction details — teammates see new messages in real time.',
      'Resolve questions by replying in-thread; the full history remains with the item forever.',
    ],
    tips: [
      {
        title: 'Discuss where the context is',
        text: 'Decisions made in a ticket’s thread are visible to whoever picks the ticket up next.',
      },
    ],
  },
  {
    id: 'run-analytics',
    icon: LineChart,
    title: 'Test Run Analytics',
    audience: 'client',
    overview:
      'Dedicated to runs: compare executions, follow quality over time and drill into a single run’s report.',
    steps: [
      'Open Test Run Analytics (requires an active project).',
      'Compare Runs — pick multiple runs to see pass rate and result distribution side by side.',
      'Trends — track pass rate, case counts and failures across runs to spot regressions.',
      'Single Run Report — deep-dive one run: results by suite/group, failed cases and tester contributions.',
    ],
    tips: [
      {
        title: 'Compare before you release',
        text: 'A side-by-side of the last two runs tells you instantly whether the fix sweep actually improved things.',
      },
    ],
  },
  {
    id: 'analytics',
    icon: PieChart,
    title: 'Analytics & Reports',
    audience: 'client',
    overview:
      'Project-level reporting: summary, trends, suite comparison, case health and ticket metrics — all exportable for stakeholders.',
    steps: [
      'Open Analytics with an active project and apply filters (date range, suite, status…).',
      'Explore the report tabs: project summary, trends over time, suite comparison, test-case health and ticket metrics.',
      'Spot weak areas: suites with low pass rates, stale cases (no recent results) and recurring failures.',
      'Export what you need — reports download as CSV, Excel or PDF from the export menu.',
    ],
    tips: [
      {
        title: 'Reports for stakeholder updates',
        text: 'The PDF export is formatted for sharing; CSV/Excel are better for your own pivots and charts.',
      },
    ],
  },
  {
    id: 'ai',
    icon: Sparkles,
    title: 'AI Test Case Generation',
    audience: 'client',
    overview:
      'Describe a feature in plain language and let AI draft structured test cases for you — then review, edit and save. Supports Gemini, OpenRouter, OpenAI, Anthropic and DeepSeek.',
    steps: [
      'Go to Settings → AI providers, paste your API key for a provider and choose its model (each user brings their own key).',
      'In Test Cases, click Generate with AI.',
      'Describe the feature or paste the requirement/acceptance criteria — as detailed as possible.',
      'Watch the draft generate in real time; edit titles, steps and fields before inserting them.',
      'Save the cases into your suite and assign priority/status like any manually created case.',
    ],
    tips: [
      {
        title: 'AI drafts, humans approve',
        text: 'Treat output as a first draft — validate steps against the actual UI before marking cases Ready.',
      },
      {
        title: 'Key not working?',
        text: 'Re-check the key and selected model in Settings; provider quota errors come from the provider, not TSTestManager.',
      },
    ],
  },
  {
    id: 'jira',
    icon: Link2,
    title: 'JIRA Integration',
    audience: 'client',
    overview:
      'Connect TSTestManager to Atlassian JIRA so defects flow both ways: link existing JIRA issues to tickets or push new ones, and keep statuses in sync.',
    steps: [
      'Client admins: in My Client → My JIRA, connect your JIRA account.',
      'In My Client → Project Configuration, enable JIRA per project and map each TSTestManager project to its JIRA project.',
      'From a ticket, link an existing JIRA issue or create one — the key appears on the ticket.',
      'Sync statuses (single or bulk) so JIRA and the kanban board stay consistent.',
    ],
    tips: [
      {
        title: 'Connection expired?',
        text: 'JIRA tokens can expire — reconnect from My JIRA if sync starts failing.',
      },
    ],
  },
  {
    id: 'drive',
    icon: HardDrive,
    title: 'Google Drive & Video Evidence',
    audience: 'client',
    overview:
      'Attach video evidence to test cases and tickets, stored in Google Drive and playable right where you work.',
    steps: [
      'Connect Google Drive from Settings or My Client → Drive (OAuth — no passwords stored).',
      'Per project, choose the folder where evidence files are saved.',
      'Upload a video from a test case or ticket; it is stored in Drive and embedded in the item.',
      'Team members play the recording inline — no downloads needed.',
    ],
    tips: [
      {
        title: 'Keep evidence close to the bug',
        text: 'A 15-second recording of a failed flow often replaces ten lines of reproduction text.',
      },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings & Account',
    audience: 'all',
    overview:
      'Your personal control panel — appearance, security and integrations. Open it from the bottom of the left menu.',
    steps: [
      'Change your password (the strength meter shows how safe it is) and keep your recovery email current.',
      'Switch theme between light and dark, here or from the header toggle.',
      'Configure AI providers: add API keys, pick models and refresh available model lists.',
      'Connect Google Drive for video evidence.',
      'Review your verification status — unverified accounts cannot receive important emails such as password resets.',
    ],
    tips: [
      {
        title: 'Keys are yours',
        text: 'AI API keys you save are attached to your account and never displayed back in full — treat them like passwords.',
      },
    ],
  },
  {
    id: 'roles',
    icon: ShieldCheck,
    title: 'Roles & Permissions',
    audience: 'all',
    overview:
      'Access is two-layered: your organisation role (what you can do in the client) and your project role (what you can do in each project).',
    extra: (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="py-2 pr-4 font-semibold">Role</th>
              <th className="py-2 pr-4 font-semibold">Scope</th>
              <th className="py-2 font-semibold">What it can do</th>
            </tr>
          </thead>
          <tbody>
            {PLATFORM_ROLES.map((r) => (
              <tr key={r.role} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                <td className="py-2.5 pr-4 font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">{r.role}</td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600 dark:text-gray-400">{r.scope}</td>
                <td className="py-2.5 text-gray-600 dark:text-gray-400">{r.can}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    tips: [
      {
        title: 'Why is something read-only?',
        text: 'Either your project role is Viewer, or you are not a member of the project. Ask a project Lead to update your role.',
      },
    ],
  },
  {
    id: 'super-admin',
    icon: Shield,
    title: 'Super Admin Console',
    audience: 'super',
    overview:
      'Platform administrators manage the entire tenant — every client, their users and cross-client analytics.',
    steps: [
      'Client Dashboard — portfolio KPIs across all clients: active clients, projects, cases, runs and tickets with trend charts.',
      'Clients — create client organisations and open one to manage its users and roles (Admin / Member / Viewer) and monitor usage.',
      'Client Analytics — cross-client reports comparing volume and quality across organisations.',
      'Sign in with the dedicated Super Admin login for administration; use a normal user account if you also do hands-on testing.',
    ],
    tips: [
      {
        title: 'Admins don’t test',
        text: 'The admin console has no suites or cases — testing lives inside client accounts under Projects.',
      },
    ],
  },
  {
    id: 'faq',
    icon: HelpCircle,
    title: 'FAQ & Troubleshooting',
    audience: 'all',
    overview: 'Quick answers to the questions new users ask most often.',
    faq: [
      {
        q: 'Menu items are greyed out and say “Select project first”.',
        a: 'Suites, cases, runs, tickets and run analytics live inside a project. Open Projects and click a project to make it your Active Project.',
      },
      {
        q: 'I can’t edit something — buttons are disabled or actions are rejected.',
        a: 'You likely have a Viewer role (organisation or project), or you are not a member of that project. Ask a project Lead or your client admin to raise your role.',
      },
      {
        q: 'I was redirected to the login page while working.',
        a: 'Your session expired for security. Log in again — unsaved form text may need to be re-entered, so save work frequently.',
      },
      {
        q: 'I get “Too many requests” (HTTP 429).',
        a: 'The API allows 300 requests per minute per user. Slow down scripts or add delays between calls in automations.',
      },
      {
        q: 'A suite, case or ticket has disappeared.',
        a: 'It is probably archived, not deleted. Switch the Active/Archived filter in that list and restore it.',
      },
      {
        q: 'A list shows no results although data exists.',
        a: 'Filters or search text are narrowing the view. Clear the filters — there is a clear/reset control above the list.',
      },
      {
        q: 'AI generation fails or returns nothing.',
        a: 'Open Settings → AI providers and confirm your API key and model are set, then check your provider quota/billing.',
      },
      {
        q: 'JIRA sync or Drive upload fails.',
        a: 'Authorisations can expire — reconnect from My Client → My JIRA or Settings → Drive. For JIRA, also verify the project mapping.',
      },
      {
        q: 'I forgot my password or my reset link expired.',
        a: 'Use “Forgot password” on the login page to request a fresh, time-limited link — older links stop working for safety.',
      },
      {
        q: 'Where do notifications come from?',
        a: 'The bell in the header shows updates about your work — open it to jump straight to the related item.',
      },
    ],
  },
];

const HelpPage: React.FC = () => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string>('');
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const visibleSections = useMemo(
    () => HELP_SECTIONS.filter((s) => s.audience === 'all' || (isSuperAdmin ? s.audience === 'super' : s.audience === 'client')),
    [isSuperAdmin],
  );

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleSections;
    return visibleSections.filter((s) => {
      const haystack = [
        s.title,
        s.overview,
        ...(s.steps ?? []),
        ...(s.tips ?? []).map((t) => `${t.title} ${t.text}`),
        ...(s.faq ?? []).map((f) => `${f.q} ${f.a}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [visibleSections, query]);

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
              <HelpCircle size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Help Center</h1>
              <p className="text-sm text-blue-100">
                Learn how every section of TSTestManager works — from your first project to release reports.
              </p>
            </div>
          </div>
          <div className="relative mt-6 max-w-xl">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-200" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help — e.g. “run”, “roles”, “AI”, “JIRA”…"
              className="w-full rounded-lg border-0 bg-white/15 py-2.5 pl-10 pr-10 text-sm text-white placeholder-blue-200 outline-none ring-1 ring-white/20 backdrop-blur focus:bg-white/25 focus:ring-white/50"
              aria-label="Search help"
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
          <nav className="hidden lg:block" aria-label="Help sections">
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
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Help sections">
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
                  Try a different keyword, or clear the search to browse all topics.
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
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{s.title}</h2>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{s.overview}</p>

                  {s.steps && s.steps.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        How it works
                      </p>
                      <ol className="mt-2 space-y-2">
                        {s.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-system-blue/10 text-[11px] font-bold text-system-blue">
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {s.extra && <div className="mt-4">{s.extra}</div>}

                  {s.faq && s.faq.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {s.faq.map((f, i) => (
                        <div key={i} className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{f.q}</p>
                          <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{f.a}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.tips && s.tips.length > 0 && (
                    <div className="mt-5 space-y-2.5">
                      {s.tips.map((tip, i) => (
                        <div
                          key={i}
                          className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-500/20 dark:bg-amber-500/10"
                        >
                          <Lightbulb size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
                          <div className="text-sm">
                            <span className="font-semibold text-amber-800 dark:text-amber-300">{tip.title} — </span>
                            <span className="text-amber-800/90 dark:text-amber-200/80">{tip.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            {/* Footer note */}
            {filteredSections.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
                <Info size={16} className="mt-0.5 flex-shrink-0" />
                <p>
                  Can’t find what you need? Contact your workspace administrator — they can adjust roles, projects and
                  integrations for you.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
