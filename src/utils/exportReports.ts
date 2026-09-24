/**
 * Report Export Utilities
 * Handles exporting analytics/report data to CSV, Excel, and PDF.
 * CSV/Excel are downloaded as files; PDF uses the browser's print-to-PDF dialog.
 * Graphs are generated as SVG and embedded in PDF (inline) and Excel (PNG).
 */

import ExcelJS from 'exceljs';
import {
    ProjectSummaryReport,
    TrendReport,
    SuiteComparisonReport,
    TestCaseHealthReport,
    TicketMetricsReport,
} from '../types/testManager';
import {
    horizontalBarChartSVG,
    multiLineChartSVG,
    pieChartSVG,
    reportChartColors,
    stackedBarChartSVG,
    svgToPngBytes,
    wrapSvgAsPrintBlock,
} from './reportCharts';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function escapeCsv(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function row(...cells: (string | number | null | undefined)[]): string {
    return cells.map(escapeCsv).join(',');
}

function calcPassRate(passed: number, failed: number): string {
    const total = passed + failed;
    if (total === 0) return '0.0%';
    return `${((passed / total) * 100).toFixed(1)}%`;
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
    const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadBlobRaw(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

interface ReportCharts {
    distribution?: string;
    passFail?: string;
    passRateTrend?: string;
    executionVolume?: string;
    suitePassRates?: string;
    triageTrend?: string;
}

function buildReportCharts(
    summaryReport: ProjectSummaryReport,
    trendReport: TrendReport | null,
    suiteReport: SuiteComparisonReport | null,
    ticketMetricsReport: TicketMetricsReport | null,
): ReportCharts {
    const c = reportChartColors();
    const charts: ReportCharts = {};

    const distributionSlices = [
        { name: 'Passed', value: summaryReport.overallStats.totalPassed, color: c.passed },
        { name: 'Failed', value: summaryReport.overallStats.totalFailed, color: c.failed },
        { name: 'Blocked', value: summaryReport.overallStats.totalBlocked, color: c.blocked },
        { name: 'Skipped', value: summaryReport.overallStats.totalSkipped, color: c.skipped },
        { name: 'Not Run', value: summaryReport.overallStats.totalNotRun, color: c.primary },
    ].filter(s => s.value > 0);
    if (distributionSlices.length > 0) {
        charts.distribution = pieChartSVG('Test Case Distribution', distributionSlices);
    }

    const passFailSlices = [
        { name: 'Passed', value: summaryReport.overallStats.totalPassed, color: c.passed },
        { name: 'Failed', value: summaryReport.overallStats.totalFailed, color: c.failed },
    ].filter(s => s.value > 0);
    if (passFailSlices.length > 0) {
        charts.passFail = pieChartSVG('Test Pass/Fail Distribution', passFailSlices);
    }

    if (trendReport && trendReport.dataPoints.length > 0) {
        charts.passRateTrend = multiLineChartSVG(
            'Pass Rate Trend',
            ['Pass Rate'],
            [c.primary],
            trendReport.dataPoints.map(p => ({
                label: p.periodLabel,
                series: [p.passRate],
            })),
            'Pass Rate (%)',
        );
        charts.executionVolume = stackedBarChartSVG(
            'Test Execution Volume',
            ['Passed', 'Failed', 'Blocked', 'Skipped'],
            [c.passed, c.failed, c.blocked, c.skipped],
            trendReport.dataPoints.map(p => ({
                label: p.periodLabel,
                values: [p.passed, p.failed, p.blocked, p.skipped],
            })),
        );
    }

    if (suiteReport && suiteReport.suites.length > 0) {
        charts.suitePassRates = horizontalBarChartSVG(
            'Suite Pass Rates',
            suiteReport.suites.map(s => ({
                label: s.suiteName,
                value: s.passRate,
                color: s.passRate >= 80 ? c.passed : s.passRate >= 60 ? c.blocked : c.failed,
            })),
            '%',
        );
    }

    if (ticketMetricsReport && ticketMetricsReport.trend.length > 0) {
        charts.triageTrend = multiLineChartSVG(
            'Triage Trend',
            ['Created', 'Reproduced', 'Returned'],
            ['#3B82F6', c.passed, c.blocked],
            ticketMetricsReport.trend.map(p => ({
                label: p.periodLabel,
                series: [p.ticketsCreated, p.ticketsReproduced, p.ticketsReturned],
            })),
        );
    }

    return charts;
}

function chartsSectionHtml(charts: ReportCharts): string {
    const blocks: string[] = [];
    if (charts.distribution) blocks.push(wrapSvgAsPrintBlock(charts.distribution));
    if (charts.passFail) blocks.push(wrapSvgAsPrintBlock(charts.passFail));
    if (charts.passRateTrend) blocks.push(wrapSvgAsPrintBlock(charts.passRateTrend));
    if (charts.executionVolume) blocks.push(wrapSvgAsPrintBlock(charts.executionVolume));
    if (charts.suitePassRates) blocks.push(wrapSvgAsPrintBlock(charts.suitePassRates));
    if (charts.triageTrend) blocks.push(wrapSvgAsPrintBlock(charts.triageTrend));
    if (blocks.length === 0) return '<p>No chart data available.</p>';
    return `<div class="charts-grid">${blocks.join('')}</div>`;
}

function formatDateForFilename(): string {
    return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

/**
 * Build a multi-section CSV string from all available report data.
 * Each section starts with a heading row followed by a header row and data rows.
 */
function buildReportCSV(
    summaryReport: ProjectSummaryReport,
    trendReport: TrendReport | null,
    suiteReport: SuiteComparisonReport | null,
    healthReport: TestCaseHealthReport | null,
): string {
    const sections: string[] = [];

    // -- Summary section --
    const summaryRows: string[] = [
        '=== Project Summary ===',
        row('Metric', 'Value'),
        row('Total Test Runs', summaryReport.totalRuns),
        row('Completed Runs', summaryReport.completedRuns),
        row('In Progress Runs', summaryReport.inProgressRuns),
        row('Draft Runs', summaryReport.draftRuns),
        row('Abandoned Runs', summaryReport.abandonedRuns),
        row('Total Tests Executed', summaryReport.overallStats.totalTests),
        row('Total Passed', summaryReport.overallStats.totalPassed),
        row('Total Failed', summaryReport.overallStats.totalFailed),
        row('Total Blocked', summaryReport.overallStats.totalBlocked),
        row('Total Skipped', summaryReport.overallStats.totalSkipped),
        row('Total Not Run', summaryReport.overallStats.totalNotRun),
        row(
            'Average Pass Rate',
            calcPassRate(
                summaryReport.overallStats.totalPassed,
                summaryReport.overallStats.totalFailed,
            ),
        ),
        row('Average Duration', formatDuration(summaryReport.overallStats.averageDuration)),
    ];

    if (summaryReport.suiteBreakdown.length > 0) {
        summaryRows.push('');
        summaryRows.push('-- Suite Breakdown --');
        summaryRows.push(row('Suite', 'Runs', 'Tests', 'Passed', 'Failed', 'Pass Rate', 'Avg Duration'));
        for (const s of summaryReport.suiteBreakdown) {
            summaryRows.push(
                row(
                    s.suiteName,
                    s.totalRuns,
                    s.totalTests,
                    s.totalPassed,
                    s.totalFailed,
                    calcPassRate(s.totalPassed, s.totalFailed),
                    formatDuration(s.averageDuration),
                ),
            );
        }
    }

    if (summaryReport.recentActivity.length > 0) {
        summaryRows.push('');
        summaryRows.push('-- Recent Activity --');
        summaryRows.push(row('Run Title', 'Status', 'Pass Rate', 'Duration', 'Completed At'));
        for (const a of summaryReport.recentActivity) {
            summaryRows.push(
                row(
                    a.title,
                    a.status,
                    `${a.passRate.toFixed(1)}%`,
                    formatDuration(a.duration),
                    a.completedAt ? new Date(a.completedAt).toLocaleString() : '-',
                ),
            );
        }
    }

    sections.push(summaryRows.join('\r\n'));

    // -- Trends section --
    if (trendReport) {
        const trendRows: string[] = [
            '',
            '=== Trends ===',
            row('Period', 'Runs Completed', 'Total Tests', 'Passed', 'Failed', 'Blocked', 'Skipped', 'Pass Rate', 'Avg Duration'),
        ];
        for (const p of trendReport.dataPoints) {
            trendRows.push(
                row(
                    p.periodLabel,
                    p.runsCompleted,
                    p.totalTests,
                    p.passed,
                    p.failed,
                    p.blocked,
                    p.skipped,
                    `${p.passRate.toFixed(1)}%`,
                    formatDuration(p.averageDuration),
                ),
            );
        }
        sections.push(trendRows.join('\r\n'));
    }

    // -- Suite comparison section --
    if (suiteReport && suiteReport.suites.length > 0) {
        const suiteRows: string[] = [
            '',
            '=== Suite Comparison ===',
            row('Suite', 'Runs', 'Tests', 'Passed', 'Failed', 'Blocked', 'Skipped', 'Pass Rate', 'Failure Rate', 'Trend', 'Avg Duration'),
        ];
        for (const s of suiteReport.suites) {
            suiteRows.push(
                row(
                    s.suiteName,
                    s.totalRuns,
                    s.totalTests,
                    s.passed,
                    s.failed,
                    s.blocked,
                    s.skipped,
                    `${s.passRate.toFixed(1)}%`,
                    `${s.failureRate.toFixed(1)}%`,
                    s.trend,
                    formatDuration(s.averageDuration),
                ),
            );
        }
        sections.push(suiteRows.join('\r\n'));
    }

    // -- Health section --
    if (healthReport) {
        const healthRows: string[] = [
            '',
            '=== Test Case Health ===',
            row('Metric', 'Count'),
            row('Total Unique Cases', healthReport.summary.totalUniqueCases),
            row('Flaky Tests', healthReport.summary.flakyCount),
            row('Never Executed', healthReport.summary.neverExecutedCount),
            row('High Failure Rate', healthReport.summary.highFailureCount),
        ];

        if (healthReport.flakyTests.length > 0) {
            healthRows.push('');
            healthRows.push('-- Flaky Tests --');
            healthRows.push(row('Test Case', 'Suite', 'Executions', 'Passed', 'Failed', 'Flaky Score'));
            for (const t of healthReport.flakyTests) {
                healthRows.push(row(t.title, t.suite, t.executionCount, t.passCount, t.failCount, t.flakyScore));
            }
        }

        if (healthReport.mostFailingTests.length > 0) {
            healthRows.push('');
            healthRows.push('-- Most Failing Tests --');
            healthRows.push(row('Test Case', 'Suite', 'Executions', 'Failures', 'Failure Rate'));
            for (const t of healthReport.mostFailingTests) {
                healthRows.push(row(t.title, t.suite, t.executionCount, t.failCount, `${t.failureRate.toFixed(1)}%`));
            }
        }

        if (healthReport.neverExecutedTests.length > 0) {
            healthRows.push('');
            healthRows.push('-- Never Executed Tests --');
            healthRows.push(row('Test Case', 'Suite', 'Days Since Creation'));
            for (const t of healthReport.neverExecutedTests) {
                healthRows.push(row(t.title, t.suite, t.daysSinceCreation));
            }
        }

        if (healthReport.failedRunCases.length > 0) {
            healthRows.push('');
            healthRows.push('-- Recent Failed Run Cases --');
            healthRows.push(row('Test Case', 'Run Name', 'Suite', 'Area', 'Failed At'));
            for (const t of healthReport.failedRunCases) {
                healthRows.push(
                    row(
                        t.testCaseName,
                        t.runName,
                        t.testSuite,
                        t.area,
                        t.failedAt ? new Date(t.failedAt).toLocaleString() : '-',
                    ),
                );
            }
        }

        sections.push(healthRows.join('\r\n'));
    }

    return sections.join('\r\n');
}

/**
 * Export all available report data to a CSV file.
 */
export function exportReportToCSV(
    summaryReport: ProjectSummaryReport,
    trendReport: TrendReport | null,
    suiteReport: SuiteComparisonReport | null,
    healthReport: TestCaseHealthReport | null,
    projectName?: string,
): void {
    const csv = buildReportCSV(summaryReport, trendReport, suiteReport, healthReport);
    const slug = projectName ? `-${projectName.replace(/[^a-z0-9]/gi, '_')}` : '';
    const filename = `report${slug}-${formatDateForFilename()}.csv`;
    downloadBlob(csv, filename, 'text/csv');
}

// ---------------------------------------------------------------------------
// PDF Export (browser print-to-PDF)
// ---------------------------------------------------------------------------

function htmlTable(headers: string[], rows: (string | number | null | undefined)[][]): string {
    const ths = headers.map(h => `<th>${h}</th>`).join('');
    const trs = rows
        .map(r => {
            const tds = r.map(c => `<td>${c ?? ''}</td>`).join('');
            return `<tr>${tds}</tr>`;
        })
        .join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function section(title: string, content: string): string {
    return `<div class="section"><h2 class="section-title">${title}</h2>${content}</div>`;
}

function kv(label: string, value: string | number): string {
    return `<tr><td class="kv-label">${label}</td><td class="kv-value">${value}</td></tr>`;
}

function kvTable(pairs: [string, string | number][]): string {
    return `<table class="kv-table">${pairs.map(([l, v]) => kv(l, v)).join('')}</table>`;
}

/**
 * Open a print-optimised HTML page with the full report and trigger the
 * browser's print dialog (the user can choose "Save as PDF").
 */
export function exportReportToPDF(
    summaryReport: ProjectSummaryReport,
    trendReport: TrendReport | null,
    suiteReport: SuiteComparisonReport | null,
    healthReport: TestCaseHealthReport | null,
    projectName?: string,
    ticketMetricsReport: TicketMetricsReport | null = null,
): void {
    const dateRange = `${new Date(summaryReport.dateRange.startDate).toLocaleDateString()} – ${new Date(summaryReport.dateRange.endDate).toLocaleDateString()}`;
    const overallPassRate = calcPassRate(
        summaryReport.overallStats.totalPassed,
        summaryReport.overallStats.totalFailed,
    );
    const charts = buildReportCharts(summaryReport, trendReport, suiteReport, ticketMetricsReport);

    // ---------- Summary section ----------
    const summaryContent =
        kvTable([
            ['Date Range', dateRange],
            ['Total Test Runs', summaryReport.totalRuns],
            ['Completed Runs', summaryReport.completedRuns],
            ['In Progress Runs', summaryReport.inProgressRuns],
            ['Total Tests Executed', summaryReport.overallStats.totalTests],
            ['Total Passed', summaryReport.overallStats.totalPassed],
            ['Total Failed', summaryReport.overallStats.totalFailed],
            ['Total Blocked', summaryReport.overallStats.totalBlocked],
            ['Total Skipped', summaryReport.overallStats.totalSkipped],
            ['Total Not Run', summaryReport.overallStats.totalNotRun],
            ['Average Pass Rate', overallPassRate],
            ['Average Duration', formatDuration(summaryReport.overallStats.averageDuration)],
        ]) +
        (summaryReport.suiteBreakdown.length > 0
            ? `<h3>Suite Breakdown</h3>` +
              htmlTable(
                  ['Suite', 'Runs', 'Tests', 'Passed', 'Failed', 'Pass Rate', 'Avg Duration'],
                  summaryReport.suiteBreakdown.map(s => [
                      s.suiteName,
                      s.totalRuns,
                      s.totalTests,
                      s.totalPassed,
                      s.totalFailed,
                      calcPassRate(s.totalPassed, s.totalFailed),
                      formatDuration(s.averageDuration),
                  ]),
              )
            : '') +
        (summaryReport.recentActivity.length > 0
            ? `<h3>Recent Activity</h3>` +
              htmlTable(
                  ['Run Title', 'Status', 'Pass Rate', 'Duration', 'Completed At'],
                  summaryReport.recentActivity.map(a => [
                      a.title,
                      a.status,
                      `${a.passRate.toFixed(1)}%`,
                      formatDuration(a.duration),
                      a.completedAt ? new Date(a.completedAt).toLocaleDateString() : '-',
                  ]),
              )
            : '');

    // ---------- Trends section ----------
    const trendsContent = trendReport
        ? htmlTable(
              ['Period', 'Runs', 'Tests', 'Passed', 'Failed', 'Blocked', 'Skipped', 'Pass Rate'],
              trendReport.dataPoints.map(p => [
                  p.periodLabel,
                  p.runsCompleted,
                  p.totalTests,
                  p.passed,
                  p.failed,
                  p.blocked,
                  p.skipped,
                  `${p.passRate.toFixed(1)}%`,
              ]),
          )
        : '<p>No trend data available.</p>';

    // ---------- Suites section ----------
    const suitesContent =
        suiteReport && suiteReport.suites.length > 0
            ? htmlTable(
                  ['Suite', 'Runs', 'Tests', 'Passed', 'Failed', 'Pass Rate', 'Failure Rate', 'Trend', 'Avg Duration'],
                  suiteReport.suites.map(s => [
                      s.suiteName,
                      s.totalRuns,
                      s.totalTests,
                      s.passed,
                      s.failed,
                      `${s.passRate.toFixed(1)}%`,
                      `${s.failureRate.toFixed(1)}%`,
                      s.trend,
                      formatDuration(s.averageDuration),
                  ]),
              )
            : '<p>No suite comparison data available.</p>';

    // ---------- Health section ----------
    let healthContent = '';
    if (healthReport) {
        healthContent +=
            kvTable([
                ['Total Unique Cases', healthReport.summary.totalUniqueCases],
                ['Flaky Tests', healthReport.summary.flakyCount],
                ['Never Executed', healthReport.summary.neverExecutedCount],
                ['High Failure Rate', healthReport.summary.highFailureCount],
            ]);

        if (healthReport.flakyTests.length > 0) {
            healthContent +=
                '<h3>Flaky Tests</h3>' +
                htmlTable(
                    ['Test Case', 'Suite', 'Executions', 'Passed', 'Failed', 'Flaky Score'],
                    healthReport.flakyTests.map(t => [t.title, t.suite, t.executionCount, t.passCount, t.failCount, t.flakyScore]),
                );
        }

        if (healthReport.mostFailingTests.length > 0) {
            healthContent +=
                '<h3>Most Failing Tests</h3>' +
                htmlTable(
                    ['Test Case', 'Suite', 'Executions', 'Failures', 'Failure Rate'],
                    healthReport.mostFailingTests.map(t => [t.title, t.suite, t.executionCount, t.failCount, `${t.failureRate.toFixed(1)}%`]),
                );
        }

        if (healthReport.neverExecutedTests.length > 0) {
            healthContent +=
                '<h3>Never Executed Tests</h3>' +
                htmlTable(
                    ['Test Case', 'Suite', 'Days Since Creation'],
                    healthReport.neverExecutedTests.map(t => [t.title, t.suite, t.daysSinceCreation]),
                );
        }

        if (healthReport.failedRunCases.length > 0) {
            healthContent +=
                '<h3>Recent Failed Run Cases</h3>' +
                htmlTable(
                    ['Test Case', 'Run Name', 'Suite', 'Area', 'Failed At'],
                    healthReport.failedRunCases.map(t => [
                        t.testCaseName,
                        t.runName,
                        t.testSuite,
                        t.area,
                        t.failedAt ? new Date(t.failedAt).toLocaleDateString() : '-',
                    ]),
                );
        }
    } else {
        healthContent = '<p>No health data available.</p>';
    }

    const title = projectName ? `Analytics Report – ${projectName}` : 'Analytics Report';
    const scriptClose = '</scr' + 'ipt>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; margin: 0; padding: 20px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
    /* Allow long sections to flow across pages — avoid on multi-page blocks
       forces Chrome to leave a blank first page when content cannot fit. */
    .section { margin-bottom: 22px; break-inside: auto; page-break-inside: auto; }
    .section-title { break-after: avoid-page; page-break-after: avoid; }
    h2 { font-size: 16px; font-weight: 700; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; margin-bottom: 12px; color: #1d4ed8; }
    h3 { font-size: 13px; font-weight: 600; margin: 14px 0 8px; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 11px; font-weight: 600; color: #374151; border: 1px solid #e5e7eb; }
    td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    tr:nth-child(even) td { background: #f9fafb; }
    .kv-table td.kv-label { font-weight: 600; width: 220px; background: #f3f4f6; }
    .kv-table td.kv-value { }
    p { color: #6b7280; }
    .charts-grid { display: flex; flex-direction: column; gap: 14px; break-inside: auto; }
    .chart-block { break-inside: avoid; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #fff; }
    .chart-block h3 { margin-top: 0; }
    .chart-svg svg { display: block; max-width: 100%; height: auto; }
    .header-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8px; }
    @media print {
      body { padding: 0; }
      h1, .subtitle { break-inside: avoid; page-break-inside: avoid; }
      .section { break-inside: auto; page-break-inside: auto; }
      .chart-block { break-inside: avoid; page-break-inside: avoid; }
      tr { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header-block">
    <h1>${title}</h1>
    <div class="subtitle">Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; Date Range: ${dateRange}</div>
  </div>
  ${section('Summary', summaryContent)}
  ${section('Charts', chartsSectionHtml(charts))}
  ${section('Trends', trendsContent)}
  ${section('Suite Comparison', suitesContent)}
  ${section('Test Case Health', healthContent)}
  <script>
    window.addEventListener('load', function() {
      // Defer print so layout/SVGs finish painting (avoids a blank first sheet).
      setTimeout(function() { window.print(); }, 150);
    });
  ${scriptClose}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        // Fallback if popup is blocked
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.click();
    }
    // Revoke after a delay to allow the new window to fully load before the URL is released
    const PDF_URL_REVOKE_DELAY_MS = 60_000;
    setTimeout(() => URL.revokeObjectURL(url), PDF_URL_REVOKE_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Excel Export (xlsx with data sheets + embedded chart images)
// ---------------------------------------------------------------------------

const HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1D4ED8' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14, color: { argb: 'FF111827' } };

function styleHeaderRow(row: ExcelJS.Row): void {
    row.eachCell(cell => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = { vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
    });
}

function autosizeColumns(ws: ExcelJS.Worksheet, maxCols = 20): void {
    const widths: number[] = [];
    ws.eachRow({ includeEmpty: false }, row => {
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            if (colNumber > maxCols) return;
            const text = cell.text ?? '';
            const len = Math.min(text.length + 2, 50);
            widths[colNumber] = Math.max(widths[colNumber] || 10, len);
        });
    });
    for (let i = 1; i < widths.length; i++) {
        ws.getColumn(i).width = widths[i] || 12;
    }
}

function addTitle(ws: ExcelJS.Worksheet, title: string, subtitle?: string): number {
    const titleRow = ws.addRow([title]);
    titleRow.getCell(1).font = TITLE_FONT;
    ws.mergeCells(titleRow.number, 1, titleRow.number, 6);
    if (subtitle) {
        const sub = ws.addRow([subtitle]);
        sub.getCell(1).font = { size: 10, color: { argb: 'FF6B7280' } };
        ws.mergeCells(sub.number, 1, sub.number, 6);
        ws.addRow([]);
        return sub.number + 2;
    }
    ws.addRow([]);
    return titleRow.number + 2;
}

/**
 * Export all available report data to an Excel workbook with a Charts sheet
 * that embeds graph images (pie / line / stacked bar / suite bars / triage).
 */
export async function exportReportToExcel(
    summaryReport: ProjectSummaryReport,
    trendReport: TrendReport | null,
    suiteReport: SuiteComparisonReport | null,
    healthReport: TestCaseHealthReport | null,
    projectName?: string,
    ticketMetricsReport: TicketMetricsReport | null = null,
): Promise<void> {
    const dateRange = `${new Date(summaryReport.dateRange.startDate).toLocaleDateString()} – ${new Date(summaryReport.dateRange.endDate).toLocaleDateString()}`;
    const charts = buildReportCharts(summaryReport, trendReport, suiteReport, ticketMetricsReport);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TS Test Manager';
    workbook.created = new Date();

    // -- Summary sheet --
    const summaryWs = workbook.addWorksheet('Summary');
    addTitle(
        summaryWs,
        projectName ? `Analytics Report – ${projectName}` : 'Analytics Report',
        `Generated ${new Date().toLocaleString()} | Date Range: ${dateRange}`,
    );
    summaryWs.addRow(['Metric', 'Value']);
    styleHeaderRow(summaryWs.getRow(summaryWs.lastRow!.number));
    const summaryPairs: [string, string | number][] = [
        ['Total Test Runs', summaryReport.totalRuns],
        ['Completed Runs', summaryReport.completedRuns],
        ['In Progress Runs', summaryReport.inProgressRuns],
        ['Draft Runs', summaryReport.draftRuns],
        ['Abandoned Runs', summaryReport.abandonedRuns],
        ['Total Tests Executed', summaryReport.overallStats.totalTests],
        ['Total Passed', summaryReport.overallStats.totalPassed],
        ['Total Failed', summaryReport.overallStats.totalFailed],
        ['Total Blocked', summaryReport.overallStats.totalBlocked],
        ['Total Skipped', summaryReport.overallStats.totalSkipped],
        ['Total Not Run', summaryReport.overallStats.totalNotRun],
        ['Average Pass Rate', calcPassRate(summaryReport.overallStats.totalPassed, summaryReport.overallStats.totalFailed)],
        ['Average Duration', formatDuration(summaryReport.overallStats.averageDuration)],
    ];
    for (const [k, v] of summaryPairs) summaryWs.addRow([k, v]);

    if (summaryReport.suiteBreakdown.length > 0) {
        summaryWs.addRow([]);
        summaryWs.addRow(['Suite Breakdown']);
        summaryWs.getRow(summaryWs.lastRow!.number).font = { bold: true };
        summaryWs.addRow(['Suite', 'Runs', 'Tests', 'Passed', 'Failed', 'Pass Rate', 'Avg Duration']);
        styleHeaderRow(summaryWs.getRow(summaryWs.lastRow!.number));
        for (const s of summaryReport.suiteBreakdown) {
            summaryWs.addRow([
                s.suiteName,
                s.totalRuns,
                s.totalTests,
                s.totalPassed,
                s.totalFailed,
                calcPassRate(s.totalPassed, s.totalFailed),
                formatDuration(s.averageDuration),
            ]);
        }
    }

    if (summaryReport.recentActivity.length > 0) {
        summaryWs.addRow([]);
        summaryWs.addRow(['Recent Activity']);
        summaryWs.getRow(summaryWs.lastRow!.number).font = { bold: true };
        summaryWs.addRow(['Run Title', 'Status', 'Pass Rate', 'Duration', 'Completed At']);
        styleHeaderRow(summaryWs.getRow(summaryWs.lastRow!.number));
        for (const a of summaryReport.recentActivity) {
            summaryWs.addRow([
                a.title,
                a.status,
                `${a.passRate.toFixed(1)}%`,
                formatDuration(a.duration),
                a.completedAt ? new Date(a.completedAt).toLocaleString() : '-',
            ]);
        }
    }
    autosizeColumns(summaryWs);

    // -- Trends sheet --
    if (trendReport) {
        const ws = workbook.addWorksheet('Trends');
        addTitle(ws, 'Trends', `Grouped by ${trendReport.groupBy}`);
        ws.addRow(['Period', 'Runs Completed', 'Total Tests', 'Passed', 'Failed', 'Blocked', 'Skipped', 'Pass Rate', 'Avg Duration']);
        styleHeaderRow(ws.getRow(ws.lastRow!.number));
        for (const p of trendReport.dataPoints) {
            ws.addRow([
                p.periodLabel,
                p.runsCompleted,
                p.totalTests,
                p.passed,
                p.failed,
                p.blocked,
                p.skipped,
                `${p.passRate.toFixed(1)}%`,
                formatDuration(p.averageDuration),
            ]);
        }
        autosizeColumns(ws);
    }

    // -- Suites sheet --
    if (suiteReport && suiteReport.suites.length > 0) {
        const ws = workbook.addWorksheet('Suites');
        addTitle(ws, 'Suite Comparison');
        ws.addRow(['Suite', 'Runs', 'Tests', 'Passed', 'Failed', 'Blocked', 'Skipped', 'Pass Rate', 'Failure Rate', 'Trend', 'Avg Duration']);
        styleHeaderRow(ws.getRow(ws.lastRow!.number));
        for (const s of suiteReport.suites) {
            ws.addRow([
                s.suiteName,
                s.totalRuns,
                s.totalTests,
                s.passed,
                s.failed,
                s.blocked,
                s.skipped,
                `${s.passRate.toFixed(1)}%`,
                `${s.failureRate.toFixed(1)}%`,
                s.trend,
                formatDuration(s.averageDuration),
            ]);
        }
        autosizeColumns(ws);
    }

    // -- Health sheet --
    if (healthReport) {
        const ws = workbook.addWorksheet('Test Health');
        addTitle(ws, 'Test Case Health');
        ws.addRow(['Metric', 'Count']);
        styleHeaderRow(ws.getRow(ws.lastRow!.number));
        ws.addRow(['Total Unique Cases', healthReport.summary.totalUniqueCases]);
        ws.addRow(['Flaky Tests', healthReport.summary.flakyCount]);
        ws.addRow(['Never Executed', healthReport.summary.neverExecutedCount]);
        ws.addRow(['High Failure Rate', healthReport.summary.highFailureCount]);

        if (healthReport.flakyTests.length > 0) {
            ws.addRow([]);
            ws.addRow(['Flaky Tests']);
            ws.getRow(ws.lastRow!.number).font = { bold: true };
            ws.addRow(['Test Case', 'Suite', 'Executions', 'Passed', 'Failed', 'Flaky Score']);
            styleHeaderRow(ws.getRow(ws.lastRow!.number));
            for (const t of healthReport.flakyTests) {
                ws.addRow([t.title, t.suite, t.executionCount, t.passCount, t.failCount, t.flakyScore]);
            }
        }

        if (healthReport.mostFailingTests.length > 0) {
            ws.addRow([]);
            ws.addRow(['Most Failing Tests']);
            ws.getRow(ws.lastRow!.number).font = { bold: true };
            ws.addRow(['Test Case', 'Suite', 'Executions', 'Failures', 'Failure Rate']);
            styleHeaderRow(ws.getRow(ws.lastRow!.number));
            for (const t of healthReport.mostFailingTests) {
                ws.addRow([t.title, t.suite, t.executionCount, t.failCount, `${t.failureRate.toFixed(1)}%`]);
            }
        }

        if (healthReport.neverExecutedTests.length > 0) {
            ws.addRow([]);
            ws.addRow(['Never Executed Tests']);
            ws.getRow(ws.lastRow!.number).font = { bold: true };
            ws.addRow(['Test Case', 'Suite', 'Days Since Creation']);
            styleHeaderRow(ws.getRow(ws.lastRow!.number));
            for (const t of healthReport.neverExecutedTests) {
                ws.addRow([t.title, t.suite, t.daysSinceCreation]);
            }
        }

        if (healthReport.failedRunCases.length > 0) {
            ws.addRow([]);
            ws.addRow(['Recent Failed Run Cases']);
            ws.getRow(ws.lastRow!.number).font = { bold: true };
            ws.addRow(['Test Case', 'Run Name', 'Suite', 'Area', 'Failed At']);
            styleHeaderRow(ws.getRow(ws.lastRow!.number));
            for (const t of healthReport.failedRunCases) {
                ws.addRow([
                    t.testCaseName,
                    t.runName,
                    t.testSuite,
                    t.area,
                    t.failedAt ? new Date(t.failedAt).toLocaleString() : '-',
                ]);
            }
        }
        autosizeColumns(ws);
    }

    // -- Ticket Triage sheet --
    if (ticketMetricsReport) {
        const ws = workbook.addWorksheet('Triage');
        addTitle(ws, 'Ticket Triage Metrics');
        ws.addRow(['KPI', 'Value']);
        styleHeaderRow(ws.getRow(ws.lastRow!.number));
        const k = ticketMetricsReport.kpis;
        ws.addRow(['Tickets Created', k.ticketsCreated]);
        ws.addRow(['Tickets Reproduced', k.ticketsReproduced]);
        ws.addRow(['Reproduction Rate', `${k.reproductionRate.toFixed(1)}%`]);
        ws.addRow(['Median TTR (hours)', k.timeToReproduceMedianHours ?? '—']);
        ws.addRow(['Avg TTR (hours)', k.timeToReproduceAvgHours ?? '—']);
        ws.addRow(['Tickets Returned', k.ticketsReturned]);
        ws.addRow(['Returned Rate', `${k.returnedRate.toFixed(1)}%`]);
        ws.addRow([]);
        ws.addRow(['Period', 'Created', 'Reproduced', 'Returned']);
        styleHeaderRow(ws.getRow(ws.lastRow!.number));
        for (const p of ticketMetricsReport.trend) {
            ws.addRow([p.periodLabel, p.ticketsCreated, p.ticketsReproduced, p.ticketsReturned]);
        }
        autosizeColumns(ws);
    }

    // -- Charts sheet (embedded PNG graphs) --
    const chartEntries: { title: string; svg: string }[] = [];
    if (charts.distribution) chartEntries.push({ title: 'Test Case Distribution', svg: charts.distribution });
    if (charts.passFail) chartEntries.push({ title: 'Pass/Fail Distribution', svg: charts.passFail });
    if (charts.passRateTrend) chartEntries.push({ title: 'Pass Rate Trend', svg: charts.passRateTrend });
    if (charts.executionVolume) chartEntries.push({ title: 'Test Execution Volume', svg: charts.executionVolume });
    if (charts.suitePassRates) chartEntries.push({ title: 'Suite Pass Rates', svg: charts.suitePassRates });
    if (charts.triageTrend) chartEntries.push({ title: 'Triage Trend', svg: charts.triageTrend });

    const chartsWs = workbook.addWorksheet('Charts');
    addTitle(
        chartsWs,
        'Graphs',
        projectName ? `Project: ${projectName}` : undefined,
    );

    let rowCursor = Math.max(chartsWs.lastRow?.number ?? 1, 3) + 1;
    if (chartEntries.length === 0) {
        chartsWs.addRow(['No chart data available for this range.']);
    } else {
        for (const entry of chartEntries) {
            const widthMatch = /width="(\d+)"/.exec(entry.svg);
            const heightMatch = /height="(\d+)"/.exec(entry.svg);
            const width = Number(widthMatch?.[1] || 760);
            const height = Number(heightMatch?.[1] || 340);

            const titleRow = chartsWs.addRow([entry.title]);
            titleRow.getCell(1).font = { bold: true, size: 12 };
            rowCursor = titleRow.number + 1;

            try {
                const png = await svgToPngBytes(entry.svg, width, height);
                // exceljs's ambient Buffer extends ArrayBuffer; Uint8Array is accepted at runtime
                const imageId = workbook.addImage({
                    buffer: png as unknown as ArrayBuffer as typeof Buffer.prototype,
                    extension: 'png',
                });
                // exceljs ext is in CSS pixels
                const displayW = Math.min(width, 720);
                const displayH = Math.round(displayW * (height / width));
                chartsWs.addImage(imageId, {
                    tl: { col: 0.5, row: rowCursor - 1 },
                    ext: { width: displayW, height: displayH },
                });
                // Reserve vertical space (~row height 15pt ≈ 20px): leave enough empty rows
                const rowSpan = Math.ceil((displayH + 16) / 20);
                for (let i = 0; i < rowSpan; i++) {
                    chartsWs.addRow([]);
                }
                rowCursor += rowSpan + 1;
            } catch {
                chartsWs.addRow([`Could not render chart image: ${entry.title}`]);
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

    const slug = projectName ? `-${projectName.replace(/[^a-z0-9]/gi, '_')}` : '';
    const filename = `report${slug}-${formatDateForFilename()}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlobRaw(blob, filename);
}
