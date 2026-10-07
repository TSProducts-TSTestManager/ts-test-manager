import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const escapeHtml = (value: unknown): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

export async function exportAutomationStatusToPDF(
    project: { name?: string },
    metrics: { 
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
): Promise<void> {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.zIndex = '-9999';
    container.style.opacity = '0.01';
    container.style.pointerEvents = 'none';
    container.style.width = '800px';
    container.style.backgroundColor = '#ffffff';
    container.style.padding = '32px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#1f2937';

    container.innerHTML = `
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 0 0 6px 0;">Automation Status & Executive Analytics Report</h1>
            <div style="font-size: 13px; color: #6b7280;">
                Project: <strong>${escapeHtml(project?.name || 'Project')}</strong> &bull; Generated on: <strong>${new Date().toLocaleString()}</strong>
            </div>
        </div>

        <!-- KPI Grid -->
        <h2 style="font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 12px;">Executive Overview KPIs</h2>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 28px;">
            <div style="border-left: 4px solid #3b82f6; background-color: #f8fafc; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0;">
                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">Total Test Cases</div>
                <div style="font-size: 28px; font-weight: 800; color: #0f172a;">${metrics.total}</div>
                <div style="font-size: 12px; color: #475569; margin-top: 8px;">
                    Automatable: <strong>${metrics.automatableBase}</strong> &bull; Not Automatable: <strong>${metrics.notAutomatable}</strong>
                </div>
            </div>

            <div style="border-left: 4px solid #10b981; background-color: #f8fafc; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0;">
                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">Automated Coverage</div>
                <div style="font-size: 28px; font-weight: 800; color: #059669;">${metrics.automationCoverage}%</div>
                <div style="font-size: 12px; color: #475569; margin-top: 8px;">
                    Automated Cases: <strong>${metrics.automated}</strong>
                </div>
            </div>
        </div>

        <!-- Script Maintenance Breakdown Table -->
        <h2 style="font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 12px;">Script Fix & Readiness Breakdown</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 12px;">
            <thead>
                <tr style="background-color: #1e40af; color: #ffffff; text-align: left;">
                    <th style="padding: 10px 12px; border: 1px solid #1e40af;">Fix Status / Category</th>
                    <th style="padding: 10px 12px; border: 1px solid #1e40af;">Count</th>
                    <th style="padding: 10px 12px; border: 1px solid #1e40af;">Percentage of Automatable</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 12px; font-weight: bold; color: #7c3aed;">Created</td>
                    <td style="padding: 8px 12px;">${metrics.created}</td>
                    <td style="padding: 8px 12px;">${metrics.automatableBase > 0 ? ((metrics.created / metrics.automatableBase) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                    <td style="padding: 8px 12px; font-weight: bold; color: #2563eb;">In Progress</td>
                    <td style="padding: 8px 12px;">${metrics.inProgress}</td>
                    <td style="padding: 8px 12px;">${metrics.automatableBase > 0 ? ((metrics.inProgress / metrics.automatableBase) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 12px; font-weight: bold; color: #059669;">Fixed</td>
                    <td style="padding: 8px 12px;">${metrics.fixed}</td>
                    <td style="padding: 8px 12px;">${metrics.automatableBase > 0 ? ((metrics.fixed / metrics.automatableBase) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                    <td style="padding: 8px 12px; font-weight: bold; color: #0891b2;">Ready for Execute</td>
                    <td style="padding: 8px 12px;">${metrics.readyForExecute}</td>
                    <td style="padding: 8px 12px;">${metrics.automatableBase > 0 ? ((metrics.readyForExecute / metrics.automatableBase) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 12px; font-weight: bold; color: #dc2626;">Fail</td>
                    <td style="padding: 8px 12px;">${metrics.fail}</td>
                    <td style="padding: 8px 12px;">${metrics.automatableBase > 0 ? ((metrics.fail / metrics.automatableBase) * 100).toFixed(1) : 0}%</td>
                </tr>
            </tbody>
        </table>

        <!-- Footer -->
        <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8;">
            Generated by TSTestManager &bull; Automated Testing Platform Report
        </div>
    `;

    document.body.appendChild(container);

    try {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Allow DOM paint

        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        const safeProjectName = (project?.name || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
        pdf.save(`${safeProjectName}_Automation_Status_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } finally {
        if (document.body.contains(container)) {
            document.body.removeChild(container);
        }
    }
}

