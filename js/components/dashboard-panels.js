/**
 * Dashboard Panels for HCC OmniScope
 * Six interactive visualization classes: CohortDashboard, GeneLeaderboard,
 * VolcanoPlot, SankeyDiagram, RadarChart, CorrelationMatrix.
 * Pure vanilla JS ES module, canvas-based, no external dependencies, no em dashes.
 */

// ---------------------------------------------------------------------------
// Theme constants
// ---------------------------------------------------------------------------

const COLORS = {
    bg: 'rgba(10, 10, 26, 0.95)',
    bgSolid: '#0a0a1a',
    panel: 'rgba(12, 12, 30, 0.92)',
    panelSolid: '#0c0c1e',
    border: 'rgba(100, 120, 255, 0.15)',
    borderBright: 'rgba(100, 120, 255, 0.3)',
    text: '#e0e0f0',
    textDim: '#8888aa',
    textBright: '#ffffff',
    accent: '#6c8cff',
    altitude: '#4ade80',
    ros: '#f87171',
    overlap: '#fbbf24',
    alive: '#60a5fa',
    deceased: '#ef4444',
    grid: 'rgba(100, 120, 255, 0.08)',
};

const FONT = "'Inter', system-ui, -apple-system, sans-serif";
const MONO = "'JetBrains Mono', monospace";

const ALTITUDE_GENES = ['GC', 'GRB2', 'LDHA', 'SENP1', 'CDC42', 'HMOX1', 'HK2', 'EPO', 'AEBP2'];
const ROS_GENES = ['TXNRD1', 'MAFG', 'G6PD', 'SQSTM1', 'SLC7A11', 'GSR', 'NCF2', 'MSRA', 'GLRX2', 'BACH1'];
const ALL_GENES = [...ALTITUDE_GENES, ...ROS_GENES];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function geneSignature(gene) {
    const inAlt = ALTITUDE_GENES.includes(gene);
    const inRos = ROS_GENES.includes(gene);
    if (inAlt && inRos) return 'overlap';
    if (inAlt) return 'altitude';
    return 'ros';
}

function geneColor(gene) {
    const sig = geneSignature(gene);
    if (sig === 'overlap') return COLORS.overlap;
    if (sig === 'altitude') return COLORS.altitude;
    return COLORS.ros;
}

function sigColor(sig) {
    if (!sig) return COLORS.textDim;
    const s = sig.toLowerCase();
    if (s.includes('altitude') || s.includes('adaptation')) return COLORS.altitude;
    if (s.includes('ros') || s.includes('ferroptosis')) return COLORS.ros;
    if (s.includes('overlap') || s.includes('both')) return COLORS.overlap;
    return COLORS.accent;
}

function createOverlay(onBackdropClick) {
    const el = document.createElement('div');
    Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '900',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.bg,
        fontFamily: FONT,
    });
    if (onBackdropClick) {
        el.addEventListener('click', (e) => {
            if (e.target === el) onBackdropClick();
        });
    }
    return el;
}

function createCard(width, maxHeight) {
    const card = document.createElement('div');
    Object.assign(card.style, {
        position: 'relative',
        background: COLORS.panelSolid,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '12px',
        padding: '20px',
        width: width || '700px',
        maxWidth: '95vw',
        maxHeight: maxHeight || '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
    });
    return card;
}

function createCloseBtn(onClose) {
    const btn = document.createElement('button');
    btn.textContent = '\u00D7';
    btn.setAttribute('aria-label', 'Close');
    Object.assign(btn.style, {
        position: 'absolute',
        top: '8px',
        right: '12px',
        background: 'none',
        border: 'none',
        color: COLORS.textDim,
        fontSize: '22px',
        cursor: 'pointer',
        lineHeight: '1',
        padding: '4px 8px',
        borderRadius: '4px',
        zIndex: '10',
        fontFamily: FONT,
    });
    btn.addEventListener('mouseenter', () => {
        btn.style.color = COLORS.textBright;
        btn.style.background = 'rgba(255,255,255,0.08)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.color = COLORS.textDim;
        btn.style.background = 'none';
    });
    btn.addEventListener('click', onClose);
    return btn;
}

function createTitle(text) {
    const el = document.createElement('h2');
    el.textContent = text;
    Object.assign(el.style, {
        margin: '0 0 12px 0',
        fontSize: '15px',
        fontWeight: '700',
        color: COLORS.textBright,
        letterSpacing: '0.02em',
        fontFamily: FONT,
    });
    return el;
}

function createHiDPICanvas(w, h) {
    const canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { canvas, ctx, dpr, w, h };
}

function median(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

/** Welch's t-test (unequal variance, two-tailed). Returns p-value. */
function tTest(a, b) {
    if (a.length < 2 || b.length < 2) return 1;
    const m1 = mean(a), m2 = mean(b);
    const s1 = stddev(a), s2 = stddev(b);
    const n1 = a.length, n2 = b.length;
    const se = Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);
    if (se === 0) return 1;
    const t = (m1 - m2) / se;
    // Approximate p from t using a sigmoid-like transformation (no scipy needed)
    const df = Math.max(1, Math.floor(
        ((s1 * s1 / n1 + s2 * s2 / n2) ** 2) /
        ((s1 ** 4) / (n1 * n1 * (n1 - 1)) + (s2 ** 4) / (n2 * n2 * (n2 - 1)))
    ));
    return tDistPValue(Math.abs(t), df);
}

/** Approximate two-tailed p-value from t distribution using regularized incomplete beta. */
function tDistPValue(t, df) {
    const x = df / (df + t * t);
    return betaIncomplete(df / 2, 0.5, x);
}

/** Regularized incomplete beta function via continued fraction (Lentz). */
function betaIncomplete(a, b, x) {
    if (x <= 0) return 1;
    if (x >= 1) return 0;
    const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
    // Continued fraction
    let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    f = d;
    for (let m = 1; m <= 200; m++) {
        // even step
        let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
        d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
        c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        f *= d * c;
        // odd step
        num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
        d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
        c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        f *= d * c;
        if (Math.abs(d * c - 1) < 1e-10) break;
    }
    const result = front * f;
    return Math.max(0, Math.min(1, result));
}

/** Lanczos approximation of ln(Gamma(z)). */
function lnGamma(z) {
    const g = 7;
    const coefs = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    }
    z -= 1;
    let x = coefs[0];
    for (let i = 1; i < g + 2; i++) x += coefs[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Build a flat gene map from hazardRatios keyed by gene name. */
function buildGeneMap(hazardRatios) {
    const map = {};
    if (!hazardRatios) return map;
    for (const [sig, genes] of Object.entries(hazardRatios)) {
        for (const g of genes) {
            if (!map[g.gene]) {
                map[g.gene] = { ...g, signature: sig };
            }
        }
    }
    return map;
}

/** Get Pearson r for two genes from the correlations data. */
function getCorrelation(correlations, gene1, gene2) {
    if (!correlations) return null;
    for (const sigData of Object.values(correlations)) {
        const genes = sigData.genes;
        const matrix = sigData.matrix;
        const i1 = genes.indexOf(gene1);
        const i2 = genes.indexOf(gene2);
        if (i1 >= 0 && i2 >= 0) return matrix[i1][i2];
    }
    return null;
}

/** Compute degree for a gene: number of edges with |r| > threshold. */
function computeDegree(correlations, gene, threshold = 0.15) {
    let degree = 0;
    if (!correlations) return 0;
    const seen = new Set();
    for (const sigData of Object.values(correlations)) {
        const genes = sigData.genes;
        const idx = genes.indexOf(gene);
        if (idx < 0) continue;
        for (let j = 0; j < genes.length; j++) {
            if (j === idx) continue;
            const other = genes[j];
            if (seen.has(other)) continue;
            if (Math.abs(sigData.matrix[idx][j]) > threshold) {
                degree++;
                seen.add(other);
            }
        }
    }
    return degree;
}

/** Parse a hex color to [r, g, b]. */
function hexToRGB(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Blend two hex colors at ratio t (0=c1, 1=c2), return rgba string. */
function blendColors(hex1, hex2, t, alpha = 0.5) {
    const [r1, g1, b1] = hexToRGB(hex1);
    const [r2, g2, b2] = hexToRGB(hex2);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. CohortDashboard
// ═══════════════════════════════════════════════════════════════════════════

export class CohortDashboard {
    constructor(clinical) {
        this.clinical = clinical || [];
        this.overlay = null;
        this._built = false;
    }

    _buildDOM() {
        if (this._built) return;
        this._built = true;

        this.overlay = createOverlay(() => this.hide());
        const card = createCard('750px', '580px');
        card.style.overflow = 'auto';

        card.appendChild(createCloseBtn(() => this.hide()));
        card.appendChild(createTitle(`TCGA-LIHC Cohort Overview (n=${this.clinical.length})`));

        const body = document.createElement('div');
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.gap = '12px';
        body.style.overflow = 'auto';
        body.style.flex = '1';

        // Compute stats
        const data = this.clinical;
        const events = data.filter(p => p.OS_event === 1).length;
        const survMonths = data.filter(p => p.OS_months != null).map(p => p.OS_months);
        const medSurv = median(survMonths);
        const ages = data.filter(p => p.age_at_diagnosis != null)
            .map(p => Math.round(p.age_at_diagnosis / 365.25));
        const medAge = median(ages);

        // Row 1: stat cards
        const statsRow = document.createElement('div');
        statsRow.style.display = 'grid';
        statsRow.style.gridTemplateColumns = 'repeat(4, 1fr)';
        statsRow.style.gap = '8px';

        const statData = [
            { label: 'Total Patients', value: data.length, color: COLORS.accent },
            { label: 'Events', value: events, color: COLORS.deceased },
            { label: 'Median Survival', value: medSurv.toFixed(1) + ' mo', color: COLORS.alive },
            { label: 'Median Age', value: medAge + ' yr', color: COLORS.textBright },
        ];

        for (const s of statData) {
            const sc = document.createElement('div');
            Object.assign(sc.style, {
                background: 'rgba(100, 120, 255, 0.04)',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'center',
            });
            const val = document.createElement('div');
            val.textContent = s.value;
            Object.assign(val.style, {
                fontSize: '22px',
                fontWeight: '700',
                color: s.color,
                fontFamily: MONO,
            });
            const lbl = document.createElement('div');
            lbl.textContent = s.label;
            Object.assign(lbl.style, {
                fontSize: '10px',
                color: COLORS.textDim,
                marginTop: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
            });
            sc.appendChild(val);
            sc.appendChild(lbl);
            statsRow.appendChild(sc);
        }
        body.appendChild(statsRow);

        // Row 2: 3 mini charts
        const chartsRow = document.createElement('div');
        chartsRow.style.display = 'flex';
        chartsRow.style.gap = '8px';
        chartsRow.style.justifyContent = 'center';

        // Stage distribution
        const stageCanvas = this._createStageChart();
        chartsRow.appendChild(this._wrapChart(stageCanvas, 'Stage Distribution'));

        // Grade distribution
        const gradeCanvas = this._createGradeChart();
        chartsRow.appendChild(this._wrapChart(gradeCanvas, 'Grade Distribution'));

        // Gender donut
        const genderCanvas = this._createGenderDonut();
        chartsRow.appendChild(this._wrapChart(genderCanvas, 'Gender Split'));

        body.appendChild(chartsRow);

        // Row 3: Survival status bar
        const survCanvas = this._createSurvivalBar();
        body.appendChild(this._wrapChart(survCanvas, 'Survival Status'));

        card.appendChild(body);
        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);
    }

    _wrapChart(canvas, label) {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            background: 'rgba(100, 120, 255, 0.03)',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '8px',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: '1',
        });
        const lbl = document.createElement('div');
        lbl.textContent = label;
        Object.assign(lbl.style, {
            fontSize: '10px',
            color: COLORS.textDim,
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: FONT,
        });
        wrap.appendChild(lbl);
        wrap.appendChild(canvas);
        return wrap;
    }

    _countField(field, categories) {
        const counts = {};
        for (const cat of categories) counts[cat] = 0;
        counts['Unknown'] = 0;
        for (const p of this.clinical) {
            const val = p[field];
            if (!val) { counts['Unknown']++; continue; }
            const normalized = String(val).replace(/stage\s*/i, '').replace(/\s+/g, '').toUpperCase();
            let matched = false;
            for (const cat of categories) {
                if (normalized === cat.toUpperCase() || normalized.includes(cat.toUpperCase())) {
                    counts[cat]++;
                    matched = true;
                    break;
                }
            }
            if (!matched) counts['Unknown']++;
        }
        return counts;
    }

    _createStageChart() {
        const { canvas, ctx, w, h } = createHiDPICanvas(200, 150);
        const stages = ['I', 'II', 'III', 'IV'];
        const counts = this._countField('tumor_stage', stages);
        const values = stages.map(s => counts[s]);
        const max = Math.max(...values, 1);

        const margin = { top: 10, right: 10, bottom: 25, left: 30 };
        const plotW = w - margin.left - margin.right;
        const plotH = h - margin.top - margin.bottom;
        const barW = plotW / stages.length * 0.6;
        const gap = plotW / stages.length;

        ctx.fillStyle = COLORS.panelSolid;
        ctx.fillRect(0, 0, w, h);

        // Bars
        for (let i = 0; i < stages.length; i++) {
            const barH = (values[i] / max) * plotH;
            const x = margin.left + i * gap + (gap - barW) / 2;
            const y = margin.top + plotH - barH;

            ctx.fillStyle = COLORS.accent;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
            ctx.fill();

            // Count label
            ctx.fillStyle = COLORS.text;
            ctx.font = `bold 9px ${MONO}`;
            ctx.textAlign = 'center';
            ctx.fillText(values[i], x + barW / 2, y - 3);

            // Stage label
            ctx.fillStyle = COLORS.textDim;
            ctx.font = `10px ${MONO}`;
            ctx.fillText(stages[i], x + barW / 2, h - margin.bottom + 14);
        }

        // Y-axis line
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, margin.top + plotH);
        ctx.stroke();

        return canvas;
    }

    _createGradeChart() {
        const { canvas, ctx, w, h } = createHiDPICanvas(200, 150);
        const grades = ['G1', 'G2', 'G3', 'G4'];
        const counts = {};
        for (const g of grades) counts[g] = 0;
        for (const p of this.clinical) {
            const val = p.tumor_grade;
            if (val && grades.includes(val)) counts[val]++;
        }
        const values = grades.map(g => counts[g]);
        const max = Math.max(...values, 1);

        const margin = { top: 10, right: 10, bottom: 25, left: 30 };
        const plotW = w - margin.left - margin.right;
        const plotH = h - margin.top - margin.bottom;
        const barW = plotW / grades.length * 0.6;
        const gap = plotW / grades.length;

        ctx.fillStyle = COLORS.panelSolid;
        ctx.fillRect(0, 0, w, h);

        const barColors = [COLORS.altitude, COLORS.alive, COLORS.overlap, COLORS.ros];
        for (let i = 0; i < grades.length; i++) {
            const barH = (values[i] / max) * plotH;
            const x = margin.left + i * gap + (gap - barW) / 2;
            const y = margin.top + plotH - barH;

            ctx.fillStyle = barColors[i];
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
            ctx.fill();

            ctx.fillStyle = COLORS.text;
            ctx.font = `bold 9px ${MONO}`;
            ctx.textAlign = 'center';
            ctx.fillText(values[i], x + barW / 2, y - 3);

            ctx.fillStyle = COLORS.textDim;
            ctx.font = `10px ${MONO}`;
            ctx.fillText(grades[i], x + barW / 2, h - margin.bottom + 14);
        }

        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, margin.top + plotH);
        ctx.stroke();

        return canvas;
    }

    _createGenderDonut() {
        const { canvas, ctx, w, h } = createHiDPICanvas(200, 150);
        let male = 0, female = 0;
        for (const p of this.clinical) {
            if (p.gender === 'male') male++;
            else if (p.gender === 'female') female++;
        }
        const total = male + female || 1;

        ctx.fillStyle = COLORS.panelSolid;
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        const r = 50;
        const inner = 28;

        // Male arc
        const maleAngle = (male / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + maleAngle);
        ctx.closePath();
        ctx.fillStyle = COLORS.accent;
        ctx.fill();

        // Female arc
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, -Math.PI / 2 + maleAngle, -Math.PI / 2 + Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = COLORS.ros;
        ctx.fill();

        // Inner circle (donut hole)
        ctx.beginPath();
        ctx.arc(cx, cy, inner, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.panelSolid;
        ctx.fill();

        // Center text
        ctx.fillStyle = COLORS.textBright;
        ctx.font = `bold 11px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(total, cx, cy);

        // Legend
        const lx = 8;
        ctx.font = `9px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(lx, h - 28, 8, 8);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(`Male ${((male / total) * 100).toFixed(0)}%`, lx + 12, h - 28);

        ctx.fillStyle = COLORS.ros;
        ctx.fillRect(lx, h - 14, 8, 8);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(`Female ${((female / total) * 100).toFixed(0)}%`, lx + 12, h - 14);

        return canvas;
    }

    _createSurvivalBar() {
        const { canvas, ctx, w, h } = createHiDPICanvas(680, 50);
        let alive = 0, deceased = 0;
        for (const p of this.clinical) {
            if (p.OS_event === 1) deceased++;
            else alive++;
        }
        const total = alive + deceased || 1;
        const alivePct = alive / total;

        ctx.fillStyle = COLORS.panelSolid;
        ctx.fillRect(0, 0, w, h);

        const barY = 5;
        const barH = 22;
        const barW = w - 20;
        const x0 = 10;

        // Alive bar
        ctx.fillStyle = COLORS.alive;
        ctx.beginPath();
        ctx.roundRect(x0, barY, barW * alivePct, barH, [6, 0, 0, 6]);
        ctx.fill();

        // Deceased bar
        ctx.fillStyle = COLORS.deceased;
        ctx.beginPath();
        ctx.roundRect(x0 + barW * alivePct, barY, barW * (1 - alivePct), barH, [0, 6, 6, 0]);
        ctx.fill();

        // Labels
        ctx.fillStyle = COLORS.textBright;
        ctx.font = `bold 10px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(
            `Alive: ${alive} (${(alivePct * 100).toFixed(1)}%)`,
            x0 + 6, barY + barH + 6
        );
        ctx.textAlign = 'right';
        ctx.fillText(
            `Deceased: ${deceased} (${((1 - alivePct) * 100).toFixed(1)}%)`,
            x0 + barW - 6, barY + barH + 6
        );

        return canvas;
    }

    show() {
        this._buildDOM();
        this.overlay.style.display = 'flex';
    }

    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. GeneLeaderboard
// ═══════════════════════════════════════════════════════════════════════════

export class GeneLeaderboard {
    constructor(hazardRatios, correlations, geneAnnotations) {
        this.hazardRatios = hazardRatios;
        this.correlations = correlations;
        this.geneAnnotations = geneAnnotations || {};
        this.overlay = null;
        this._built = false;
        this._sortKey = 'hr';
        this._sortDir = -1; // -1 = descending
        this._rows = [];
        this._tableBody = null;
    }

    _buildRows() {
        const geneMap = buildGeneMap(this.hazardRatios);
        this._rows = [];

        for (const gene of ALL_GENES) {
            const info = geneMap[gene] || {};
            const ann = this.geneAnnotations[gene] || {};
            const degree = computeDegree(this.correlations, gene);
            const pathways = ann.pathways ? ann.pathways.length : 0;
            const drugs = ann.drugs || [];
            const isDruggable = drugs.length > 0 && !drugs.every(d => d.includes('No direct'));

            this._rows.push({
                gene,
                signature: info.signature || geneSignature(gene),
                hr: info.hazard_ratio || 0,
                coef: Math.abs(info.coef || 0),
                degree,
                druggable: isDruggable,
                pathways,
            });
        }

        this._applySort();
    }

    _applySort() {
        const key = this._sortKey;
        const dir = this._sortDir;
        this._rows.sort((a, b) => {
            let va = a[key], vb = b[key];
            if (typeof va === 'boolean') { va = va ? 1 : 0; vb = vb ? 1 : 0; }
            return (va - vb) * dir;
        });
    }

    _buildDOM() {
        if (this._built) return;
        this._built = true;
        this._buildRows();

        this.overlay = createOverlay(() => this.hide());
        const card = createCard('780px', '85vh');

        card.appendChild(createCloseBtn(() => this.hide()));
        card.appendChild(createTitle('Gene Ranking Leaderboard'));

        // Metric selector
        const selector = document.createElement('div');
        Object.assign(selector.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '10px',
            flexWrap: 'wrap',
        });
        const label = document.createElement('span');
        label.textContent = 'Rank by:';
        Object.assign(label.style, { fontSize: '11px', color: COLORS.textDim, fontFamily: MONO });
        selector.appendChild(label);

        const metrics = [
            { key: 'hr', label: 'HR' },
            { key: 'coef', label: 'Coefficient' },
            { key: 'degree', label: 'Degree' },
            { key: 'druggable', label: 'Druggability' },
        ];
        for (const m of metrics) {
            const btn = document.createElement('button');
            btn.textContent = m.label;
            btn.dataset.key = m.key;
            Object.assign(btn.style, {
                fontSize: '10px',
                padding: '3px 10px',
                borderRadius: '12px',
                border: `1px solid ${COLORS.border}`,
                background: m.key === this._sortKey ? COLORS.accent + '30' : 'transparent',
                color: m.key === this._sortKey ? COLORS.accent : COLORS.textDim,
                cursor: 'pointer',
                fontFamily: MONO,
            });
            btn.addEventListener('click', () => {
                this._sortKey = m.key;
                this._sortDir = -1;
                this._applySort();
                this._renderTable();
                // Update button styles
                selector.querySelectorAll('button').forEach(b => {
                    const active = b.dataset.key === m.key;
                    b.style.background = active ? COLORS.accent + '30' : 'transparent';
                    b.style.color = active ? COLORS.accent : COLORS.textDim;
                });
            });
            selector.appendChild(btn);
        }
        card.appendChild(selector);

        // Table container
        const tableWrap = document.createElement('div');
        tableWrap.style.overflow = 'auto';
        tableWrap.style.flex = '1';

        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
            fontFamily: MONO,
        });

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const columns = [
            { key: null, label: '#', width: '30px' },
            { key: null, label: 'Gene', width: '70px' },
            { key: null, label: 'Signature', width: '90px' },
            { key: 'hr', label: 'HR', width: '60px' },
            { key: 'coef', label: '|Coef|', width: '60px' },
            { key: 'degree', label: 'Degree', width: '55px' },
            { key: 'druggable', label: 'Druggable', width: '65px' },
            { key: 'pathways', label: 'Pathways', width: '60px' },
        ];

        for (const col of columns) {
            const th = document.createElement('th');
            th.textContent = col.label;
            Object.assign(th.style, {
                textAlign: 'left',
                padding: '6px 6px',
                borderBottom: `1px solid ${COLORS.border}`,
                color: COLORS.textDim,
                fontSize: '9px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                width: col.width,
                cursor: col.key ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                userSelect: 'none',
            });
            if (col.key) {
                th.addEventListener('click', () => {
                    if (this._sortKey === col.key) {
                        this._sortDir *= -1;
                    } else {
                        this._sortKey = col.key;
                        this._sortDir = -1;
                    }
                    this._applySort();
                    this._renderTable();
                    // Update arrows
                    thead.querySelectorAll('th').forEach(t => {
                        const colDef = columns.find(c => c.label === t.textContent.replace(/[^a-zA-Z|]/g, ''));
                        if (!colDef) return;
                    });
                    this._updateHeaderArrows(thead, columns);
                });
            }
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        this._tableBody = document.createElement('tbody');
        table.appendChild(this._tableBody);
        this._thead = thead;
        this._columns = columns;

        this._renderTable();

        tableWrap.appendChild(table);
        card.appendChild(tableWrap);
        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);
    }

    _updateHeaderArrows(thead, columns) {
        const ths = thead.querySelectorAll('th');
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            let text = col.label;
            if (col.key === this._sortKey) {
                text += this._sortDir === -1 ? ' \u25BC' : ' \u25B2';
            }
            ths[i].textContent = text;
        }
    }

    _renderTable() {
        if (!this._tableBody) return;
        this._tableBody.innerHTML = '';
        this._updateHeaderArrows(this._thead, this._columns);

        const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

        for (let i = 0; i < this._rows.length; i++) {
            const row = this._rows[i];
            const tr = document.createElement('tr');

            // Colored left border by signature
            const borderColor = row.gene === 'HMOX1' ? COLORS.overlap
                : geneSignature(row.gene) === 'altitude' ? COLORS.altitude
                : COLORS.ros;

            Object.assign(tr.style, {
                borderLeft: `3px solid ${borderColor}`,
                background: i === 0 ? `${COLORS.accent}10` : 'transparent',
                boxShadow: i === 0 ? `inset 0 0 20px ${COLORS.accent}08` : 'none',
            });

            tr.addEventListener('mouseenter', () => {
                if (i !== 0) tr.style.background = 'rgba(255,255,255,0.02)';
            });
            tr.addEventListener('mouseleave', () => {
                tr.style.background = i === 0 ? `${COLORS.accent}10` : 'transparent';
            });

            const cells = [
                i < 3 ? `${medals[i]} ${i + 1}` : String(i + 1),
                row.gene,
                this._sigLabel(row.signature),
                row.hr.toFixed(3),
                row.coef.toFixed(3),
                String(row.degree),
                row.druggable ? 'Yes' : 'No',
                String(row.pathways),
            ];

            for (let c = 0; c < cells.length; c++) {
                const td = document.createElement('td');
                Object.assign(td.style, {
                    padding: '5px 6px',
                    borderBottom: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    whiteSpace: 'nowrap',
                });

                if (c === 1) {
                    td.style.color = geneColor(row.gene);
                    td.style.fontWeight = '600';
                } else if (c === 2) {
                    td.style.color = sigColor(row.signature);
                    td.style.fontSize = '9px';
                } else if (c === 6) {
                    td.style.color = row.druggable ? COLORS.altitude : COLORS.textDim;
                }

                td.textContent = cells[c];
                tr.appendChild(td);
            }

            this._tableBody.appendChild(tr);
        }
    }

    _sigLabel(sig) {
        if (!sig) return 'Unknown';
        if (sig.toLowerCase().includes('altitude')) return 'Altitude';
        if (sig.toLowerCase().includes('ros') || sig.toLowerCase().includes('ferroptosis')) return 'ROS';
        return sig;
    }

    show() {
        this._buildDOM();
        this.overlay.style.display = 'flex';
    }

    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. VolcanoPlot
// ═══════════════════════════════════════════════════════════════════════════

export class VolcanoPlot {
    constructor(expression, riskScores) {
        this.expression = expression || {};
        this.riskScores = riskScores || {};
        this.overlay = null;
        this._built = false;
        this._tooltip = null;
        this._points = [];
    }

    _computePoints(signatureName) {
        // Determine high/low risk groups
        const sigKey = signatureName || Object.keys(this.riskScores)[0] || '';
        const scores = this.riskScores[sigKey]?.scores || this.riskScores[sigKey] || {};
        const patientIds = Object.keys(scores);
        if (!patientIds.length) return [];

        const scoreArr = patientIds.map(id => ({ id, score: scores[id] }));
        const med = median(scoreArr.map(s => s.score));
        const highGroup = scoreArr.filter(s => s.score >= med).map(s => s.id);
        const lowGroup = scoreArr.filter(s => s.score < med).map(s => s.id);

        const points = [];
        for (const gene of ALL_GENES) {
            const highVals = [];
            const lowVals = [];
            for (const id of highGroup) {
                if (this.expression[id] && this.expression[id][gene] != null) {
                    highVals.push(this.expression[id][gene]);
                }
            }
            for (const id of lowGroup) {
                if (this.expression[id] && this.expression[id][gene] != null) {
                    lowVals.push(this.expression[id][gene]);
                }
            }

            if (!highVals.length || !lowVals.length) continue;

            const meanH = mean(highVals);
            const meanL = mean(lowVals);
            const fc = meanL > 0 ? Math.log2(meanH / meanL) : 0;
            const p = tTest(highVals, lowVals);
            const negLogP = p > 0 ? -Math.log10(p) : 16;

            points.push({
                gene,
                fc: isFinite(fc) ? fc : 0,
                p,
                negLogP: Math.min(negLogP, 16),
            });
        }
        return points;
    }

    _buildDOM() {
        if (this._built) return;
        this._built = true;

        this.overlay = createOverlay(() => this.hide());
        const card = createCard('580px');
        card.appendChild(createCloseBtn(() => this.hide()));
        this._titleEl = createTitle('Differential Expression: High-Risk vs Low-Risk');
        card.appendChild(this._titleEl);

        const { canvas, ctx, w, h } = createHiDPICanvas(550, 450);
        this._canvas = canvas;
        this._ctx = ctx;
        this._w = w;
        this._h = h;

        // Tooltip
        this._tooltip = document.createElement('div');
        Object.assign(this._tooltip.style, {
            position: 'absolute',
            display: 'none',
            background: COLORS.panelSolid,
            border: `1px solid ${COLORS.borderBright}`,
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '10px',
            fontFamily: MONO,
            color: COLORS.text,
            pointerEvents: 'none',
            zIndex: '20',
            whiteSpace: 'nowrap',
        });

        const canvasWrap = document.createElement('div');
        canvasWrap.style.position = 'relative';
        canvasWrap.appendChild(canvas);
        canvasWrap.appendChild(this._tooltip);

        canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        canvas.addEventListener('mouseleave', () => {
            this._tooltip.style.display = 'none';
        });

        card.appendChild(canvasWrap);
        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);
    }

    _draw() {
        const ctx = this._ctx;
        const w = this._w, h = this._h;
        const points = this._points;

        ctx.fillStyle = COLORS.panelSolid;
        ctx.fillRect(0, 0, w, h);

        if (!points.length) {
            ctx.fillStyle = COLORS.textDim;
            ctx.font = `14px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.fillText('No data available', w / 2, h / 2);
            return;
        }

        const margin = { top: 20, right: 30, bottom: 50, left: 60 };
        const plotW = w - margin.left - margin.right;
        const plotH = h - margin.top - margin.bottom;

        const maxFC = Math.max(2, ...points.map(p => Math.abs(p.fc))) * 1.2;
        const maxNLP = Math.max(4, ...points.map(p => p.negLogP)) * 1.1;

        const xScale = (fc) => margin.left + ((fc + maxFC) / (2 * maxFC)) * plotW;
        const yScale = (nlp) => margin.top + plotH - (nlp / maxNLP) * plotH;

        // Store for hit detection
        this._plotInfo = { margin, plotW, plotH, maxFC, maxNLP, xScale, yScale };

        // Grid
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const y = margin.top + (plotH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(margin.left + plotW, y);
            ctx.stroke();
        }

        // Dashed threshold lines
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = COLORS.textDim;
        ctx.lineWidth = 1;

        // Horizontal: -log10(0.05) = 1.3
        const sigY = yScale(1.3);
        ctx.beginPath();
        ctx.moveTo(margin.left, sigY);
        ctx.lineTo(margin.left + plotW, sigY);
        ctx.stroke();

        // Vertical: FC = -0.5 and +0.5
        const leftLine = xScale(-0.5);
        const rightLine = xScale(0.5);
        ctx.beginPath();
        ctx.moveTo(leftLine, margin.top);
        ctx.lineTo(leftLine, margin.top + plotH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightLine, margin.top);
        ctx.lineTo(rightLine, margin.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Points
        this._drawnPoints = [];
        for (const pt of points) {
            const px = xScale(pt.fc);
            const py = yScale(pt.negLogP);
            const sig = pt.p < 0.05;
            let color = COLORS.textDim;
            if (sig && pt.fc > 0.5) color = COLORS.ros;
            else if (sig && pt.fc < -0.5) color = COLORS.alive;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();

            this._drawnPoints.push({ ...pt, px, py, color });

            // Label significant points
            if (sig && Math.abs(pt.fc) > 0.5) {
                ctx.fillStyle = COLORS.text;
                ctx.font = `9px ${MONO}`;
                ctx.textAlign = pt.fc > 0 ? 'left' : 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(pt.gene, px + (pt.fc > 0 ? 6 : -6), py - 4);
            }
        }

        // Axes
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, margin.top + plotH);
        ctx.lineTo(margin.left + plotW, margin.top + plotH);
        ctx.stroke();

        // Axis labels
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `10px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('log2(Fold Change)', margin.left + plotW / 2, margin.top + plotH + 18);

        // X tick labels
        const xTicks = [-2, -1, -0.5, 0, 0.5, 1, 2].filter(v => Math.abs(v) <= maxFC);
        for (const v of xTicks) {
            const x = xScale(v);
            ctx.fillText(v.toString(), x, margin.top + plotH + 4);
        }

        // Y axis label
        ctx.save();
        ctx.translate(14, margin.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('-log10(p)', 0, 0);
        ctx.restore();

        // Y tick labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const yStep = Math.ceil(maxNLP / 4);
        for (let v = 0; v <= maxNLP; v += yStep) {
            ctx.fillText(v.toFixed(0), margin.left - 6, yScale(v));
        }

        // Threshold labels
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `8px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText('p=0.05', margin.left + plotW + 3, sigY);
    }

    _onMouseMove(e) {
        const rect = this._canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (!this._drawnPoints) return;

        let closest = null;
        let minDist = 15;
        for (const pt of this._drawnPoints) {
            const d = Math.sqrt((mx - pt.px) ** 2 + (my - pt.py) ** 2);
            if (d < minDist) {
                minDist = d;
                closest = pt;
            }
        }

        if (closest) {
            this._tooltip.style.display = 'block';
            this._tooltip.style.left = (closest.px + 12) + 'px';
            this._tooltip.style.top = (closest.py - 10) + 'px';
            this._tooltip.innerHTML =
                `<span style="color:${geneColor(closest.gene)};font-weight:600">${closest.gene}</span><br>` +
                `FC: ${closest.fc.toFixed(3)}<br>` +
                `p: ${closest.p < 0.001 ? '< 0.001' : closest.p.toFixed(4)}`;
        } else {
            this._tooltip.style.display = 'none';
        }
    }

    show(signatureName) {
        this._buildDOM();
        this._points = this._computePoints(signatureName);
        this._draw();
        this.overlay.style.display = 'flex';
    }

    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. SankeyDiagram
// ═══════════════════════════════════════════════════════════════════════════

export class SankeyDiagram {
    constructor(patients) {
        this.patients = patients || [];
        this.overlay = null;
        this._built = false;
    }

    _buildDOM() {
        if (this._built) return;
        this._built = true;

        this.overlay = createOverlay(() => this.hide());
        const card = createCard('680px');
        card.appendChild(createCloseBtn(() => this.hide()));
        card.appendChild(createTitle('Patient Flow: Risk Stratification to Clinical Outcome'));

        const { canvas, ctx, w, h } = createHiDPICanvas(650, 450);
        this._canvas = canvas;
        this._ctx = ctx;
        this._w = w;
        this._h = h;

        card.appendChild(canvas);
        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);

        this._draw();
    }

    _draw() {
        const ctx = this._ctx;
        const w = this._w, h = this._h;
        const patients = this.patients;

        ctx.fillStyle = COLORS.panelSolid;
        ctx.fillRect(0, 0, w, h);

        if (!patients.length) {
            ctx.fillStyle = COLORS.textDim;
            ctx.font = `14px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.fillText('No patient data', w / 2, h / 2);
            return;
        }

        // Compute risk group medians to classify
        const rosScores = patients.map(p => p.rosScore || 0);
        const altScores = patients.map(p => p.altScore || 0);
        const rosMed = median(rosScores);
        const altMed = median(altScores);

        // Categorize patients
        const groups = {
            'HIGH-HIGH': [], 'HIGH-LOW': [], 'LOW-HIGH': [], 'LOW-LOW': []
        };
        const stages = {};
        const outcomes = { 'Alive': [], 'Deceased': [] };

        for (const p of patients) {
            const rosHigh = (p.rosScore || 0) >= rosMed;
            const altHigh = (p.altScore || 0) >= altMed;
            const gKey = `${rosHigh ? 'HIGH' : 'LOW'}-${altHigh ? 'HIGH' : 'LOW'}`;
            groups[gKey].push(p);

            const st = p.stage || 'Unknown';
            const stNorm = this._normalizeStage(st);
            if (!stages[stNorm]) stages[stNorm] = [];
            stages[stNorm].push(p);

            const outKey = p.isDeceased ? 'Deceased' : 'Alive';
            outcomes[outKey].push(p);
        }

        // Layout columns
        const colX = [60, w / 2 - 30, w - 120];
        const nodeH = 28;
        const colPad = 30;

        // Define node arrays
        const leftNodes = Object.entries(groups).map(([k, v]) => ({ label: k, count: v.length }));
        const stageOrder = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unknown'];
        const midNodes = stageOrder.filter(s => stages[s] && stages[s].length > 0)
            .map(s => ({ label: s, count: stages[s].length }));
        const rightNodes = Object.entries(outcomes).map(([k, v]) => ({ label: k, count: v.length }));

        // Position nodes vertically
        const positionNodes = (nodes, x, colWidth) => {
            const totalCount = nodes.reduce((s, n) => s + n.count, 0) || 1;
            const availH = h - colPad * 2;
            let y = colPad;
            for (const node of nodes) {
                const nh = Math.max(nodeH, (node.count / totalCount) * availH * 0.8);
                node.x = x;
                node.y = y;
                node.w = colWidth;
                node.h = nh;
                y += nh + 8;
            }
        };

        positionNodes(leftNodes, colX[0], 90);
        positionNodes(midNodes, colX[1], 80);
        positionNodes(rightNodes, colX[2], 80);

        // Compute flows: left -> middle
        const flowsLM = [];
        for (const [gKey, gPatients] of Object.entries(groups)) {
            const leftNode = leftNodes.find(n => n.label === gKey);
            const stageCounts = {};
            for (const p of gPatients) {
                const st = this._normalizeStage(p.stage || 'Unknown');
                stageCounts[st] = (stageCounts[st] || 0) + 1;
            }
            for (const [st, cnt] of Object.entries(stageCounts)) {
                const midNode = midNodes.find(n => n.label === st);
                if (midNode) flowsLM.push({ from: leftNode, to: midNode, count: cnt });
            }
        }

        // Compute flows: middle -> right
        const flowsMR = [];
        for (const stKey of stageOrder) {
            if (!stages[stKey]) continue;
            const midNode = midNodes.find(n => n.label === stKey);
            let alive = 0, deceased = 0;
            for (const p of stages[stKey]) {
                if (p.isDeceased) deceased++; else alive++;
            }
            if (alive > 0) flowsMR.push({ from: midNode, to: rightNodes.find(n => n.label === 'Alive'), count: alive });
            if (deceased > 0) flowsMR.push({ from: midNode, to: rightNodes.find(n => n.label === 'Deceased'), count: deceased });
        }

        // Draw flows
        const drawFlows = (flows, fromSide, toSide) => {
            // Track offsets within each node for stacking bands
            const fromOffsets = new Map();
            const toOffsets = new Map();

            for (const flow of flows) {
                if (!flow.from || !flow.to || flow.count === 0) continue;

                const fromOff = fromOffsets.get(flow.from) || 0;
                const toOff = toOffsets.get(flow.to) || 0;

                const fromTotal = flow.from.count || 1;
                const toTotal = flow.to.count || 1;

                const bandHFrom = (flow.count / fromTotal) * flow.from.h;
                const bandHTo = (flow.count / toTotal) * flow.to.h;

                const x1 = flow.from.x + flow.from.w;
                const y1 = flow.from.y + fromOff;
                const x2 = flow.to.x;
                const y2 = flow.to.y + toOff;

                const cpx = (x1 + x2) / 2;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.bezierCurveTo(cpx, y1, cpx, y2, x2, y2);
                ctx.lineTo(x2, y2 + bandHTo);
                ctx.bezierCurveTo(cpx, y2 + bandHTo, cpx, y1 + bandHFrom, x1, y1 + bandHFrom);
                ctx.closePath();

                const fromColor = this._nodeColor(flow.from.label);
                const toColor = this._nodeColor(flow.to.label);
                ctx.fillStyle = blendColors(fromColor, toColor, 0.5, 0.25);
                ctx.fill();

                // Count label on band
                if (flow.count > 2) {
                    const labelX = (x1 + x2) / 2;
                    const labelY = (y1 + bandHFrom / 2 + y2 + bandHTo / 2) / 2;
                    ctx.fillStyle = COLORS.textDim;
                    ctx.font = `8px ${MONO}`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(flow.count, labelX, labelY);
                }

                fromOffsets.set(flow.from, fromOff + bandHFrom);
                toOffsets.set(flow.to, toOff + bandHTo);
            }
        };

        drawFlows(flowsLM);
        drawFlows(flowsMR);

        // Draw nodes
        const drawNodes = (nodes) => {
            for (const node of nodes) {
                const color = this._nodeColor(node.label);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.roundRect(node.x, node.y, node.w, node.h, 4);
                ctx.fill();

                ctx.fillStyle = COLORS.textBright;
                ctx.font = `bold 9px ${MONO}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const centerY = node.y + node.h / 2;
                ctx.fillText(node.label, node.x + node.w / 2, centerY - 6);
                ctx.font = `8px ${MONO}`;
                ctx.fillStyle = COLORS.text;
                ctx.fillText(`n=${node.count}`, node.x + node.w / 2, centerY + 8);
            }
        };

        drawNodes(leftNodes);
        drawNodes(midNodes);
        drawNodes(rightNodes);

        // Column headers
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `10px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Risk Group', colX[0] + 45, 8);
        ctx.fillText('Stage', colX[1] + 40, 8);
        ctx.fillText('Outcome', colX[2] + 40, 8);
    }

    _normalizeStage(raw) {
        if (!raw) return 'Unknown';
        const s = String(raw).toUpperCase().replace(/STAGE\s*/i, '').trim();
        if (s.startsWith('IV') || s === '4') return 'Stage IV';
        if (s.startsWith('III') || s === '3') return 'Stage III';
        if (s.startsWith('II') || s === '2') return 'Stage II';
        if (s.startsWith('I') || s === '1') return 'Stage I';
        return 'Unknown';
    }

    _nodeColor(label) {
        if (label === 'HIGH-HIGH') return '#ef4444';
        if (label === 'HIGH-LOW') return '#f97316';
        if (label === 'LOW-HIGH') return '#eab308';
        if (label === 'LOW-LOW') return '#22c55e';
        if (label === 'Alive') return COLORS.alive;
        if (label === 'Deceased') return COLORS.deceased;
        if (label.includes('IV')) return '#ef4444';
        if (label.includes('III')) return '#f97316';
        if (label.includes('II')) return '#eab308';
        if (label.includes('I')) return '#22c55e';
        return COLORS.textDim;
    }

    show() {
        this._buildDOM();
        this.overlay.style.display = 'flex';
    }

    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. RadarChart
// ═══════════════════════════════════════════════════════════════════════════

export class RadarChart {
    constructor() {
        this.overlay = null;
        this._built = false;
        this._titleEl = null;
    }

    _buildDOM() {
        if (this._built) return;
        this._built = true;

        this.overlay = createOverlay(() => this.hide());
        const card = createCard('480px');
        card.appendChild(createCloseBtn(() => this.hide()));

        this._titleEl = createTitle('Radar Profile');
        card.appendChild(this._titleEl);

        const { canvas, ctx, w, h } = createHiDPICanvas(450, 450);
        this._canvas = canvas;
        this._ctx = ctx;
        this._w = w;
        this._h = h;

        card.appendChild(canvas);

        // Legend container
        this._legend = document.createElement('div');
        Object.assign(this._legend.style, {
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            marginTop: '8px',
            fontSize: '10px',
            fontFamily: MONO,
        });
        card.appendChild(this._legend);

        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);
    }

    _drawRadar(datasets, labels, axisLabels) {
        const ctx = this._ctx;
        const w = this._w, h = this._h;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 60;
        const n = axisLabels.length;
        const angleStep = (Math.PI * 2) / n;

        ctx.fillStyle = COLORS.panelSolid;
        ctx.fillRect(0, 0, w, h);

        // Draw concentric rings
        for (let ring = 1; ring <= 5; ring++) {
            const rr = (ring / 5) * r;
            ctx.strokeStyle = COLORS.grid;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const angle = -Math.PI / 2 + i * angleStep;
                const x = cx + Math.cos(angle) * rr;
                const y = cy + Math.sin(angle) * rr;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Axis lines
        for (let i = 0; i < n; i++) {
            const angle = -Math.PI / 2 + i * angleStep;
            ctx.strokeStyle = COLORS.border;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
            ctx.stroke();
        }

        // Axis labels
        ctx.fillStyle = COLORS.text;
        ctx.font = `10px ${MONO}`;
        ctx.textBaseline = 'middle';
        for (let i = 0; i < n; i++) {
            const angle = -Math.PI / 2 + i * angleStep;
            const lx = cx + Math.cos(angle) * (r + 20);
            const ly = cy + Math.sin(angle) * (r + 20);
            ctx.textAlign = Math.abs(Math.cos(angle)) < 0.1 ? 'center'
                : Math.cos(angle) > 0 ? 'left' : 'right';
            ctx.fillText(axisLabels[i], lx, ly);
        }

        // Draw polygons
        const colors = [COLORS.accent, COLORS.ros, COLORS.altitude];
        for (let d = 0; d < datasets.length; d++) {
            const data = datasets[d];
            const color = colors[d % colors.length];

            // Filled polygon
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const angle = -Math.PI / 2 + i * angleStep;
                const val = Math.max(0, Math.min(1, data[i] || 0));
                const x = cx + Math.cos(angle) * val * r;
                const y = cy + Math.sin(angle) * val * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = color + '25';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Data points
            for (let i = 0; i < n; i++) {
                const angle = -Math.PI / 2 + i * angleStep;
                const val = Math.max(0, Math.min(1, data[i] || 0));
                const x = cx + Math.cos(angle) * val * r;
                const y = cy + Math.sin(angle) * val * r;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Legend
        this._legend.innerHTML = '';
        for (let d = 0; d < labels.length; d++) {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '4px';

            const swatch = document.createElement('div');
            Object.assign(swatch.style, {
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: colors[d % colors.length],
            });

            const lbl = document.createElement('span');
            lbl.textContent = labels[d];
            lbl.style.color = COLORS.text;

            item.appendChild(swatch);
            item.appendChild(lbl);
            this._legend.appendChild(item);
        }
    }

    showGeneProfile(geneData, geneAnnotations) {
        this._buildDOM();

        // geneData: { gene, hazard_ratio, coef, signature }
        const ann = (geneAnnotations || {})[geneData.gene] || {};
        const axisLabels = ['HR', '|Coef|', 'Degree', 'Pathways', 'Drugs', 'Expression'];

        // Normalize to 0-1 ranges (approximate cohort ranges)
        const hr = geneData.hazard_ratio || 1;
        const hrNorm = Math.min(1, Math.max(0, (hr - 0.5) / 1.5));
        const coefNorm = Math.min(1, Math.abs(geneData.coef || 0) / 0.6);
        const degreeNorm = Math.min(1, (geneData.degree || 0) / 10);
        const pathways = ann.pathways ? ann.pathways.length : 0;
        const pathNorm = Math.min(1, pathways / 8);
        const drugs = ann.drugs ? ann.drugs.length : 0;
        const drugNorm = Math.min(1, drugs / 6);
        const exprNorm = geneData.expressionNorm || 0.5;

        const data = [hrNorm, coefNorm, degreeNorm, pathNorm, drugNorm, exprNorm];

        this._titleEl.textContent = `Gene Profile: ${geneData.gene}`;
        this._drawRadar([data], [geneData.gene], axisLabels);
        this.overlay.style.display = 'flex';
    }

    showPatientProfile(patientData) {
        this._buildDOM();

        // patientData: { id, rosRisk, altRisk, survival, stage, age, geneExpr }
        const axisLabels = ['ROS Risk', 'Altitude Risk', 'Survival', 'Stage', 'Age', 'Gene Expr'];

        const data = [
            patientData.rosRisk || 0,
            patientData.altRisk || 0,
            patientData.survival || 0,
            patientData.stage || 0,
            patientData.age || 0,
            patientData.geneExpr || 0,
        ];

        this._titleEl.textContent = `Patient Profile: ${patientData.id || 'Unknown'}`;
        this._drawRadar([data], [patientData.id || 'Patient'], axisLabels);
        this.overlay.style.display = 'flex';
    }

    showComparison(data1, data2, labels) {
        this._buildDOM();

        // data1/data2: { values: [0-1 array], axisLabels: [...] }
        const axisLabels = data1.axisLabels || data2.axisLabels || [];

        this._titleEl.textContent = `Comparison: ${labels[0]} vs ${labels[1]}`;
        this._drawRadar([data1.values, data2.values], labels, axisLabels);
        this.overlay.style.display = 'flex';
    }

    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. CorrelationMatrix
// ═══════════════════════════════════════════════════════════════════════════

export class CorrelationMatrix {
    constructor(correlations, geneAnnotations) {
        this.correlations = correlations;
        this.geneAnnotations = geneAnnotations || {};
        this.overlay = null;
        this._built = false;
        this.onCellClick = null;
        this._tooltip = null;
    }

    _buildFullMatrix() {
        // Build ordered gene list: altitude first, then ROS
        const genes = [...ALTITUDE_GENES.filter(g => g !== 'HMOX1'), 'HMOX1', ...ROS_GENES.filter(g => g !== 'HMOX1')];
        // Deduplicate
        const seen = new Set();
        this._genes = [];
        for (const g of genes) {
            if (!seen.has(g)) {
                seen.add(g);
                this._genes.push(g);
            }
        }

        // Build full NxN matrix
        const n = this._genes.length;
        this._matrix = [];
        for (let i = 0; i < n; i++) {
            this._matrix[i] = [];
            for (let j = 0; j < n; j++) {
                if (i === j) {
                    this._matrix[i][j] = 1.0;
                } else {
                    const r = getCorrelation(this.correlations, this._genes[i], this._genes[j]);
                    this._matrix[i][j] = r != null ? r : 0;
                }
            }
        }

        // Divider index: where altitude ends
        this._dividerIdx = ALTITUDE_GENES.length;
    }

    _buildDOM() {
        if (this._built) return;
        this._built = true;
        this._buildFullMatrix();

        this.overlay = createOverlay(() => this.hide());
        const card = createCard('580px');
        card.appendChild(createCloseBtn(() => this.hide()));
        card.appendChild(createTitle('Gene-Gene Correlation Matrix (Pearson r)'));

        const { canvas, ctx, w, h } = createHiDPICanvas(550, 550);
        this._canvas = canvas;
        this._ctx = ctx;
        this._w = w;
        this._h = h;

        // Tooltip
        this._tooltip = document.createElement('div');
        Object.assign(this._tooltip.style, {
            position: 'absolute',
            display: 'none',
            background: COLORS.panelSolid,
            border: `1px solid ${COLORS.borderBright}`,
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '10px',
            fontFamily: MONO,
            color: COLORS.text,
            pointerEvents: 'none',
            zIndex: '20',
            whiteSpace: 'nowrap',
        });

        const canvasWrap = document.createElement('div');
        canvasWrap.style.position = 'relative';
        canvasWrap.appendChild(canvas);
        canvasWrap.appendChild(this._tooltip);

        canvas.addEventListener('mousemove', (e) => this._onHover(e));
        canvas.addEventListener('mouseleave', () => {
            this._tooltip.style.display = 'none';
        });
        canvas.addEventListener('click', (e) => this._onClick(e));

        card.appendChild(canvasWrap);
        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);

        this._draw();
    }

    _rToColor(r) {
        // blue (-1) -> white (0) -> red (+1)
        const clamped = Math.max(-1, Math.min(1, r));
        if (clamped <= 0) {
            const t = (clamped + 1); // 0=blue, 1=white
            const rb = Math.round(59 + (255 - 59) * t);
            const g = Math.round(130 + (255 - 130) * t);
            const b = Math.round(246 + (255 - 246) * t);
            return `rgb(${rb},${g},${b})`;
        } else {
            const t = clamped; // 0=white, 1=red
            const rv = Math.round(255 + (239 - 255) * t);
            const g = Math.round(255 + (68 - 255) * t);
            const b = Math.round(255 + (68 - 255) * t);
            return `rgb(${rv},${g},${b})`;
        }
    }

    _draw() {
        const ctx = this._ctx;
        const w = this._w, h = this._h;
        const n = this._genes.length;

        ctx.fillStyle = COLORS.panelSolid;
        ctx.fillRect(0, 0, w, h);

        const margin = { top: 80, right: 50, bottom: 20, left: 80 };
        const plotW = w - margin.left - margin.right;
        const plotH = h - margin.top - margin.bottom;
        const cellW = plotW / n;
        const cellH = plotH / n;

        this._plotInfo = { margin, cellW, cellH, n };

        // Draw cells
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const r = this._matrix[i][j];
                const x = margin.left + j * cellW;
                const y = margin.top + i * cellH;

                ctx.fillStyle = i === j ? '#333340' : this._rToColor(r);
                ctx.fillRect(x, y, cellW, cellH);

                // Cell border
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, cellW, cellH);
            }
        }

        // Divider line
        const divX = margin.left + this._dividerIdx * cellW;
        const divY = margin.top + this._dividerIdx * cellH;

        ctx.strokeStyle = COLORS.overlap;
        ctx.lineWidth = 2;
        // Vertical divider
        ctx.beginPath();
        ctx.moveTo(divX, margin.top);
        ctx.lineTo(divX, margin.top + plotH);
        ctx.stroke();
        // Horizontal divider
        ctx.beginPath();
        ctx.moveTo(margin.left, divY);
        ctx.lineTo(margin.left + plotW, divY);
        ctx.stroke();

        // Gene labels - top (rotated)
        ctx.save();
        for (let j = 0; j < n; j++) {
            const gene = this._genes[j];
            const x = margin.left + j * cellW + cellW / 2;
            const y = margin.top - 4;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-Math.PI / 3);
            ctx.fillStyle = geneColor(gene);
            ctx.font = `bold 8px ${MONO}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(gene, 0, 0);
            ctx.restore();
        }
        ctx.restore();

        // Gene labels - left
        for (let i = 0; i < n; i++) {
            const gene = this._genes[i];
            const x = margin.left - 4;
            const y = margin.top + i * cellH + cellH / 2;
            ctx.fillStyle = geneColor(gene);
            ctx.font = `bold 8px ${MONO}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(gene, x, y);
        }

        // Color bar legend
        const barX = w - 40;
        const barY = margin.top;
        const barW = 12;
        const barH = plotH;

        for (let p = 0; p < barH; p++) {
            const r = 1 - (p / barH) * 2; // 1 at top, -1 at bottom
            ctx.fillStyle = this._rToColor(r);
            ctx.fillRect(barX, barY + p, barW, 1);
        }

        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = COLORS.text;
        ctx.font = `8px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('+1', barX + barW + 3, barY);
        ctx.textBaseline = 'middle';
        ctx.fillText('0', barX + barW + 3, barY + barH / 2);
        ctx.textBaseline = 'bottom';
        ctx.fillText('-1', barX + barW + 3, barY + barH);
    }

    _hitTest(e) {
        if (!this._plotInfo) return null;
        const rect = this._canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { margin, cellW, cellH, n } = this._plotInfo;

        const col = Math.floor((mx - margin.left) / cellW);
        const row = Math.floor((my - margin.top) / cellH);

        if (col >= 0 && col < n && row >= 0 && row < n) {
            return { row, col, gene1: this._genes[row], gene2: this._genes[col], r: this._matrix[row][col] };
        }
        return null;
    }

    _onHover(e) {
        const hit = this._hitTest(e);
        if (hit) {
            const rect = this._canvas.getBoundingClientRect();
            this._tooltip.style.display = 'block';
            this._tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
            this._tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
            this._tooltip.innerHTML =
                `<span style="color:${geneColor(hit.gene1)}">${hit.gene1}</span>` +
                ` x <span style="color:${geneColor(hit.gene2)}">${hit.gene2}</span>` +
                `: r = ${hit.r.toFixed(3)}`;
        } else {
            this._tooltip.style.display = 'none';
        }
    }

    _onClick(e) {
        const hit = this._hitTest(e);
        if (hit && hit.row !== hit.col && this.onCellClick) {
            this.onCellClick(hit.gene1, hit.gene2);
        }
    }

    show() {
        this._buildDOM();
        this.overlay.style.display = 'flex';
    }

    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
}
