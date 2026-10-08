/**
 * Shared report metadata helpers.
 *
 * Every exported report (Analytics, Test Run Report, Run Trends) identifies
 * which client/project it belongs to and who generated/downloaded it, so the
 * file is traceable when it is shared or archived.
 *
 * The canonical shape is a list of `[label, value]` rows, which each exporter
 * renders in its own tabular form (HTML table for PDF, key/value cells for
 * Excel, a leading block for CSV).
 */

export interface ReportAuthor {
    name?: string;
    email?: string;
}

export interface ReportMeta {
    clientName?: string;
    clientId?: string;
    projectName?: string;
    projectId?: string;
    author?: ReportAuthor;
    generatedAt?: string;
}

/** `[label, value]` pair used to build report header tables. */
export type ReportMetaRow = [string, string];

/** `Pankaj Kumar (pankaj@example.com)` — name is optional. */
export const formatAuthor = (author?: ReportAuthor): string => {
    if (!author) return '';
    const name = (author.name || '').trim();
    const email = (author.email || '').trim();
    if (name && email) return `${name} (${email})`;
    return name || email;
};

/** Human labels used in report headers and summary sheets. */
export const REPORT_CLIENT_LABEL = 'Client Name';
export const REPORT_CLIENT_ID_LABEL = 'Client ID';
export const REPORT_PROJECT_LABEL = 'Project Name';
export const REPORT_PROJECT_ID_LABEL = 'Project ID';
export const REPORT_AUTHOR_LABEL = 'Created By Name';
export const REPORT_TIMESTAMP_LABEL = 'Date & Time Stamp';

/**
 * Tabular identity rows, in display order, with blank values dropped:
 */
export const buildReportMetaRows = (meta: ReportMeta): ReportMetaRow[] => {
    const rows: ReportMetaRow[] = [];
    const client = (meta.clientName || '').trim();
    if (client) rows.push([REPORT_CLIENT_LABEL, client]);
    const clientId = (meta.clientId || '').trim();
    if (clientId) rows.push([REPORT_CLIENT_ID_LABEL, clientId]);

    const project = (meta.projectName || '').trim();
    if (project) rows.push([REPORT_PROJECT_LABEL, project]);
    const projectId = (meta.projectId || '').trim();
    if (projectId) rows.push([REPORT_PROJECT_ID_LABEL, projectId]);

    const author = formatAuthor(meta.author);
    if (author) rows.push([REPORT_AUTHOR_LABEL, author]);

    const timestamp = (meta.generatedAt || '').trim() || new Date().toLocaleString();
    rows.push([REPORT_TIMESTAMP_LABEL, timestamp]);

    return rows;
};

/**
 * Flat `Label: Value` lines for plain-text contexts (e.g. CSV headers).
 * Joins with a newline so nothing depends on a `|` separator.
 */
export const buildReportMetaBlock = (meta: ReportMeta): string =>
    buildReportMetaRows(meta)
        .map(([label, value]) => `${label}: ${value}`)
        .join('\n');

/** Filename-safe project segment, e.g. `Sample QA / EMEA` -> `Sample_QA_EMEA`. */
export const projectSlug = (projectName?: string): string =>
    (projectName || 'project').replace(/[^a-z0-9]+/gi, '_');
