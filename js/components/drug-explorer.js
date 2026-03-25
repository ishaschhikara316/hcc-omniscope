/**
 * DrugExplorer - Interactive Drug Sensitivity Analysis Modal
 * Displays a filterable, sorted table of drug correlations with
 * ROS/Ferroptosis and Altitude Adaptation signatures.
 * Pure vanilla JS, no external dependencies.
 */

const COLORS = {
    bg: 'rgba(10, 10, 26, 0.95)',
    panel: '#0c0c1e',
    panelAlt: 'rgba(100, 120, 255, 0.04)',
    border: 'rgba(100, 120, 255, 0.15)',
    borderBright: 'rgba(100, 120, 255, 0.3)',
    text: '#e0e0f0',
    textDim: '#8888aa',
    textBright: '#ffffff',
    accent: '#6c8cff',
    sensitive: '#4ade80',
    resistant: '#f87171',
    ros: '#f87171',
    altitude: '#4ade80',
    overlap: '#fbbf24',
};

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

// Known drug category keywords for classification
const FERROPTOSIS_KEYWORDS = [
    'erastin', 'rsl3', 'fin56', 'ml162', 'sorafenib', 'sulfasalazine',
    'artesunate', 'withaferin', 'gpx4', 'ferroptosis', 'glutathione',
    'bso', 'cystine',
];
const KINASE_KEYWORDS = [
    'imatinib', 'dasatinib', 'nilotinib', 'sunitinib', 'erlotinib',
    'gefitinib', 'lapatinib', 'vemurafenib', 'dabrafenib', 'trametinib',
    'selumetinib', 'crizotinib', 'axitinib', 'pazopanib', 'regorafenib',
    'lenvatinib', 'cabozantinib', 'ponatinib', 'ruxolitinib', 'ibrutinib',
    'bosutinib', 'afatinib', 'osimertinib', 'neratinib', 'kinase',
    'staurosporine', 'midostaurin',
];

function classifyDrug(name) {
    const lower = name.toLowerCase();
    if (FERROPTOSIS_KEYWORDS.some((kw) => lower.includes(kw))) return 'Ferroptosis inducers';
    if (KINASE_KEYWORDS.some((kw) => lower.includes(kw))) return 'Kinase inhibitors';
    return 'Other';
}

export class DrugExplorer {
    /**
     * @param {Array<object>} drugData - Array of drug objects from drug_sensitivity.json
     */
    constructor(drugData) {
        this.rawData = Array.isArray(drugData) ? drugData : [];
        this.overlay = null;
        this.visible = false;
        this.filterText = '';
        this.activeCategory = 'all';

        // Preprocess: classify and sort by max absolute correlation
        this.drugs = this._preprocess(this.rawData);

        this._buildDOM();
    }

    /**
     * Normalize drug data, classify, and sort.
     */
    _preprocess(data) {
        return data.map((d) => {
            const rosCorr = d.ros_correlation ?? d.correlation_ros ?? d.cor_ros ?? 0;
            const altCorr = d.altitude_correlation ?? d.correlation_altitude ?? d.cor_altitude ?? 0;
            const maxAbs = Math.max(Math.abs(rosCorr), Math.abs(altCorr));

            return {
                name: d.drug_name ?? d.name ?? d.drug ?? 'Unknown',
                rosCorr,
                altCorr,
                maxAbs,
                category: classifyDrug(d.drug_name ?? d.name ?? d.drug ?? ''),
            };
        }).sort((a, b) => b.maxAbs - a.maxAbs);
    }

    _buildDOM() {
        // Overlay
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '900',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.bg,
            fontFamily: FONT,
        });
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        // Modal card
        this.card = document.createElement('div');
        Object.assign(this.card.style, {
            position: 'relative',
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '12px',
            padding: '20px',
            width: '620px',
            maxWidth: '95vw',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        });

        // Close button
        const closeBtn = this._createCloseBtn();

        // Title
        const titleEl = document.createElement('h2');
        titleEl.textContent = 'Drug Sensitivity Analysis';
        Object.assign(titleEl.style, {
            margin: '0 0 4px 0',
            fontSize: '15px',
            fontWeight: '700',
            color: COLORS.textBright,
            letterSpacing: '0.02em',
        });

        // Subtitle
        const subtitle = document.createElement('p');
        subtitle.textContent = 'Top drugs ranked by absolute correlation with prognostic signatures';
        Object.assign(subtitle.style, {
            margin: '0 0 12px 0',
            fontSize: '11px',
            color: COLORS.textDim,
        });

        // Controls row: search + category filter
        const controls = document.createElement('div');
        Object.assign(controls.style, {
            display: 'flex',
            gap: '8px',
            marginBottom: '12px',
            flexWrap: 'wrap',
        });

        // Search input
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.placeholder = 'Search drugs...';
        this.searchInput.setAttribute('aria-label', 'Filter drugs by name');
        Object.assign(this.searchInput.style, {
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
        this.searchInput.addEventListener('focus', () => {
            this.searchInput.style.borderColor = COLORS.borderBright;
        });
        this.searchInput.addEventListener('blur', () => {
            this.searchInput.style.borderColor = COLORS.border;
        });
        this.searchInput.addEventListener('input', () => {
            this.filterText = this.searchInput.value.toLowerCase();
            this._renderList();
        });

        // Category pills
        this.categoryContainer = document.createElement('div');
        Object.assign(this.categoryContainer.style, {
            display: 'flex',
            gap: '4px',
        });
        const categories = ['all', 'Ferroptosis inducers', 'Kinase inhibitors', 'Other'];
        categories.forEach((cat) => {
            const pill = document.createElement('button');
            pill.textContent = cat === 'all' ? 'All' : cat;
            pill.dataset.category = cat;
            Object.assign(pill.style, {
                padding: '4px 10px',
                fontSize: '10px',
                fontFamily: FONT,
                fontWeight: '500',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '12px',
                background: cat === 'all' ? 'rgba(100,120,255,0.12)' : 'transparent',
                color: cat === 'all' ? COLORS.accent : COLORS.textDim,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
            });
            pill.addEventListener('click', () => {
                this.activeCategory = cat;
                this._updateCategoryPills();
                this._renderList();
            });
            this.categoryContainer.appendChild(pill);
        });

        controls.appendChild(this.searchInput);
        controls.appendChild(this.categoryContainer);

        // Table header
        const header = this._createTableHeader();

        // Scrollable list container
        this.listContainer = document.createElement('div');
        Object.assign(this.listContainer.style, {
            flex: '1',
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: '0',
        });

        // Assemble
        this.card.appendChild(closeBtn);
        this.card.appendChild(titleEl);
        this.card.appendChild(subtitle);
        this.card.appendChild(controls);
        this.card.appendChild(header);
        this.card.appendChild(this.listContainer);
        this.overlay.appendChild(this.card);
        document.body.appendChild(this.overlay);

        // Keyboard close
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.visible) this.hide();
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    _createCloseBtn() {
        const btn = document.createElement('button');
        btn.textContent = '\u00D7';
        btn.setAttribute('aria-label', 'Close drug explorer');
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
        btn.addEventListener('click', () => this.hide());
        return btn;
    }

    _createTableHeader() {
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'grid',
            gridTemplateColumns: '3fr 2fr 2fr 1fr',
            gap: '4px',
            padding: '6px 8px',
            fontSize: '10px',
            fontWeight: '600',
            color: COLORS.textDim,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderBottom: `1px solid ${COLORS.border}`,
            marginBottom: '2px',
        });
        const cols = ['Drug', 'ROS Correlation', 'Altitude Correlation', 'Category'];
        cols.forEach((label) => {
            const cell = document.createElement('div');
            cell.textContent = label;
            header.appendChild(cell);
        });
        return header;
    }

    _updateCategoryPills() {
        const pills = this.categoryContainer.querySelectorAll('button');
        pills.forEach((pill) => {
            const isActive = pill.dataset.category === this.activeCategory;
            pill.style.background = isActive ? 'rgba(100,120,255,0.12)' : 'transparent';
            pill.style.color = isActive ? COLORS.accent : COLORS.textDim;
        });
    }

    _getFilteredDrugs() {
        let list = this.drugs;

        if (this.activeCategory !== 'all') {
            list = list.filter((d) => d.category === this.activeCategory);
        }

        if (this.filterText) {
            list = list.filter((d) => d.name.toLowerCase().includes(this.filterText));
        }

        return list.slice(0, 20);
    }

    _renderList() {
        const filtered = this._getFilteredDrugs();
        this.listContainer.innerHTML = '';

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No drugs match the current filter.';
            Object.assign(empty.style, {
                padding: '24px 8px',
                fontSize: '12px',
                color: COLORS.textDim,
                textAlign: 'center',
            });
            this.listContainer.appendChild(empty);
            return;
        }

        // Find max correlation for bar scaling
        const maxCorr = Math.max(...filtered.map((d) => d.maxAbs), 0.01);

        filtered.forEach((drug, i) => {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'grid',
                gridTemplateColumns: '3fr 2fr 2fr 1fr',
                gap: '4px',
                padding: '7px 8px',
                fontSize: '11px',
                color: COLORS.text,
                background: i % 2 === 0 ? 'transparent' : COLORS.panelAlt,
                borderRadius: '4px',
                alignItems: 'center',
            });

            // Drug name
            const nameCell = document.createElement('div');
            nameCell.textContent = drug.name;
            Object.assign(nameCell.style, {
                fontWeight: '500',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            });

            // ROS correlation bar
            const rosCell = this._createCorrBar(drug.rosCorr, maxCorr, COLORS.ros);

            // Altitude correlation bar
            const altCell = this._createCorrBar(drug.altCorr, maxCorr, COLORS.altitude);

            // Category badge
            const catCell = document.createElement('div');
            const badge = document.createElement('span');
            badge.textContent = this._shortCategory(drug.category);
            const badgeColor = drug.category === 'Ferroptosis inducers' ? COLORS.overlap
                : drug.category === 'Kinase inhibitors' ? COLORS.accent
                : COLORS.textDim;
            Object.assign(badge.style, {
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '8px',
                background: `${badgeColor}20`,
                color: badgeColor,
                fontWeight: '500',
                whiteSpace: 'nowrap',
            });
            catCell.appendChild(badge);

            row.appendChild(nameCell);
            row.appendChild(rosCell);
            row.appendChild(altCell);
            row.appendChild(catCell);

            this.listContainer.appendChild(row);
        });
    }

    /**
     * Create a correlation bar cell.
     * Green for negative correlation (sensitive in high-risk),
     * Red for positive correlation (resistant in high-risk).
     */
    _createCorrBar(value, maxCorr, baseColor) {
        const cell = document.createElement('div');
        Object.assign(cell.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
        });

        // Bar container
        const barOuter = document.createElement('div');
        Object.assign(barOuter.style, {
            flex: '1',
            height: '6px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '3px',
            overflow: 'hidden',
            position: 'relative',
        });

        const barFill = document.createElement('div');
        const pct = Math.min(Math.abs(value) / maxCorr * 100, 100);
        // Negative correlation = sensitive (green), positive = resistant (red)
        const fillColor = value < 0 ? COLORS.sensitive : COLORS.resistant;
        Object.assign(barFill.style, {
            width: `${pct}%`,
            height: '100%',
            background: fillColor,
            borderRadius: '3px',
            transition: 'width 0.3s ease',
        });
        barOuter.appendChild(barFill);

        // Numeric label
        const label = document.createElement('span');
        label.textContent = value.toFixed(3);
        Object.assign(label.style, {
            fontSize: '10px',
            color: COLORS.textDim,
            minWidth: '40px',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
        });

        cell.appendChild(barOuter);
        cell.appendChild(label);
        return cell;
    }

    _shortCategory(cat) {
        if (cat === 'Ferroptosis inducers') return 'Ferr.';
        if (cat === 'Kinase inhibitors') return 'Kinase';
        return 'Other';
    }

    /** Show the drug explorer modal. */
    show() {
        this.visible = true;
        this.overlay.style.display = 'flex';
        this.filterText = '';
        this.activeCategory = 'all';
        this.searchInput.value = '';
        this._updateCategoryPills();
        this._renderList();
        // Focus search on open for quick filtering
        requestAnimationFrame(() => this.searchInput.focus());
    }

    /** Hide the drug explorer modal. */
    hide() {
        this.visible = false;
        this.overlay.style.display = 'none';
    }

    /** Clean up event listeners. */
    destroy() {
        document.removeEventListener('keydown', this._keyHandler);
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}
