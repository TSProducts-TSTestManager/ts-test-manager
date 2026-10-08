import ExcelJS from 'exceljs';
import { pieChartSVG, svgToPngBytes } from './reportCharts';
import { buildReportMetaRows, ReportMeta } from './reportMeta';

const escapeHtml = (value: unknown): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

export interface AutomationStatusMetrics {
    total: number;
    automatableBase: number;
    notAutomatable: number;
    automated: number;
    created: number;
    inProgress: number;
    fixed: number;
    readyForExecute: number;
    fail: number;
    automationCoverage: string | number;
}

export interface PieChartConfig {
    title: string;
    data: { name: string; value: number; color: string }[];
}

export function exportAutomationStatusToPDF(
    project: { name?: string },
    metrics: AutomationStatusMetrics,
    reportMeta: ReportMeta = {},
    pieCharts: PieChartConfig[] = []
): void {
    const metaRows = buildReportMetaRows(reportMeta);
    const dateStr = new Date().toLocaleString();
    const title = project?.name
        ? `Automation Status & Analytics Report – ${project.name}`
        : 'Automation Status & Analytics Report';

    // Build SVG charts dynamically for all 6 pie charts
    const chartsSvg = pieCharts.map(c => ({
        title: c.title,
        svg: pieChartSVG(c.title, c.data)
    }));

    const scriptClose = '</scr' + 'ipt>';

    const metaTableHtml = metaRows.length > 0
        ? `<table class="kv-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            ${metaRows.map(([lbl, val]) => `
                <tr>
                    <td style="font-weight: 600; width: 220px; background: #f3f4f6; padding: 6px 10px; border: 1px solid #e5e7eb; font-size: 11px;">${escapeHtml(lbl)}</td>
                    <td style="padding: 6px 10px; border: 1px solid #e5e7eb; font-size: 11px;">${escapeHtml(val)}</td>
                </tr>
            `).join('')}
           </table>`
        : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; margin: 0; padding: 20px; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #1e3a8a; }
    .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
    .section { margin-bottom: 24px; break-inside: auto; }
    h2 { font-size: 15px; font-weight: 700; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; margin-bottom: 12px; color: #1d4ed8; }
    .kpi-grid { display: flex; gap: 16px; margin-bottom: 20px; }
    .kpi-card { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #f9fafb; }
    .kpi-label { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 6px; }
    .kpi-value { font-size: 28px; font-weight: 800; color: #111827; }
    .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px; }
    .chart-block { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fff; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    .chart-title { font-weight: 700; font-size: 12px; color: #111827; margin-bottom: 8px; }
    .chart-svg svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { background: #1e40af; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: 600; border: 1px solid #1e40af; }
    td { padding: 6px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    @media print {
      body { padding: 0; }
      .chart-block, .kpi-card { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div style="margin-bottom: 20px;">
    <h1>${escapeHtml(title)}</h1>
    <div class="subtitle">Generated on ${dateStr}</div>
    ${metaTableHtml}
  </div>

  <div class="section">
    <h2>Executive Overview KPIs</h2>
    <div class="kpi-grid">
      <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
        <div class="kpi-label">Total Test Cases</div>
        <div class="kpi-value">${metrics.total}</div>
        <div style="font-size: 11px; margin-top: 8px; color: #4b5563;">
          Automatable: <strong>${metrics.automatableBase}</strong> &bull; Not Automatable: <strong>${metrics.notAutomatable}</strong>
        </div>
      </div>
      <div class="kpi-card" style="border-left: 4px solid #10b981;">
        <div class="kpi-label">Automation Coverage</div>
        <div class="kpi-value" style="color: #059669;">${metrics.automationCoverage}%</div>
        <div style="font-size: 11px; margin-top: 8px; color: #4b5563;">
          Automated: <strong>${metrics.automated}</strong>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Script Fix & Maintenance Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Fix Status / Category</th>
          <th>Count</th>
          <th>Percentage of Automatable</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="font-weight: 600; color: #7c3aed;">Created</td><td>${metrics.created}</td><td>${metrics.automatableBase > 0 ? ((metrics.created / metrics.automatableBase) * 100).toFixed(1) : 0}%</td></tr>
        <tr><td style="font-weight: 600; color: #2563eb;">In Progress</td><td>${metrics.inProgress}</td><td>${metrics.automatableBase > 0 ? ((metrics.inProgress / metrics.automatableBase) * 100).toFixed(1) : 0}%</td></tr>
        <tr><td style="font-weight: 600; color: #059669;">Fixed</td><td>${metrics.fixed}</td><td>${metrics.automatableBase > 0 ? ((metrics.fixed / metrics.automatableBase) * 100).toFixed(1) : 0}%</td></tr>
        <tr><td style="font-weight: 600; color: #0891b2;">Ready for Execute</td><td>${metrics.readyForExecute}</td><td>${metrics.automatableBase > 0 ? ((metrics.readyForExecute / metrics.automatableBase) * 100).toFixed(1) : 0}%</td></tr>
        <tr><td style="font-weight: 600; color: #dc2626;">Fail</td><td>${metrics.fail}</td><td>${metrics.automatableBase > 0 ? ((metrics.fail / metrics.automatableBase) * 100).toFixed(1) : 0}%</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Automation Analytics Visual Graphs</h2>
    <div class="charts-grid">
      ${chartsSvg.map(c => `
        <div class="chart-block">
          <div class="chart-svg">${c.svg}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <div style="margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center;">
    Generated by TS Test Manager
  </div>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  ${scriptClose}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Professional Excel Export with Embedded Charts & Meta Block */
export async function exportAutomationStatusToExcel(
    project: { name?: string },
    metrics: AutomationStatusMetrics,
    filteredCases: any[] = [],
    reportMeta: ReportMeta = {}
): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TS Test Manager';
    workbook.created = new Date();

    const { projectName } = reportMeta;
    const metaRows = buildReportMetaRows(reportMeta);

    // 1. Summary Sheet
    const wsSummary = workbook.addWorksheet('Summary');
    const titleRow = wsSummary.addRow([projectName ? `Automation Status Report – ${projectName}` : 'Automation Status Report']);
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF111827' } };
    wsSummary.mergeCells(titleRow.number, 1, titleRow.number, 4);
    wsSummary.addRow([]);

    if (metaRows.length > 0) {
        const hdr = wsSummary.addRow(['Report Details', 'Value']);
        hdr.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        hdr.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        hdr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        hdr.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };

        metaRows.forEach(([k, v]) => {
            const r = wsSummary.addRow([k, v]);
            r.getCell(1).font = { bold: true };
        });
        wsSummary.addRow([]);
    }

    // KPI Summary
    const kpiHeader = wsSummary.addRow(['Executive KPI', 'Value', 'Percentage']);
    kpiHeader.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    wsSummary.addRow(['Total Test Cases', metrics.total, '100%']);
    wsSummary.addRow(['Automatable Cases', metrics.automatableBase, `${metrics.total > 0 ? ((metrics.automatableBase / metrics.total) * 100).toFixed(1) : 0}%`]);
    wsSummary.addRow(['Automated Cases', metrics.automated, `${metrics.automationCoverage}%`]);
    wsSummary.addRow(['Not Automatable', metrics.notAutomatable, `${metrics.total > 0 ? ((metrics.notAutomatable / metrics.total) * 100).toFixed(1) : 0}%`]);
    wsSummary.addRow([]);

    // Fix Breakdown
    const fixHeader = wsSummary.addRow(['Fix / Maintenance Status', 'Count', '% of Automatable']);
    fixHeader.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    wsSummary.addRow(['Created', metrics.created, `${metrics.automatableBase > 0 ? ((metrics.created / metrics.automatableBase) * 100).toFixed(1) : 0}%`]);
    wsSummary.addRow(['In Progress', metrics.inProgress, `${metrics.automatableBase > 0 ? ((metrics.inProgress / metrics.automatableBase) * 100).toFixed(1) : 0}%`]);
    wsSummary.addRow(['Fixed', metrics.fixed, `${metrics.automatableBase > 0 ? ((metrics.fixed / metrics.automatableBase) * 100).toFixed(1) : 0}%`]);
    wsSummary.addRow(['Ready for Execute', metrics.readyForExecute, `${metrics.automatableBase > 0 ? ((metrics.readyForExecute / metrics.automatableBase) * 100).toFixed(1) : 0}%`]);
    wsSummary.addRow(['Fail', metrics.fail, `${metrics.automatableBase > 0 ? ((metrics.fail / metrics.automatableBase) * 100).toFixed(1) : 0}%`]);

    wsSummary.getColumn(1).width = 30;
    wsSummary.getColumn(2).width = 15;
    wsSummary.getColumn(3).width = 25;

    // 2. Embedded Charts Sheet
    const statusSvg = pieChartSVG('Automation Coverage', [
        { name: 'Automated', value: metrics.automated, color: '#10B981' },
        { name: 'Automatable', value: Math.max(0, metrics.automatableBase - metrics.automated), color: '#3B82F6' },
        { name: 'Not Automatable', value: metrics.notAutomatable, color: '#F59E0B' },
    ].filter(d => d.value > 0));

    const wsCharts = workbook.addWorksheet('Charts');
    wsCharts.addRow(['Automation Status Visual Graphs']).getCell(1).font = { bold: true, size: 14 };
    wsCharts.addRow([]);

    try {
        const png = await svgToPngBytes(statusSvg, 500, 300);
        const imgId = workbook.addImage({
            buffer: png as unknown as ArrayBuffer as typeof Buffer.prototype,
            extension: 'png',
        });
        wsCharts.addImage(imgId, {
            tl: { col: 0.5, row: 3 },
            ext: { width: 500, height: 300 },
        });
    } catch (err) {
        console.error('Failed to embed graph in Excel:', err);
    }

    // 3. Detailed Cases Sheet
    const wsDetails = workbook.addWorksheet('Test Cases Detail');
    const dHdr = wsDetails.addRow([
        'Test Case ID',
        'Title',
        'Suite',
        'Priority',
        'Status',
        'Test Type',
        'Automation Status',
        'Fix Status',
        'Last Automation Update',
        'Archived',
    ]);
    dHdr.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    filteredCases.forEach((tc) => {
        wsDetails.addRow([
            tc.displayId || tc.id,
            tc.title,
            tc.suite || '',
            tc.priority,
            tc.status,
            tc.testType || '',
            tc.automationStatus || 'Not Automatable',
            tc.automationFixStatus || 'Not Applicable',
            tc.lastAutomationUpdateDate ? new Date(tc.lastAutomationUpdateDate).toLocaleString() : '',
            tc.archived ? 'Yes' : 'No',
        ]);
    });

    [15, 45, 25, 12, 12, 12, 20, 20, 22, 10].forEach((w, i) => {
        wsDetails.getColumn(i + 1).width = w;
    });

    const safeName = (project?.name || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}_Automation_Status_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}


