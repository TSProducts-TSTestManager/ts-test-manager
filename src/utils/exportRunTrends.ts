/**
 * Test Run Trend Report Export
 *
 * Turns a `TestRunTrendReport` (GET /reports/project/:projectId/test-run-trends)
 * into an Excel workbook or a print-ready PDF.
 *
 * Charts come from the shared SVG generators so they render identically here
 * and on screen.
 */

import ExcelJS from 'exceljs';
import { TestRunTrendPoint, TestRunTrendReport } from '../types/testManager';
import {
    ReportChart,
    horizontalBarChartSVG,
    multiLineChartSVG,
    pieChartSVG,
    reportChartColors,
    stackedBarChartSVG,
    svgToPngBytes,
} from './reportCharts';
import {
    ReportMeta,
    buildReportMetaRows,
} from './reportMeta';

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

const runLabel = (point: TestRunTrendPoint): string => point.displayId || `#${point.sequence}`;

const slug = (value: string): string =>
    value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

/** Build the trend charts: pass rate, results, duration and tickets over runs. */
function buildTrendCharts(report: TestRunTrendReport): ReportChart[] {
    const colors = reportChartColors();
    const charts: ReportChart[] = [];
    const points = report.points;

    if (points.length === 0) return charts;

    // Shorten long ids so the axis stays readable
    const labels = points.map((p) => runLabel(p));

    // 1. Pass rate over runs
    charts.push({
        title: 'Pass Rate per Run',
        svg: multiLineChartSVG(
            'Pass Rate per Run',
            ['Pass rate'],
            [colors.passed],
            points.map((p) => ({ label: labels[points.indexOf(p)], series: [p.passRate] })),
            '%',
            760,
            320
        ),
    });

    // 2. Results breakdown (stacked)
    charts.push({
        title: 'Results Breakdown per Run',
        svg: stackedBarChartSVG(
            'Results Breakdown per Run',
            ['Passed', 'Failed', 'Blocked', 'Skipped'],
            [colors.passed, colors.failed, colors.blocked, colors.skipped],
            points.map((p) => ({
                label: runLabel(p),
                values: [p.passed, p.failed, p.blocked, p.skipped],
            })),
            760,
            Math.max(240, 130 + points.length * 28)
        ),
    });

    // 3. Duration (minutes)
    charts.push({
        title: 'Duration per Run (minutes)',
        svg: multiLineChartSVG(
            'Duration per Run (minutes)',
            ['Minutes'],
            [colors.primary],
            points.map((p) => ({
                label: runLabel(p),
                series: [Math.round((p.duration / 60) * 10) / 10],
            })),
            'min',
            760,
            300
        ),
    });

    // 4. Tickets raised per run
    charts.push({
        title: 'Tickets Raised per Run',
        svg: multiLineChartSVG(
            'Tickets Raised per Run',
            ['Tickets'],
            ['#8B5CF6'],
            points.map((p) => ({ label: runLabel(p), series: [p.ticketCount] })),
            '',
            760,
            300
        ),
    });

    // 5. Outcome split across the whole period
    const totals = points.reduce(
        (acc, p) => {
            acc.passed += p.passed;
            acc.failed += p.failed;
            acc.blocked += p.blocked;
            acc.skipped += p.skipped;
            return acc;
        },
        { passed: 0, failed: 0, blocked: 0, skipped: 0 }
    );
    charts.push({
        title: 'Overall Outcome Split',
        svg: pieChartSVG(
            'Overall Outcome Split',
            [
                { name: 'Passed', value: totals.passed, color: colors.passed },
                { name: 'Failed', value: totals.failed, color: colors.failed },
                { name: 'Blocked', value: totals.blocked, color: colors.blocked },
                { name: 'Skipped', value: totals.skipped, color: colors.skipped },
            ].filter((s) => s.value > 0),
            560,
            300
        ),
    });

    // 6. Failed counts per run (where the regressions are)
    const failures = points
        .map((p) => ({ label: runLabel(p), value: p.failed, color: colors.failed }))
        .filter((f) => f.value > 0);
    if (failures.length > 0) {
        charts.push({
            title: 'Failures per Run',
            svg: horizontalBarChartSVG(
                'Failures per Run',
                failures,
                '',
                760,
                Math.max(160, 90 + failures.length * 30)
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

/** Export the run-trend report as a 3-sheet Excel workbook. */
export async function exportRunTrendsToExcel(
    report: TestRunTrendReport,
    reportMeta: ReportMeta = {}
): Promise<string> {
    // Fall back to the client/project the trends API resolved
    const meta: ReportMeta = {
        clientName: reportMeta.clientName || report.clientName || undefined,
        projectName: reportMeta.projectName || report.projectName || undefined,
        author: reportMeta.author,
    };
    const { projectName } = meta;
    const metaRows = buildReportMetaRows(meta);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TS Test Manager';
    workbook.created = new Date();

    const generated = formatDateTime(new Date());
    const s = report.summary;
    const range = `${formatDate(report.dateRange.startDate)} – ${formatDate(report.dateRange.endDate)}`;

    // ---- Summary ----
    const summaryWs = workbook.addWorksheet('Summary');
    addTitle(
        summaryWs,
        'Test Run Trend Report',
        [`Date Range: ${range}`, `Generated ${generated}`].join('  |  ')
    );

    summaryWs.addRow(['Report Details', 'Value']);
    styleHeader(summaryWs.getRow(summaryWs.lastRow!.number));
    // Client / Project / Report Generated By rows first
    for (const [label, value] of metaRows) {
        summaryWs.addRow([label, value]);
    }
    summaryWs.addRow(['Date Range', range]);
    summaryWs.addRow(['Generated', generated]);
    summaryWs.addRow([]);

    summaryWs.addRow(['Metric', 'Value']);
    styleHeader(summaryWs.getRow(summaryWs.lastRow!.number));
    const pairs: Array<[string, string | number]> = [
        ['Total Runs', s.totalRuns],
        ['Average Pass Rate', `${s.averagePassRate}%`],
        ['Trend Direction', s.trendDirection],
        ['Pass Rate Change', `${s.changePercentage > 0 ? '+' : ''}${s.changePercentage} pts`],
        ['Average Duration', formatDuration(s.averageDuration)],
        [
            'Duration Change',
            `${s.durationChangePercentage > 0 ? '+' : ''}${s.durationChangePercentage}%`,
        ],
        ['Total Tickets', s.totalTickets],
        ['Avg Ticket Resolution', s.totalTickets > 0 ? `${s.averageTicketResolutionRate}%` : '-'],
        ['Runs With Tickets', s.runsWithTickets],
        ['Runs Without Tickets', s.runsWithoutTickets],
    ];
    for (const [label, value] of pairs) summaryWs.addRow([label, value]);

    if (s.bestRun || s.worstRun) {
        summaryWs.addRow([]);
        summaryWs.addRow(['Highlights', 'Run', 'Pass Rate']);
        styleHeader(summaryWs.getRow(summaryWs.lastRow!.number));
        if (s.bestRun) {
            summaryWs.addRow(['Best Run', `${runLabel(s.bestRun)} – ${s.bestRun.title}`, `${s.bestRun.passRate}%`]);
        }
        if (s.worstRun) {
            summaryWs.addRow(['Worst Run', `${runLabel(s.worstRun)} – ${s.worstRun.title}`, `${s.worstRun.passRate}%`]);
        }
    }
    autosize(summaryWs, 3);

    // ---- Trend Data ----
    const dataWs = workbook.addWorksheet('Trend Data');
    addTitle(
        dataWs,
        'Per-Run Trend Data',
        `${report.points.length} run(s), oldest → newest | Generated ${generated}`
    );
    dataWs.addRow([
        '#',
        'Run ID',
        'Title',
        'Status',
        'Completed At',
        'Environment',
        'Team',
        'Build',
        'Total',
        'Passed',
        'Failed',
        'Blocked',
        'Skipped',
        'Not Run',
        'Pass Rate %',
        'Duration',
        'Tickets',
        'Resolved %',
    ]);
    styleHeader(dataWs.getRow(dataWs.lastRow!.number));
    for (const p of report.points) {
        dataWs.addRow([
            p.sequence,
            p.displayId || p.runId,
            p.title,
            p.status,
            formatDateTime(p.completedAt),
            p.environment || '-',
            p.team || '-',
            p.buildVersion || '-',
            p.total,
            p.passed,
            p.failed,
            p.blocked,
            p.skipped,
            p.notRun,
            p.passRate,
            formatDuration(p.duration),
            p.ticketCount,
            p.ticketCount > 0 ? p.ticketResolutionRate : '-',
        ]);
    }
    autosize(dataWs, 18);

    // ---- Graphs ----
    const charts = buildTrendCharts(report);
    const chartsWs = workbook.addWorksheet('Graphs');
    addTitle(chartsWs, 'Trend Analytics', `${charts.length} chart(s) | Generated ${generated}`);

    if (charts.length === 0) {
        chartsWs.addRow(['No chart data available for this range.']);
    } else {
        let rowCursor = chartsWs.lastRow!.number + 2;
        for (const chart of charts) {
            const widthMatch = /width="(\d+)"/.exec(chart.svg);
            const heightMatch = /height="(\d+)"/.exec(chart.svg);
            const width = Number(widthMatch?.[1] || 760);
            const height = Number(heightMatch?.[1] || 320);

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

    const filename = `test-run-trends-${slug(projectName ?? 'project')}-${slug(
        range.replace(/\s+/g, '')
    )}.xlsx`;
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

/** Export the run-trend report as a print-ready document. */
export function exportRunTrendsToPDF(
    report: TestRunTrendReport,
    reportMeta: ReportMeta = {}
): void {
    // Fall back to the client/project the trends API resolved
    const meta: ReportMeta = {
        clientName: reportMeta.clientName || report.clientName || undefined,
        projectName: reportMeta.projectName || report.projectName || undefined,
        author: reportMeta.author,
    };
    const { projectName } = meta;
    const metaRows = buildReportMetaRows(meta);
    const s = report.summary;
    const range = `${formatDate(report.dateRange.startDate)} – ${formatDate(report.dateRange.endDate)}`;

    // Header identity table: Client / Project / Report Generated By / Date Range / Generated
    const headerTable = pdfTable(
        ['Field', 'Value'],
        [...metaRows, ['Date Range', range], ['Generated', formatDateTime(new Date())]]
    );

    const trendMeta =
        s.trendDirection === 'improving'
            ? { label: 'Improving', color: '#059669' }
            : s.trendDirection === 'declining'
              ? { label: 'Declining', color: '#DC2626' }
              : { label: 'Stable', color: '#6B7280' };

    const kpiCards: Array<[string, string, string]> = [
        ['Total Runs', String(s.totalRuns), '#1F2937'],
        ['Avg Pass Rate', `${s.averagePassRate}%`, '#059669'],
        [
            'Trend',
            `${trendMeta.label}${s.changePercentage !== 0 ? ` (${s.changePercentage > 0 ? '+' : ''}${s.changePercentage})` : ''}`,
            trendMeta.color,
        ],
        ['Avg Duration', formatDuration(s.averageDuration), '#1D4ED8'],
        ['Total Tickets', String(s.totalTickets), '#7C3AED'],
        [
            'Ticket Resolution',
            s.totalTickets > 0 ? `${s.averageTicketResolutionRate}%` : '-',
            '#0891B2',
        ],
    ];

    const kpiBlock = `<div class="kpi-grid">${kpiCards
        .map(
            ([label, value, color]) => `<div class="kpi-card">
                <div class="kpi-label">${escapeHtml(label)}</div>
                <div class="kpi-value" style="color:${color}">${escapeHtml(value)}</div>
            </div>`
        )
        .join('')}</div>`;

    const highlights =
        s.bestRun || s.worstRun
            ? pdfTable(
                  ['Highlight', 'Run', 'Title', 'Pass Rate'],
                  [
                      ...(s.bestRun
                          ? [
                                [
                                    'Best Run',
                                    runLabel(s.bestRun),
                                    s.bestRun.title,
                                    `${s.bestRun.passRate}%`,
                                ],
                            ]
                          : []),
                      ...(s.worstRun
                          ? [
                                [
                                    'Worst Run',
                                    runLabel(s.worstRun),
                                    s.worstRun.title,
                                    `${s.worstRun.passRate}%`,
                                ],
                            ]
                          : []),
                  ]
              )
            : '';

    const dataTable = pdfTable(
        [
            '#',
            'Run ID',
            'Title',
            'Status',
            'Total',
            'Passed',
            'Failed',
            'Pass Rate',
            'Duration',
            'Tickets',
        ],
        report.points.map((p) => [
            String(p.sequence),
            runLabel(p),
            p.title,
            p.status,
            String(p.total),
            String(p.passed),
            String(p.failed),
            `${p.passRate}%`,
            formatDuration(p.duration),
            String(p.ticketCount),
        ])
    );

    // The SVG already renders its own title, so the block must not add another
    const charts = buildTrendCharts(report);
    const chartsBlock =
        charts.length > 0
            ? `<div class="charts-grid">${charts
                  .map(
                      (chart) =>
                          `<div class="chart-block"><div class="chart-svg">${chart.svg}</div></div>`
                  )
                  .join('')}</div>`
            : '<p>No chart data available for this range.</p>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Test Run Trend Report</title>
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
    .kpi-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .kpi-card { flex: 1 1 22%; min-width: 120px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; background: #f9fafb; }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; margin-bottom: 2px; }
    .kpi-value { font-size: 18px; font-weight: 700; }
    .charts-grid { display: flex; flex-direction: column; gap: 14px; }
    .chart-block { break-inside: avoid; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #fff; }
    .chart-block h3 { margin-top: 0; }
    .chart-svg svg { display: block; max-width: 100%; height: auto; }
    .header-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8px; }
    .footer { margin-top: 24px; color: #9ca3af; font-size: 10px; }
    @media print {
        body { padding: 0; }
        .section, .chart-block, .kpi-card { break-inside: avoid; page-break-inside: avoid; }
        tr { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header-block">
    <h1>Test Run Trend Report</h1>
    <div class="subtitle">${escapeHtml(range)}</div>
    ${headerTable}
  </div>

  ${pdfSection('Report Details', pdfTable(
      ['Field', 'Value'],
      [
          ['Date Range', range],
          ['Runs Analysed', String(s.totalRuns)],
          ['Average Pass Rate', `${s.averagePassRate}%`],
          ['Trend Direction', s.trendDirection],
      ],
  ))}
  ${pdfSection('Trend Summary', kpiBlock)}
  ${pdfSection('Highlights', highlights)}
  ${pdfSection('Charts', chartsBlock)}
  ${pdfSection(`Per-Run Data (${report.points.length})`, dataTable)}

  <div class="footer">Generated by TS Test Manager</div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        // Popup blocked — fall back to downloading the printable HTML
        const link = document.createElement('a');
        link.href = url;
        link.download = `test-run-trends-${slug(projectName ?? 'project')}.html`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
