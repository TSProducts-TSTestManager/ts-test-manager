/**
 * Lightweight SVG chart generators for report exports.
 * Charts are pure SVG so they can be embedded directly in print HTML (PDF)
 * or rasterized to PNG and placed into Excel worksheets.
 */

const COLORS = {
    passed: '#10B981',
    failed: '#EF4444',
    blocked: '#F59E0B',
    skipped: '#6B7280',
    primary: '#3B82F6',
} as const;

export interface PieSlice {
    name: string;
    value: number;
    color: string;
}

export interface MultiLinePoint {
    label: string;
    series: number[];
}

export interface StackedBarPoint {
    label: string;
    values: number[];
}

export interface HorizontalBarItem {
    label: string;
    value: number;
    color?: string;
}

/** A single titled chart ready to embed in print HTML or rasterize to PNG. */
export interface ReportChart {
    title: string;
    svg: string;
}

function esc(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function pieChartSVG(title: string, slices: PieSlice[], width = 560, height = 320): string {
    const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
    if (total <= 0) {
        return chartFrame(title, '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="14">No data</text>', width, height);
    }

    const cx = 170;
    const cy = 155;
    const r = 95;
    let angle = 0;
    const paths: string[] = [];
    const legend: string[] = [];

    slices.forEach((slice, idx) => {
        const portion = Math.max(0, slice.value) / total;
        if (portion <= 0) return;
        const sweep = portion * 360;
        const start = angle;
        const end = angle + sweep;
        // Full circle: SVG arc of 360° is a no-op — draw two half arcs
        if (portion >= 0.999) {
            paths.push(
                `<path d="${donutArcPath(cx, cy, r, 0, 179.9)}" fill="${slice.color}" stroke="#fff" stroke-width="1"/>` +
                `<path d="${donutArcPath(cx, cy, r, 180, 359.9)}" fill="${slice.color}" stroke="#fff" stroke-width="1"/>`
            );
        } else {
            paths.push(`<path d="${donutArcPath(cx, cy, r, start, end)}" fill="${slice.color}" stroke="#fff" stroke-width="1"/>`);
        }

        const pct = ((slice.value / total) * 100).toFixed(1);
        const ly = 95 + idx * 22;
        legend.push(
            `<rect x="330" y="${ly - 11}" width="12" height="12" rx="2" fill="${slice.color}"/>` +
            `<text x="350" y="${ly}" font-size="13" fill="#374151">${esc(slice.name)}</text>` +
            `<text x="${width - 30}" y="${ly}" font-size="13" fill="#111827" text-anchor="end" font-weight="600">${slice.value} (${pct}%)</text>`
        );
        angle = end;
    });

    const body =
        `<g>${paths.join('')}</g>` +
        `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" font-weight="700" fill="#111827">${total}</text>` +
        `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="#6b7280">total</text>` +
        legend.join('');

    return chartFrame(title, body, width, height);
}

export function multiLineChartSVG(
    title: string,
    seriesNames: string[],
    seriesColors: string[],
    points: MultiLinePoint[],
    yLabel = '',
    width = 760,
    height = 340,
): string {
    if (points.length === 0) {
        return chartFrame(title, '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="14">No data</text>', width, height);
    }

    const padL = 50;
    const padR = 24;
    // Leave room for the frame title (y≈24) and the legend row beneath it
    const padT = 72;
    const padB = 56;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const allValues = points.flatMap(p => p.series);
    const maxVal = Math.max(1, ...allValues);
    // Nice ceiling for percent-like series
    const yMax = maxVal <= 100 && yLabel.includes('%') ? 100 : niceMax(maxVal);

    const xAt = (i: number) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const yAt = (v: number) => padT + plotH - (v / yMax) * plotH;

    const grid: string[] = [];
    const tickCount = 5;
    for (let t = 0; t <= tickCount; t++) {
        const val = (yMax / tickCount) * t;
        const y = yAt(val);
        grid.push(
            `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="3 3"/>` +
            `<text x="${padL - 8}" y="${y + 4}" font-size="11" fill="#6b7280" text-anchor="end">${Math.round(val)}</text>`
        );
    }

    // X labels (thin out if crowded)
    const labelStep = Math.max(1, Math.ceil(points.length / 8));
    const xLabels = points.map((p, i) => {
        if (i % labelStep !== 0 && i !== points.length - 1) return '';
        return `<text x="${xAt(i)}" y="${height - padB + 18}" font-size="11" fill="#6b7280" text-anchor="middle">${esc(p.label)}</text>`;
    }).join('');

    const lines = seriesNames.map((_name, si) => {
        const color = seriesColors[si] || COLORS.primary;
        const coords = points.map((p, i) => `${xAt(i)},${yAt(p.series[si] ?? 0)}`).join(' ');
        const dots = points.map((p, i) =>
            `<circle cx="${xAt(i)}" cy="${yAt(p.series[si] ?? 0)}" r="3.5" fill="${color}" stroke="#fff" stroke-width="1"/>`
        ).join('');
        return `<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${coords}"/>${dots}`;
    }).join('');

    const legend = seriesNames.map((name, i) => {
        const x = padL + i * 120;
        return (
            `<rect x="${x}" y="44" width="12" height="12" rx="2" fill="${seriesColors[i] || COLORS.primary}"/>` +
            `<text x="${x + 18}" y="54" font-size="12" fill="#374151">${esc(name)}</text>`
        );
    }).join('');

    const yTitle = yLabel
        ? `<text transform="translate(14,${padT + plotH / 2}) rotate(-90)" font-size="11" fill="#6b7280" text-anchor="middle">${esc(yLabel)}</text>`
        : '';

    const body = grid.join('') + xLabels + lines + legend + yTitle +
        `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#9ca3af"/>` +
        `<line x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" stroke="#9ca3af"/>`;

    return chartFrame(title, body, width, height);
}

export function stackedBarChartSVG(
    title: string,
    seriesNames: string[],
    seriesColors: string[],
    points: StackedBarPoint[],
    width = 760,
    height = 340,
): string {
    if (points.length === 0) {
        return chartFrame(title, '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="14">No data</text>', width, height);
    }

    const padL = 50;
    const padR = 24;
    // Leave room for the frame title (y≈24) and the legend row beneath it
    const padT = 72;
    const padB = 56;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const totals = points.map(p => p.values.reduce((a, b) => a + (b || 0), 0));
    const yMax = niceMax(Math.max(1, ...totals));
    const band = plotW / points.length;
    const barW = Math.min(36, band * 0.65);

    const grid: string[] = [];
    for (let t = 0; t <= 5; t++) {
        const val = (yMax / 5) * t;
        const y = padT + plotH - (val / yMax) * plotH;
        grid.push(
            `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="3 3"/>` +
            `<text x="${padL - 8}" y="${y + 4}" font-size="11" fill="#6b7280" text-anchor="end">${Math.round(val)}</text>`
        );
    }

    const bars: string[] = [];
    const labelStep = Math.max(1, Math.ceil(points.length / 8));
    const xLabels: string[] = [];

    points.forEach((p, i) => {
        const cx = padL + i * band + band / 2;
        let acc = 0;
        p.values.forEach((v, si) => {
            const h = ((v || 0) / yMax) * plotH;
            const y = padT + plotH - acc - h;
            if (h > 0) {
                bars.push(
                    `<rect x="${cx - barW / 2}" y="${y}" width="${barW}" height="${h}" fill="${seriesColors[si] || '#ccc'}" rx="1"/>`
                );
            }
            acc += h;
        });
        if (i % labelStep === 0 || i === points.length - 1) {
            xLabels.push(
                `<text x="${cx}" y="${height - padB + 18}" font-size="11" fill="#6b7280" text-anchor="middle">${esc(p.label)}</text>`
            );
        }
    });

    const legend = seriesNames.map((name, i) => {
        const x = padL + i * 100;
        return (
            `<rect x="${x}" y="44" width="12" height="12" rx="2" fill="${seriesColors[i] || COLORS.primary}"/>` +
            `<text x="${x + 18}" y="54" font-size="12" fill="#374151">${esc(name)}</text>`
        );
    }).join('');

    const body =
        grid.join('') +
        bars.join('') +
        xLabels.join('') +
        legend +
        `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#9ca3af"/>` +
        `<line x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" stroke="#9ca3af"/>`;

    return chartFrame(title, body, width, height);
}

export function horizontalBarChartSVG(
    title: string,
    items: HorizontalBarItem[],
    unit = '%',
    width = 760,
    height?: number,
): string {
    const maxItems = Math.max(items.length, 1);
    const rowH = 36;
    const padL = 190;
    const padR = 70;
    const padT = 36;
    const padB = 28;
    const h = height ?? Math.max(180, padT + padB + maxItems * rowH);
    const plotW = width - padL - padR;

    if (items.length === 0) {
        return chartFrame(title, '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="14">No data</text>', width, Math.max(h, 160));
    }

    const maxVal = Math.max(1, ...items.map(i => Math.max(0, i.value)));
    const scaleMax = unit === '%' ? Math.max(100, maxVal) : maxVal;

    const bars = items.map((item, i) => {
        const y = padT + i * rowH;
        const w = (Math.max(0, item.value) / scaleMax) * plotW;
        const color = item.color || COLORS.primary;
        const label = item.label.length > 28 ? item.label.slice(0, 27) + '…' : item.label;
        return (
            `<text x="${padL - 10}" y="${y + 16}" font-size="12" fill="#374151" text-anchor="end">${esc(label)}</text>` +
            `<rect x="${padL}" y="${y + 4}" width="${Math.max(w, 2)}" height="18" rx="3" fill="${color}"/>` +
            `<text x="${padL + Math.max(w, 2) + 8}" y="${y + 17}" font-size="12" fill="#111827" font-weight="600">${Math.round(item.value)}${unit}</text>`
        );
    }).join('');

    const body =
        `<line x1="${padL}" y1="${padT - 4}" x2="${padL}" y2="${padT + items.length * rowH}" stroke="#9ca3af"/>` +
        bars;

    return chartFrame(title, body, width, Math.max(h, padT + padB + items.length * rowH));
}

export function chartFrame(title: string, body: string, width: number, height: number): string {
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        `<rect width="100%" height="100%" fill="#ffffff"/>` +
        `<text x="16" y="24" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">${esc(title)}</text>` +
        `<g font-family="Arial, sans-serif">${body}</g>` +
        `</svg>`
    );
}

export function wrapSvgAsPrintBlock(svg: string, heading?: string): string {
    const h = heading ? `<h3>${heading}</h3>` : '';
    return `<div class="chart-block">${h}<div class="chart-svg">${svg}</div></div>`;
}

export function reportChartColors() {
    return { ...COLORS };
}

/** Convert an SVG string to PNG bytes for embedding in Excel. */
export async function svgToPngBytes(svg: string, width: number, height: number): Promise<Uint8Array> {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.decoding = 'sync';
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load chart SVG'));
            img.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1] || '';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function niceMax(value: number): number {
    if (value <= 10) return Math.ceil(value);
    const mag = Math.pow(10, Math.floor(Math.log10(value)));
    const norm = value / mag;
    let nice: number;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * mag;
}
