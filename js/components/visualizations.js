/**
 * Visualization Components for HCC OmniScope
 * Three interactive modal visualizations: ExpressionHeatmap, SignatureVenn, PathwayDiagram.
 * Pure vanilla JS ES module, no external dependencies.
 */

const COLORS = {
    bg: 'rgba(10, 10, 26, 0.95)',
    panel: '#0c0c1e',
    border: 'rgba(100, 120, 255, 0.15)',
    borderBright: 'rgba(100, 120, 255, 0.3)',
    text: '#e0e0f0',
    textDim: '#8888aa',
    textBright: '#ffffff',
    accent: '#6c8cff',
    altitude: '#4ade80',
    ros: '#f87171',
    overlap: '#fbbf24',
    lowExpr: '#3b82f6',
    midExpr: '#ffffff',
    highExpr: '#ef4444',
};

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const ALTITUDE_GENES = ['GC', 'GRB2', 'LDHA', 'SENP1', 'CDC42', 'HMOX1', 'HK2', 'EPO', 'AEBP2'];
const ROS_GENES = ['TXNRD1', 'MAFG', 'G6PD', 'SQSTM1', 'SLC7A11', 'GSR', 'NCF2', 'MSRA', 'GLRX2', 'BACH1'];
const ALL_GENES = [...ALTITUDE_GENES, ...ROS_GENES];

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

function lerpColorCSS(c1, c2, t) {
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return `rgb(${r},${g},${b})`;
}

function expressionToColor(zScore) {
    const low = [59, 130, 246];
    const mid = [255, 255, 255];
    const high = [239, 68, 68];
    const clamped = Math.max(-3, Math.min(3, zScore));
    const t = (clamped + 3) / 6;
    if (t <= 0.5) {
        return lerpColorCSS(low, mid, t * 2);
    }
    return lerpColorCSS(mid, high, (t - 0.5) * 2);
}

function riskToColor(score, min, max) {
    const low = [59, 130, 246];
    const high = [239, 68, 68];
    const t = Math.max(0, Math.min(1, (score - min) / (max - min + 0.0001)));
    return lerpColorCSS(low, high, t);
}

function createCloseButton(onClick) {
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
        fontSize: '28px',
        cursor: 'pointer',
        lineHeight: '1',
        padding: '4px 8px',
        borderRadius: '6px',
        zIndex: '10',
    });
    btn.addEventListener('mouseenter', () => { btn.style.color = COLORS.textBright; });
    btn.addEventListener('mouseleave', () => { btn.style.color = COLORS.textDim; });
    btn.addEventListener('click', onClick);
    return btn;
}

function createOverlay(onBackdropClick) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '900',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.bg,
        fontFamily: FONT,
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) onBackdropClick();
    });
    return overlay;
}

function createCard() {
    const card = document.createElement('div');
    Object.assign(card.style, {
        position: 'relative',
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        maxHeight: '90vh',
        overflowY: 'auto',
    });
    return card;
}

// ---------------------------------------------------------------------------
// 1. ExpressionHeatmap
// ---------------------------------------------------------------------------

export class ExpressionHeatmap {
    /**
     * @param {object} expressionData - { patientId: { geneName: value, ... }, ... }
     * @param {object} riskScores - { "ROS/Ferroptosis": { scores: {...}, median: number } }
     * @param {object} geneAnnotations - { geneName: { signature, fullName, ... } }
     */
    constructor(expressionData, riskScores, geneAnnotations) {
        this.expressionData = expressionData || {};
        this.riskScores = riskScores || {};
        this.geneAnnotations = geneAnnotations || {};
        this.overlay = null;
        this.canvas = null;
        this.ctx = null;
        this.tooltip = null;
        this.visible = false;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.width = 700;
        this.height = 500;
        this.margin = { top: 60, right: 80, bottom: 50, left: 90 };

        this._sortedPatients = [];
        this._genes = [];
        this._zScores = {};
        this._riskMin = 0;
        this._riskMax = 1;
        this._riskMedian = 0.1;

        this._prepareData();
        this._buildDOM();
    }

    _prepareData() {
        // Get ROS risk scores
        const rosData = this.riskScores['ROS/Ferroptosis'] || {};
        const scores = rosData.scores || {};
        this._riskMedian = rosData.median ?? 0.1;

        // Sort patients by risk score
        const patients = Object.keys(scores);
        patients.sort((a, b) => scores[a] - scores[b]);
        this._sortedPatients = patients;

        if (patients.length === 0) return;

        const scoreValues = patients.map((p) => scores[p]);
        this._riskMin = Math.min(...scoreValues);
        this._riskMax = Math.max(...scoreValues);

        // Deduplicate gene list: altitude first, then ROS-only
        const seen = new Set();
        this._genes = [];
        for (const g of ALTITUDE_GENES) {
            if (!seen.has(g)) { this._genes.push(g); seen.add(g); }
        }
        for (const g of ROS_GENES) {
            if (!seen.has(g)) { this._genes.push(g); seen.add(g); }
        }

        // Compute z-scores per gene across patients
        for (const gene of this._genes) {
            const vals = [];
            for (const pid of patients) {
                const expr = this.expressionData[pid];
                const v = expr ? (expr[gene] ?? null) : null;
                vals.push(v);
            }
            const valid = vals.filter((v) => v !== null);
            const mean = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
            const variance = valid.length > 1
                ? valid.reduce((a, b) => a + (b - mean) ** 2, 0) / (valid.length - 1)
                : 1;
            const sd = Math.sqrt(variance) || 1;

            this._zScores[gene] = vals.map((v) => (v !== null ? (v - mean) / sd : 0));
        }
    }

    _buildDOM() {
        this.overlay = createOverlay(() => this.hide());
        this.card = createCard();
        Object.assign(this.card.style, { padding: '20px' });

        this.card.appendChild(createCloseButton(() => this.hide()));

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        Object.assign(this.canvas.style, {
            width: this.width + 'px',
            height: this.height + 'px',
            display: 'block',
            borderRadius: '4px',
        });
        this.ctx = this.canvas.getContext('2d');
        this.card.appendChild(this.canvas);

        // Tooltip
        this.tooltip = document.createElement('div');
        Object.assign(this.tooltip.style, {
            position: 'absolute',
            display: 'none',
            background: 'rgba(12,12,30,0.96)',
            border: `1px solid ${COLORS.borderBright}`,
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            color: COLORS.text,
            pointerEvents: 'none',
            zIndex: '1000',
            lineHeight: '1.5',
            maxWidth: '260px',
            fontFamily: FONT,
        });
        this.card.appendChild(this.tooltip);

        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.tooltip.style.display = 'none';
        });

        this.overlay.appendChild(this.card);
        document.body.appendChild(this.overlay);
    }

    _getPlotArea() {
        return {
            x: this.margin.left,
            y: this.margin.top,
            w: this.width - this.margin.left - this.margin.right,
            h: this.height - this.margin.top - this.margin.bottom,
        };
    }

    _render() {
        const ctx = this.ctx;
        const d = this.dpr;
        ctx.save();
        ctx.scale(d, d);
        ctx.clearRect(0, 0, this.width, this.height);

        // Background
        ctx.fillStyle = '#06060f';
        ctx.fillRect(0, 0, this.width, this.height);

        const patients = this._sortedPatients;
        const genes = this._genes;
        if (patients.length === 0 || genes.length === 0) {
            ctx.fillStyle = COLORS.textDim;
            ctx.font = `14px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.fillText('No data available', this.width / 2, this.height / 2);
            ctx.restore();
            return;
        }

        const plot = this._getPlotArea();
        const cellW = plot.w / patients.length;
        const cellH = (plot.h - 18) / genes.length; // reserve 18px for risk bar

        // Title
        ctx.fillStyle = COLORS.textBright;
        ctx.font = `bold 14px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('Signature Gene Expression Across 302 TCGA-LIHC Patients', this.width / 2, 24);

        // Subtitle
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `11px ${FONT}`;
        ctx.fillText('Patients sorted by ROS/Ferroptosis risk score (low \u2192 high)', this.width / 2, 42);

        // Draw heatmap cells
        for (let gi = 0; gi < genes.length; gi++) {
            const gene = genes[gi];
            const zArr = this._zScores[gene];
            const cy = plot.y + gi * cellH;
            for (let pi = 0; pi < patients.length; pi++) {
                ctx.fillStyle = expressionToColor(zArr[pi]);
                ctx.fillRect(plot.x + pi * cellW, cy, Math.ceil(cellW) + 0.5, Math.ceil(cellH) + 0.5);
            }
        }

        // Altitude / ROS section divider
        const altCount = ALTITUDE_GENES.length;
        const dividerY = plot.y + altCount * cellH;
        ctx.strokeStyle = COLORS.textDim;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(plot.x, dividerY);
        ctx.lineTo(plot.x + plot.w, dividerY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Section labels on far left
        ctx.save();
        ctx.font = `bold 9px ${FONT}`;
        ctx.textAlign = 'center';
        const altMidY = plot.y + (altCount * cellH) / 2;
        ctx.fillStyle = COLORS.altitude;
        ctx.translate(8, altMidY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('ALTITUDE', 0, 0);
        ctx.restore();

        ctx.save();
        const rosMidY = plot.y + altCount * cellH + ((genes.length - altCount) * cellH) / 2;
        ctx.font = `bold 9px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.ros;
        ctx.translate(8, rosMidY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('ROS', 0, 0);
        ctx.restore();

        // Gene labels on left
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let gi = 0; gi < genes.length; gi++) {
            const gene = genes[gi];
            ctx.fillStyle = geneColor(gene);
            const isBold = gene === 'HMOX1';
            ctx.font = `${isBold ? 'bold ' : ''}11px ${FONT}`;
            ctx.fillText(gene, plot.x - 6, plot.y + gi * cellH + cellH / 2);
        }

        // Risk score bar at bottom
        const riskBarY = plot.y + genes.length * cellH + 4;
        const riskBarH = 12;
        const rosData = this.riskScores['ROS/Ferroptosis'] || {};
        const scores = rosData.scores || {};
        for (let pi = 0; pi < patients.length; pi++) {
            const s = scores[patients[pi]] ?? 0;
            ctx.fillStyle = riskToColor(s, this._riskMin, this._riskMax);
            ctx.fillRect(plot.x + pi * cellW, riskBarY, Math.ceil(cellW) + 0.5, riskBarH);
        }

        // Risk bar label
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `9px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('Risk', plot.x - 6, riskBarY + 1);

        // Median vertical line
        const medianIdx = patients.findIndex((p) => (scores[p] ?? 0) >= this._riskMedian);
        if (medianIdx >= 0) {
            const medX = plot.x + medianIdx * cellW;
            ctx.strokeStyle = COLORS.overlap;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(medX, plot.y);
            ctx.lineTo(medX, riskBarY + riskBarH);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = COLORS.overlap;
            ctx.font = `9px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('median', medX, riskBarY + riskBarH + 2);
        }

        // Risk axis labels
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `9px ${FONT}`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText('Low risk', plot.x, riskBarY + riskBarH + 2);
        ctx.textAlign = 'right';
        ctx.fillText('High risk', plot.x + plot.w, riskBarY + riskBarH + 2);

        // Color bar legend on right
        const legendX = plot.x + plot.w + 10;
        const legendY = plot.y + 10;
        const legendH = 120;
        const legendW = 12;
        for (let i = 0; i < legendH; i++) {
            const z = 3 - (i / legendH) * 6;
            ctx.fillStyle = expressionToColor(z);
            ctx.fillRect(legendX, legendY + i, legendW, 1.5);
        }
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(legendX, legendY, legendW, legendH);

        ctx.fillStyle = COLORS.textDim;
        ctx.font = `9px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('High', legendX + legendW + 4, legendY - 2);
        ctx.fillText('Med', legendX + legendW + 4, legendY + legendH / 2 - 5);
        ctx.fillText('Low', legendX + legendW + 4, legendY + legendH - 10);

        ctx.fillStyle = COLORS.textDim;
        ctx.font = `bold 9px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('z-score', legendX + legendW / 2, legendY - 14);

        ctx.restore();
    }

    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const plot = this._getPlotArea();
        const patients = this._sortedPatients;
        const genes = this._genes;
        if (patients.length === 0 || genes.length === 0) return;

        const cellW = plot.w / patients.length;
        const cellH = (plot.h - 18) / genes.length;

        const pi = Math.floor((mx - plot.x) / cellW);
        const gi = Math.floor((my - plot.y) / cellH);

        if (pi < 0 || pi >= patients.length || gi < 0 || gi >= genes.length) {
            this.tooltip.style.display = 'none';
            return;
        }

        const gene = genes[gi];
        const patient = patients[pi];
        const zVal = this._zScores[gene][pi];
        const rawExpr = this.expressionData[patient]
            ? (this.expressionData[patient][gene] ?? 'N/A')
            : 'N/A';
        const rosData = this.riskScores['ROS/Ferroptosis'] || {};
        const risk = rosData.scores ? (rosData.scores[patient] ?? 'N/A') : 'N/A';

        const riskStr = typeof risk === 'number' ? risk.toFixed(3) : risk;
        const exprStr = typeof rawExpr === 'number' ? rawExpr.toFixed(2) : rawExpr;

        this.tooltip.innerHTML = [
            `<span style="color:${geneColor(gene)};font-weight:bold">${gene}</span>`,
            `Patient: <span style="color:${COLORS.accent}">${patient}</span>`,
            `Expression: ${exprStr}`,
            `z-score: ${zVal.toFixed(2)}`,
            `Risk score: ${riskStr}`,
        ].join('<br>');

        const tipX = Math.min(mx + 14, this.card.offsetWidth - 200);
        const tipY = Math.max(my - 60, 4);
        this.tooltip.style.left = tipX + 'px';
        this.tooltip.style.top = tipY + 'px';
        this.tooltip.style.display = 'block';
    }

    show() {
        this.overlay.style.display = 'flex';
        this.visible = true;
        this._render();
        this._escHandler = (e) => { if (e.key === 'Escape') this.hide(); };
        document.addEventListener('keydown', this._escHandler);
    }

    hide() {
        this.overlay.style.display = 'none';
        this.visible = false;
        this.tooltip.style.display = 'none';
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    }
}

// ---------------------------------------------------------------------------
// 2. SignatureVenn
// ---------------------------------------------------------------------------

export class SignatureVenn {
    constructor() {
        this.overlay = null;
        this.visible = false;
        this.onGeneClick = null;
        this._buildDOM();
    }

    _buildDOM() {
        this.overlay = createOverlay(() => this.hide());
        this.card = createCard();
        Object.assign(this.card.style, {
            padding: '24px',
            minWidth: '600px',
            maxWidth: '780px',
        });
        this.card.appendChild(createCloseButton(() => this.hide()));

        // Title
        const title = document.createElement('div');
        title.textContent = 'Two Prognostic Signatures, One Bridge Gene';
        Object.assign(title.style, {
            color: COLORS.textBright,
            fontSize: '16px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '4px',
            fontFamily: FONT,
        });
        this.card.appendChild(title);

        // Subtitle
        const subtitle = document.createElement('div');
        subtitle.textContent = 'Altitude C-index: 0.671 | ROS C-index: 0.700';
        Object.assign(subtitle.style, {
            color: COLORS.textDim,
            fontSize: '12px',
            textAlign: 'center',
            marginBottom: '16px',
            fontFamily: FONT,
        });
        this.card.appendChild(subtitle);

        // SVG container
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 700 400');
        svg.setAttribute('width', '100%');
        svg.style.display = 'block';
        svg.style.maxWidth = '700px';
        svg.style.margin = '0 auto';

        // Definitions for filters
        const defs = document.createElementNS(svgNS, 'defs');

        // Drop shadow filter
        const filter = document.createElementNS(svgNS, 'filter');
        filter.setAttribute('id', 'venn-glow');
        filter.setAttribute('x', '-20%');
        filter.setAttribute('y', '-20%');
        filter.setAttribute('width', '140%');
        filter.setAttribute('height', '140%');
        const blur = document.createElementNS(svgNS, 'feGaussianBlur');
        blur.setAttribute('stdDeviation', '3');
        blur.setAttribute('result', 'glow');
        filter.appendChild(blur);
        const merge = document.createElementNS(svgNS, 'feMerge');
        const mn1 = document.createElementNS(svgNS, 'feMergeNode');
        mn1.setAttribute('in', 'glow');
        const mn2 = document.createElementNS(svgNS, 'feMergeNode');
        mn2.setAttribute('in', 'SourceGraphic');
        merge.appendChild(mn1);
        merge.appendChild(mn2);
        filter.appendChild(merge);
        defs.appendChild(filter);
        svg.appendChild(defs);

        // Left circle (Altitude)
        const cxL = 270, cxR = 430, cy = 200, r = 160;

        const circleL = document.createElementNS(svgNS, 'ellipse');
        circleL.setAttribute('cx', cxL);
        circleL.setAttribute('cy', cy);
        circleL.setAttribute('rx', r);
        circleL.setAttribute('ry', r);
        circleL.setAttribute('fill', COLORS.altitude);
        circleL.setAttribute('fill-opacity', '0.15');
        circleL.setAttribute('stroke', COLORS.altitude);
        circleL.setAttribute('stroke-width', '1.5');
        circleL.setAttribute('stroke-opacity', '0.5');
        svg.appendChild(circleL);

        // Right circle (ROS)
        const circleR = document.createElementNS(svgNS, 'ellipse');
        circleR.setAttribute('cx', cxR);
        circleR.setAttribute('cy', cy);
        circleR.setAttribute('rx', r);
        circleR.setAttribute('ry', r);
        circleR.setAttribute('fill', COLORS.ros);
        circleR.setAttribute('fill-opacity', '0.15');
        circleR.setAttribute('stroke', COLORS.ros);
        circleR.setAttribute('stroke-width', '1.5');
        circleR.setAttribute('stroke-opacity', '0.5');
        svg.appendChild(circleR);

        // Overlap highlight
        // Use clip-path approach: draw a filled region for the intersection
        const overlapPath = document.createElementNS(svgNS, 'clipPath');
        overlapPath.setAttribute('id', 'clip-left');
        const clipCircle = document.createElementNS(svgNS, 'ellipse');
        clipCircle.setAttribute('cx', cxL);
        clipCircle.setAttribute('cy', cy);
        clipCircle.setAttribute('rx', r);
        clipCircle.setAttribute('ry', r);
        overlapPath.appendChild(clipCircle);
        defs.appendChild(overlapPath);

        const overlapFill = document.createElementNS(svgNS, 'ellipse');
        overlapFill.setAttribute('cx', cxR);
        overlapFill.setAttribute('cy', cy);
        overlapFill.setAttribute('rx', r);
        overlapFill.setAttribute('ry', r);
        overlapFill.setAttribute('fill', COLORS.overlap);
        overlapFill.setAttribute('fill-opacity', '0.25');
        overlapFill.setAttribute('clip-path', 'url(#clip-left)');
        svg.appendChild(overlapFill);

        // Circle labels
        const labelL = document.createElementNS(svgNS, 'text');
        labelL.setAttribute('x', cxL - 70);
        labelL.setAttribute('y', 36);
        labelL.setAttribute('text-anchor', 'middle');
        labelL.setAttribute('fill', COLORS.altitude);
        labelL.setAttribute('font-size', '13');
        labelL.setAttribute('font-weight', 'bold');
        labelL.setAttribute('font-family', FONT);
        labelL.textContent = 'Altitude Adaptation (9 genes)';
        svg.appendChild(labelL);

        const labelR = document.createElementNS(svgNS, 'text');
        labelR.setAttribute('x', cxR + 70);
        labelR.setAttribute('y', 36);
        labelR.setAttribute('text-anchor', 'middle');
        labelR.setAttribute('fill', COLORS.ros);
        labelR.setAttribute('font-size', '13');
        labelR.setAttribute('font-weight', 'bold');
        labelR.setAttribute('font-family', FONT);
        labelR.textContent = 'ROS/Ferroptosis (11 genes)';
        svg.appendChild(labelR);

        // Gene text placement
        const leftOnlyGenes = ['GC', 'GRB2', 'LDHA', 'SENP1', 'CDC42', 'HK2', 'EPO', 'AEBP2'];
        const rightOnlyGenes = ['TXNRD1', 'MAFG', 'G6PD', 'SQSTM1', 'SLC7A11', 'GSR', 'NCF2', 'MSRA', 'GLRX2', 'BACH1'];
        const overlapGenes = ['HMOX1'];

        // Left-only genes arranged in a column
        const leftStartX = cxL - 80;
        const leftStartY = cy - 80;
        const lineH = 20;
        leftOnlyGenes.forEach((gene, i) => {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const tx = leftStartX + col * 60 - 15;
            const ty = leftStartY + row * lineH;
            this._addGeneText(svg, gene, tx, ty, COLORS.altitude, false);
        });

        // Right-only genes arranged in a column
        const rightStartX = cxR - 10;
        const rightStartY = cy - 95;
        rightOnlyGenes.forEach((gene, i) => {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const tx = rightStartX + col * 65;
            const ty = rightStartY + row * lineH;
            this._addGeneText(svg, gene, tx, ty, COLORS.ros, false);
        });

        // Overlap gene: HMOX1
        overlapGenes.forEach((gene) => {
            this._addGeneText(svg, gene, (cxL + cxR) / 2, cy, COLORS.overlap, true);
        });

        // "Bridge Gene" annotation arrow pointing to HMOX1
        const arrowTip = document.createElementNS(svgNS, 'line');
        arrowTip.setAttribute('x1', (cxL + cxR) / 2);
        arrowTip.setAttribute('y1', cy + 16);
        arrowTip.setAttribute('x2', (cxL + cxR) / 2);
        arrowTip.setAttribute('y2', cy + 45);
        arrowTip.setAttribute('stroke', COLORS.overlap);
        arrowTip.setAttribute('stroke-width', '1');
        arrowTip.setAttribute('stroke-opacity', '0.6');
        svg.appendChild(arrowTip);

        const bridgeLabel = document.createElementNS(svgNS, 'text');
        bridgeLabel.setAttribute('x', (cxL + cxR) / 2);
        bridgeLabel.setAttribute('y', cy + 60);
        bridgeLabel.setAttribute('text-anchor', 'middle');
        bridgeLabel.setAttribute('fill', COLORS.overlap);
        bridgeLabel.setAttribute('font-size', '11');
        bridgeLabel.setAttribute('font-style', 'italic');
        bridgeLabel.setAttribute('font-family', FONT);
        bridgeLabel.textContent = 'Bridge Gene';
        svg.appendChild(bridgeLabel);

        this.card.appendChild(svg);
        this.overlay.appendChild(this.card);
        document.body.appendChild(this.overlay);
    }

    _addGeneText(svg, gene, x, y, color, bold) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', color);
        text.setAttribute('font-size', bold ? '14' : '11');
        text.setAttribute('font-weight', bold ? 'bold' : 'normal');
        text.setAttribute('font-family', FONT);
        text.setAttribute('cursor', 'pointer');
        text.textContent = gene;

        // Hover effect
        text.addEventListener('mouseenter', () => {
            text.setAttribute('font-size', bold ? '16' : '13');
            text.setAttribute('filter', 'url(#venn-glow)');
        });
        text.addEventListener('mouseleave', () => {
            text.setAttribute('font-size', bold ? '14' : '11');
            text.removeAttribute('filter');
        });
        text.addEventListener('click', () => {
            if (typeof this.onGeneClick === 'function') {
                this.onGeneClick(gene);
            }
        });

        svg.appendChild(text);
    }

    show() {
        this.overlay.style.display = 'flex';
        this.visible = true;
        this._escHandler = (e) => { if (e.key === 'Escape') this.hide(); };
        document.addEventListener('keydown', this._escHandler);
    }

    hide() {
        this.overlay.style.display = 'none';
        this.visible = false;
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    }
}

// ---------------------------------------------------------------------------
// 3. PathwayDiagram
// ---------------------------------------------------------------------------

const PATHWAYS = [
    {
        name: 'HIF-1 Signaling',
        genes: ['EPO', 'LDHA', 'HK2', 'HMOX1', 'SENP1'],
    },
    {
        name: 'Ferroptosis / Glutathione',
        genes: ['SLC7A11', 'GSR', 'TXNRD1', 'HMOX1'],
    },
    {
        name: 'ROS Defense',
        genes: ['G6PD', 'MAFG', 'BACH1', 'SQSTM1', 'MSRA', 'GLRX2', 'NCF2'],
    },
    {
        name: 'Signaling / Migration',
        genes: ['GRB2', 'CDC42', 'GC', 'AEBP2'],
    },
];

export class PathwayDiagram {
    /**
     * @param {object} geneAnnotations - { geneName: { signature, fullName, ... } }
     */
    constructor(geneAnnotations) {
        this.geneAnnotations = geneAnnotations || {};
        this.overlay = null;
        this.visible = false;
        this.onGeneClick = null;
        this._selectedGene = null;
        this._svg = null;
        this._titleEl = null;
        this._buildDOM();
    }

    _buildDOM() {
        this.overlay = createOverlay(() => this.hide());
        this.card = createCard();
        Object.assign(this.card.style, {
            padding: '24px',
            minWidth: '700px',
            maxWidth: '900px',
        });
        this.card.appendChild(createCloseButton(() => this.hide()));

        // Title
        this._titleEl = document.createElement('div');
        this._titleEl.textContent = 'Pathway Context';
        Object.assign(this._titleEl.style, {
            color: COLORS.textBright,
            fontSize: '16px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '16px',
            fontFamily: FONT,
        });
        this.card.appendChild(this._titleEl);

        // SVG placeholder
        this._svgContainer = document.createElement('div');
        this._svgContainer.style.textAlign = 'center';
        this.card.appendChild(this._svgContainer);

        this.overlay.appendChild(this.card);
        document.body.appendChild(this.overlay);
    }

    _renderSVG(selectedGene) {
        this._svgContainer.innerHTML = '';
        const svgNS = 'http://www.w3.org/2000/svg';

        const laneHeight = 80;
        const laneGap = 10;
        const totalH = PATHWAYS.length * (laneHeight + laneGap) + 20;
        const svgW = 820;

        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${svgW} ${totalH}`);
        svg.setAttribute('width', '100%');
        svg.style.display = 'block';
        svg.style.maxWidth = svgW + 'px';
        svg.style.margin = '0 auto';

        // Defs for glow
        const defs = document.createElementNS(svgNS, 'defs');

        const glowFilter = document.createElementNS(svgNS, 'filter');
        glowFilter.setAttribute('id', 'pw-glow');
        glowFilter.setAttribute('x', '-30%');
        glowFilter.setAttribute('y', '-30%');
        glowFilter.setAttribute('width', '160%');
        glowFilter.setAttribute('height', '160%');
        const gb = document.createElementNS(svgNS, 'feGaussianBlur');
        gb.setAttribute('stdDeviation', '4');
        gb.setAttribute('result', 'glow');
        glowFilter.appendChild(gb);
        const gm = document.createElementNS(svgNS, 'feMerge');
        const gm1 = document.createElementNS(svgNS, 'feMergeNode');
        gm1.setAttribute('in', 'glow');
        const gm2 = document.createElementNS(svgNS, 'feMergeNode');
        gm2.setAttribute('in', 'SourceGraphic');
        gm.appendChild(gm1);
        gm.appendChild(gm2);
        glowFilter.appendChild(gm);
        defs.appendChild(glowFilter);

        // Arrow marker
        const marker = document.createElementNS(svgNS, 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '8');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        const arrowPath = document.createElementNS(svgNS, 'path');
        arrowPath.setAttribute('d', 'M0,0 L8,3 L0,6 Z');
        arrowPath.setAttribute('fill', COLORS.textDim);
        marker.appendChild(arrowPath);
        defs.appendChild(marker);

        svg.appendChild(defs);

        const labelWidth = 180;
        const nodeW = 68;
        const nodeH = 32;
        const nodeRad = 8;

        PATHWAYS.forEach((pathway, laneIdx) => {
            const laneY = 10 + laneIdx * (laneHeight + laneGap);

            // Lane background
            const laneBg = document.createElementNS(svgNS, 'rect');
            laneBg.setAttribute('x', 0);
            laneBg.setAttribute('y', laneY);
            laneBg.setAttribute('width', svgW);
            laneBg.setAttribute('height', laneHeight);
            laneBg.setAttribute('rx', 6);
            laneBg.setAttribute('fill', 'rgba(100, 120, 255, 0.03)');
            laneBg.setAttribute('stroke', COLORS.border);
            laneBg.setAttribute('stroke-width', '0.5');
            svg.appendChild(laneBg);

            // Lane label
            const lbl = document.createElementNS(svgNS, 'text');
            lbl.setAttribute('x', 14);
            lbl.setAttribute('y', laneY + laneHeight / 2);
            lbl.setAttribute('dominant-baseline', 'central');
            lbl.setAttribute('fill', COLORS.textDim);
            lbl.setAttribute('font-size', '11');
            lbl.setAttribute('font-weight', 'bold');
            lbl.setAttribute('font-family', FONT);
            lbl.textContent = pathway.name;
            svg.appendChild(lbl);

            const geneCount = pathway.genes.length;
            const availableW = svgW - labelWidth - 40;
            const spacing = Math.min(availableW / geneCount, 110);
            const startX = labelWidth + 10;

            pathway.genes.forEach((gene, gi) => {
                const cx = startX + gi * spacing + spacing / 2;
                const cy = laneY + laneHeight / 2;
                const isSelected = gene === selectedGene;
                const color = geneColor(gene);

                // Node rect
                const rect = document.createElementNS(svgNS, 'rect');
                rect.setAttribute('x', cx - nodeW / 2);
                rect.setAttribute('y', cy - nodeH / 2);
                rect.setAttribute('width', nodeW);
                rect.setAttribute('height', nodeH);
                rect.setAttribute('rx', nodeRad);
                rect.setAttribute('fill', isSelected ? color : 'rgba(12,12,30,0.9)');
                rect.setAttribute('stroke', color);
                rect.setAttribute('stroke-width', isSelected ? '2.5' : '1.2');
                rect.setAttribute('cursor', 'pointer');
                if (isSelected) {
                    rect.setAttribute('filter', 'url(#pw-glow)');
                }
                svg.appendChild(rect);

                // Gene text
                const txt = document.createElementNS(svgNS, 'text');
                txt.setAttribute('x', cx);
                txt.setAttribute('y', cy);
                txt.setAttribute('text-anchor', 'middle');
                txt.setAttribute('dominant-baseline', 'central');
                txt.setAttribute('fill', isSelected ? '#0a0a1a' : color);
                txt.setAttribute('font-size', '11');
                txt.setAttribute('font-weight', 'bold');
                txt.setAttribute('font-family', FONT);
                txt.setAttribute('cursor', 'pointer');
                txt.setAttribute('pointer-events', 'none');
                txt.textContent = gene;
                svg.appendChild(txt);

                // Click handler on the rect
                rect.addEventListener('click', () => {
                    this._selectedGene = gene;
                    this._titleEl.textContent = `Pathway Context for ${gene}`;
                    this._renderSVG(gene);
                    if (typeof this.onGeneClick === 'function') {
                        this.onGeneClick(gene);
                    }
                });

                // Arrow to next gene in lane
                if (gi < geneCount - 1) {
                    const nextCx = startX + (gi + 1) * spacing + spacing / 2;
                    const line = document.createElementNS(svgNS, 'line');
                    line.setAttribute('x1', cx + nodeW / 2 + 2);
                    line.setAttribute('y1', cy);
                    line.setAttribute('x2', nextCx - nodeW / 2 - 4);
                    line.setAttribute('y2', cy);
                    line.setAttribute('stroke', COLORS.textDim);
                    line.setAttribute('stroke-width', '1');
                    line.setAttribute('marker-end', 'url(#arrowhead)');
                    svg.appendChild(line);
                }
            });
        });

        this._svgContainer.appendChild(svg);
    }

    /**
     * Show the pathway diagram, optionally centered on a specific gene.
     * @param {string} [geneName] - Gene to highlight initially
     */
    show(geneName) {
        const gene = geneName || null;
        this._selectedGene = gene;
        this._titleEl.textContent = gene
            ? `Pathway Context for ${gene}`
            : 'Pathway Context';
        this._renderSVG(gene);
        this.overlay.style.display = 'flex';
        this.visible = true;
        this._escHandler = (e) => { if (e.key === 'Escape') this.hide(); };
        document.addEventListener('keydown', this._escHandler);
    }

    hide() {
        this.overlay.style.display = 'none';
        this.visible = false;
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    }
}
