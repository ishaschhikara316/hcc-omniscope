/**
 * Interactive Features - Utility classes for HCC OmniScope 3D visualization.
 * Pure vanilla JS ES module. No frameworks, no em dashes.
 */

/* ========================================================================
   1. GeneSearch - Autocomplete search bar for finding genes in the 3D view
   ======================================================================== */

export class GeneSearch {
    /**
     * @param {HTMLElement} containerEl - DOM element to append the search input into
     * @param {string[]} allGenes - Array of gene symbol strings
     * @param {function} onSelect - Callback(geneName) when user selects a gene
     */
    constructor(containerEl, allGenes, onSelect) {
        this.containerEl = containerEl;
        this.allGenes = allGenes.slice().sort();
        this.onSelect = onSelect;
        this.activeIndex = -1;
        this.filteredGenes = [];
        this.isOpen = false;

        this._build();
        this._attachEvents();
    }

    _build() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'gene-search-wrapper';
        Object.assign(this.wrapper.style, {
            position: 'relative',
            width: '100%',
            marginBottom: '0.5rem',
        });

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Search genes...';
        this.input.className = 'gene-search-input';
        this.input.setAttribute('autocomplete', 'off');
        this.input.setAttribute('aria-label', 'Search genes');
        this.input.setAttribute('aria-autocomplete', 'list');
        this.input.setAttribute('role', 'combobox');
        this.input.setAttribute('aria-expanded', 'false');
        Object.assign(this.input.style, {
            width: '100%',
            padding: '0.4rem 0.6rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text)',
            fontSize: '0.74rem',
            fontFamily: 'var(--font)',
            outline: 'none',
            transition: 'border-color 0.2s ease',
        });

        this.dropdown = document.createElement('ul');
        this.dropdown.className = 'gene-search-dropdown';
        this.dropdown.setAttribute('role', 'listbox');
        Object.assign(this.dropdown.style, {
            position: 'absolute',
            top: '100%',
            left: '0',
            right: '0',
            margin: '0',
            padding: '0',
            listStyle: 'none',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            maxHeight: '160px',
            overflowY: 'auto',
            zIndex: '100',
            display: 'none',
            backdropFilter: 'blur(16px)',
        });

        this.wrapper.appendChild(this.input);
        this.wrapper.appendChild(this.dropdown);
        this.containerEl.appendChild(this.wrapper);
    }

    _attachEvents() {
        this.input.addEventListener('input', () => this._onInput());
        this.input.addEventListener('keydown', (e) => this._onKeydown(e));
        this.input.addEventListener('focus', () => {
            this.input.style.borderColor = 'var(--accent)';
            if (this.input.value.length > 0) this._onInput();
        });
        this.input.addEventListener('blur', () => {
            this.input.style.borderColor = 'var(--border)';
            // Delay to allow click on dropdown item
            setTimeout(() => this._closeDropdown(), 150);
        });
    }

    _onInput() {
        const query = this.input.value.trim().toUpperCase();
        if (query.length === 0) {
            this._closeDropdown();
            return;
        }

        this.filteredGenes = this.allGenes.filter(g =>
            g.toUpperCase().includes(query)
        );
        // Sort: starts-with matches first, then contains
        this.filteredGenes.sort((a, b) => {
            const aStarts = a.toUpperCase().startsWith(query) ? 0 : 1;
            const bStarts = b.toUpperCase().startsWith(query) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return a.localeCompare(b);
        });
        this.filteredGenes = this.filteredGenes.slice(0, 20);

        this._renderDropdown();
    }

    _renderDropdown() {
        this.dropdown.innerHTML = '';
        this.activeIndex = -1;

        if (this.filteredGenes.length === 0) {
            this._closeDropdown();
            return;
        }

        this.filteredGenes.forEach((gene, idx) => {
            const li = document.createElement('li');
            li.textContent = gene;
            li.setAttribute('role', 'option');
            li.dataset.index = idx;
            Object.assign(li.style, {
                padding: '0.35rem 0.6rem',
                fontSize: '0.72rem',
                fontFamily: 'var(--mono)',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'background 0.15s',
            });
            li.addEventListener('mouseenter', () => {
                this._highlightIndex(idx);
            });
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._selectGene(gene);
            });
            this.dropdown.appendChild(li);
        });

        this.dropdown.style.display = 'block';
        this.isOpen = true;
        this.input.setAttribute('aria-expanded', 'true');
    }

    _highlightIndex(idx) {
        const items = this.dropdown.querySelectorAll('li');
        items.forEach((li, i) => {
            li.style.background = i === idx ? 'rgba(100,120,255,0.2)' : 'transparent';
        });
        this.activeIndex = idx;
    }

    _onKeydown(e) {
        if (!this.isOpen) return;
        const count = this.filteredGenes.length;
        if (count === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._highlightIndex(this.activeIndex < count - 1 ? this.activeIndex + 1 : 0);
            this._scrollToActive();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._highlightIndex(this.activeIndex > 0 ? this.activeIndex - 1 : count - 1);
            this._scrollToActive();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.activeIndex >= 0 && this.activeIndex < count) {
                this._selectGene(this.filteredGenes[this.activeIndex]);
            }
        } else if (e.key === 'Escape') {
            this._closeDropdown();
        }
    }

    _scrollToActive() {
        const items = this.dropdown.querySelectorAll('li');
        if (items[this.activeIndex]) {
            items[this.activeIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    _selectGene(gene) {
        this.input.value = '';
        this._closeDropdown();
        if (this.onSelect) this.onSelect(gene);
    }

    _closeDropdown() {
        this.dropdown.style.display = 'none';
        this.dropdown.innerHTML = '';
        this.isOpen = false;
        this.activeIndex = -1;
        this.input.setAttribute('aria-expanded', 'false');
    }
}

/* ========================================================================
   2. ExternalLinks - Generates external link HTML for a given gene
   ======================================================================== */

export class ExternalLinks {
    /**
     * Returns HTML string with icon-links to external databases.
     * Links open in new tab, styled as small icon-buttons in a row.
     * @param {string} geneName
     * @returns {string} HTML string
     */
    static getLinksHTML(geneName) {
        const encoded = encodeURIComponent(geneName);

        const links = [
            {
                label: 'GeneCards',
                abbr: 'GC',
                url: `https://www.genecards.org/cgi-bin/carddisp.pl?gene=${encoded}`,
                color: '#6c8cff',
            },
            {
                label: 'UniProt',
                abbr: 'UP',
                url: `https://www.uniprot.org/uniprotkb?query=${encoded}+AND+organism_id:9606`,
                color: '#4ade80',
            },
            {
                label: 'PubMed',
                abbr: 'PM',
                url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encoded}+hepatocellular+carcinoma`,
                color: '#f87171',
            },
            {
                label: 'NCBI Gene',
                abbr: 'NG',
                url: `https://www.ncbi.nlm.nih.gov/gene/?term=${encoded}+homo+sapiens`,
                color: '#fbbf24',
            },
        ];

        const btnStyle = [
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'width:28px',
            'height:22px',
            'border-radius:4px',
            'font-size:0.55rem',
            'font-weight:700',
            'font-family:var(--mono)',
            'text-decoration:none',
            'transition:all 0.2s',
            'border:1px solid var(--border)',
        ].join(';');

        const items = links.map(link => {
            const bg = link.color.replace(')', ',0.15)').replace('rgb', 'rgba').replace('#', '');
            // Convert hex to rgba for background
            const hex = link.color;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const bgColor = `rgba(${r},${g},${b},0.15)`;

            return `<a href="${link.url}" target="_blank" rel="noopener noreferrer"
                title="${link.label}: ${geneName}"
                aria-label="View ${geneName} on ${link.label}"
                style="${btnStyle};background:${bgColor};color:${link.color}"
                onmouseenter="this.style.background='rgba(${r},${g},${b},0.35)'"
                onmouseleave="this.style.background='${bgColor}'"
            >${link.abbr}</a>`;
        });

        return `<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:0.3rem;">
            ${items.join('')}
        </div>`;
    }
}

/* ========================================================================
   3. PatientFilter - Filtering controls for the patient landscape
   ======================================================================== */

export class PatientFilter {
    /**
     * @param {HTMLElement} containerEl - DOM element to append filter controls
     * @param {object[]} patients - Array of patient objects with
     *   { stage, grade, gender, isDeceased, rosScore, altScore, rosGroup, altGroup }
     * @param {function} onChange - Callback(filteredIndices) when filters change
     */
    constructor(containerEl, patients, onChange) {
        this.containerEl = containerEl;
        this.patients = patients;
        this.onChange = onChange;

        this.filters = {
            stage: 'All',
            grade: 'All',
            gender: 'All',
            survival: 'all',   // 'all', 'deceased', 'alive'
            riskGroup: 'All',  // 'All', 'HIGH-HIGH', 'HIGH-LOW', 'LOW-HIGH', 'LOW-LOW'
        };

        this._build();
        this._attachEvents();
        this._applyFilters();
    }

    _build() {
        this.root = document.createElement('div');
        this.root.className = 'patient-filter-root';
        Object.assign(this.root.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
        });

        // Stage dropdown
        this.stageSelect = this._createSelect('Stage', [
            'All', 'I', 'II', 'III', 'IV',
        ]);

        // Grade dropdown
        this.gradeSelect = this._createSelect('Grade', [
            'All', 'G1', 'G2', 'G3', 'G4',
        ]);

        // Gender dropdown
        this.genderSelect = this._createSelect('Gender', [
            'All', 'Male', 'Female',
        ]);

        // Survival radio group
        const survivalRow = document.createElement('div');
        survivalRow.className = 'control-row';
        Object.assign(survivalRow.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            flexWrap: 'wrap',
        });

        const survLabel = document.createElement('label');
        survLabel.textContent = 'Status:';
        Object.assign(survLabel.style, {
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
        });
        survivalRow.appendChild(survLabel);

        this.survivalRadios = {};
        ['all', 'alive', 'deceased'].forEach(val => {
            const lbl = document.createElement('label');
            Object.assign(lbl.style, {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                fontSize: '0.68rem',
                color: 'var(--text)',
                cursor: 'pointer',
            });
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'patient-survival-filter';
            radio.value = val;
            radio.checked = val === 'all';
            Object.assign(radio.style, {
                accentColor: 'var(--accent)',
                width: '12px',
                height: '12px',
            });
            lbl.appendChild(radio);
            lbl.appendChild(document.createTextNode(
                val === 'all' ? 'All' : val === 'alive' ? 'Alive' : 'Deceased'
            ));
            survivalRow.appendChild(lbl);
            this.survivalRadios[val] = radio;
        });

        this.root.appendChild(survivalRow);

        // Risk group dropdown
        this.riskGroupSelect = this._createSelect('Risk', [
            'All', 'HIGH-HIGH', 'HIGH-LOW', 'LOW-HIGH', 'LOW-LOW',
        ]);

        // Count display
        this.countDisplay = document.createElement('div');
        this.countDisplay.className = 'patient-filter-count';
        Object.assign(this.countDisplay.style, {
            fontSize: '0.68rem',
            fontFamily: 'var(--mono)',
            color: 'var(--accent)',
            marginTop: '0.25rem',
            textAlign: 'right',
        });

        this.root.appendChild(this.countDisplay);
        this.containerEl.appendChild(this.root);
    }

    _createSelect(label, options) {
        const row = document.createElement('div');
        row.className = 'control-row';
        Object.assign(row.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
        });

        const lbl = document.createElement('label');
        lbl.textContent = `${label}:`;
        Object.assign(lbl.style, {
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
            minWidth: '38px',
        });

        const select = document.createElement('select');
        select.className = 'patient-filter-select';
        Object.assign(select.style, {
            flex: '1',
            padding: '0.3rem 0.5rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text)',
            fontSize: '0.72rem',
            fontFamily: 'var(--font)',
            cursor: 'pointer',
            outline: 'none',
        });

        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            select.appendChild(o);
        });

        row.appendChild(lbl);
        row.appendChild(select);

        // Insert before the count display (or at end of root)
        if (this.countDisplay) {
            this.root.insertBefore(row, this.countDisplay);
        } else {
            this.root.appendChild(row);
        }

        return select;
    }

    _attachEvents() {
        this.stageSelect.addEventListener('change', () => {
            this.filters.stage = this.stageSelect.value;
            this._applyFilters();
        });
        this.gradeSelect.addEventListener('change', () => {
            this.filters.grade = this.gradeSelect.value;
            this._applyFilters();
        });
        this.genderSelect.addEventListener('change', () => {
            this.filters.gender = this.genderSelect.value;
            this._applyFilters();
        });
        this.riskGroupSelect.addEventListener('change', () => {
            this.filters.riskGroup = this.riskGroupSelect.value;
            this._applyFilters();
        });

        Object.entries(this.survivalRadios).forEach(([val, radio]) => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.filters.survival = val;
                    this._applyFilters();
                }
            });
        });
    }

    _applyFilters() {
        const indices = [];
        const total = this.patients.length;

        this.patients.forEach((p, i) => {
            // Stage filter
            if (this.filters.stage !== 'All') {
                const stage = (p.stage || '').toUpperCase().replace('STAGE ', '');
                if (!stage.startsWith(this.filters.stage)) return;
            }

            // Grade filter
            if (this.filters.grade !== 'All') {
                if ((p.grade || '') !== this.filters.grade) return;
            }

            // Gender filter
            if (this.filters.gender !== 'All') {
                const genderLower = (p.gender || '').toLowerCase();
                const filterLower = this.filters.gender.toLowerCase();
                if (genderLower !== filterLower) return;
            }

            // Survival filter
            if (this.filters.survival === 'deceased' && !p.isDeceased) return;
            if (this.filters.survival === 'alive' && p.isDeceased) return;

            // Risk group filter
            if (this.filters.riskGroup !== 'All') {
                const rosGroup = (p.rosGroup || '').toUpperCase().includes('HIGH') ? 'HIGH' : 'LOW';
                const altGroup = (p.altGroup || '').toUpperCase().includes('HIGH') ? 'HIGH' : 'LOW';
                const combined = `${rosGroup}-${altGroup}`;
                if (combined !== this.filters.riskGroup) return;
            }

            indices.push(i);
        });

        this.countDisplay.textContent = `Showing ${indices.length} / ${total}`;

        if (this.onChange) this.onChange(indices);
    }

    /** Reset all filters to defaults. */
    reset() {
        this.stageSelect.value = 'All';
        this.gradeSelect.value = 'All';
        this.genderSelect.value = 'All';
        this.riskGroupSelect.value = 'All';
        this.survivalRadios['all'].checked = true;
        this.filters = {
            stage: 'All',
            grade: 'All',
            gender: 'All',
            survival: 'all',
            riskGroup: 'All',
        };
        this._applyFilters();
    }
}

/* ========================================================================
   4. RiskCalculator - Modal overlay for predicting risk from gene expression
   ======================================================================== */

export class RiskCalculator {
    /**
     * @param {object} coefficients - Object keyed by gene with {coef/coefficient, signature, mean, std, ...}
     * @param {object} geneAnnotations - Object keyed by gene with {fullName, signature, ...}
     */
    constructor(coefficients, geneAnnotations) {
        this.coefficients = coefficients;
        this.geneAnnotations = geneAnnotations || {};

        // Separate genes into the two signature groups
        this.altitudeGenes = [];
        this.rosGenes = [];

        for (const [gene, info] of Object.entries(coefficients)) {
            const sig = (info.signature || '').toLowerCase();
            const entry = {
                gene,
                coef: info.coefficient ?? info.coef ?? 0,
                mean: info.mean ?? 0,
                std: info.std ?? 1,
                signature: info.signature || '',
            };
            if (sig.includes('altitude') || sig.includes('alt')) {
                this.altitudeGenes.push(entry);
            } else {
                this.rosGenes.push(entry);
            }
        }

        this.altitudeGenes.sort((a, b) => a.gene.localeCompare(b.gene));
        this.rosGenes.sort((a, b) => a.gene.localeCompare(b.gene));

        this.overlay = null;
        this.inputMap = {};
        this._build();
    }

    _build() {
        // Overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'risk-calc-overlay';
        Object.assign(this.overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '60',
            background: 'rgba(0,0,0,0.6)',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
        });

        // Modal container
        const modal = document.createElement('div');
        modal.className = 'risk-calc-modal';
        Object.assign(modal.style, {
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.4rem 1.6rem',
            maxWidth: '560px',
            width: '90vw',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(20px)',
            color: 'var(--text)',
            fontFamily: 'var(--font)',
        });

        // Header row
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
        });

        const title = document.createElement('h3');
        title.textContent = 'Risk Score Calculator';
        Object.assign(title.style, {
            fontSize: '1rem',
            fontWeight: '700',
            color: 'var(--text-bright, #fff)',
            margin: '0',
        });

        this.closeBtn = document.createElement('button');
        this.closeBtn.innerHTML = '&times;';
        Object.assign(this.closeBtn.style, {
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            fontSize: '1.4rem',
            cursor: 'pointer',
            lineHeight: '1',
            padding: '0 0.2rem',
        });
        this.closeBtn.addEventListener('click', () => this.hide());
        this.closeBtn.setAttribute('aria-label', 'Close calculator');

        header.appendChild(title);
        header.appendChild(this.closeBtn);
        modal.appendChild(header);

        // Instructions
        const desc = document.createElement('p');
        desc.textContent = 'Enter gene expression values (FPKM/TPM) to compute risk scores. Fields are pre-filled with cohort median values.';
        Object.assign(desc.style, {
            fontSize: '0.74rem',
            color: 'var(--text-dim)',
            marginBottom: '1rem',
            lineHeight: '1.5',
        });
        modal.appendChild(desc);

        // Altitude section
        modal.appendChild(this._buildSection('Altitude Genes', this.altitudeGenes, 'var(--altitude)'));

        // ROS section
        modal.appendChild(this._buildSection('ROS Genes', this.rosGenes, 'var(--ros)'));

        // Button row
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, {
            display: 'flex',
            gap: '0.5rem',
            marginTop: '1rem',
            marginBottom: '0.8rem',
        });

        this.calcBtn = this._createButton('Calculate', 'var(--accent)', () => this._calculate());
        this.resetBtn = this._createButton('Reset to median', 'var(--text-dim)', () => this._resetValues());

        btnRow.appendChild(this.calcBtn);
        btnRow.appendChild(this.resetBtn);
        modal.appendChild(btnRow);

        // Results area
        this.resultsContainer = document.createElement('div');
        this.resultsContainer.className = 'risk-calc-results';
        Object.assign(this.resultsContainer.style, {
            display: 'none',
            marginTop: '0.5rem',
        });
        modal.appendChild(this.resultsContainer);

        this.overlay.appendChild(modal);
        document.body.appendChild(this.overlay);

        // Close on overlay click (outside modal)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        // Close on Escape
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.overlay.style.display === 'flex') {
                this.hide();
            }
        };
        document.addEventListener('keydown', this._escHandler);
    }

    _buildSection(title, genes, accentColor) {
        const section = document.createElement('div');
        Object.assign(section.style, {
            marginBottom: '0.8rem',
        });

        const heading = document.createElement('h4');
        heading.textContent = title;
        Object.assign(heading.style, {
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: accentColor,
            marginBottom: '0.4rem',
            paddingBottom: '0.25rem',
            borderBottom: '1px solid var(--border)',
            fontWeight: '600',
        });
        section.appendChild(heading);

        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.3rem',
        });

        genes.forEach(entry => {
            const cell = document.createElement('div');
            Object.assign(cell.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.35rem 0.5rem',
                borderRadius: '4px',
            });

            const label = document.createElement('label');
            label.textContent = entry.gene;
            Object.assign(label.style, {
                fontSize: '0.68rem',
                fontFamily: 'var(--mono)',
                color: 'var(--text)',
                fontWeight: '500',
                minWidth: '62px',
                flexShrink: '0',
            });

            const input = document.createElement('input');
            input.type = 'number';
            input.step = 'any';
            input.value = entry.mean.toFixed(1);
            input.setAttribute('aria-label', `${entry.gene} expression value`);
            Object.assign(input.style, {
                flex: '1',
                width: '0',
                minWidth: '50px',
                padding: '0.25rem 0.4rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                color: 'var(--text)',
                fontSize: '0.68rem',
                fontFamily: 'var(--mono)',
                outline: 'none',
                textAlign: 'right',
            });
            input.addEventListener('focus', () => {
                input.style.borderColor = 'var(--accent)';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = 'var(--border)';
            });

            this.inputMap[entry.gene] = input;

            cell.appendChild(label);
            cell.appendChild(input);
            grid.appendChild(cell);
        });

        section.appendChild(grid);
        return section;
    }

    _createButton(text, color, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: '0.45rem 1rem',
            background: 'rgba(100,120,255,0.15)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: color,
            fontSize: '0.75rem',
            fontWeight: '500',
            fontFamily: 'var(--font)',
            cursor: 'pointer',
            transition: 'all 0.2s',
        });
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(100,120,255,0.3)';
            btn.style.borderColor = 'var(--accent)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(100,120,255,0.15)';
            btn.style.borderColor = 'var(--border)';
        });
        btn.addEventListener('click', onClick);
        return btn;
    }

    _resetValues() {
        for (const genes of [this.altitudeGenes, this.rosGenes]) {
            for (const entry of genes) {
                const input = this.inputMap[entry.gene];
                if (input) input.value = entry.mean.toFixed(1);
            }
        }
        this.resultsContainer.style.display = 'none';
    }

    _calculate() {
        // Compute risk scores as sum of (coef * normalized expression)
        let rosScore = 0;
        let altScore = 0;

        for (const entry of this.rosGenes) {
            const raw = parseFloat(this.inputMap[entry.gene]?.value || 0);
            rosScore += entry.coef * raw;
        }

        for (const entry of this.altitudeGenes) {
            const raw = parseFloat(this.inputMap[entry.gene]?.value || 0);
            altScore += entry.coef * raw;
        }

        // Determine risk groups relative to median (0 since median-centered in many models)
        const rosGroup = rosScore >= 0 ? 'HIGH' : 'LOW';
        const altGroup = altScore >= 0 ? 'HIGH' : 'LOW';
        const combinedGroup = `${rosGroup}-${altGroup}`;

        this._renderResults(rosScore, altScore, combinedGroup);
    }

    _renderResults(rosScore, altScore, combinedGroup) {
        this.resultsContainer.innerHTML = '';
        this.resultsContainer.style.display = 'block';

        // Results header
        const header = document.createElement('div');
        Object.assign(header.style, {
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-dim)',
            marginBottom: '0.5rem',
            fontWeight: '600',
        });
        header.textContent = 'Results';
        this.resultsContainer.appendChild(header);

        // Score cards
        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '0.5rem',
            marginBottom: '0.8rem',
        });

        grid.appendChild(this._scoreCard('ROS Score', rosScore.toFixed(4), 'var(--ros)'));
        grid.appendChild(this._scoreCard('Altitude Score', altScore.toFixed(4), 'var(--altitude)'));
        grid.appendChild(this._scoreCard('Risk Group', combinedGroup, this._groupColor(combinedGroup)));

        this.resultsContainer.appendChild(grid);

        // Visual indicator bars
        this.resultsContainer.appendChild(this._scoreBar('ROS Risk', rosScore, 'var(--ros)'));
        this.resultsContainer.appendChild(this._scoreBar('Altitude Risk', altScore, 'var(--altitude)'));
    }

    _scoreCard(label, value, color) {
        const card = document.createElement('div');
        Object.assign(card.style, {
            textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            padding: '0.6rem 0.4rem',
            borderRadius: '6px',
        });

        const lbl = document.createElement('div');
        lbl.textContent = label;
        Object.assign(lbl.style, {
            fontSize: '0.6rem',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.2rem',
        });

        const val = document.createElement('div');
        val.textContent = value;
        Object.assign(val.style, {
            fontSize: '0.88rem',
            fontWeight: '700',
            fontFamily: 'var(--mono)',
            color: color,
        });

        card.appendChild(lbl);
        card.appendChild(val);
        return card;
    }

    _scoreBar(label, score, color) {
        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.4rem',
        });

        const lbl = document.createElement('span');
        lbl.textContent = label;
        Object.assign(lbl.style, {
            fontSize: '0.65rem',
            color: 'var(--text-dim)',
            minWidth: '80px',
            textAlign: 'right',
        });

        const track = document.createElement('div');
        Object.assign(track.style, {
            flex: '1',
            height: '8px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '4px',
            position: 'relative',
            overflow: 'hidden',
        });

        // Center line (median = 0)
        const centerLine = document.createElement('div');
        Object.assign(centerLine.style, {
            position: 'absolute',
            left: '50%',
            top: '0',
            bottom: '0',
            width: '1px',
            background: 'var(--text-dim)',
            opacity: '0.4',
        });
        track.appendChild(centerLine);

        // Score indicator
        // Map score to 0-100% range, clamping at +/- 3 std deviations for visual range
        const clampedPct = Math.min(Math.max((score / 6 + 0.5) * 100, 2), 98);
        const indicator = document.createElement('div');
        Object.assign(indicator.style, {
            position: 'absolute',
            left: `${clampedPct}%`,
            top: '-1px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: color,
            transform: 'translateX(-50%)',
            boxShadow: `0 0 6px ${color}`,
            transition: 'left 0.4s ease',
        });
        track.appendChild(indicator);

        // Labels: LOW and HIGH
        const labelRow = document.createElement('div');
        Object.assign(labelRow.style, {
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
        });

        const lowLabel = document.createElement('span');
        lowLabel.textContent = 'LOW';
        Object.assign(lowLabel.style, {
            fontSize: '0.5rem',
            color: 'var(--text-dim)',
            letterSpacing: '0.05em',
        });

        const highLabel = document.createElement('span');
        highLabel.textContent = 'HIGH';
        Object.assign(highLabel.style, {
            fontSize: '0.5rem',
            color: 'var(--text-dim)',
            letterSpacing: '0.05em',
        });

        const barWrap = document.createElement('div');
        Object.assign(barWrap.style, { flex: '1' });
        barWrap.appendChild(track);

        const subRow = document.createElement('div');
        Object.assign(subRow.style, {
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '0.1rem',
        });
        subRow.appendChild(lowLabel);
        subRow.appendChild(highLabel);
        barWrap.appendChild(subRow);

        row.appendChild(lbl);
        row.appendChild(barWrap);
        return row;
    }

    _groupColor(group) {
        switch (group) {
            case 'HIGH-HIGH': return 'var(--ros)';
            case 'LOW-LOW': return 'var(--altitude)';
            case 'HIGH-LOW': return 'var(--overlap)';
            case 'LOW-HIGH': return 'var(--overlap)';
            default: return 'var(--text)';
        }
    }

    show() {
        this.overlay.style.display = 'flex';
    }

    hide() {
        this.overlay.style.display = 'none';
        this.resultsContainer.style.display = 'none';
    }
}

/* ========================================================================
   5. CohortSwitcher - Toggle between training and validation cohorts
   ======================================================================== */

export class CohortSwitcher {
    /**
     * @param {HTMLElement} containerEl - DOM element to append cohort buttons
     * @param {object} riskScoresData - The full risk scores data object (may contain cohort info)
     * @param {function} onChange - Callback(cohortName) when cohort changes
     */
    constructor(containerEl, riskScoresData, onChange) {
        this.containerEl = containerEl;
        this.riskScoresData = riskScoresData;
        this.onChange = onChange;
        this.activeCohort = 'TCGA';

        // Define cohorts with patient counts
        this.cohorts = [
            { name: 'TCGA', label: 'TCGA', count: 302, type: 'training' },
            { name: 'GSE14520', label: 'GSE14520', count: 221, type: 'validation' },
            { name: 'ICGC-LIRI', label: 'ICGC-LIRI', count: 232, type: 'validation' },
            { name: 'GSE76427', label: 'GSE76427', count: 115, type: 'validation' },
        ];

        this._build();
    }

    _build() {
        this.root = document.createElement('div');
        this.root.className = 'cohort-switcher';
        Object.assign(this.root.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
        });

        // Section label
        const label = document.createElement('div');
        label.textContent = 'Cohort';
        Object.assign(label.style, {
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-dim)',
            marginBottom: '0.2rem',
            fontWeight: '600',
        });
        this.root.appendChild(label);

        // Button group
        const btnGroup = document.createElement('div');
        Object.assign(btnGroup.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.25rem',
        });

        this.buttons = {};

        this.cohorts.forEach(cohort => {
            const btn = document.createElement('button');
            btn.className = 'cohort-btn';
            const isTraining = cohort.type === 'training';

            // Button inner content
            btn.innerHTML = `
                <span style="font-size:0.7rem;font-weight:600;display:block;line-height:1.3;">
                    ${cohort.label}
                </span>
                <span style="font-size:0.58rem;font-family:var(--mono);color:var(--text-dim);display:block;">
                    ${cohort.count} pts ${isTraining ? '(train)' : '(val)'}
                </span>
            `;

            Object.assign(btn.style, {
                padding: '0.4rem 0.5rem',
                background: cohort.name === this.activeCohort
                    ? 'rgba(100,120,255,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${cohort.name === this.activeCohort
                    ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '6px',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center',
                fontFamily: 'var(--font)',
            });

            if (cohort.name === this.activeCohort) {
                btn.style.boxShadow = '0 0 8px rgba(100,120,255,0.15)';
            }

            btn.addEventListener('mouseenter', () => {
                if (cohort.name !== this.activeCohort) {
                    btn.style.background = 'rgba(255,255,255,0.06)';
                    btn.style.borderColor = 'rgba(100,120,255,0.4)';
                }
            });
            btn.addEventListener('mouseleave', () => {
                if (cohort.name !== this.activeCohort) {
                    btn.style.background = 'rgba(255,255,255,0.03)';
                    btn.style.borderColor = 'var(--border)';
                }
            });
            btn.addEventListener('click', () => this._select(cohort.name));
            btn.setAttribute('aria-label', `Switch to ${cohort.label} cohort, ${cohort.count} patients`);

            this.buttons[cohort.name] = btn;
            btnGroup.appendChild(btn);
        });

        this.root.appendChild(btnGroup);
        this.containerEl.appendChild(this.root);
    }

    _select(cohortName) {
        if (cohortName === this.activeCohort) return;

        // Deactivate previous
        const prevBtn = this.buttons[this.activeCohort];
        if (prevBtn) {
            prevBtn.style.background = 'rgba(255,255,255,0.03)';
            prevBtn.style.borderColor = 'var(--border)';
            prevBtn.style.boxShadow = 'none';
        }

        // Activate new
        this.activeCohort = cohortName;
        const newBtn = this.buttons[cohortName];
        if (newBtn) {
            newBtn.style.background = 'rgba(100,120,255,0.15)';
            newBtn.style.borderColor = 'var(--accent)';
            newBtn.style.boxShadow = '0 0 8px rgba(100,120,255,0.15)';
        }

        if (this.onChange) this.onChange(cohortName);
    }

    /** Programmatically set the active cohort without triggering onChange. */
    setActive(cohortName) {
        const prevBtn = this.buttons[this.activeCohort];
        if (prevBtn) {
            prevBtn.style.background = 'rgba(255,255,255,0.03)';
            prevBtn.style.borderColor = 'var(--border)';
            prevBtn.style.boxShadow = 'none';
        }

        this.activeCohort = cohortName;
        const newBtn = this.buttons[cohortName];
        if (newBtn) {
            newBtn.style.background = 'rgba(100,120,255,0.15)';
            newBtn.style.borderColor = 'var(--accent)';
            newBtn.style.boxShadow = '0 0 8px rgba(100,120,255,0.15)';
        }
    }
}
