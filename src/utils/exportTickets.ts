/**
 * Ticket Export Utilities
 * Exports the currently filtered ticket list to Excel (XLSX) with every detail.
 */

import * as XLSX from 'xlsx';
import { Ticket } from '../types/testManager';
import { stripHtmlPreserveLineBreaks } from './sanitize';

const formatDateTime = (value?: string): string => {
    if (!value) return '';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch {
        return value;
    }
};

interface ExportColumn {
    id: string;
    label: string;
    value: (ticket: Ticket) => string;
}

/** Every ticket detail, in the order it appears in the export. */
const EXPORT_COLUMNS: ExportColumn[] = [
    { id: 'id', label: 'Ticket ID', value: (t) => t.displayId || t.id },
    { id: 'title', label: 'Title', value: (t) => t.title || '' },
    { id: 'description', label: 'Description', value: (t) => stripHtmlPreserveLineBreaks(t.description) },
    { id: 'status', label: 'Status', value: (t) => t.status || '' },
    { id: 'priority', label: 'Priority', value: (t) => t.priority || '' },
    { id: 'severity', label: 'Severity', value: (t) => t.severity || '' },
    { id: 'assignedTo', label: 'Assignee', value: (t) => t.assignedTo?.name || 'Unassigned' },
    { id: 'createdBy', label: 'Created By', value: (t) => t.createdBy?.name || '' },
    { id: 'team', label: 'Team', value: (t) => t.team || '' },
    { id: 'failureType', label: 'Failure Type', value: (t) => t.failureType || '' },
    { id: 'environment', label: 'Environment', value: (t) => t.environment || '' },
    { id: 'buildVersion', label: 'Build Version', value: (t) => t.buildVersion || '' },
    { id: 'tags', label: 'Tags', value: (t) => (t.tags || []).join(', ') },
    { id: 'jiraIssueKey', label: 'JIRA Key', value: (t) => t.jiraIssueKey || '' },
    { id: 'jiraStatus', label: 'JIRA Status', value: (t) => t.jiraStatus || '' },
    { id: 'jiraUrl', label: 'JIRA URL', value: (t) => t.jiraUrl || '' },
    { id: 'relatedRunId', label: 'Related Run ID', value: (t) => t.relatedRunId || '' },
    { id: 'relatedRunItemId', label: 'Related Run Item ID', value: (t) => t.relatedRunItemId || '' },
    { id: 'failureAt', label: 'Failure At', value: (t) => formatDateTime(t.failureAt) },
    { id: 'firstReproducedAt', label: 'First Reproduced At', value: (t) => formatDateTime(t.firstReproducedAt) },
    { id: 'returnedCount', label: 'Returned Count', value: (t) => String(t.returnedCount ?? 0) },
    { id: 'lastReturnedAt', label: 'Last Returned At', value: (t) => formatDateTime(t.lastReturnedAt) },
    { id: 'lastReturnReason', label: 'Return Reason', value: (t) => t.lastReturnReason || '' },
    {
        id: 'divergence',
        label: 'Divergence',
        value: (t) =>
            t.divergence?.hasDiverged
                ? `Yes — ${(t.divergence.changedFields || []).map((f) => f.field).join(', ')}`
                : 'No',
    },
    { id: 'attachments', label: 'Attachments', value: (t) => String((t.attachments || []).length) },
    {
        id: 'attachmentLinks',
        label: 'Attachment Links',
        value: (t) => (t.attachments || []).map((a) => a.url).filter(Boolean).join('\n'),
    },
    { id: 'archived', label: 'Archived', value: (t) => (t.archived ? 'Yes' : 'No') },
    { id: 'archivedAt', label: 'Archived At', value: (t) => formatDateTime(t.archivedAt) },
    { id: 'createdAt', label: 'Created At', value: (t) => formatDateTime(t.createdAt) },
    { id: 'updatedAt', label: 'Last Updated', value: (t) => formatDateTime(t.updatedAt) },
];

/** Build the sheet data: header row plus one row per ticket. */
export function buildTicketRows(tickets: Ticket[]): string[][] {
    const header = EXPORT_COLUMNS.map((col) => col.label);
    const rows = tickets.map((ticket) => EXPORT_COLUMNS.map((col) => col.value(ticket)));
    return [header, ...rows];
}

export interface TicketExportOptions {
    projectName?: string;
    scope?: 'active' | 'archived';
}

const slug = (value: string): string => value.replace(/[^a-z0-9]/gi, '_');

/** Export the given tickets to a downloadable .xlsx file. */
export function exportTicketsToXLSX(tickets: Ticket[], options: TicketExportOptions = {}): void {
    if (tickets.length === 0) {
        throw new Error('There are no tickets to export for the current filters');
    }

    const rows = buildTicketRows(tickets);
    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = EXPORT_COLUMNS.map((col, index) => ({
        wch: Math.max(
            col.label.length,
            ...rows.slice(1).map((row) => Math.min((row[index] || '').length, 60))
        ),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tickets');

    const timestamp = new Date().toISOString().split('T')[0];
    let filename = 'tickets';
    if (options.projectName) filename += `-${slug(options.projectName)}`;
    if (options.scope) filename += `-${options.scope}`;
    filename += `-${timestamp}.xlsx`;

    XLSX.writeFile(wb, filename);
}
