/**
 * Single Test Run Report Export
 *
 * Turns a `DetailedRunReport` (produced by GET /reports/run/:runId/detailed)
 * into an Excel workbook or a print-ready PDF.
 *
 * The workbook has one sheet per concern — Summary, Test Items, Tickets,
 * Timeline — so a run can be reviewed without scrolling a single wide table.
 */

import ExcelJS from 'exceljs';
import { DetailedRunReport, RunTicketSummary } from '../types/testManager';
import {
    HorizontalBarItem,
    PieSlice,
    ReportChart,
    StackedBarPoint,
    horizontalBarChartSVG,
    pieChartSVG,
    reportChartColors,
    stackedBarChartSVG,
    svgToPngBytes,
} from './reportCharts';
import {
    ReportMeta,
    buildReportMetaRows,
} from './reportMeta';

const PALETTE = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#F97316',
    '#64748B',
];

const formatDateTime = (value?: Date | string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
};

const formatDate = (value?: Date | string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};

const formatDuration = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    if (minutes < 60) return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
};

const statusDistribution = (summary: RunTicketSummary): [string, number][] =>
    Object.entries(summary.byStatus || {}).sort((a, b) => b[1] - a[1]);

const failureDistribution = (summary: RunTicketSummary): [string, number][] =>
    Object.entries(summary.byFailureType || {}).sort((a, b) => b[1] - a[1]);

const severityDistribution = (summary: RunTicketSummary): [string, number][] =>
    Object.entries(summary.bySeverity || {}).sort((a, b) => b[1] - a[1]);

const priorityDistribution = (summary: RunTicketSummary): [string, number][] =>
    Object.entries(summary.byPriority || {}).sort((a, b) => b[1] - a[1]);

const unticketedFailures = (report: DetailedRunReport) =>
    report.items.filter(
        (item) => item.status === 'Failed' && (item.linkedTickets?.length ?? 0) === 0
    );

const ticketCell = (itemId: string, report: DetailedRunReport): string => {
    const item = report.items.find((i) => i.itemId === itemId);
    if (!item || !item.linkedTickets?.length) return '';
    return item.linkedTickets.map((t) => t.displayId || t.ticketId).join(', ');
};

const runLabel = (report: DetailedRunReport): string =>
    report.displayId || report.runId;

/**
 * Resolve report identity: the explicit prop wins, otherwise fall back to the
 * client/project the API resolved for this run (suite -> project -> client).
 */
const mergeRunMeta = (report: DetailedRunReport, meta: ReportMeta): ReportMeta => ({
    clientName: meta.clientName || report.client?.name || undefined,
    projectName: meta.projectName || report.project?.name || undefined,
    author: meta.author,
});

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

const toHorizontalBars = (entries: [string, number][]): HorizontalBarItem[] =>
    entries.map(([label, value], index) => ({
        label,
        value,
        color: PALETTE[index % PALETTE.length],
    }));

/**
 * Build the visual analytics for a single run: execution outcome, per-suite
 * results, slowest cases, ticket breakdowns and failure-ticket hygiene.
 */
function buildRunReportCharts(report: DetailedRunReport): ReportChart[] {
    const colors = reportChartColors();
    const summary = report.ticketSummary;
    const stats = report.statistics;
    const charts: ReportChart[] = [];

    // 1. Execution outcome donut
    const outcomeSlices: PieSlice[] = [
        { name: 'Passed', value: stats.passed, color: colors.passed },
        { name: 'Failed', value: stats.failed, color: colors.failed },
        { name: 'Blocked', value: stats.blocked, color: colors.blocked },
        { name: 'Skipped', value: stats.skipped, color: colors.skipped },
        { name: 'Not Run', value: stats.notRun, color: colors.primary },
    ].filter((slice) => slice.value > 0);

    charts.push({
        title: 'Execution Outcome',
        svg: pieChartSVG('Execution Outcome', outcomeSlices, 560, 300),
    });

    // 2. Per-suite stacked bar (passed / failed / other)
    const suiteMap = new Map<string, { passed: number; failed: number; other: number }>();
    for (const item of report.items) {
        const suite = item.suiteName || 'Unassigned suite';
        const bucket = suiteMap.get(suite) || { passed: 0, failed: 0, other: 0 };
        if (item.status === 'Passed') bucket.passed += 1;
        else if (item.status === 'Failed') bucket.failed += 1;
        else bucket.other += 1;
        suiteMap.set(suite, bucket);
    }
    if (suiteMap.size > 0) {
        const suitePoints: StackedBarPoint[] = Array.from(suiteMap.entries()).map(
            ([suite, bucket]) => ({
                label: suite.length > 18 ? `${suite.slice(0, 17)}…` : suite,
                values: [bucket.passed, bucket.failed, bucket.other],
            })
        );
        charts.push({
            title: 'Results by Suite',
            svg: stackedBarChartSVG(
                'Results by Suite',
                ['Passed', 'Failed', 'Other'],
                [colors.passed, colors.failed, colors.skipped],
                suitePoints,
                760,
                Math.max(220, 120 + suitePoints.length * 34)
            ),
        });
    }

    // 3. Slowest test cases
    const slowest: HorizontalBarItem[] = [...report.items]
        .filter((item) => item.timeSpent > 0)
        .sort((a, b) => b.timeSpent - a.timeSpent)
        .slice(0, 8)
        .map((item) => ({
            label: item.title.length > 26 ? `${item.title.slice(0, 25)}…` : item.title,
            value: Math.round(item.timeSpent),
            color: colors.primary,
        }));
    if (slowest.length > 0) {
        charts.push({
            title: 'Slowest Test Cases',
            svg: horizontalBarChartSVG(
                'Slowest Test Cases (seconds)',
                slowest,
                's',
                760,
                Math.max(180, 90 + slowest.length * 34)
            ),
        });
    }

    // 4. Tickets by status
    const statusEntries = statusDistribution(summary);
    if (statusEntries.length > 0) {
        charts.push({
            title: 'Tickets by Status',
            svg: pieChartSVG(
                'Tickets by Status',
                statusEntries.map(([name, value], index) => ({
                    name,
                    value,
                    color: PALETTE[index % PALETTE.length],
                })),
                560,
                300
            ),
        });
    }

    // 5. Tickets by failure type
    const failureEntries = failureDistribution(summary);
    if (failureEntries.length > 0) {
        charts.push({
            title: 'Tickets by Failure Type',
            svg: horizontalBarChartSVG(
                'Tickets by Failure Type',
                toHorizontalBars(failureEntries),
                '',
                760,
                Math.max(160, 90 + failureEntries.length * 34)
            ),
        });
    }

    // 6. Tickets by severity
    const severityEntries = severityDistribution(summary);
    if (severityEntries.length > 0) {
        charts.push({
            title: 'Tickets by Severity',
            svg: horizontalBarChartSVG(
                'Tickets by Severity',
                toHorizontalBars(severityEntries),
                '',
                760,
                Math.max(160, 90 + severityEntries.length * 34)
            ),
        });
    }

    // 7. Tickets by priority
    const priorityEntries = priorityDistribution(summary);
    if (priorityEntries.length > 0) {
        charts.push({
            title: 'Tickets by Priority',
            svg: horizontalBarChartSVG(
                'Tickets by Priority',
                toHorizontalBars(priorityEntries),
                '',
                760,
                Math.max(160, 90 + priorityEntries.length * 34)
            ),
        });
    }

    // 8. Failure ticket hygiene — were failures ticketed?
    const failedTotal = report.items.filter((item) => item.status === 'Failed').length;
    if (failedTotal > 0) {
        const unticketed = unticketedFailures(report).length;
        charts.push({
            title: 'Failure Ticket Hygiene',
            svg: pieChartSVG(
                'Failure Ticket Hygiene',
                [
                    {
                        name: 'Ticketed',
                        value: failedTotal - unticketed,
                        color: colors.passed,
                    },
                    { name: 'Not ticketed', value: unticketed, color: colors.failed },
                ],
                560,
                280
            ),
        });
    }

    return charts;
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

const styleHeader = (row: ExcelJS.Row): void => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    row.alignment = { vertical: 'middle' };
    row.height = 20;
};

const addTitle = (ws: ExcelJS.Worksheet, title: string, subtitle: string): void => {
    const titleRow = ws.addRow([title]);
    titleRow.font = { bold: true, size: 14 };
    ws.addRow([subtitle]).font = { size: 10, color: { argb: 'FF6B7280' } };
    ws.addRow([]);
};

const autosize = (ws: ExcelJS.Worksheet, maxCols = 14): void => {
    for (let col = 1; col <= maxCols; col++) {
        const column = ws.getColumn(col);
        let longest = 10;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
            const value = cell.value;
            const text =
                typeof value === 'string'
                    ? value
                    : value === null || value === undefined
                      ? ''
                      : String((value as { text?: string })?.text ?? value);
            longest = Math.max(longest, Math.min(text.length, 60));
        });
        column.width = Math.min(longest + 2, 62);
    }
};

const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const slug = (value: string): string => value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

/**
 * Export a single test run report as a multi-sheet Excel workbook.
 */
export async function exportRunReportToExcel(
    report: DetailedRunReport,
    reportMeta: ReportMeta = {}
): Promise<string> {
    // Prefer the explicit prop, fall back to what the API resolved from suite -> project -> client
    const meta = mergeRunMeta(report, reportMeta);
    const { projectName } = meta;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TS Test Manager';
    workbook.created = new Date();

    const generated = formatDateTime(new Date());
    const summary = report.ticketSummary;
    const unticketed = unticketedFailures(report);
    // Tabular identity: Client / Project / Report Generated By
    const metaRows = buildReportMetaRows(meta);

    // ---- Summary ----
    const summaryWs = workbook.addWorksheet('Summary');
    addTitle(
        summaryWs,
        `Test Run Report – ${runLabel(report)}`,
        [report.title, `Status: ${report.status}`, `Generated ${generated}`]
            .filter(Boolean)
            .join('  |  ')
    );

    summaryWs.addRow(['Report Details', 'Value']);
    styleHeader(summaryWs.getRow(summaryWs.lastRow!.number));
    // Client / Project / Report Generated By rows first, then run specifics
    const identityPairs: Array<[string, string]> = [...metaRows];
    const runPairs: Array<[string, string | number]> = [
        ['Run ID', runLabel(report)],
        ['Title', report.title],
        ['Status', report.status],
        ['Description', report.description || '-'],
        ['Suite', report.suite?.name ?? '-'],
        ['Group', report.group?.name ?? '-'],
        ['Environment', report.environment || '-'],
        ['Team', report.team || '-'],
        ['Build Version', report.buildVersion || '-'],
        ['Tags', (report.tags || []).join(', ') || '-'],
        ['Created By', report.createdBy],
        ['Created At', formatDateTime(report.createdAt)],
        ['Completed At', formatDateTime(report.completedAt)],
        ['Duration', formatDuration(report.duration)],
    ];
    for (const [label, value] of [...identityPairs, ...runPairs]) summaryWs.addRow([label, value]);

    summaryWs.addRow([]);
    summaryWs.addRow(['Execution Summary', 'Value']);
    styleHeader(summaryWs.getRow(summaryWs.lastRow!.number));
    const execPairs: Array<[string, string | number]> = [
        ['Total Tests', report.statistics.total],
        ['Passed', report.statistics.passed],
        ['Failed', report.statistics.failed],
        ['Blocked', report.statistics.blocked],
        ['Skipped', report.statistics.skipped],
        ['Not Run', report.statistics.notRun],
        ['Pass Rate', `${report.statistics.passRate}%`],
        ['Failed Without Ticket', unticketed.length],
    ];
    for (const [label, value] of execPairs) summaryWs.addRow([label, value]);

    summaryWs.addRow([]);
    summaryWs.addRow(['Ticket Summary', 'Value']);
    styleHeader(summaryWs.getRow(summaryWs.lastRow!.number));
    const ticketPairs: Array<[string, string | number]> = [
        ['Total Tickets', summary.total],
        ['Resolved / Closed %', `${summary.resolutionRate}%`],
        ['Reproduced', summary.reproducedCount],
        ['Reproduction %', `${summary.reproductionRate}%`],
        ['Not Reproduced', summary.ticketsWithNoRepro],
        ['Returned', summary.returnedCount],
        ['Returned %', `${summary.returnedRate}%`],
        ['Unassigned', summary.ticketsUnassigned],
        [
            'Avg Time To Reproduce',
            summary.avgTimeToReproduceHours !== null
                ? `${summary.avgTimeToReproduceHours} h`
                : '-',
        ],
    ];
    for (const [label, value] of ticketPairs) summaryWs.addRow([label, value]);

    const addDistribution = (title: string, entries: [string, number][]): void => {
        if (entries.length === 0) return;
        summaryWs.addRow([]);
        summaryWs.addRow([title]);
        summaryWs.getRow(summaryWs.lastRow!.number).font = { bold: true };
        summaryWs.addRow(['Value', 'Count']);
        styleHeader(summaryWs.getRow(summaryWs.lastRow!.number));
        for (const [label, count] of entries) summaryWs.addRow([label, count]);
    };
    addDistribution('Tickets By Status', statusDistribution(summary));
    addDistribution('Tickets By Failure Type', failureDistribution(summary));
    addDistribution('Tickets By Severity', severityDistribution(summary));
    addDistribution('Tickets By Priority', priorityDistribution(summary));

    autosize(summaryWs, 4);

    // ---- Test Items ----
    const itemsWs = workbook.addWorksheet('Test Items');
    addTitle(
        itemsWs,
        `Test Items – ${runLabel(report)}`,
        `${report.items.length} item(s) | Generated ${generated}`
    );
    itemsWs.addRow([
        '#',
        'Test Case',
        'Suite',
        'Area',
        'Priority',
        'Status',
        'Executed By',
        'Executed At',
        'Time Spent',
        'Tickets',
        'Actual Result',
    ]);
    styleHeader(itemsWs.getRow(itemsWs.lastRow!.number));
    report.items.forEach((item, index) => {
        itemsWs.addRow([
            index + 1,
            item.title,
            item.suiteName ?? '-',
            item.area || '-',
            item.priority ?? '-',
            item.status,
            item.executedBy ?? '-',
            formatDateTime(item.executedAt),
            formatDuration(item.timeSpent),
            ticketCell(item.itemId, report) || '-',
            item.actualResult || '-',
        ]);
    });
    autosize(itemsWs, 11);

    // ---- Tickets ----
    const ticketsWs = workbook.addWorksheet('Tickets');
    addTitle(
        ticketsWs,
        `Tickets – ${runLabel(report)}`,
        `${report.tickets.length} ticket(s) | Generated ${generated}`
    );
    ticketsWs.addRow([
        'Ticket ID',
        'Title',
        'Status',
        'Priority',
        'Severity',
        'Failure Type',
        'Assigned To',
        'From Item',
        'Created At',
        'First Reproduced',
        'Returned',
        'Return Reason',
    ]);
    styleHeader(ticketsWs.getRow(ticketsWs.lastRow!.number));
    report.tickets.forEach((ticket) => {
        const fromItem = ticket.relatedRunItemId
            ? report.items.find((i) => i.itemId === ticket.relatedRunItemId)?.title ?? '-'
            : 'Run level';
        ticketsWs.addRow([
            ticket.displayId || ticket.ticketId,
            ticket.title,
            ticket.status,
            ticket.priority,
            ticket.severity,
            ticket.failureType ?? '-',
            ticket.assignedTo?.name ?? 'Unassigned',
            fromItem,
            formatDateTime(ticket.createdAt),
            formatDateTime(ticket.firstReproducedAt),
            ticket.returnedCount,
            ticket.lastReturnReason ?? '-',
        ]);
    });
    if (report.tickets.length === 0) {
        ticketsWs.addRow(['No tickets were raised from this run.']);
    }
    autosize(ticketsWs, 12);

    // ---- Timeline ----
    const timelineWs = workbook.addWorksheet('Timeline');
    addTitle(
        timelineWs,
        `Timeline – ${runLabel(report)}`,
        `${report.timeline.length} event(s) | Generated ${generated}`
    );
    timelineWs.addRow(['Timestamp', 'Action', 'User', 'Details', 'Ticket', 'Status Change']);
    styleHeader(timelineWs.getRow(timelineWs.lastRow!.number));
    report.timeline.forEach((entry) => {
        timelineWs.addRow([
            formatDateTime(entry.timestamp),
            entry.action,
            entry.user,
            entry.details,
            entry.ticketDisplayId || entry.ticketId || '-',
            entry.statusChange ? `${entry.statusChange.from} → ${entry.statusChange.to}` : '-',
        ]);
    });
    autosize(timelineWs, 6);

    // ---- Graphs (charts rendered as PNG) ----
    const charts = buildRunReportCharts(report);
    const chartsWs = workbook.addWorksheet('Graphs');
    addTitle(
        chartsWs,
        `Analytics – ${runLabel(report)}`,
        `${charts.length} chart(s) | Generated ${generated}`
    );

    if (charts.length === 0) {
        chartsWs.addRow(['No chart data available for this run.']);
    } else {
        let rowCursor = chartsWs.lastRow!.number + 2;
        for (const chart of charts) {
            const widthMatch = /width="(\d+)"/.exec(chart.svg);
            const heightMatch = /height="(\d+)"/.exec(chart.svg);
            const width = Number(widthMatch?.[1] || 760);
            const height = Number(heightMatch?.[1] || 340);

            const titleRow = chartsWs.addRow([chart.title]);
            titleRow.font = { bold: true, size: 12 };
            rowCursor = titleRow.number + 1;

            try {
                const png = await svgToPngBytes(chart.svg, width, height);
                const imageId = workbook.addImage({
                    buffer: png as unknown as ArrayBuffer as typeof Buffer.prototype,
                    extension: 'png',
                });
                const displayW = Math.min(width, 720);
                const displayH = Math.round(displayW * (height / width));
                chartsWs.addImage(imageId, {
                    tl: { col: 0.5, row: rowCursor - 1 },
                    ext: { width: displayW, height: displayH },
                });
                // Reserve vertical space so the next chart does not overlap
                const rowSpan = Math.ceil((displayH + 16) / 20);
                for (let i = 0; i < rowSpan; i++) chartsWs.addRow([]);
                rowCursor += rowSpan + 1;
            } catch {
                chartsWs.addRow([`Could not render chart image: ${chart.title}`]);
                chartsWs.addRow([]);
                rowCursor += 2;
            }
            chartsWs.addRow([]);
            rowCursor += 1;
        }
    }

    for (let col = 1; col <= 10; col++) {
        chartsWs.getColumn(col).width = 12;
    }

    const filename = `test-run-report-${slug(runLabel(report))}-${slug(projectName ?? 'project')}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(
        new Blob([buffer as BlobPart], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        filename
    );
    return filename;
}

// ---------------------------------------------------------------------------
// PDF (print-to-PDF via the browser dialog)
// ---------------------------------------------------------------------------

const escapeHtml = (value: unknown): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

const pdfTable = (headers: string[], rows: string[][]): string => `
    <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>
            ${rows
                .map((cells) => `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
                .join('')}
        </tbody>
    </table>`;

const pdfSection = (title: string, content: string): string =>
    content ? `<h2>${escapeHtml(title)}</h2>${content}` : '';

/**
 * Export a single test run report as a print-ready document.
 * Opens the browser print dialog where the user can choose "Save as PDF".
 */
export function exportRunReportToPDF(
    report: DetailedRunReport,
    reportMeta: ReportMeta = {}
): void {
    const meta = mergeRunMeta(report, reportMeta);
    const summary = report.ticketSummary;
    const unticketed = unticketedFailures(report);
    const metaRows = buildReportMetaRows(meta);

    // Header identity table: Client / Project / Report Generated By / Status / Generated
    const headerTable = pdfTable(
        ['Field', 'Value'],
        [
            ...metaRows,
            ['Status', report.status],
            ['Generated', formatDateTime(new Date())],
        ]
    );

    const runDetails = pdfTable(
        ['Field', 'Value'],
        [
            ['Run ID', runLabel(report)],
            ['Title', report.title],
            ['Status', report.status],
            ['Description', report.description || '-'],
            ['Suite', report.suite?.name ?? '-'],
            ['Project', meta.projectName || report.project?.name || '-'],
            ['Client', meta.clientName || report.client?.name || '-'],
            ['Group', report.group?.name ?? '-'],
            ['Environment', report.environment || '-'],
            ['Team', report.team || '-'],
            ['Build Version', report.buildVersion || '-'],
            ['Tags', (report.tags || []).join(', ') || '-'],
            ['Run Created By', report.createdBy],
            ['Created At', formatDateTime(report.createdAt)],
            ['Completed At', formatDateTime(report.completedAt)],
            ['Duration', formatDuration(report.duration)],
        ]
    );

    const execution = pdfTable(
        ['Total', 'Passed', 'Failed', 'Blocked', 'Skipped', 'Not Run', 'Pass Rate', 'Failed w/o Ticket'],
        [
            [
                String(report.statistics.total),
                String(report.statistics.passed),
                String(report.statistics.failed),
                String(report.statistics.blocked),
                String(report.statistics.skipped),
                String(report.statistics.notRun),
                `${report.statistics.passRate}%`,
                String(unticketed.length),
            ],
        ]
    );

    const ticketSection = `
        ${pdfTable(
            ['Total', 'Resolution %', 'Reproduced', 'Not Reproduced', 'Returned', 'Unassigned', 'Avg TTR'],
            [
                [
                    String(summary.total),
                    `${summary.resolutionRate}%`,
                    String(summary.reproducedCount),
                    String(summary.ticketsWithNoRepro),
                    String(summary.returnedCount),
                    String(summary.ticketsUnassigned),
                    summary.avgTimeToReproduceHours !== null
                        ? `${summary.avgTimeToReproduceHours} h`
                        : '-',
                ],
            ]
        )}
        ${
            statusDistribution(summary).length > 0
                ? `<h3>Tickets by status</h3>` +
                  pdfTable(
                      ['Status', 'Count'],
                      statusDistribution(summary).map(([k, v]) => [k, String(v)])
                  )
                : ''
        }
        ${
            failureDistribution(summary).length > 0
                ? `<h3>Tickets by failure type</h3>` +
                  pdfTable(
                      ['Failure Type', 'Count'],
                      failureDistribution(summary).map(([k, v]) => [k, String(v)])
                  )
                : ''
        }`;

    // ---- Analytics summary cards ----
    const failedCases = report.items.filter((item) => item.status === 'Failed').length;
    const ticketedFailures = failedCases - unticketed.length;
    const ticketedRate = failedCases > 0 ? Math.round((ticketedFailures / failedCases) * 100) : 100;
    const executed = report.statistics.passed + report.statistics.failed;
    const failRate = executed > 0 ? Math.round((report.statistics.failed / executed) * 100) : 0;
    const avgItemTime =
        report.items.length > 0
            ? report.items.reduce((sum, item) => sum + (item.timeSpent || 0), 0) /
              report.items.length
            : 0;

    const kpiCards: Array<[string, string, string]> = [
        ['Pass Rate', `${report.statistics.passRate}%`, report.statistics.passRate >= 80 ? '#059669' : report.statistics.passRate >= 50 ? '#D97706' : '#DC2626'],
        ['Fail Rate', `${failRate}%`, failRate === 0 ? '#059669' : '#DC2626'],
        ['Duration', formatDuration(report.duration), '#1D4ED8'],
        ['Avg per Test', formatDuration(Math.round(avgItemTime)), '#1D4ED8'],
        ['Tickets', String(summary.total), '#7C3AED'],
        ['Ticket Resolution', summary.total > 0 ? `${summary.resolutionRate}%` : '-', '#059669'],
        ['Avg TTR', summary.avgTimeToReproduceHours !== null ? `${summary.avgTimeToReproduceHours} h` : '-', '#0891B2'],
        ['Failures Ticketed', `${ticketedRate}%`, ticketedRate === 100 ? '#059669' : '#D97706'],
    ];

    const kpiBlock = `<div class="kpi-grid">${kpiCards
        .map(
            ([label, value, color]) => `<div class="kpi-card">
                <div class="kpi-label">${escapeHtml(label)}</div>
                <div class="kpi-value" style="color:${color}">${escapeHtml(value)}</div>
            </div>`
        )
        .join('')}</div>`;

    // ---- Charts ----
    // The SVG already renders its own title, so the block must not add another
    const charts = buildRunReportCharts(report);
    const chartsBlock =
        charts.length > 0
            ? `<div class="charts-grid">${charts
                  .map(
                      (chart) =>
                          `<div class="chart-block"><div class="chart-svg">${chart.svg}</div></div>`
                  )
                  .join('')}</div>`
            : '<p>No chart data available for this run.</p>';

    const itemsSection = pdfTable(
        ['#', 'Test Case', 'Suite', 'Status', 'Executed By', 'Executed At', 'Time', 'Tickets'],
        report.items.map((item, index) => [
            String(index + 1),
            item.title,
            item.suiteName ?? '-',
            item.status,
            item.executedBy ?? '-',
            formatDate(item.executedAt),
            formatDuration(item.timeSpent),
            item.linkedTickets?.length
                ? item.linkedTickets.map((t) => t.displayId || t.ticketId).join(', ')
                : '-',
        ])
    );

    const ticketsSection =
        report.tickets.length > 0
            ? pdfTable(
                  [
                      'Ticket ID',
                      'Title',
                      'Status',
                      'Priority',
                      'Severity',
                      'Failure Type',
                      'Assigned To',
                      'Created At',
                      'Returned',
                  ],
                  report.tickets.map((ticket) => [
                      ticket.displayId || ticket.ticketId,
                      ticket.title,
                      ticket.status,
                      ticket.priority,
                      ticket.severity,
                      ticket.failureType ?? '-',
                      ticket.assignedTo?.name ?? 'Unassigned',
                      formatDate(ticket.createdAt),
                      String(ticket.returnedCount),
                  ])
              )
            : '<p>No tickets were raised from this run.</p>';

    const unticketedSection =
        unticketed.length > 0
            ? pdfTable(
                  ['Test Case', 'Suite', 'Area', 'Executed By', 'When'],
                  unticketed.map((item) => [
                      item.title,
                      item.suiteName ?? '-',
                      item.area || '-',
                      item.executedBy ?? '-',
                      formatDate(item.executedAt),
                  ])
              )
            : '';

    const timelineSection = pdfTable(
        ['Timestamp', 'Action', 'User', 'Details'],
        report.timeline.map((entry) => [
            formatDateTime(entry.timestamp),
            entry.action,
            entry.user,
            entry.details,
        ])
    );

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Test Run Report – ${escapeHtml(runLabel(report))}</title>
    <style>
        * { box-sizing: border-box; }
        @page { size: A4; margin: 12mm; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; margin: 0; padding: 20px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        h2 { font-size: 15px; margin: 20px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #3b82f6; color: #1d4ed8; }
        h3 { font-size: 12px; margin: 14px 0 6px; color: #374151; }
        .subtitle { color: #6b7280; font-size: 11px; margin-bottom: 16px; }
        .section { margin-bottom: 22px; break-inside: auto; page-break-inside: auto; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 600; color: #374151; border: 1px solid #e5e7eb; text-transform: uppercase; }
        td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        tr:nth-child(even) td { background: #f9fafb; }
        p { color: #6b7280; }
        /* Analytics KPI cards */
        .kpi-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .kpi-card { flex: 1 1 22%; min-width: 120px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; background: #f9fafb; }
        .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; margin-bottom: 2px; }
        .kpi-value { font-size: 18px; font-weight: 700; }
        /* Charts */
        .charts-grid { display: flex; flex-direction: column; gap: 14px; }
        .chart-block { break-inside: avoid; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #fff; }
        .chart-block h3 { margin-top: 0; }
        .chart-svg svg { display: block; max-width: 100%; height: auto; }
        .header-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8px; }
        @media print {
            body { padding: 0; }
            .section, .chart-block, .kpi-card { break-inside: avoid; page-break-inside: avoid; }
            tr { break-inside: avoid; page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header-block">
        <h1>Test Run Report – ${escapeHtml(runLabel(report))}</h1>
        <div class="subtitle">${escapeHtml(report.title)}</div>
        ${headerTable}
    </div>

    ${pdfSection('Analytics Summary', kpiBlock)}
    ${pdfSection('Charts', chartsBlock)}
    ${pdfSection('Run Details', runDetails)}
    ${pdfSection('Execution Summary', execution)}
    ${pdfSection('Ticket Summary', ticketSection)}
    ${pdfSection(`Test Items (${report.items.length})`, itemsSection)}
    ${pdfSection(`Tickets (${report.tickets.length})`, ticketsSection)}
    ${pdfSection(`Failed Without Ticket (${unticketed.length})`, unticketedSection)}
    ${pdfSection(`Timeline (${report.timeline.length})`, timelineSection)}

    <div class="footer">Generated by TS Test Manager</div>
    <script>
        window.addEventListener('load', function () {
            // Defer print so layout and SVGs finish painting first
            setTimeout(function () { window.print(); }, 400);
        });
    </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        // Popup blocked — fall back to a direct download of the printable HTML
        const link = document.createElement('a');
        link.href = url;
        link.download = `test-run-report-${slug(runLabel(report))}.html`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
