/**
 * KMCurveViewer - Interactive Kaplan-Meier Survival Curve Renderer
 * Renders KM curves on an HTML5 canvas overlay with dark theme styling.
 * Pure vanilla JS, no external dependencies.
 */

const COLORS = {
    highRisk: '#f87171',
    lowRisk: '#60a5fa',
    bg: 'rgba(10, 10, 26, 0.95)',
    panel: '#0c0c1e',
    border: 'rgba(100, 120, 255, 0.25)',
    grid: 'rgba(100, 120, 255, 0.08)',
    text: '#e0e0f0',
    textDim: '#8888aa',
    textBright: '#ffffff',
    accent: '#6c8cff',
};

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

export class KMCurveViewer {
    /**
     * @param {string} containerId - ID of the parent DOM element
     * @param {object} kmData - Full KM data keyed by signature name
     */
    constructor(containerId, kmData) {
        this.containerId = containerId;
        this.kmData = kmData;
        this.overlay = null;
        this.canvas = null;
        this.ctx = null;
        this.visible = false;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        // Canvas logical dimensions
        this.width = 500;
        this.height = 400;

        // Plot area margins
        this.margin = { top: 50, right: 30, bottom: 70, left: 60 };

        this._buildDOM();
    }

    _buildDOM() {
        // Overlay backdrop
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

        // Card wrapper
        this.card = document.createElement('div');
        Object.assign(this.card.style, {
            position: 'relative',
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        });

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '\u00D7';
        closeBtn.setAttribute('aria-label', 'Close survival curve viewer');
        Object.assign(closeBtn.style, {
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
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.color = COLORS.textBright;
            closeBtn.style.background = 'rgba(255,255,255,0.08)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.color = COLORS.textDim;
            closeBtn.style.background = 'none';
        });
        closeBtn.addEventListener('click', () => this.hide());

        // Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.canvas.style.borderRadius = '6px';
        this.ctx = this.canvas.getContext('2d');
        this.ctx.scale(this.dpr, this.dpr);

        this.card.appendChild(closeBtn);
        this.card.appendChild(this.canvas);
        this.overlay.appendChild(this.card);

        const container = document.getElementById(this.containerId) || document.body;
        container.appendChild(this.overlay);

        // Keyboard close
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.visible) this.hide();
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    /**
     * Show KM curves for a given signature.
     * @param {string} signatureName - Key in kmData (e.g. 'ROS/Ferroptosis')
     * @param {string} [title] - Optional title override
     */
    show(signatureName, title) {
        const sigData = this.kmData[signatureName];
        if (!sigData) {
            console.warn(`KMCurveViewer: No data for signature "${signatureName}"`);
            return;
        }

        this.visible = true;
        this.overlay.style.display = 'flex';
        this._render(sigData, title || `${signatureName} - Kaplan-Meier Survival`);
    }

    /** Hide the overlay. */
    hide() {
        this.visible = false;
        this.overlay.style.display = 'none';
    }

    /**
     * Render the full KM plot onto the canvas.
     */
    _render(sigData, title) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const m = this.margin;
        const plotW = w - m.left - m.right;
        const plotH = h - m.top - m.bottom;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = COLORS.panel;
        ctx.fillRect(0, 0, w, h);

        const highRisk = sigData['High Risk'];
        const lowRisk = sigData['Low Risk'];
        if (!highRisk || !lowRisk) return;

        // Compute axis ranges
        const allTimes = [...highRisk.timeline, ...lowRisk.timeline];
        const maxTime = Math.ceil(Math.max(...allTimes));
        const xMax = maxTime > 0 ? maxTime : 10;

        // Scale helpers
        const xScale = (t) => m.left + (t / xMax) * plotW;
        const yScale = (s) => m.top + (1 - s) * plotH;

        // --- Grid lines ---
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;

        // Horizontal grid (survival 0.0 to 1.0 step 0.2)
        for (let s = 0; s <= 1.0; s += 0.2) {
            const y = yScale(s);
            ctx.beginPath();
            ctx.moveTo(m.left, y);
            ctx.lineTo(m.left + plotW, y);
            ctx.stroke();
        }

        // Vertical grid
        const xStep = this._niceStep(xMax, 5);
        for (let t = 0; t <= xMax; t += xStep) {
            const x = xScale(t);
            ctx.beginPath();
            ctx.moveTo(x, m.top);
            ctx.lineTo(x, m.top + plotH);
            ctx.stroke();
        }

        // --- Axes ---
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(m.left, m.top);
        ctx.lineTo(m.left, m.top + plotH);
        ctx.lineTo(m.left + plotW, m.top + plotH);
        ctx.stroke();

        // --- Axis tick labels ---
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // X-axis ticks
        for (let t = 0; t <= xMax; t += xStep) {
            const x = xScale(t);
            ctx.fillText(t.toFixed(t === Math.floor(t) ? 0 : 1), x, m.top + plotH + 6);

            // Small tick mark
            ctx.beginPath();
            ctx.strokeStyle = COLORS.border;
            ctx.moveTo(x, m.top + plotH);
            ctx.lineTo(x, m.top + plotH + 4);
            ctx.stroke();
        }

        // Y-axis ticks
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let s = 0; s <= 1.0; s += 0.2) {
            const y = yScale(s);
            ctx.fillText(s.toFixed(1), m.left - 8, y);
        }

        // --- Axis labels ---
        ctx.fillStyle = COLORS.text;
        ctx.font = `12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Time (years)', m.left + plotW / 2, h - 22);

        // Y-axis label (rotated)
        ctx.save();
        ctx.translate(16, m.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Survival Probability', 0, 0);
        ctx.restore();

        // --- Draw KM step curves ---
        this._drawStepCurve(ctx, highRisk.timeline, highRisk.survival, xScale, yScale, COLORS.highRisk);
        this._drawStepCurve(ctx, lowRisk.timeline, lowRisk.survival, xScale, yScale, COLORS.lowRisk);

        // --- Title ---
        ctx.fillStyle = COLORS.textBright;
        ctx.font = `bold 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(title, w / 2, 12);

        // --- P-value annotation ---
        if (sigData.logrank_p != null) {
            const pText = sigData.logrank_p < 0.0001
                ? `Log-rank p < 0.0001`
                : `Log-rank p = ${sigData.logrank_p.toExponential(2)}`;
            const statText = sigData.logrank_stat != null
                ? ` (stat = ${sigData.logrank_stat.toFixed(1)})`
                : '';

            ctx.fillStyle = COLORS.accent;
            ctx.font = `11px ${FONT}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(pText + statText, m.left + plotW, m.top + 6);
        }

        // --- Legend ---
        const legendX = m.left + plotW - 130;
        const legendY = m.top + 24;

        // Legend background
        ctx.fillStyle = 'rgba(12, 12, 30, 0.8)';
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        this._roundRect(ctx, legendX - 6, legendY - 4, 136, 42, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = `11px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // High risk legend entry
        ctx.strokeStyle = COLORS.highRisk;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX, legendY + 8);
        ctx.lineTo(legendX + 20, legendY + 8);
        ctx.stroke();
        ctx.fillStyle = COLORS.text;
        ctx.fillText('High Risk', legendX + 26, legendY + 8);

        // Low risk legend entry
        ctx.strokeStyle = COLORS.lowRisk;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX, legendY + 26);
        ctx.lineTo(legendX + 20, legendY + 26);
        ctx.stroke();
        ctx.fillStyle = COLORS.text;
        ctx.fillText('Low Risk', legendX + 26, legendY + 26);

        // --- Patients at risk ---
        this._drawPatientsAtRisk(ctx, highRisk, lowRisk, xScale, xMax, xStep, m, plotH);
    }

    /**
     * Draw a Kaplan-Meier step function curve.
     */
    _drawStepCurve(ctx, timeline, survival, xScale, yScale, color) {
        if (!timeline || timeline.length === 0) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        let prevX = xScale(timeline[0]);
        let prevY = yScale(survival[0]);
        ctx.moveTo(prevX, prevY);

        for (let i = 1; i < timeline.length; i++) {
            const x = xScale(timeline[i]);
            const y = yScale(survival[i]);

            // Horizontal step to new time at previous survival
            ctx.lineTo(x, prevY);
            // Vertical drop to new survival
            ctx.lineTo(x, y);

            prevX = x;
            prevY = y;
        }

        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draw patients-at-risk numbers below the x-axis.
     */
    _drawPatientsAtRisk(ctx, highRisk, lowRisk, xScale, xMax, xStep, m, plotH) {
        // We estimate patients at risk at each time tick based on the survival curve
        // approximation: count = round(survival * initial_count) where initial_count = timeline.length
        const baseY = m.top + plotH + 28;

        ctx.font = `10px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Label
        ctx.fillStyle = COLORS.highRisk;
        ctx.textAlign = 'right';
        ctx.fillText('High:', m.left - 4, baseY);
        ctx.fillStyle = COLORS.lowRisk;
        ctx.fillText('Low:', m.left - 4, baseY + 14);

        ctx.textAlign = 'center';

        for (let t = 0; t <= xMax; t += xStep) {
            const x = xScale(t);

            // Find survival at time t for each group
            const highSurv = this._survivalAt(highRisk.timeline, highRisk.survival, t);
            const lowSurv = this._survivalAt(lowRisk.timeline, lowRisk.survival, t);

            const highN = Math.round(highSurv * highRisk.timeline.length);
            const lowN = Math.round(lowSurv * lowRisk.timeline.length);

            ctx.fillStyle = COLORS.highRisk;
            ctx.fillText(String(highN), x, baseY);

            ctx.fillStyle = COLORS.lowRisk;
            ctx.fillText(String(lowN), x, baseY + 14);
        }
    }

    /**
     * Get survival probability at a given time from step data.
     */
    _survivalAt(timeline, survival, t) {
        let s = 1.0;
        for (let i = 0; i < timeline.length; i++) {
            if (timeline[i] <= t) {
                s = survival[i];
            } else {
                break;
            }
        }
        return s;
    }

    /**
     * Compute a nice step size for axis ticks.
     */
    _niceStep(range, approxTicks) {
        const rough = range / approxTicks;
        const mag = Math.pow(10, Math.floor(Math.log10(rough)));
        const residual = rough / mag;
        let nice;
        if (residual <= 1.5) nice = 1;
        else if (residual <= 3.5) nice = 2;
        else if (residual <= 7.5) nice = 5;
        else nice = 10;
        return nice * mag || 1;
    }

    /**
     * Draw a rounded rectangle path.
     */
    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    /** Clean up event listeners. */
    destroy() {
        document.removeEventListener('keydown', this._keyHandler);
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}
