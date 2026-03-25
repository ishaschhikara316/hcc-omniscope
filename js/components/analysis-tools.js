/**
 * Analysis Tools - Gene comparison, data tables, network stats,
 * correlation explorer, and multi-select for HCC OmniScope.
 * Pure vanilla JS ES module. No frameworks, no em dashes.
 */

const COLORS = {
    bg: 'rgba(10, 10, 26, 0.95)',
    bgSolid: '#0a0a1a',
    panel: '#0c0c1e',
    panelAlt: 'rgba(100, 120, 255, 0.04)',
    border: 'rgba(100, 120, 255, 0.15)',
    borderBright: 'rgba(100, 120, 255, 0.3)',
    text: '#e0e0f0',
    textDim: '#8888aa',
    textBright: '#ffffff',
    accent: '#6c8cff',
    altitude: '#4ade80',
    ros: '#f87171',
    overlap: '#fbbf24',
    positive: '#6c8cff',
    negative: '#f87171',
    alive: '#6c8cff',
    deceased: '#f87171',
    riskHigh: '#f87171',
    riskLow: '#6c8cff',
    protective: '#4ade80',
    risk: '#f87171',
};

const FONT = "'Inter', system-ui, -apple-system, sans-serif";
const MONO = "'JetBrains Mono', monospace";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function createOverlay(onClick) {
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
    if (onClick) {
        el.addEventListener('click', (e) => {
            if (e.target === el) onClick();
        });
    }
    return el;
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

function createCard(opts = {}) {
    const card = document.createElement('div');
    Object.assign(card.style, {
        position: 'relative',
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '12px',
        padding: '20px',
        width: opts.width || '700px',
        maxWidth: opts.maxWidth || '95vw',
        maxHeight: opts.maxHeight || '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
    });
    return card;
}

function createTitle(text) {
    const el = document.createElement('h2');
    el.textContent = text;
    Object.assign(el.style, {
        margin: '0 0 4px 0',
        fontSize: '15px',
        fontWeight: '700',
        color: COLORS.textBright,
        letterSpacing: '0.02em',
    });
    return el;
}

function createTag(text, color) {
    const tag = document.createElement('span');
    tag.textContent = text;
    Object.assign(tag.style, {
        display: 'inline-block',
        fontSize: '9px',
        padding: '2px 6px',
        borderRadius: '8px',
        background: `${color}20`,
        color: color,
        fontWeight: '500',
        marginRight: '4px',
        marginBottom: '3px',
        whiteSpace: 'nowrap',
        maxWidth: '180px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    });
    return tag;
}

function sigColor(signature) {
    if (!signature) return COLORS.textDim;
    const s = signature.toLowerCase();
    if (s.includes('ros') || s.includes('ferroptosis')) return COLORS.ros;
    if (s.includes('altitude') || s.includes('adaptation')) return COLORS.altitude;
    if (s.includes('overlap') || s.includes('both')) return COLORS.overlap;
    return COLORS.accent;
}

function fmtP(p) {
    if (p == null) return 'N/A';
    if (p < 0.001) return '< 0.001';
    return p.toFixed(3);
}

function fmtNum(v, d = 3) {
    if (v == null) return 'N/A';
    return Number(v).toFixed(d);
}

/** Build a lookup of all genes across signatures from hazardRatios object. */
function buildGeneMap(hazardRatios) {
    const map = {};
    if (!hazardRatios) return map;
    for (const [sig, genes] of Object.entries(hazardRatios)) {
        for (const g of genes) {
            map[g.gene] = { ...g, signature: sig };
        }
    }
    return map;
}

/** Look up Pearson r between two genes from the correlations data. */
function getCorrelation(correlations, gene1, gene2) {
    if (!correlations) return null;
    for (const sigData of Object.values(correlations)) {
        const genes = sigData.genes;
        const matrix = sigData.matrix;
        const i1 = genes.indexOf(gene1);
        const i2 = genes.indexOf(gene2);
        if (i1 >= 0 && i2 >= 0) {
            return matrix[i1][i2];
        }
    }
    return null;
}

/** Find which signature block(s) contain a gene. */
function findGeneSignatureBlock(correlations, gene) {
    const blocks = [];
    if (!correlations) return blocks;
    for (const [sig, sigData] of Object.entries(correlations)) {
        if (sigData.genes.indexOf(gene) >= 0) blocks.push(sig);
    }
    return blocks;
}

function escapeCSV(val) {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function downloadCSV(rows, headers, filename) {
    const lines = [headers.map(escapeCSV).join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => escapeCSV(row[h])).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function createSearchInput(placeholder, onInput) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    Object.assign(input.style, {
        flex: '1',
        minWidth: '160px',
        padding: '6px 10px',
        fontSize: '12px',
        fontFamily: FONT,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        color: COLORS.text,
        outline: 'none',
    });
    input.addEventListener('focus', () => { input.style.borderColor = COLORS.borderBright; });
    input.addEventListener('blur', () => { input.style.borderColor = COLORS.border; });
    input.addEventListener('input', () => onInput(input.value));
    return input;
}

function createButton(text, onClick, opts = {}) {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
        padding: opts.padding || '5px 12px',
        fontSize: opts.fontSize || '11px',
        fontFamily: FONT,
        fontWeight: '500',
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        background: opts.bg || 'rgba(100,120,255,0.1)',
        color: opts.color || COLORS.accent,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    });
    btn.addEventListener('mouseenter', () => {
        btn.style.background = opts.bgHover || 'rgba(100,120,255,0.2)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = opts.bg || 'rgba(100,120,255,0.1)';
    });
    btn.addEventListener('click', onClick);
    return btn;
}

function createSelect(options, onChange, selectedValue) {
    const sel = document.createElement('select');
    Object.assign(sel.style, {
        padding: '5px 8px',
        fontSize: '12px',
        fontFamily: MONO,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        color: COLORS.text,
        outline: 'none',
        cursor: 'pointer',
        minWidth: '120px',
    });
    for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        o.style.background = COLORS.panel;
        o.style.color = COLORS.text;
        if (opt === selectedValue) o.selected = true;
        sel.appendChild(o);
    }
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
}


// ===========================================================================
// 1. GeneComparison
// ===========================================================================

export class GeneComparison {
    /**
     * @param {Object} hazardRatios - Keyed by signature, each an array of gene objects
     * @param {Object} correlations - Keyed by signature, each { genes, matrix }
     * @param {Object} geneAnnotations - Keyed by gene symbol
     */
    constructor(hazardRatios, correlations, geneAnnotations) {
        this.hazardRatios = hazardRatios;
        this.correlations = correlations;
        this.annotations = geneAnnotations || {};
        this.geneMap = buildGeneMap(hazardRatios);
        this.allGenes = Object.keys(this.geneMap).sort();
        this.gene1 = null;
        this.gene2 = null;
        this.overlay = null;
        this.visible = false;
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.visible) this.hide();
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    show(gene1, gene2) {
        this.gene1 = gene1;
        this.gene2 = gene2;
        if (this.overlay) {
            this.overlay.remove();
        }
        this._build();
        this.visible = true;
        this.overlay.style.display = 'flex';
    }

    hide() {
        this.visible = false;
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
    }

    _build() {
        this.overlay = createOverlay(() => this.hide());
        const card = createCard({ width: '860px', maxHeight: '90vh' });
        card.appendChild(createCloseBtn(() => this.hide()));

        // Title
        const titleText = `Gene Comparison: ${this.gene1 || '?'} vs ${this.gene2 || '?'}`;
        const title = createTitle(titleText);
        title.style.marginBottom = '10px';
        card.appendChild(title);

        // Dropdowns
        const selRow = document.createElement('div');
        Object.assign(selRow.style, {
            display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center',
        });
        const lbl1 = document.createElement('span');
        lbl1.textContent = 'Gene 1:';
        Object.assign(lbl1.style, { fontSize: '11px', color: COLORS.textDim });
        this.sel1 = createSelect(this.allGenes, (v) => {
            this.gene1 = v;
            this._rebuild(card);
        }, this.gene1);
        const lbl2 = document.createElement('span');
        lbl2.textContent = 'Gene 2:';
        Object.assign(lbl2.style, { fontSize: '11px', color: COLORS.textDim });
        this.sel2 = createSelect(this.allGenes, (v) => {
            this.gene2 = v;
            this._rebuild(card);
        }, this.gene2);
        selRow.append(lbl1, this.sel1, lbl2, this.sel2);
        card.appendChild(selRow);

        // Content area
        this.contentArea = document.createElement('div');
        Object.assign(this.contentArea.style, {
            flex: '1', overflowY: 'auto', minHeight: '0',
        });
        card.appendChild(this.contentArea);
        this._renderContent();

        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);
    }

    _rebuild(card) {
        // Update title
        const title = card.querySelector('h2');
        if (title) title.textContent = `Gene Comparison: ${this.gene1 || '?'} vs ${this.gene2 || '?'}`;
        this._renderContent();
    }

    _renderContent() {
        const c = this.contentArea;
        c.innerHTML = '';
        const g1 = this.gene1;
        const g2 = this.gene2;
        if (!g1 || !g2) {
            c.innerHTML = `<div style="padding:20px;color:${COLORS.textDim};font-size:12px;text-align:center;">Select two genes to compare.</div>`;
            return;
        }
        const d1 = this.geneMap[g1];
        const d2 = this.geneMap[g2];
        const a1 = this.annotations[g1] || {};
        const a2 = this.annotations[g2] || {};

        // Three-column layout: gene1 | center | gene2
        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '16px',
        });

        grid.appendChild(this._geneColumn(g1, d1, a1));
        grid.appendChild(this._centerColumn(g1, g2, d1, d2, a1, a2));
        grid.appendChild(this._geneColumn(g2, d2, a2));
        c.appendChild(grid);
    }

    _geneColumn(gene, data, ann) {
        const col = document.createElement('div');
        Object.assign(col.style, {
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '8px',
            padding: '14px',
            border: `1px solid ${COLORS.border}`,
        });

        // Gene name
        const nameEl = document.createElement('div');
        nameEl.textContent = gene;
        Object.assign(nameEl.style, {
            fontSize: '16px', fontWeight: '700', fontFamily: MONO,
            color: sigColor(data ? data.signature : ann.signature),
            marginBottom: '2px',
        });
        col.appendChild(nameEl);

        // Full name
        const fullName = document.createElement('div');
        fullName.textContent = ann.fullName || 'Unknown';
        Object.assign(fullName.style, {
            fontSize: '10px', color: COLORS.textDim, marginBottom: '10px',
            lineHeight: '1.4',
        });
        col.appendChild(fullName);

        // Stats
        const stats = [
            { label: 'Hazard Ratio', value: data ? fmtNum(data.hazard_ratio) : 'N/A' },
            { label: '95% CI', value: data ? `${fmtNum(data.ci_lower)} - ${fmtNum(data.ci_upper)}` : 'N/A' },
            { label: 'p-value', value: data ? fmtP(data.p_value) : 'N/A' },
            { label: 'LASSO Coef', value: data ? fmtNum(data.coef) : 'N/A' },
        ];
        for (const s of stats) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', justifyContent: 'space-between',
                fontSize: '11px', marginBottom: '4px',
            });
            const lbl = document.createElement('span');
            lbl.textContent = s.label;
            lbl.style.color = COLORS.textDim;
            const val = document.createElement('span');
            val.textContent = s.value;
            val.style.color = COLORS.text;
            val.style.fontFamily = MONO;
            val.style.fontSize = '10px';
            row.append(lbl, val);
            col.appendChild(row);
        }

        // Pathways
        if (ann.pathways && ann.pathways.length) {
            const secLabel = document.createElement('div');
            secLabel.textContent = 'Pathways';
            Object.assign(secLabel.style, {
                fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginTop: '10px', marginBottom: '4px',
            });
            col.appendChild(secLabel);
            const tagWrap = document.createElement('div');
            tagWrap.style.display = 'flex';
            tagWrap.style.flexWrap = 'wrap';
            for (const p of ann.pathways) {
                tagWrap.appendChild(createTag(p, COLORS.accent));
            }
            col.appendChild(tagWrap);
        }

        // Drugs
        if (ann.drugs && ann.drugs.length) {
            const secLabel = document.createElement('div');
            secLabel.textContent = 'Drugs';
            Object.assign(secLabel.style, {
                fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginTop: '8px', marginBottom: '4px',
            });
            col.appendChild(secLabel);
            const tagWrap = document.createElement('div');
            tagWrap.style.display = 'flex';
            tagWrap.style.flexWrap = 'wrap';
            for (const d of ann.drugs) {
                tagWrap.appendChild(createTag(d, COLORS.overlap));
            }
            col.appendChild(tagWrap);
        }

        // HCC Role
        if (ann.hccRole) {
            const secLabel = document.createElement('div');
            secLabel.textContent = 'HCC Role';
            Object.assign(secLabel.style, {
                fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginTop: '8px', marginBottom: '4px',
            });
            col.appendChild(secLabel);
            const roleText = document.createElement('div');
            roleText.textContent = ann.hccRole;
            Object.assign(roleText.style, {
                fontSize: '10px', color: COLORS.text, lineHeight: '1.5',
                maxHeight: '80px', overflowY: 'auto',
            });
            col.appendChild(roleText);
        }

        return col;
    }

    _centerColumn(g1, g2, d1, d2, a1, a2) {
        const col = document.createElement('div');
        Object.assign(col.style, {
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-start', minWidth: '160px', paddingTop: '10px',
        });

        // Correlation
        const r = getCorrelation(this.correlations, g1, g2);
        const corrLabel = document.createElement('div');
        corrLabel.textContent = 'Pearson r';
        Object.assign(corrLabel.style, {
            fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: '4px',
        });
        col.appendChild(corrLabel);

        const corrVal = document.createElement('div');
        corrVal.textContent = r != null ? fmtNum(r, 3) : 'N/A';
        Object.assign(corrVal.style, {
            fontSize: '22px', fontWeight: '700', fontFamily: MONO,
            color: r != null ? (r >= 0 ? COLORS.positive : COLORS.negative) : COLORS.textDim,
            marginBottom: '6px',
        });
        col.appendChild(corrVal);

        // Mini correlation bar
        if (r != null) {
            const barOuter = document.createElement('div');
            Object.assign(barOuter.style, {
                width: '120px', height: '6px', background: 'rgba(255,255,255,0.06)',
                borderRadius: '3px', overflow: 'hidden', marginBottom: '14px',
            });
            const barFill = document.createElement('div');
            const pct = Math.min(Math.abs(r) * 100, 100);
            Object.assign(barFill.style, {
                width: `${pct}%`, height: '100%',
                background: r >= 0 ? COLORS.positive : COLORS.negative,
                borderRadius: '3px',
            });
            barOuter.appendChild(barFill);
            col.appendChild(barOuter);
        }

        // Direction
        const dirLabel = document.createElement('div');
        dirLabel.textContent = 'Direction';
        Object.assign(dirLabel.style, {
            fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: '4px',
        });
        col.appendChild(dirLabel);

        const hr1 = d1 ? d1.hazard_ratio : null;
        const hr2 = d2 ? d2.hazard_ratio : null;
        let dirText = 'N/A';
        let dirColor = COLORS.textDim;
        if (hr1 != null && hr2 != null) {
            if (hr1 > 1 && hr2 > 1) { dirText = 'Both risk'; dirColor = COLORS.risk; }
            else if (hr1 < 1 && hr2 < 1) { dirText = 'Both protective'; dirColor = COLORS.protective; }
            else { dirText = 'Opposing'; dirColor = COLORS.overlap; }
        }
        const dirVal = document.createElement('div');
        dirVal.textContent = dirText;
        Object.assign(dirVal.style, {
            fontSize: '12px', fontWeight: '600', color: dirColor, marginBottom: '14px',
        });
        col.appendChild(dirVal);

        // Shared pathways
        const pw1 = (a1.pathways || []).map((p) => p.toLowerCase());
        const pw2 = (a2.pathways || []).map((p) => p.toLowerCase());
        const shared = (a1.pathways || []).filter((p) => pw2.includes(p.toLowerCase()));
        if (shared.length > 0) {
            const shLabel = document.createElement('div');
            shLabel.textContent = 'Shared Pathways';
            Object.assign(shLabel.style, {
                fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: '4px',
            });
            col.appendChild(shLabel);
            const tagWrap = document.createElement('div');
            Object.assign(tagWrap.style, {
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
            });
            for (const p of shared) {
                tagWrap.appendChild(createTag(p, COLORS.overlap));
            }
            col.appendChild(tagWrap);
        }

        // Mini expression comparison (canvas)
        const canvas = document.createElement('canvas');
        canvas.width = 140;
        canvas.height = 100;
        Object.assign(canvas.style, {
            marginTop: '14px', borderRadius: '4px',
            background: 'rgba(0,0,0,0.2)',
        });
        col.appendChild(canvas);
        this._drawMiniComparison(canvas, g1, g2);

        return col;
    }

    _drawMiniComparison(canvas, g1, g2) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Find both genes in a common correlation matrix for reference
        // Draw bar comparison of HR values
        const d1 = this.geneMap[g1];
        const d2 = this.geneMap[g2];
        if (!d1 || !d2) return;

        const maxHR = Math.max(d1.hazard_ratio, d2.hazard_ratio, 1.1);
        const barW = 40;
        const gap = 20;
        const baseY = h - 14;
        const maxBarH = h - 30;

        // Labels
        ctx.font = `9px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText('HR Comparison', w / 2, 12);

        // Gene 1 bar
        const x1 = w / 2 - gap / 2 - barW;
        const h1 = (d1.hazard_ratio / maxHR) * maxBarH;
        const c1 = sigColor(d1.signature);
        ctx.fillStyle = c1;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.roundRect(x1, baseY - h1, barW, h1, [3, 3, 0, 0]);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Gene 2 bar
        const x2 = w / 2 + gap / 2;
        const h2 = (d2.hazard_ratio / maxHR) * maxBarH;
        const c2 = sigColor(d2.signature);
        ctx.fillStyle = c2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.roundRect(x2, baseY - h2, barW, h2, [3, 3, 0, 0]);
        ctx.fill();
        ctx.globalAlpha = 1;

        // HR=1 reference line
        const refY = baseY - (1 / maxHR) * maxBarH;
        ctx.strokeStyle = COLORS.textDim;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(10, refY);
        ctx.lineTo(w - 10, refY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `8px ${MONO}`;
        ctx.fillStyle = COLORS.textDim;
        ctx.textAlign = 'right';
        ctx.fillText('HR=1', w - 10, refY - 3);

        // Gene labels
        ctx.textAlign = 'center';
        ctx.fillStyle = c1;
        ctx.font = `bold 8px ${FONT}`;
        ctx.fillText(g1, x1 + barW / 2, baseY + 10);
        ctx.fillStyle = c2;
        ctx.fillText(g2, x2 + barW / 2, baseY + 10);

        // HR values on bars
        ctx.fillStyle = COLORS.textBright;
        ctx.font = `bold 9px ${MONO}`;
        ctx.fillText(d1.hazard_ratio.toFixed(2), x1 + barW / 2, baseY - h1 - 4);
        ctx.fillText(d2.hazard_ratio.toFixed(2), x2 + barW / 2, baseY - h2 - 4);
    }

    destroy() {
        document.removeEventListener('keydown', this._keyHandler);
        if (this.overlay) this.overlay.remove();
    }
}


// ===========================================================================
// 2. DataTableView
// ===========================================================================

export class DataTableView {
    constructor() {
        this.overlay = null;
        this.visible = false;
        this.sortCol = null;
        this.sortAsc = true;
        this.filterText = '';
        this.rows = [];
        this.columns = [];
        this.colorRules = [];
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.visible) this.hide();
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    showGeneTable(hazardRatios, geneAnnotations) {
        const ann = geneAnnotations || {};
        const rows = [];
        if (hazardRatios) {
            for (const [sig, genes] of Object.entries(hazardRatios)) {
                for (const g of genes) {
                    const a = ann[g.gene] || {};
                    rows.push({
                        Gene: g.gene,
                        'Full Name': a.fullName || '',
                        Signature: sig,
                        HR: g.hazard_ratio,
                        CI: `${fmtNum(g.ci_lower)} - ${fmtNum(g.ci_upper)}`,
                        'p-value': g.p_value,
                        'LASSO Coef': g.coef,
                        Pathways: (a.pathways || []).join('; '),
                        Drugs: (a.drugs || []).join('; '),
                    });
                }
            }
        }
        this.columns = ['Gene', 'Full Name', 'Signature', 'HR', 'CI', 'p-value', 'LASSO Coef', 'Pathways', 'Drugs'];
        this.colorRules = [
            { col: 'HR', fn: (v) => v > 1 ? COLORS.risk : v < 1 ? COLORS.protective : null },
        ];
        this._show('Gene Data Table', rows, 'genes_export.csv');
    }

    showCellTable(coactivation, specialists, cellAnnotations) {
        const specMap = {};
        if (specialists) {
            for (const s of specialists) {
                if (!specMap[s.cell_type]) specMap[s.cell_type] = {};
                specMap[s.cell_type].specialist = true;
                specMap[s.cell_type].tissues = s.tissues;
            }
        }
        const ann = cellAnnotations || {};
        const rows = [];
        if (coactivation) {
            for (const cell of coactivation) {
                const ct = cell.cell_type;
                const spec = specMap[ct] || {};
                const a = ann[ct] || {};
                rows.push({
                    'Cell Type': ct,
                    'ROS Score': cell.ros_mean != null ? Number(cell.ros_mean).toFixed(1) : 'N/A',
                    'Altitude Score': cell.altitude_mean != null ? Number(cell.altitude_mean).toFixed(1) : 'N/A',
                    'Hypoxia Score': cell.altitude_mean != null ? Number(cell.altitude_mean).toFixed(1) : 'N/A',
                    Tissues: spec.tissues || '',
                    Specialist: spec.specialist ? 'Yes' : 'No',
                });
            }
        }
        this.columns = ['Cell Type', 'ROS Score', 'Altitude Score', 'Hypoxia Score', 'Tissues', 'Specialist'];
        this.colorRules = [];
        this._show('Cell Type Data Table', rows, 'cells_export.csv');
    }

    showPatientTable(patients) {
        const rows = [];
        if (patients) {
            for (const p of patients) {
                rows.push({
                    ID: p.patientId || p.id || '',
                    Status: p.vital_status || '',
                    'Survival (mo)': p.OS_months != null ? Number(p.OS_months).toFixed(1) : 'N/A',
                    Stage: p.tumor_stage || 'N/A',
                    Grade: p.tumor_grade || 'N/A',
                    'ROS Risk': p.ros_risk || p.rosRisk || 'N/A',
                    'Altitude Risk': p.altitude_risk || p.altitudeRisk || 'N/A',
                    'Risk Group': p.risk_group || p.riskGroup || 'N/A',
                });
            }
        }
        this.columns = ['ID', 'Status', 'Survival (mo)', 'Stage', 'Grade', 'ROS Risk', 'Altitude Risk', 'Risk Group'];
        this.colorRules = [
            {
                col: 'ROS Risk', fn: (v) => {
                    if (typeof v === 'string') {
                        const lv = v.toLowerCase();
                        if (lv === 'high') return COLORS.riskHigh;
                        if (lv === 'low') return COLORS.riskLow;
                    }
                    return null;
                },
            },
            {
                col: 'Altitude Risk', fn: (v) => {
                    if (typeof v === 'string') {
                        const lv = v.toLowerCase();
                        if (lv === 'high') return COLORS.riskHigh;
                        if (lv === 'low') return COLORS.riskLow;
                    }
                    return null;
                },
            },
            {
                col: 'Risk Group', fn: (v) => {
                    if (typeof v === 'string') {
                        const lv = v.toLowerCase();
                        if (lv.includes('high')) return COLORS.riskHigh;
                        if (lv.includes('low')) return COLORS.riskLow;
                    }
                    return null;
                },
            },
        ];
        this._show('Patient Data Table', rows, 'patients_export.csv');
    }

    hide() {
        this.visible = false;
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
    }

    _show(title, rows, csvFilename) {
        this.rows = rows;
        this.sortCol = null;
        this.sortAsc = true;
        this.filterText = '';
        this.csvFilename = csvFilename;

        if (this.overlay) this.overlay.remove();
        this.overlay = createOverlay(() => this.hide());

        const card = createCard({ width: '95vw', maxWidth: '1200px', maxHeight: '92vh' });
        card.appendChild(createCloseBtn(() => this.hide()));

        const titleEl = createTitle(title);
        titleEl.style.marginBottom = '10px';
        card.appendChild(titleEl);

        // Controls row
        const controls = document.createElement('div');
        Object.assign(controls.style, {
            display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center',
        });
        const searchInput = createSearchInput('Filter rows...', (val) => {
            this.filterText = val.toLowerCase();
            this._renderRows();
        });
        controls.appendChild(searchInput);

        const exportBtn = createButton('Export CSV', () => {
            downloadCSV(this._getFilteredRows(), this.columns, this.csvFilename);
        });
        controls.appendChild(exportBtn);
        card.appendChild(controls);

        // Table header
        this.headerEl = document.createElement('div');
        Object.assign(this.headerEl.style, {
            display: 'grid',
            gridTemplateColumns: this.columns.map(() => '1fr').join(' '),
            gap: '2px',
            padding: '6px 8px',
            fontSize: '10px',
            fontWeight: '600',
            color: COLORS.textDim,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderBottom: `1px solid ${COLORS.border}`,
            minWidth: 'max-content',
        });
        for (const col of this.columns) {
            const cell = document.createElement('div');
            cell.style.cursor = 'pointer';
            cell.style.userSelect = 'none';
            cell.style.whiteSpace = 'nowrap';
            cell.style.overflow = 'hidden';
            cell.style.textOverflow = 'ellipsis';
            cell.style.padding = '0 4px';
            cell.dataset.col = col;
            cell.textContent = col;
            cell.addEventListener('click', () => this._toggleSort(col));
            this.headerEl.appendChild(cell);
        }
        card.appendChild(this.headerEl);

        // Row container
        this.rowContainer = document.createElement('div');
        Object.assign(this.rowContainer.style, {
            flex: '1', overflowY: 'auto', overflowX: 'auto', minHeight: '0',
        });
        card.appendChild(this.rowContainer);

        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);
        this._renderRows();
        this.visible = true;
        this.overlay.style.display = 'flex';
        requestAnimationFrame(() => searchInput.focus());
    }

    _toggleSort(col) {
        if (this.sortCol === col) {
            this.sortAsc = !this.sortAsc;
        } else {
            this.sortCol = col;
            this.sortAsc = true;
        }
        this._updateHeaderIndicators();
        this._renderRows();
    }

    _updateHeaderIndicators() {
        const cells = this.headerEl.children;
        for (const cell of cells) {
            const col = cell.dataset.col;
            const arrow = this.sortCol === col ? (this.sortAsc ? ' \u25B2' : ' \u25BC') : '';
            cell.textContent = col + arrow;
            cell.style.color = this.sortCol === col ? COLORS.accent : COLORS.textDim;
        }
    }

    _getFilteredRows() {
        let result = this.rows;
        if (this.filterText) {
            result = result.filter((row) =>
                this.columns.some((col) =>
                    String(row[col]).toLowerCase().includes(this.filterText)
                )
            );
        }
        if (this.sortCol) {
            const col = this.sortCol;
            const asc = this.sortAsc ? 1 : -1;
            result = [...result].sort((a, b) => {
                let va = a[col];
                let vb = b[col];
                const na = parseFloat(va);
                const nb = parseFloat(vb);
                if (!isNaN(na) && !isNaN(nb)) return (na - nb) * asc;
                return String(va).localeCompare(String(vb)) * asc;
            });
        }
        return result;
    }

    _renderRows() {
        this.rowContainer.innerHTML = '';
        const filtered = this._getFilteredRows();
        const display = filtered.slice(0, 50);

        if (display.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No matching rows found.';
            Object.assign(empty.style, {
                padding: '24px', fontSize: '12px', color: COLORS.textDim, textAlign: 'center',
            });
            this.rowContainer.appendChild(empty);
            return;
        }

        const colTpl = this.columns.map(() => '1fr').join(' ');

        for (let i = 0; i < display.length; i++) {
            const row = display[i];
            const rowEl = document.createElement('div');
            Object.assign(rowEl.style, {
                display: 'grid',
                gridTemplateColumns: colTpl,
                gap: '2px',
                padding: '5px 8px',
                fontSize: '11px',
                color: COLORS.text,
                background: i % 2 === 0 ? 'transparent' : COLORS.panelAlt,
                borderRadius: '3px',
                alignItems: 'center',
                minWidth: 'max-content',
            });

            for (const col of this.columns) {
                const cell = document.createElement('div');
                const val = row[col];
                cell.textContent = val != null ? val : '';
                Object.assign(cell.style, {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: '0 4px',
                    fontFamily: typeof val === 'number' ? MONO : FONT,
                    fontSize: '10px',
                });

                // Apply color rules
                for (const rule of this.colorRules) {
                    if (rule.col === col) {
                        const c = rule.fn(val);
                        if (c) cell.style.color = c;
                    }
                }

                rowEl.appendChild(cell);
            }
            this.rowContainer.appendChild(rowEl);
        }

        // Row count info
        if (filtered.length > 50) {
            const info = document.createElement('div');
            info.textContent = `Showing 50 of ${filtered.length} rows. Use the filter to narrow results.`;
            Object.assign(info.style, {
                padding: '8px', fontSize: '10px', color: COLORS.textDim, textAlign: 'center',
            });
            this.rowContainer.appendChild(info);
        }
    }

    destroy() {
        document.removeEventListener('keydown', this._keyHandler);
        if (this.overlay) this.overlay.remove();
    }
}


// ===========================================================================
// 3. NetworkStats
// ===========================================================================

export class NetworkStats {
    /**
     * @param {Object} correlations - Keyed by signature, each { genes, matrix }
     * @param {Object} hazardRatios - Keyed by signature, each array of gene objects
     */
    constructor(correlations, hazardRatios) {
        this.correlations = correlations;
        this.hazardRatios = hazardRatios;
        this.geneMap = buildGeneMap(hazardRatios);
        this.overlay = null;
        this.visible = false;
        this.sortBy = 'degree';
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.visible) this.hide();
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    show() {
        if (this.overlay) this.overlay.remove();
        this._computeStats();
        this._build();
        this.visible = true;
        this.overlay.style.display = 'flex';
    }

    hide() {
        this.visible = false;
        if (this.overlay) this.overlay.style.display = 'none';
    }

    _computeStats() {
        // Build a unified adjacency from all correlation blocks
        // Merge all genes and their pairwise correlations
        this.allGenes = [];
        this.adjMatrix = {};
        const threshold = 0.15;

        if (!this.correlations) return;

        for (const sigData of Object.values(this.correlations)) {
            const genes = sigData.genes;
            const matrix = sigData.matrix;
            for (let i = 0; i < genes.length; i++) {
                if (!this.allGenes.includes(genes[i])) this.allGenes.push(genes[i]);
                if (!this.adjMatrix[genes[i]]) this.adjMatrix[genes[i]] = {};
                for (let j = 0; j < genes.length; j++) {
                    if (i === j) continue;
                    if (!this.allGenes.includes(genes[j])) this.allGenes.push(genes[j]);
                    const r = matrix[i][j];
                    // Store the highest absolute correlation if duplicated across signatures
                    const existing = this.adjMatrix[genes[i]][genes[j]];
                    if (existing == null || Math.abs(r) > Math.abs(existing)) {
                        this.adjMatrix[genes[i]][genes[j]] = r;
                    }
                }
            }
        }

        // Compute per-gene stats
        this.geneStats = [];
        let totalEdges = 0;
        const edgeSeen = new Set();

        for (const gene of this.allGenes) {
            const neighbors = this.adjMatrix[gene] || {};
            let degree = 0;
            let weightedDegree = 0;
            let maxCorrPartner = null;
            let maxCorrVal = 0;

            for (const [other, r] of Object.entries(neighbors)) {
                if (Math.abs(r) > threshold) {
                    degree++;
                    weightedDegree += Math.abs(r);

                    const edgeKey = [gene, other].sort().join('::');
                    if (!edgeSeen.has(edgeKey)) {
                        edgeSeen.add(edgeKey);
                        totalEdges++;
                    }

                    if (Math.abs(r) > Math.abs(maxCorrVal)) {
                        maxCorrVal = r;
                        maxCorrPartner = other;
                    }
                }
            }

            this.geneStats.push({
                gene,
                degree,
                weightedDegree,
                maxCorrPartner: maxCorrPartner || 'N/A',
                maxCorrVal,
                // Simplified betweenness: count how many gene pairs (i,j) where
                // this gene is a neighbor of both i and j (acts as a bridge)
                betweenness: 0,
            });
        }

        // Simplified betweenness centrality
        for (const stat of this.geneStats) {
            const gene = stat.gene;
            const neighbors = Object.entries(this.adjMatrix[gene] || {})
                .filter(([, r]) => Math.abs(r) > threshold)
                .map(([n]) => n);
            let count = 0;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    const directR = (this.adjMatrix[neighbors[i]] || {})[neighbors[j]];
                    // If neighbors are not directly connected or weakly connected, gene is a bridge
                    if (directR == null || Math.abs(directR) <= threshold) {
                        count++;
                    }
                }
            }
            stat.betweenness = count;
        }

        // Summary stats
        const n = this.allGenes.length;
        const maxPossibleEdges = n * (n - 1) / 2;
        this.summaryStats = {
            totalNodes: n,
            totalEdges,
            density: maxPossibleEdges > 0 ? (totalEdges / maxPossibleEdges) : 0,
            avgDegree: n > 0 ? this.geneStats.reduce((s, g) => s + g.degree, 0) / n : 0,
            avgClustering: this._computeAvgClustering(threshold),
        };
    }

    _computeAvgClustering(threshold) {
        let totalC = 0;
        let countC = 0;
        for (const gene of this.allGenes) {
            const neighbors = Object.entries(this.adjMatrix[gene] || {})
                .filter(([, r]) => Math.abs(r) > threshold)
                .map(([n]) => n);
            const k = neighbors.length;
            if (k < 2) continue;
            let triangles = 0;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    const r = (this.adjMatrix[neighbors[i]] || {})[neighbors[j]];
                    if (r != null && Math.abs(r) > threshold) triangles++;
                }
            }
            const maxTriangles = k * (k - 1) / 2;
            totalC += triangles / maxTriangles;
            countC++;
        }
        return countC > 0 ? totalC / countC : 0;
    }

    _build() {
        this.overlay = createOverlay(() => this.hide());
        const card = createCard({ width: '780px', maxHeight: '90vh' });
        card.appendChild(createCloseBtn(() => this.hide()));

        const title = createTitle('Gene Correlation Network Statistics');
        title.style.marginBottom = '4px';
        card.appendChild(title);

        // Summary row
        const summaryRow = document.createElement('div');
        Object.assign(summaryRow.style, {
            display: 'flex', gap: '16px', marginBottom: '14px',
            flexWrap: 'wrap', padding: '8px 0',
        });
        const summaryItems = [
            { label: 'Nodes', value: this.summaryStats.totalNodes },
            { label: 'Edges (|r| > 0.15)', value: this.summaryStats.totalEdges },
            { label: 'Density', value: this.summaryStats.density.toFixed(3) },
            { label: 'Avg Degree', value: this.summaryStats.avgDegree.toFixed(1) },
            { label: 'Avg Clustering', value: this.summaryStats.avgClustering.toFixed(3) },
        ];
        for (const item of summaryItems) {
            const box = document.createElement('div');
            Object.assign(box.style, {
                background: 'rgba(100,120,255,0.06)',
                borderRadius: '8px',
                padding: '8px 14px',
                border: `1px solid ${COLORS.border}`,
                textAlign: 'center',
            });
            const val = document.createElement('div');
            val.textContent = item.value;
            Object.assign(val.style, {
                fontSize: '16px', fontWeight: '700', fontFamily: MONO, color: COLORS.accent,
            });
            const lbl = document.createElement('div');
            lbl.textContent = item.label;
            Object.assign(lbl.style, {
                fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
                letterSpacing: '0.04em', marginTop: '2px',
            });
            box.append(val, lbl);
            summaryRow.appendChild(box);
        }
        card.appendChild(summaryRow);

        // Degree distribution bar chart (canvas)
        const chartLabel = document.createElement('div');
        chartLabel.textContent = 'Degree Distribution';
        Object.assign(chartLabel.style, {
            fontSize: '10px', color: COLORS.textDim, textTransform: 'uppercase',
            letterSpacing: '0.04em', marginBottom: '4px',
        });
        card.appendChild(chartLabel);

        const chartCanvas = document.createElement('canvas');
        chartCanvas.width = 700;
        chartCanvas.height = 80;
        Object.assign(chartCanvas.style, {
            width: '100%', height: '80px', borderRadius: '6px',
            background: 'rgba(0,0,0,0.2)', marginBottom: '12px',
        });
        card.appendChild(chartCanvas);
        this._drawDegreeDistribution(chartCanvas);

        // Sort controls
        const sortRow = document.createElement('div');
        Object.assign(sortRow.style, {
            display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center',
        });
        const sortLabel = document.createElement('span');
        sortLabel.textContent = 'Sort by:';
        Object.assign(sortLabel.style, { fontSize: '11px', color: COLORS.textDim });
        sortRow.appendChild(sortLabel);

        for (const key of ['degree', 'weightedDegree', 'betweenness']) {
            const labels = { degree: 'Degree', weightedDegree: 'Weighted Degree', betweenness: 'Betweenness' };
            const btn = createButton(labels[key], () => {
                this.sortBy = key;
                this._sortAndRender();
                // Update button styles
                for (const b of sortRow.querySelectorAll('button')) {
                    b.style.background = 'rgba(100,120,255,0.1)';
                    b.style.color = COLORS.accent;
                }
                btn.style.background = 'rgba(100,120,255,0.25)';
                btn.style.color = COLORS.textBright;
            }, { fontSize: '10px', padding: '3px 10px' });
            if (key === this.sortBy) {
                btn.style.background = 'rgba(100,120,255,0.25)';
                btn.style.color = COLORS.textBright;
            }
            sortRow.appendChild(btn);
        }
        card.appendChild(sortRow);

        // Table header
        const headerEl = document.createElement('div');
        Object.assign(headerEl.style, {
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 2fr 1fr 2fr 1fr',
            gap: '4px',
            padding: '6px 8px',
            fontSize: '9px',
            fontWeight: '600',
            color: COLORS.textDim,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderBottom: `1px solid ${COLORS.border}`,
        });
        for (const col of ['Gene', 'Degree', 'W. Degree', 'Betweenness', 'Max Partner', 'Max |r|']) {
            const cell = document.createElement('div');
            cell.textContent = col;
            cell.style.whiteSpace = 'nowrap';
            headerEl.appendChild(cell);
        }
        card.appendChild(headerEl);

        // Row container
        this.rowContainer = document.createElement('div');
        Object.assign(this.rowContainer.style, {
            flex: '1', overflowY: 'auto', minHeight: '0',
        });
        card.appendChild(this.rowContainer);

        this._sortAndRender();
        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);
    }

    _sortAndRender() {
        const sorted = [...this.geneStats].sort((a, b) => b[this.sortBy] - a[this.sortBy]);
        const maxDeg = Math.max(...sorted.map((g) => g.degree), 1);
        this.rowContainer.innerHTML = '';

        for (let i = 0; i < sorted.length; i++) {
            const g = sorted[i];
            const isHub = i < 3;
            const rowEl = document.createElement('div');
            Object.assign(rowEl.style, {
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 2fr 1fr 2fr 1fr',
                gap: '4px',
                padding: '5px 8px',
                fontSize: '11px',
                color: COLORS.text,
                background: i % 2 === 0 ? 'transparent' : COLORS.panelAlt,
                borderRadius: '3px',
                alignItems: 'center',
            });

            // Gene name (hub highlighted)
            const nameCell = document.createElement('div');
            nameCell.textContent = g.gene + (isHub ? ' *' : '');
            Object.assign(nameCell.style, {
                fontFamily: MONO, fontSize: '10px', fontWeight: isHub ? '700' : '500',
                color: isHub ? COLORS.accent : sigColor((this.geneMap[g.gene] || {}).signature),
            });

            // Degree with mini bar
            const degCell = document.createElement('div');
            degCell.style.display = 'flex';
            degCell.style.alignItems = 'center';
            degCell.style.gap = '4px';
            const degBar = document.createElement('div');
            Object.assign(degBar.style, {
                width: '40px', height: '4px', background: 'rgba(255,255,255,0.06)',
                borderRadius: '2px', overflow: 'hidden',
            });
            const degFill = document.createElement('div');
            Object.assign(degFill.style, {
                width: `${(g.degree / maxDeg) * 100}%`, height: '100%',
                background: COLORS.accent, borderRadius: '2px',
            });
            degBar.appendChild(degFill);
            const degVal = document.createElement('span');
            degVal.textContent = g.degree;
            degVal.style.fontFamily = MONO;
            degVal.style.fontSize = '10px';
            degCell.append(degBar, degVal);

            // Weighted degree
            const wdCell = document.createElement('div');
            wdCell.textContent = g.weightedDegree.toFixed(2);
            Object.assign(wdCell.style, { fontFamily: MONO, fontSize: '10px' });

            // Betweenness
            const bcCell = document.createElement('div');
            bcCell.textContent = g.betweenness;
            Object.assign(bcCell.style, { fontFamily: MONO, fontSize: '10px' });

            // Max partner
            const partnerCell = document.createElement('div');
            partnerCell.textContent = g.maxCorrPartner;
            Object.assign(partnerCell.style, { fontFamily: MONO, fontSize: '10px' });

            // Max |r|
            const maxRCell = document.createElement('div');
            maxRCell.textContent = Math.abs(g.maxCorrVal).toFixed(3);
            Object.assign(maxRCell.style, {
                fontFamily: MONO, fontSize: '10px',
                color: g.maxCorrVal >= 0 ? COLORS.positive : COLORS.negative,
            });

            rowEl.append(nameCell, degCell, wdCell, bcCell, partnerCell, maxRCell);
            this.rowContainer.appendChild(rowEl);
        }
    }

    _drawDegreeDistribution(canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Build histogram
        const degrees = this.geneStats.map((g) => g.degree);
        if (degrees.length === 0) return;

        const maxDeg = Math.max(...degrees);
        const bins = new Array(maxDeg + 1).fill(0);
        for (const d of degrees) bins[d]++;
        const maxCount = Math.max(...bins, 1);

        const padding = { left: 40, right: 10, top: 10, bottom: 18 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;
        const barW = Math.max(2, Math.min(20, plotW / bins.length - 2));

        // Axis labels
        ctx.font = `9px ${FONT}`;
        ctx.fillStyle = COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('Degree', w / 2, h - 2);
        ctx.textAlign = 'right';
        ctx.fillText(String(maxCount), padding.left - 4, padding.top + 8);
        ctx.fillText('0', padding.left - 4, h - padding.bottom);

        // Bars
        for (let i = 0; i < bins.length; i++) {
            if (bins[i] === 0) continue;
            const x = padding.left + (i / (bins.length || 1)) * plotW;
            const barH = (bins[i] / maxCount) * plotH;
            ctx.fillStyle = COLORS.accent;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.roundRect(x, padding.top + plotH - barH, barW, barH, [2, 2, 0, 0]);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    destroy() {
        document.removeEventListener('keydown', this._keyHandler);
        if (this.overlay) this.overlay.remove();
    }
}


// ===========================================================================
// 4. CorrelationExplorer
// ===========================================================================

export class CorrelationExplorer {
    /**
     * @param {Object} correlations - Keyed by signature, each { genes, matrix }
     * @param {Object} expressionData - Keyed by patient ID, each { gene: value }
     */
    constructor(correlations, expressionData) {
        this.correlations = correlations;
        this.expression = expressionData || {};
        this.overlay = null;
        this.visible = false;
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.visible) this.hide();
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    show(gene1, gene2) {
        this.gene1 = gene1;
        this.gene2 = gene2;
        if (this.overlay) this.overlay.remove();
        this._build();
        this.visible = true;
        this.overlay.style.display = 'flex';
    }

    hide() {
        this.visible = false;
        if (this.overlay) this.overlay.style.display = 'none';
    }

    _build() {
        this.overlay = createOverlay(() => this.hide());
        const card = createCard({ width: '400px', maxHeight: '420px' });
        card.style.padding = '16px';
        card.appendChild(createCloseBtn(() => this.hide()));

        // Title
        const title = createTitle(`${this.gene1} / ${this.gene2} Correlation`);
        title.style.fontSize = '13px';
        title.style.marginBottom = '8px';
        card.appendChild(title);

        // Pearson r
        const r = getCorrelation(this.correlations, this.gene1, this.gene2);

        const rDisplay = document.createElement('div');
        Object.assign(rDisplay.style, {
            textAlign: 'center', marginBottom: '8px',
        });
        const rVal = document.createElement('span');
        rVal.textContent = r != null ? `r = ${r.toFixed(3)}` : 'r = N/A';
        Object.assign(rVal.style, {
            fontSize: '24px', fontWeight: '700', fontFamily: MONO,
            color: r != null ? (r >= 0 ? COLORS.positive : COLORS.negative) : COLORS.textDim,
        });
        rDisplay.appendChild(rVal);
        card.appendChild(rDisplay);

        // Signature tags
        const tagRow = document.createElement('div');
        Object.assign(tagRow.style, {
            display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '8px',
        });
        for (const gene of [this.gene1, this.gene2]) {
            const blocks = findGeneSignatureBlock(this.correlations, gene);
            for (const sig of blocks) {
                tagRow.appendChild(createTag(`${gene}: ${sig}`, sigColor(sig)));
            }
        }
        card.appendChild(tagRow);

        // Scatter plot canvas
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 200;
        Object.assign(canvas.style, {
            width: '100%', maxWidth: '360px', height: '200px',
            borderRadius: '6px', background: 'rgba(0,0,0,0.25)',
            margin: '0 auto', display: 'block',
        });
        card.appendChild(canvas);

        // Gather expression data and compute stats
        const { points, stats } = this._gatherPoints();
        this._drawScatter(canvas, points);

        // Stats row
        const statsRow = document.createElement('div');
        Object.assign(statsRow.style, {
            display: 'flex', gap: '12px', justifyContent: 'center',
            marginTop: '10px', flexWrap: 'wrap',
        });
        const statItems = [
            { label: 'r', value: stats.r != null ? stats.r.toFixed(3) : 'N/A' },
            { label: 'r\u00B2', value: stats.r2 != null ? stats.r2.toFixed(3) : 'N/A' },
            { label: 'p-value', value: fmtP(stats.pValue) },
            { label: 'n', value: stats.n },
        ];
        for (const item of statItems) {
            const box = document.createElement('div');
            box.style.textAlign = 'center';
            const val = document.createElement('div');
            val.textContent = item.value;
            Object.assign(val.style, {
                fontSize: '13px', fontWeight: '600', fontFamily: MONO, color: COLORS.text,
            });
            const lbl = document.createElement('div');
            lbl.textContent = item.label;
            Object.assign(lbl.style, {
                fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
            });
            box.append(val, lbl);
            statsRow.appendChild(box);
        }
        card.appendChild(statsRow);

        this.overlay.appendChild(card);
        document.body.appendChild(this.overlay);
    }

    _gatherPoints() {
        const points = [];
        const xVals = [];
        const yVals = [];

        for (const [patientId, genes] of Object.entries(this.expression)) {
            const x = genes[this.gene1];
            const y = genes[this.gene2];
            if (x != null && y != null) {
                points.push({ x, y, patientId });
                xVals.push(x);
                yVals.push(y);
            }
        }

        // Compute Pearson r
        const n = xVals.length;
        let r = null;
        let r2 = null;
        let pValue = null;

        if (n >= 3) {
            const meanX = xVals.reduce((s, v) => s + v, 0) / n;
            const meanY = yVals.reduce((s, v) => s + v, 0) / n;
            let sumXY = 0, sumX2 = 0, sumY2 = 0;
            for (let i = 0; i < n; i++) {
                const dx = xVals[i] - meanX;
                const dy = yVals[i] - meanY;
                sumXY += dx * dy;
                sumX2 += dx * dx;
                sumY2 += dy * dy;
            }
            const denom = Math.sqrt(sumX2 * sumY2);
            if (denom > 0) {
                r = sumXY / denom;
                r2 = r * r;
                // Approximate p-value via t-distribution
                const t = r * Math.sqrt((n - 2) / (1 - r2 + 1e-15));
                // Rough two-tailed p-value approximation
                const df = n - 2;
                pValue = 2 * (1 - this._tCDF(Math.abs(t), df));
            }

            // Store regression line params for drawing
            if (sumX2 > 0) {
                this._regSlope = sumXY / sumX2;
                this._regIntercept = meanY - this._regSlope * meanX;
            }
        }

        return {
            points,
            stats: { r, r2, pValue, n },
        };
    }

    /** Approximate Student's t CDF using a rational approximation. */
    _tCDF(t, df) {
        // Use regularized incomplete beta function approximation
        const x = df / (df + t * t);
        // Simple approximation for large df
        if (df > 30) {
            // Use normal approximation
            return this._normalCDF(t);
        }
        // For smaller df, use a rough approach
        const a = df / 2;
        const b = 0.5;
        const beta = this._incompleteBeta(x, a, b);
        return 1 - 0.5 * beta;
    }

    _normalCDF(z) {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const sign = z < 0 ? -1 : 1;
        const az = Math.abs(z) / Math.SQRT2;
        const t = 1.0 / (1.0 + p * az);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-az * az);
        return 0.5 * (1.0 + sign * y);
    }

    _incompleteBeta(x, a, b) {
        // Very rough continued fraction approximation
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        // Use a simple series approximation
        let result = Math.pow(x, a) * Math.pow(1 - x, b);
        let sum = 1;
        let term = 1;
        for (let i = 0; i < 100; i++) {
            term *= (a + i) * x / (a + b + i);
            sum += term;
            if (Math.abs(term) < 1e-10) break;
        }
        // This is a rough approximation
        return Math.min(1, Math.max(0, result * sum / a));
    }

    _drawScatter(canvas, points) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (points.length === 0) {
            ctx.font = `11px ${FONT}`;
            ctx.fillStyle = COLORS.textDim;
            ctx.textAlign = 'center';
            ctx.fillText('No expression data available', w / 2, h / 2);
            return;
        }

        const padding = { left: 45, right: 10, top: 10, bottom: 25 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        const xVals = points.map((p) => p.x);
        const yVals = points.map((p) => p.y);
        const xMin = Math.min(...xVals);
        const xMax = Math.max(...xVals);
        const yMin = Math.min(...yVals);
        const yMax = Math.max(...yVals);
        const xRange = xMax - xMin || 1;
        const yRange = yMax - yMin || 1;

        const toX = (v) => padding.left + ((v - xMin) / xRange) * plotW;
        const toY = (v) => padding.top + plotH - ((v - yMin) / yRange) * plotH;

        // Axis labels
        ctx.font = `8px ${FONT}`;
        ctx.fillStyle = COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.fillText(this.gene1, padding.left + plotW / 2, h - 3);
        ctx.save();
        ctx.translate(10, padding.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(this.gene2, 0, 0);
        ctx.restore();

        // Draw points
        for (const pt of points) {
            const px = toX(pt.x);
            const py = toY(pt.y);
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.accent;
            ctx.globalAlpha = 0.6;
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Regression line
        if (this._regSlope != null) {
            const lx1 = xMin;
            const lx2 = xMax;
            const ly1 = this._regSlope * lx1 + this._regIntercept;
            const ly2 = this._regSlope * lx2 + this._regIntercept;
            ctx.strokeStyle = COLORS.overlap;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(toX(lx1), toY(ly1));
            ctx.lineTo(toX(lx2), toY(ly2));
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    destroy() {
        document.removeEventListener('keydown', this._keyHandler);
        if (this.overlay) this.overlay.remove();
    }
}


// ===========================================================================
// 5. MultiSelect
// ===========================================================================

export class MultiSelect {
    constructor() {
        this.selectedGenes = new Map(); // name -> geneData
        this.selectedPatients = new Map(); // id -> patientData
        this.maxItems = 10;
        this.panel = null;
        this.visible = false;
        this.onCompare = null; // Set externally to hook up GeneComparison
    }

    addGene(geneData) {
        if (!geneData || !geneData.gene) return;
        if (this.selectedGenes.size + this.selectedPatients.size >= this.maxItems) return;
        this.selectedGenes.set(geneData.gene, geneData);
        this._updatePanel();
    }

    removeGene(geneName) {
        this.selectedGenes.delete(geneName);
        this._updatePanel();
    }

    addPatient(patientData) {
        const id = patientData.patientId || patientData.id;
        if (!id) return;
        if (this.selectedGenes.size + this.selectedPatients.size >= this.maxItems) return;
        this.selectedPatients.set(id, patientData);
        this._updatePanel();
    }

    removePatient(patientId) {
        this.selectedPatients.delete(patientId);
        this._updatePanel();
    }

    clear() {
        this.selectedGenes.clear();
        this.selectedPatients.clear();
        this._updatePanel();
    }

    getSelectedGenes() {
        return Array.from(this.selectedGenes.values());
    }

    getSelectedPatients() {
        return Array.from(this.selectedPatients.values());
    }

    getTotalCount() {
        return this.selectedGenes.size + this.selectedPatients.size;
    }

    showSummary() {
        this.visible = true;
        if (!this.panel) this._buildPanel();
        this.panel.style.display = 'flex';
        this._renderPanel();
    }

    hideSummary() {
        this.visible = false;
        if (this.panel) this.panel.style.display = 'none';
    }

    _buildPanel() {
        this.panel = document.createElement('div');
        Object.assign(this.panel.style, {
            position: 'fixed',
            bottom: '16px',
            left: '16px',
            zIndex: '800',
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '10px',
            padding: '14px',
            width: '280px',
            maxHeight: '360px',
            display: 'none',
            flexDirection: 'column',
            boxShadow: '0 6px 30px rgba(0,0,0,0.5)',
            fontFamily: FONT,
            overflowY: 'auto',
        });
        document.body.appendChild(this.panel);
    }

    _updatePanel() {
        if (this.visible) this._renderPanel();
        // Dispatch custom event for external badge updates
        document.dispatchEvent(new CustomEvent('multiselect-change', {
            detail: { count: this.getTotalCount() },
        }));
    }

    _renderPanel() {
        if (!this.panel) this._buildPanel();
        this.panel.innerHTML = '';

        // Title
        const title = document.createElement('div');
        title.textContent = `Selection (${this.getTotalCount()})`;
        Object.assign(title.style, {
            fontSize: '12px', fontWeight: '700', color: COLORS.textBright,
            marginBottom: '10px',
        });
        this.panel.appendChild(title);

        // Genes section
        if (this.selectedGenes.size > 0) {
            this._renderGeneSection();
        }

        // Patients section
        if (this.selectedPatients.size > 0) {
            this._renderPatientSection();
        }

        // Buttons
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, {
            display: 'flex', gap: '6px', marginTop: '10px',
        });

        btnRow.appendChild(createButton('Clear', () => {
            this.clear();
        }, { bg: 'rgba(248,113,113,0.1)', color: COLORS.ros, bgHover: 'rgba(248,113,113,0.2)' }));

        if (this.selectedGenes.size === 2) {
            btnRow.appendChild(createButton('Compare', () => {
                const genes = this.getSelectedGenes();
                if (this.onCompare) {
                    this.onCompare(genes[0].gene, genes[1].gene);
                }
            }));
        }

        this.panel.appendChild(btnRow);

        if (this.getTotalCount() === 0) {
            this.hideSummary();
        }
    }

    _renderGeneSection() {
        const sec = document.createElement('div');
        sec.style.marginBottom = '8px';

        const header = document.createElement('div');
        header.textContent = `Genes (${this.selectedGenes.size})`;
        Object.assign(header.style, {
            fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
            letterSpacing: '0.04em', marginBottom: '4px',
        });
        sec.appendChild(header);

        // Mean HR
        const genes = this.getSelectedGenes();
        const hrs = genes.map((g) => g.hazard_ratio).filter((v) => v != null);
        if (hrs.length > 0) {
            const meanHR = hrs.reduce((s, v) => s + v, 0) / hrs.length;
            const stat = document.createElement('div');
            stat.textContent = `Mean HR: ${meanHR.toFixed(3)}`;
            Object.assign(stat.style, {
                fontSize: '10px', color: COLORS.text, fontFamily: MONO, marginBottom: '4px',
            });
            sec.appendChild(stat);
        }

        // Shared pathways across all selected genes
        // (We would need annotations for this; show count instead)

        // Gene list with remove buttons
        for (const g of genes) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '3px 0',
            });
            const name = document.createElement('span');
            name.textContent = g.gene;
            Object.assign(name.style, {
                fontSize: '11px', fontFamily: MONO, fontWeight: '600',
                color: sigColor(g.signature),
            });
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u00D7';
            removeBtn.setAttribute('aria-label', `Remove ${g.gene}`);
            Object.assign(removeBtn.style, {
                background: 'none', border: 'none', color: COLORS.textDim,
                fontSize: '14px', cursor: 'pointer', padding: '0 4px',
                lineHeight: '1', fontFamily: FONT,
            });
            removeBtn.addEventListener('click', () => this.removeGene(g.gene));
            removeBtn.addEventListener('mouseenter', () => { removeBtn.style.color = COLORS.ros; });
            removeBtn.addEventListener('mouseleave', () => { removeBtn.style.color = COLORS.textDim; });
            row.append(name, removeBtn);
            sec.appendChild(row);
        }

        this.panel.appendChild(sec);
    }

    _renderPatientSection() {
        const sec = document.createElement('div');
        sec.style.marginBottom = '8px';

        const header = document.createElement('div');
        header.textContent = `Patients (${this.selectedPatients.size})`;
        Object.assign(header.style, {
            fontSize: '9px', color: COLORS.textDim, textTransform: 'uppercase',
            letterSpacing: '0.04em', marginBottom: '4px',
        });
        sec.appendChild(header);

        const patients = this.getSelectedPatients();

        // Mean survival
        const survivals = patients
            .map((p) => p.OS_months)
            .filter((v) => v != null);
        if (survivals.length > 0) {
            const meanSurv = survivals.reduce((s, v) => s + v, 0) / survivals.length;
            const stat = document.createElement('div');
            stat.textContent = `Mean survival: ${meanSurv.toFixed(1)} mo`;
            Object.assign(stat.style, {
                fontSize: '10px', color: COLORS.text, fontFamily: MONO, marginBottom: '2px',
            });
            sec.appendChild(stat);
        }

        // Survival rate
        const events = patients.map((p) => p.OS_event).filter((v) => v != null);
        if (events.length > 0) {
            const alive = events.filter((v) => v === 0).length;
            const rate = ((alive / events.length) * 100).toFixed(0);
            const stat = document.createElement('div');
            stat.textContent = `Survival rate: ${rate}% (${alive}/${events.length})`;
            Object.assign(stat.style, {
                fontSize: '10px', color: COLORS.text, fontFamily: MONO, marginBottom: '4px',
            });
            sec.appendChild(stat);
        }

        // Patient list with remove buttons
        for (const p of patients) {
            const id = p.patientId || p.id;
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '2px 0',
            });
            const name = document.createElement('span');
            // Show truncated ID
            const shortId = id.length > 16 ? id.slice(-12) : id;
            name.textContent = shortId;
            Object.assign(name.style, {
                fontSize: '10px', fontFamily: MONO, color: COLORS.text,
            });
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u00D7';
            removeBtn.setAttribute('aria-label', `Remove ${id}`);
            Object.assign(removeBtn.style, {
                background: 'none', border: 'none', color: COLORS.textDim,
                fontSize: '14px', cursor: 'pointer', padding: '0 4px',
                lineHeight: '1', fontFamily: FONT,
            });
            removeBtn.addEventListener('click', () => this.removePatient(id));
            removeBtn.addEventListener('mouseenter', () => { removeBtn.style.color = COLORS.ros; });
            removeBtn.addEventListener('mouseleave', () => { removeBtn.style.color = COLORS.textDim; });
            row.append(name, removeBtn);
            sec.appendChild(row);
        }

        this.panel.appendChild(sec);
    }

    destroy() {
        if (this.panel) this.panel.remove();
    }
}
