/**
 * interactive-behaviors.js
 * Interactive behavior classes for HCC OmniScope Three.js (r160) cancer biology 3D visualization.
 * Pure vanilla JS ES module. No frameworks, no external deps, no em dashes.
 */

import * as THREE from 'three';

// Shared palette
const PALETTE = {
    bg: '#0a0a1a',
    bgPanel: 'rgba(12,12,30,0.92)',
    text: '#e0e0f0',
    textDim: '#8888aa',
    accent: '#6c8cff',
    altitude: '#4ade80',
    ros: '#f87171',
    overlap: '#fbbf24',
};

// Utility: simple lerp
function lerp(a, b, t) { return a + (b - a) * t; }

// Utility: inject keyframe style block once
let _styleInjected = false;
function injectBaseStyles() {
    if (_styleInjected) return;
    _styleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        .ib-btn {
            padding: 4px 10px;
            border: 1px solid rgba(108,140,255,0.4);
            border-radius: 4px;
            background: rgba(108,140,255,0.12);
            color: ${PALETTE.text};
            font-size: 0.72rem;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
        }
        .ib-btn:hover {
            background: rgba(108,140,255,0.28);
            border-color: ${PALETTE.accent};
        }
        .ib-range {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 4px;
            border-radius: 2px;
            background: rgba(255,255,255,0.08);
            outline: none;
        }
        .ib-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: ${PALETTE.accent};
            cursor: pointer;
            border: 2px solid ${PALETTE.bg};
        }
        .ib-range::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: ${PALETTE.accent};
            cursor: pointer;
            border: 2px solid ${PALETTE.bg};
        }
        .ib-label {
            color: ${PALETTE.textDim};
            font-size: 0.68rem;
            margin-bottom: 2px;
        }
        .ib-value {
            color: ${PALETTE.text};
            font-size: 0.72rem;
            font-weight: 600;
        }
    `;
    document.head.appendChild(style);
}


/* =========================================================================
   1. SpotlightMode - Click a gene, dim everything else
   ========================================================================= */

export class SpotlightMode {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this._scene = scene;
        this._active = false;
        this._originals = new Map(); // mesh -> { opacity, emissiveR, emissiveG, emissiveB, scaleX, scaleY, scaleZ }
        this._targets = new Map();   // mesh -> { opacity, emissiveIntensity }
        this._animFrame = 0;
        this._rafId = null;
        this._selectedMesh = null;
        this._connectedSet = new Set();
    }

    get isActive() {
        return this._active;
    }

    /**
     * Activate spotlight on selectedMesh and its connections.
     * @param {THREE.Mesh} selectedMesh
     * @param {THREE.Mesh[]} connectedMeshes
     */
    activate(selectedMesh, connectedMeshes) {
        if (this._active) this.deactivate();
        this._active = true;
        this._selectedMesh = selectedMesh;
        this._connectedSet = new Set(connectedMeshes);
        this._originals.clear();
        this._targets.clear();

        const selectedSet = new Set([selectedMesh, ...connectedMeshes]);

        this._scene.traverse((obj) => {
            if (!obj.isMesh) return;
            if (!obj.material) return;

            const mat = obj.material;
            const orig = {
                opacity: mat.opacity !== undefined ? mat.opacity : 1,
                emissiveR: mat.emissive ? mat.emissive.r : 0,
                emissiveG: mat.emissive ? mat.emissive.g : 0,
                emissiveB: mat.emissive ? mat.emissive.b : 0,
                emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1,
                scaleX: obj.scale.x,
                scaleY: obj.scale.y,
                scaleZ: obj.scale.z,
                transparent: mat.transparent,
            };
            this._originals.set(obj, orig);

            if (obj === selectedMesh) {
                // Selected: boosted emissive, slight scale bump
                this._targets.set(obj, {
                    opacity: orig.opacity,
                    emissiveIntensity: 1.0,
                    scaleX: orig.scaleX * 1.15,
                    scaleY: orig.scaleY * 1.15,
                    scaleZ: orig.scaleZ * 1.15,
                });
            } else if (this._connectedSet.has(obj)) {
                // Connected: 60% opacity, keep emissive
                this._targets.set(obj, {
                    opacity: 0.6,
                    emissiveIntensity: orig.emissiveIntensity,
                    scaleX: orig.scaleX,
                    scaleY: orig.scaleY,
                    scaleZ: orig.scaleZ,
                });
            } else {
                // Everything else: dim to 8%
                this._targets.set(obj, {
                    opacity: 0.08,
                    emissiveIntensity: 0,
                    scaleX: orig.scaleX,
                    scaleY: orig.scaleY,
                    scaleZ: orig.scaleZ,
                });
            }

            // Enable transparency so opacity works
            mat.transparent = true;
        });

        // Animate over 10 frames
        this._animFrame = 0;
        this._animateIn();
    }

    _animateIn() {
        if (this._animFrame >= 10) return;
        this._animFrame++;
        const t = this._animFrame / 10;

        this._originals.forEach((orig, obj) => {
            const target = this._targets.get(obj);
            if (!target) return;
            const mat = obj.material;

            mat.opacity = lerp(orig.opacity, target.opacity, t);
            if (mat.emissiveIntensity !== undefined) {
                mat.emissiveIntensity = lerp(orig.emissiveIntensity, target.emissiveIntensity, t);
            }
            obj.scale.set(
                lerp(orig.scaleX, target.scaleX, t),
                lerp(orig.scaleY, target.scaleY, t),
                lerp(orig.scaleZ, target.scaleZ, t),
            );
            mat.needsUpdate = true;
        });

        this._rafId = requestAnimationFrame(() => this._animateIn());
    }

    /**
     * Restore all meshes to their original state.
     */
    deactivate() {
        if (!this._active) return;
        if (this._rafId) cancelAnimationFrame(this._rafId);

        this._active = false;
        this._animFrame = 0;
        this._animateOut();
    }

    _animateOut() {
        if (this._animFrame >= 10) {
            this._originals.clear();
            this._targets.clear();
            this._selectedMesh = null;
            this._connectedSet.clear();
            return;
        }
        this._animFrame++;
        const t = this._animFrame / 10;

        this._originals.forEach((orig, obj) => {
            if (!obj.material) return;
            const mat = obj.material;
            const current = this._targets.get(obj);
            if (!current) return;

            mat.opacity = lerp(current.opacity, orig.opacity, t);
            if (mat.emissiveIntensity !== undefined) {
                mat.emissiveIntensity = lerp(current.emissiveIntensity, orig.emissiveIntensity, t);
            }
            obj.scale.set(
                lerp(current.scaleX, orig.scaleX, t),
                lerp(current.scaleY, orig.scaleY, t),
                lerp(current.scaleZ, orig.scaleZ, t),
            );
            mat.transparent = orig.transparent;
            mat.needsUpdate = true;
        });

        this._rafId = requestAnimationFrame(() => this._animateOut());
    }
}


/* =========================================================================
   2. SurvivalTimeline - Time slider that animates patient survival
   ========================================================================= */

export class SurvivalTimeline {
    /**
     * @param {HTMLElement} containerEl - Where to append the slider bar
     * @param {Array<{survivalMonths: number, isDeceased: boolean}>} patients
     * @param {THREE.InstancedMesh} instancedMesh - Patient instanced mesh to update colors
     */
    constructor(containerEl, patients, instancedMesh) {
        injectBaseStyles();
        this._container = containerEl;
        this._patients = patients;
        this._instancedMesh = instancedMesh;
        this._playing = false;
        this._playInterval = null;

        this._maxMonths = Math.max(...patients.map(p => p.survivalMonths), 1);
        this._currentMonth = this._maxMonths;

        this._aliveColor = new THREE.Color(PALETTE.accent);
        this._deceasedColor = new THREE.Color(PALETTE.ros);
        this._dimColor = new THREE.Color(0.15, 0.15, 0.2);

        this._build();
        this._updateView();
    }

    _build() {
        this._bar = document.createElement('div');
        Object.assign(this._bar.style, {
            position: 'fixed',
            bottom: '0',
            left: '280px',
            right: '0',
            height: '54px',
            background: PALETTE.bgPanel,
            borderTop: '1px solid rgba(108,140,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: '12px',
            zIndex: '200',
            backdropFilter: 'blur(12px)',
            fontFamily: 'inherit',
        });

        // Play/Pause button
        this._playBtn = document.createElement('button');
        this._playBtn.className = 'ib-btn';
        this._playBtn.textContent = 'Play';
        this._playBtn.style.minWidth = '52px';
        this._playBtn.addEventListener('click', () => this._togglePlay());
        this._bar.appendChild(this._playBtn);

        // Slider
        this._slider = document.createElement('input');
        this._slider.type = 'range';
        this._slider.className = 'ib-range';
        this._slider.min = '0';
        this._slider.max = String(this._maxMonths);
        this._slider.value = String(this._currentMonth);
        this._slider.style.flex = '1';
        this._slider.setAttribute('aria-label', 'Survival timeline in months');
        this._slider.addEventListener('input', () => {
            this._currentMonth = parseInt(this._slider.value, 10);
            this._updateView();
        });
        this._bar.appendChild(this._slider);

        // Status label
        this._label = document.createElement('span');
        Object.assign(this._label.style, {
            color: PALETTE.text,
            fontSize: '0.72rem',
            whiteSpace: 'nowrap',
            minWidth: '220px',
            textAlign: 'right',
        });
        this._bar.appendChild(this._label);

        this._container.appendChild(this._bar);
    }

    _updateView() {
        let alive = 0;
        let deceased = 0;
        const color = new THREE.Color();

        for (let i = 0; i < this._patients.length; i++) {
            const p = this._patients[i];
            const diedBefore = p.isDeceased && p.survivalMonths <= this._currentMonth;
            if (diedBefore) {
                deceased++;
                color.copy(this._dimColor);
            } else {
                alive++;
                color.copy(this._aliveColor);
            }
            this._instancedMesh.setColorAt(i, color);
        }
        this._instancedMesh.instanceColor.needsUpdate = true;

        this._label.textContent =
            `Time: ${this._currentMonth} months | Alive: ${alive} | Deceased: ${deceased}`;
    }

    _togglePlay() {
        if (this._playing) {
            this._pause();
        } else {
            this._play();
        }
    }

    _play() {
        this._playing = true;
        this._playBtn.textContent = 'Pause';
        if (this._currentMonth >= this._maxMonths) {
            this._currentMonth = 0;
            this._slider.value = '0';
        }
        this._playInterval = setInterval(() => {
            this._currentMonth++;
            if (this._currentMonth > this._maxMonths) {
                this._pause();
                return;
            }
            this._slider.value = String(this._currentMonth);
            this._updateView();
        }, 100);
    }

    _pause() {
        this._playing = false;
        this._playBtn.textContent = 'Play';
        if (this._playInterval) {
            clearInterval(this._playInterval);
            this._playInterval = null;
        }
    }
}


/* =========================================================================
   3. BrushSelect - Drag to select a region of patients in 3D
   ========================================================================= */

export class BrushSelect {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Camera} camera
     * @param {function(number[]): void} onSelect - Callback with array of patient indices
     */
    constructor(renderer, camera, onSelect) {
        this._renderer = renderer;
        this._camera = camera;
        this._onSelect = onSelect;
        this._enabled = false;
        this._dragging = false;
        this._startX = 0;
        this._startY = 0;
        this._overlay = null;
        this._patientPositions = []; // set externally via setPositions

        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
    }

    /**
     * Provide the world positions of all patients for projection.
     * @param {THREE.Vector3[]} positions
     */
    setPositions(positions) {
        this._patientPositions = positions;
    }

    enable() {
        if (this._enabled) return;
        this._enabled = true;
        const canvas = this._renderer.domElement;
        canvas.addEventListener('mousedown', this._onMouseDown);
        canvas.addEventListener('mousemove', this._onMouseMove);
        canvas.addEventListener('mouseup', this._onMouseUp);
    }

    disable() {
        if (!this._enabled) return;
        this._enabled = false;
        const canvas = this._renderer.domElement;
        canvas.removeEventListener('mousedown', this._onMouseDown);
        canvas.removeEventListener('mousemove', this._onMouseMove);
        canvas.removeEventListener('mouseup', this._onMouseUp);
        this._removeOverlay();
    }

    _handleMouseDown(e) {
        if (!e.shiftKey) return;
        e.preventDefault();
        this._dragging = true;
        const rect = this._renderer.domElement.getBoundingClientRect();
        this._startX = e.clientX - rect.left;
        this._startY = e.clientY - rect.top;
        this._createOverlay();
    }

    _handleMouseMove(e) {
        if (!this._dragging || !this._overlay) return;
        const rect = this._renderer.domElement.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        const x = Math.min(this._startX, cx);
        const y = Math.min(this._startY, cy);
        const w = Math.abs(cx - this._startX);
        const h = Math.abs(cy - this._startY);

        Object.assign(this._overlay.style, {
            left: x + 'px',
            top: y + 'px',
            width: w + 'px',
            height: h + 'px',
        });
    }

    _handleMouseUp(e) {
        if (!this._dragging) return;
        this._dragging = false;

        const rect = this._renderer.domElement.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        const minX = Math.min(this._startX, endX);
        const maxX = Math.max(this._startX, endX);
        const minY = Math.min(this._startY, endY);
        const maxY = Math.max(this._startY, endY);

        // Skip tiny selections (accidental clicks)
        if (maxX - minX < 5 && maxY - minY < 5) {
            this._removeOverlay();
            return;
        }

        // Project patient positions to screen space and test containment
        const canvasW = rect.width;
        const canvasH = rect.height;
        const selected = [];
        const projected = new THREE.Vector3();

        for (let i = 0; i < this._patientPositions.length; i++) {
            projected.copy(this._patientPositions[i]);
            projected.project(this._camera);

            // Convert NDC (-1..1) to pixel coords
            const sx = (projected.x * 0.5 + 0.5) * canvasW;
            const sy = (-projected.y * 0.5 + 0.5) * canvasH;

            // Skip points behind camera
            if (projected.z > 1) continue;

            if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
                selected.push(i);
            }
        }

        this._removeOverlay();

        if (selected.length > 0 && this._onSelect) {
            this._onSelect(selected);
        }
    }

    _createOverlay() {
        this._removeOverlay();
        this._overlay = document.createElement('div');
        Object.assign(this._overlay.style, {
            position: 'absolute',
            border: '2px dashed ' + PALETTE.accent,
            background: 'rgba(108,140,255,0.1)',
            pointerEvents: 'none',
            zIndex: '500',
            left: this._startX + 'px',
            top: this._startY + 'px',
            width: '0px',
            height: '0px',
        });
        // Attach relative to canvas parent
        const parent = this._renderer.domElement.parentElement;
        if (parent) {
            parent.style.position = parent.style.position || 'relative';
            parent.appendChild(this._overlay);
        }
    }

    _removeOverlay() {
        if (this._overlay && this._overlay.parentElement) {
            this._overlay.parentElement.removeChild(this._overlay);
        }
        this._overlay = null;
    }
}


/* =========================================================================
   4. LiveFilterSliders - Continuous sliders that filter patients in real-time
   ========================================================================= */

export class LiveFilterSliders {
    /**
     * @param {HTMLElement} containerEl - Sidebar element to append into
     * @param {Array<{rosScore: number, altScore: number, survivalMonths: number}>} patients
     * @param {function(number[]): void} onChange - Callback with visible patient indices
     */
    constructor(containerEl, patients, onChange) {
        injectBaseStyles();
        this._container = containerEl;
        this._patients = patients;
        this._onChange = onChange;

        // Compute data ranges
        const rosValues = patients.map(p => p.rosScore);
        const altValues = patients.map(p => p.altScore);
        const survValues = patients.map(p => p.survivalMonths);

        this._ranges = {
            ros: { dataMin: Math.min(...rosValues), dataMax: Math.max(...rosValues) },
            alt: { dataMin: Math.min(...altValues), dataMax: Math.max(...altValues) },
            surv: { dataMin: 0, dataMax: Math.max(...survValues) },
        };

        // Current filter values
        this._filters = {
            rosMin: this._ranges.ros.dataMin,
            rosMax: this._ranges.ros.dataMax,
            altMin: this._ranges.alt.dataMin,
            altMax: this._ranges.alt.dataMax,
            survMin: 0,
        };

        this._build();
        this._applyFilter();
    }

    _build() {
        this._panel = document.createElement('div');
        Object.assign(this._panel.style, {
            padding: '8px 0',
            borderTop: '1px solid rgba(108,140,255,0.1)',
            marginTop: '6px',
        });

        const title = document.createElement('div');
        title.textContent = 'Live Filters';
        Object.assign(title.style, {
            color: PALETTE.text,
            fontSize: '0.76rem',
            fontWeight: '600',
            marginBottom: '8px',
        });
        this._panel.appendChild(title);

        // ROS range slider (two-thumb emulated with two sliders)
        this._rosGroup = this._buildDualSlider(
            'ROS Risk',
            PALETTE.ros,
            this._ranges.ros.dataMin,
            this._ranges.ros.dataMax,
            (min, max) => {
                this._filters.rosMin = min;
                this._filters.rosMax = max;
                this._applyFilter();
            },
        );
        this._panel.appendChild(this._rosGroup.el);

        // Altitude range slider
        this._altGroup = this._buildDualSlider(
            'Altitude Risk',
            PALETTE.altitude,
            this._ranges.alt.dataMin,
            this._ranges.alt.dataMax,
            (min, max) => {
                this._filters.altMin = min;
                this._filters.altMax = max;
                this._applyFilter();
            },
        );
        this._panel.appendChild(this._altGroup.el);

        // Min survival single slider
        this._survGroup = this._buildSingleSlider(
            'Min Survival',
            PALETTE.accent,
            0,
            this._ranges.surv.dataMax,
            0,
            (val) => {
                this._filters.survMin = val;
                this._applyFilter();
            },
        );
        this._panel.appendChild(this._survGroup.el);

        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'ib-btn';
        resetBtn.textContent = 'Reset';
        resetBtn.style.marginTop = '8px';
        resetBtn.addEventListener('click', () => this._reset());
        this._panel.appendChild(resetBtn);

        this._container.appendChild(this._panel);
    }

    _buildDualSlider(label, color, dataMin, dataMax, onDualChange) {
        const el = document.createElement('div');
        el.style.marginBottom = '10px';

        const lbl = document.createElement('div');
        lbl.className = 'ib-label';
        lbl.textContent = label;
        el.appendChild(lbl);

        const valueLabel = document.createElement('div');
        valueLabel.className = 'ib-value';
        valueLabel.style.color = color;
        el.appendChild(valueLabel);

        const step = (dataMax - dataMin) / 200;

        // Wrap both sliders in a relative container
        const sliderWrap = document.createElement('div');
        Object.assign(sliderWrap.style, {
            position: 'relative',
            height: '18px',
            marginTop: '2px',
        });

        const minSlider = document.createElement('input');
        minSlider.type = 'range';
        minSlider.className = 'ib-range';
        minSlider.min = String(dataMin);
        minSlider.max = String(dataMax);
        minSlider.step = String(step);
        minSlider.value = String(dataMin);
        minSlider.setAttribute('aria-label', label + ' minimum');
        Object.assign(minSlider.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            pointerEvents: 'none',
            background: 'transparent',
            zIndex: '2',
        });
        // Allow thumb interaction
        minSlider.style.setProperty('-webkit-appearance', 'none');

        const maxSlider = document.createElement('input');
        maxSlider.type = 'range';
        maxSlider.className = 'ib-range';
        maxSlider.min = String(dataMin);
        maxSlider.max = String(dataMax);
        maxSlider.step = String(step);
        maxSlider.value = String(dataMax);
        maxSlider.setAttribute('aria-label', label + ' maximum');
        Object.assign(maxSlider.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            pointerEvents: 'none',
            background: 'transparent',
            zIndex: '3',
        });

        // Re-enable pointer events on the thumbs via CSS
        const thumbStyle = document.createElement('style');
        thumbStyle.textContent = `
            .ib-range::-webkit-slider-thumb { pointer-events: auto; }
            .ib-range::-moz-range-thumb { pointer-events: auto; }
        `;
        el.appendChild(thumbStyle);

        let currentMin = dataMin;
        let currentMax = dataMax;

        const updateLabel = () => {
            valueLabel.textContent = `${label}: ${currentMin.toFixed(1)} to ${currentMax.toFixed(1)}`;
        };
        updateLabel();

        minSlider.addEventListener('input', () => {
            const v = parseFloat(minSlider.value);
            if (v > currentMax) {
                minSlider.value = String(currentMax);
                return;
            }
            currentMin = v;
            updateLabel();
            onDualChange(currentMin, currentMax);
        });

        maxSlider.addEventListener('input', () => {
            const v = parseFloat(maxSlider.value);
            if (v < currentMin) {
                maxSlider.value = String(currentMin);
                return;
            }
            currentMax = v;
            updateLabel();
            onDualChange(currentMin, currentMax);
        });

        sliderWrap.appendChild(minSlider);
        sliderWrap.appendChild(maxSlider);
        el.appendChild(sliderWrap);

        return {
            el,
            reset: () => {
                currentMin = dataMin;
                currentMax = dataMax;
                minSlider.value = String(dataMin);
                maxSlider.value = String(dataMax);
                updateLabel();
            },
        };
    }

    _buildSingleSlider(label, color, min, max, initial, onSingleChange) {
        const el = document.createElement('div');
        el.style.marginBottom = '10px';

        const lbl = document.createElement('div');
        lbl.className = 'ib-label';
        lbl.textContent = label;
        el.appendChild(lbl);

        const valueLabel = document.createElement('div');
        valueLabel.className = 'ib-value';
        valueLabel.style.color = color;
        el.appendChild(valueLabel);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'ib-range';
        slider.min = String(min);
        slider.max = String(max);
        slider.value = String(initial);
        slider.step = '1';
        slider.style.marginTop = '2px';
        slider.setAttribute('aria-label', label);

        let current = initial;
        const updateLabel = () => {
            valueLabel.textContent = `${label}: ${current} months`;
        };
        updateLabel();

        slider.addEventListener('input', () => {
            current = parseInt(slider.value, 10);
            updateLabel();
            onSingleChange(current);
        });

        el.appendChild(slider);

        return {
            el,
            reset: () => {
                current = initial;
                slider.value = String(initial);
                updateLabel();
            },
        };
    }

    _applyFilter() {
        const visible = [];
        for (let i = 0; i < this._patients.length; i++) {
            const p = this._patients[i];
            if (p.rosScore < this._filters.rosMin || p.rosScore > this._filters.rosMax) continue;
            if (p.altScore < this._filters.altMin || p.altScore > this._filters.altMax) continue;
            if (p.survivalMonths < this._filters.survMin) continue;
            visible.push(i);
        }
        if (this._onChange) this._onChange(visible);
    }

    _reset() {
        this._filters.rosMin = this._ranges.ros.dataMin;
        this._filters.rosMax = this._ranges.ros.dataMax;
        this._filters.altMin = this._ranges.alt.dataMin;
        this._filters.altMax = this._ranges.alt.dataMax;
        this._filters.survMin = 0;

        this._rosGroup.reset();
        this._altGroup.reset();
        this._survGroup.reset();
        this._applyFilter();
    }
}


/* =========================================================================
   5. TreatmentRecommendation - Research-grade treatment suggestions
   ========================================================================= */

export class TreatmentRecommendation {
    /**
     * @param {object} geneAnnotations - Map of geneName -> { function, pathway, evidence }
     * @param {object} drugSensitivity - Map of drugName -> { target, ic50Corr, mechanism }
     */
    constructor(geneAnnotations, drugSensitivity) {
        injectBaseStyles();
        this._geneAnnotations = geneAnnotations || {};
        this._drugSensitivity = drugSensitivity || {};
        this._modal = null;
    }

    /**
     * Show treatment recommendations for a patient profile.
     * @param {{ rosScore: number, altScore: number, signatureGenes?: string[] }} patientData
     */
    show(patientData) {
        this.hide();

        const isRosHigh = patientData.rosScore > 0;
        const isAltHigh = patientData.altScore > 0;

        const recommendations = [];

        if (isRosHigh && isAltHigh) {
            recommendations.push({
                priority: 'high',
                title: 'Combination Therapy',
                description: 'Sorafenib (multi-kinase + ferroptosis) + anti-angiogenic agents',
                drugs: [
                    this._drugCard('Sorafenib', 'RAF/VEGFR', 'Multi-kinase inhibitor that also induces ferroptosis via system Xc- inhibition', 'high'),
                    this._drugCard('Bevacizumab', 'VEGF', 'Anti-angiogenic monoclonal antibody targeting VEGF pathway', 'moderate'),
                ],
            });
        }

        if (isRosHigh) {
            recommendations.push({
                priority: 'high',
                title: 'Ferroptosis Induction',
                description: 'Consider ferroptosis induction: Erastin (targets SLC7A11), Auranofin (targets TXNRD1)',
                drugs: [
                    this._drugCard('Erastin', 'SLC7A11', 'System Xc- inhibitor that depletes glutathione and induces lipid peroxidation', 'high'),
                    this._drugCard('Auranofin', 'TXNRD1', 'Thioredoxin reductase inhibitor that amplifies oxidative stress', 'moderate'),
                ],
            });
        }

        if (isAltHigh) {
            recommendations.push({
                priority: 'moderate',
                title: 'Glycolysis Inhibition',
                description: 'Consider glycolysis inhibition: 2-DG (targets HK2), FX-11 (targets LDHA)',
                drugs: [
                    this._drugCard('2-Deoxyglucose (2-DG)', 'HK2', 'Hexokinase 2 inhibitor that blocks glucose metabolism in hypoxic cells', 'moderate'),
                    this._drugCard('FX-11', 'LDHA', 'Lactate dehydrogenase A inhibitor reducing aerobic glycolysis', 'moderate'),
                ],
            });
        }

        if (!isRosHigh && !isAltHigh) {
            recommendations.push({
                priority: 'standard',
                title: 'Favorable Prognosis',
                description: 'Favorable prognosis. Standard surveillance recommended.',
                drugs: [],
            });
        }

        this._renderModal(recommendations, patientData);
    }

    _drugCard(name, target, mechanism, evidence) {
        const annotation = this._geneAnnotations[target] || {};
        const sensitivity = this._drugSensitivity[name] || {};
        return {
            name,
            target,
            mechanism,
            evidence: evidence || annotation.evidence || 'unknown',
            ic50Corr: sensitivity.ic50Corr || null,
        };
    }

    _renderModal(recommendations, patientData) {
        this._modal = document.createElement('div');
        Object.assign(this._modal.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '350px',
            maxHeight: '80vh',
            overflowY: 'auto',
            background: PALETTE.bgPanel,
            border: '1px solid rgba(108,140,255,0.2)',
            borderRadius: '10px',
            padding: '16px',
            zIndex: '1000',
            backdropFilter: 'blur(16px)',
            fontFamily: 'inherit',
            color: PALETTE.text,
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
        });

        const heading = document.createElement('div');
        heading.textContent = 'Treatment Recommendations';
        Object.assign(heading.style, {
            fontSize: '0.84rem',
            fontWeight: '700',
            color: PALETTE.text,
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        closeBtn.className = 'ib-btn';
        closeBtn.style.padding = '2px 8px';
        closeBtn.addEventListener('click', () => this.hide());

        header.appendChild(heading);
        header.appendChild(closeBtn);
        this._modal.appendChild(header);

        // Patient summary
        const summary = document.createElement('div');
        summary.textContent = `ROS: ${patientData.rosScore.toFixed(2)} | Altitude: ${patientData.altScore.toFixed(2)}`;
        Object.assign(summary.style, {
            fontSize: '0.7rem',
            color: PALETTE.textDim,
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
        });
        this._modal.appendChild(summary);

        // Recommendation cards
        const priorityColors = {
            high: PALETTE.ros,
            moderate: PALETTE.overlap,
            standard: PALETTE.altitude,
        };

        for (const rec of recommendations) {
            const card = document.createElement('div');
            Object.assign(card.style, {
                border: `1px solid ${priorityColors[rec.priority] || PALETTE.accent}`,
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '8px',
                background: 'rgba(255,255,255,0.02)',
            });

            const cardTitle = document.createElement('div');
            cardTitle.textContent = rec.title;
            Object.assign(cardTitle.style, {
                fontSize: '0.76rem',
                fontWeight: '600',
                color: priorityColors[rec.priority] || PALETTE.text,
                marginBottom: '4px',
            });
            card.appendChild(cardTitle);

            const desc = document.createElement('div');
            desc.textContent = rec.description;
            Object.assign(desc.style, {
                fontSize: '0.68rem',
                color: PALETTE.textDim,
                marginBottom: '6px',
            });
            card.appendChild(desc);

            for (const drug of rec.drugs) {
                const drugEl = document.createElement('div');
                Object.assign(drugEl.style, {
                    padding: '6px 8px',
                    marginTop: '4px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '4px',
                    fontSize: '0.66rem',
                });

                const drugName = document.createElement('div');
                drugName.textContent = drug.name;
                drugName.style.fontWeight = '600';
                drugName.style.color = PALETTE.text;
                drugEl.appendChild(drugName);

                const targetLine = document.createElement('div');
                targetLine.textContent = `Target: ${drug.target}`;
                targetLine.style.color = PALETTE.accent;
                drugEl.appendChild(targetLine);

                const mechLine = document.createElement('div');
                mechLine.textContent = drug.mechanism;
                mechLine.style.color = PALETTE.textDim;
                mechLine.style.marginTop = '2px';
                drugEl.appendChild(mechLine);

                const evidenceLine = document.createElement('div');
                evidenceLine.textContent = `Evidence: ${drug.evidence}`;
                Object.assign(evidenceLine.style, {
                    marginTop: '2px',
                    color: drug.evidence === 'high' ? PALETTE.altitude : PALETTE.overlap,
                });
                drugEl.appendChild(evidenceLine);

                if (drug.ic50Corr !== null) {
                    const ic50Line = document.createElement('div');
                    ic50Line.textContent = `IC50 correlation: ${drug.ic50Corr.toFixed(3)}`;
                    ic50Line.style.color = PALETTE.textDim;
                    drugEl.appendChild(ic50Line);
                }

                card.appendChild(drugEl);
            }

            this._modal.appendChild(card);
        }

        // Disclaimer
        const disclaimer = document.createElement('div');
        disclaimer.textContent = 'Research-grade analysis only. Not for clinical decision-making.';
        Object.assign(disclaimer.style, {
            fontSize: '0.62rem',
            color: PALETTE.textDim,
            fontStyle: 'italic',
            textAlign: 'center',
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
        });
        this._modal.appendChild(disclaimer);

        document.body.appendChild(this._modal);
    }

    hide() {
        if (this._modal && this._modal.parentElement) {
            this._modal.parentElement.removeChild(this._modal);
        }
        this._modal = null;
    }
}


/* =========================================================================
   6. ResearchTimeline - Animated horizontal timeline of analysis pipeline
   ========================================================================= */

const RESEARCH_STEPS = [
    {
        title: 'Data Acquisition',
        detail: 'Downloaded raw RNA-seq counts and clinical metadata from TCGA-LIHC (n=365), GEO (GSE14520, GSE76427), and ICGC-LIRI-JP cohorts. Unified identifiers and normalized batch effects across platforms.',
    },
    {
        title: 'Gene Set Curation',
        detail: 'Curated 169 altitude adaptation genes from HighAltitudeOmicsDB cross-referenced with HIF pathway literature. Filtered for protein-coding genes with detectable expression in liver tissue.',
    },
    {
        title: 'Univariate Screening',
        detail: 'Performed Cox proportional hazards regression on each of 169 genes individually. Retained 42 genes with p < 0.05 for downstream penalized regression.',
    },
    {
        title: 'LASSO Signature Building',
        detail: 'Applied L1-penalized Cox regression with 5-fold cross-validation to select the optimal lambda. Final signature retained 20 genes with non-zero coefficients.',
    },
    {
        title: 'Multi-Cohort Validation',
        detail: 'Validated the 20-gene signature across 4 external cohorts totaling 648 patients. Achieved C-index range 0.68 to 0.74 with consistent risk stratification.',
    },
    {
        title: 'Functional Annotation',
        detail: 'Performed GSEA and over-representation analysis identifying enrichment in ferroptosis, glycolysis, and HIF-1 signaling pathways. Mapped druggable targets.',
    },
    {
        title: 'Single-Cell Mapping',
        detail: 'Integrated expression data from Human Protein Atlas and CellxGene spanning 85 cell types across 14 tissues. Identified macrophages as specialist expressors of signature genes.',
    },
    {
        title: 'Drug Sensitivity',
        detail: 'Correlated signature gene expression with GDSC IC50 values across cancer cell lines. Identified Sorafenib, Erastin, and 2-DG as top candidates with significant negative correlations.',
    },
    {
        title: 'Visualization',
        detail: 'Built HCC OmniScope: a multi-scale 3D interactive explorer integrating gene, cell, and patient landscapes for comprehensive research presentation.',
    },
];

export class ResearchTimeline {
    constructor() {
        injectBaseStyles();
        this._modal = null;
        this._expandedIndex = -1;
    }

    show() {
        this.hide();
        this._modal = document.createElement('div');
        Object.assign(this._modal.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '2000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            fontFamily: 'inherit',
            color: PALETTE.text,
        });

        // Inner container
        const inner = document.createElement('div');
        Object.assign(inner.style, {
            background: PALETTE.bgPanel,
            border: '1px solid rgba(108,140,255,0.2)',
            borderRadius: '12px',
            padding: '24px',
            width: '90vw',
            maxWidth: '900px',
            maxHeight: '80vh',
            overflowX: 'auto',
            overflowY: 'auto',
        });

        // Title
        const title = document.createElement('div');
        title.textContent = 'Research Pipeline';
        Object.assign(title.style, {
            fontSize: '1rem',
            fontWeight: '700',
            marginBottom: '20px',
            textAlign: 'center',
        });
        inner.appendChild(title);

        // Timeline container
        const timeline = document.createElement('div');
        Object.assign(timeline.style, {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0',
            position: 'relative',
            padding: '20px 10px',
            minWidth: `${RESEARCH_STEPS.length * 100}px`,
        });

        // Connecting line
        const line = document.createElement('div');
        Object.assign(line.style, {
            position: 'absolute',
            top: '34px',
            left: '50px',
            right: '50px',
            height: '2px',
            background: `linear-gradient(90deg, ${PALETTE.textDim}, ${PALETTE.accent})`,
            zIndex: '0',
        });
        timeline.appendChild(line);

        // Detail card area (below the timeline)
        const detailArea = document.createElement('div');
        Object.assign(detailArea.style, {
            marginTop: '16px',
            minHeight: '60px',
        });

        // Nodes
        RESEARCH_STEPS.forEach((step, idx) => {
            const node = document.createElement('div');
            Object.assign(node.style, {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: '1',
                minWidth: '80px',
                position: 'relative',
                zIndex: '1',
                cursor: 'pointer',
                opacity: '0',
                transition: 'opacity 0.3s ease',
            });

            // Animate in with stagger
            setTimeout(() => {
                node.style.opacity = '1';
            }, idx * 100);

            const isLast = idx === RESEARCH_STEPS.length - 1;

            const circle = document.createElement('div');
            Object.assign(circle.style, {
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: isLast ? PALETTE.accent : 'rgba(108,140,255,0.25)',
                border: `2px solid ${isLast ? PALETTE.accent : PALETTE.textDim}`,
                marginBottom: '8px',
                transition: 'transform 0.2s, background 0.2s',
                boxShadow: isLast ? `0 0 12px ${PALETTE.accent}` : 'none',
            });

            const label = document.createElement('div');
            label.textContent = step.title;
            Object.assign(label.style, {
                fontSize: '0.6rem',
                color: isLast ? PALETTE.accent : PALETTE.textDim,
                textAlign: 'center',
                maxWidth: '90px',
                lineHeight: '1.3',
            });

            const stepNum = document.createElement('div');
            stepNum.textContent = String(idx + 1);
            Object.assign(stepNum.style, {
                position: 'absolute',
                top: '3px',
                fontSize: '0.58rem',
                fontWeight: '700',
                color: isLast ? PALETTE.bg : PALETTE.text,
                pointerEvents: 'none',
            });

            node.appendChild(circle);
            node.appendChild(stepNum);
            node.appendChild(label);

            node.addEventListener('mouseenter', () => {
                circle.style.transform = 'scale(1.2)';
            });
            node.addEventListener('mouseleave', () => {
                circle.style.transform = 'scale(1)';
            });

            node.addEventListener('click', () => {
                this._expandedIndex = this._expandedIndex === idx ? -1 : idx;
                this._renderDetail(detailArea, this._expandedIndex);
            });

            timeline.appendChild(node);
        });

        inner.appendChild(timeline);
        inner.appendChild(detailArea);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'ib-btn';
        closeBtn.textContent = 'Close';
        closeBtn.style.display = 'block';
        closeBtn.style.margin = '16px auto 0';
        closeBtn.addEventListener('click', () => this.hide());
        inner.appendChild(closeBtn);

        this._modal.appendChild(inner);

        // Close on background click
        this._modal.addEventListener('click', (e) => {
            if (e.target === this._modal) this.hide();
        });

        document.body.appendChild(this._modal);
    }

    _renderDetail(container, idx) {
        container.innerHTML = '';
        if (idx < 0 || idx >= RESEARCH_STEPS.length) return;

        const step = RESEARCH_STEPS[idx];
        const card = document.createElement('div');
        Object.assign(card.style, {
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(108,140,255,0.15)',
            borderRadius: '6px',
            padding: '12px 16px',
        });

        const cardTitle = document.createElement('div');
        cardTitle.textContent = `${idx + 1}. ${step.title}`;
        Object.assign(cardTitle.style, {
            fontSize: '0.78rem',
            fontWeight: '600',
            color: PALETTE.accent,
            marginBottom: '6px',
        });
        card.appendChild(cardTitle);

        const cardText = document.createElement('div');
        cardText.textContent = step.detail;
        Object.assign(cardText.style, {
            fontSize: '0.7rem',
            color: PALETTE.textDim,
            lineHeight: '1.5',
        });
        card.appendChild(cardText);

        container.appendChild(card);
    }

    hide() {
        if (this._modal && this._modal.parentElement) {
            this._modal.parentElement.removeChild(this._modal);
        }
        this._modal = null;
        this._expandedIndex = -1;
    }
}


/* =========================================================================
   7. AnnotationSystem - Sticky notes for genes/cells/patients
   ========================================================================= */

const ANNOTATIONS_KEY = 'omniscope-annotations';
const MAX_NOTES = 50;

export class AnnotationSystem {
    constructor() {
        injectBaseStyles();
        this._notes = this._load();
        this._panel = null;
    }

    _load() {
        try {
            const raw = localStorage.getItem(ANNOTATIONS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    _save() {
        try {
            localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(this._notes));
        } catch {
            // Storage full or unavailable
        }
    }

    /**
     * Add a note to an object.
     * @param {'gene'|'cell'|'patient'} objectType
     * @param {string} objectId
     * @param {string} text
     * @returns {boolean} True if added
     */
    addNote(objectType, objectId, text) {
        if (this._notes.length >= MAX_NOTES) return false;
        if (!text || !text.trim()) return false;

        this._notes.push({
            type: objectType,
            id: objectId,
            text: text.trim(),
            timestamp: new Date().toISOString(),
        });
        this._save();
        this._refreshPanel();
        return true;
    }

    /**
     * Remove all notes for a given object.
     * @param {'gene'|'cell'|'patient'} objectType
     * @param {string} objectId
     */
    removeNote(objectType, objectId) {
        this._notes = this._notes.filter(
            n => !(n.type === objectType && n.id === objectId)
        );
        this._save();
        this._refreshPanel();
    }

    /**
     * Remove a note by index in the internal array.
     * @param {number} idx
     */
    removeNoteByIndex(idx) {
        if (idx >= 0 && idx < this._notes.length) {
            this._notes.splice(idx, 1);
            this._save();
            this._refreshPanel();
        }
    }

    /**
     * Get notes for a specific object.
     * @param {'gene'|'cell'|'patient'} objectType
     * @param {string} objectId
     * @returns {Array}
     */
    getNotes(objectType, objectId) {
        return this._notes.filter(
            n => n.type === objectType && n.id === objectId
        );
    }

    /**
     * Get all notes.
     * @returns {Array}
     */
    getAllNotes() {
        return [...this._notes];
    }

    /**
     * Export all notes as a JSON download.
     */
    exportNotes() {
        const blob = new Blob(
            [JSON.stringify(this._notes, null, 2)],
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'omniscope-annotations.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Show the annotation panel.
     */
    showPanel() {
        this.hidePanel();

        this._panel = document.createElement('div');
        Object.assign(this._panel.style, {
            position: 'fixed',
            top: '60px',
            right: '16px',
            width: '280px',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            background: PALETTE.bgPanel,
            border: '1px solid rgba(108,140,255,0.2)',
            borderRadius: '10px',
            padding: '14px',
            zIndex: '900',
            backdropFilter: 'blur(16px)',
            fontFamily: 'inherit',
            color: PALETTE.text,
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
        });

        const heading = document.createElement('div');
        heading.textContent = 'Annotations';
        Object.assign(heading.style, {
            fontSize: '0.8rem',
            fontWeight: '700',
        });

        const headerBtns = document.createElement('div');
        headerBtns.style.display = 'flex';
        headerBtns.style.gap = '6px';

        const exportBtn = document.createElement('button');
        exportBtn.className = 'ib-btn';
        exportBtn.textContent = 'Export';
        exportBtn.addEventListener('click', () => this.exportNotes());

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ib-btn';
        closeBtn.textContent = 'X';
        closeBtn.style.padding = '2px 8px';
        closeBtn.addEventListener('click', () => this.hidePanel());

        headerBtns.appendChild(exportBtn);
        headerBtns.appendChild(closeBtn);
        header.appendChild(heading);
        header.appendChild(headerBtns);
        this._panel.appendChild(header);

        // Grouped notes
        this._notesContainer = document.createElement('div');
        this._panel.appendChild(this._notesContainer);
        this._renderNotes();

        document.body.appendChild(this._panel);
    }

    _refreshPanel() {
        if (this._panel && this._notesContainer) {
            this._renderNotes();
        }
    }

    _renderNotes() {
        if (!this._notesContainer) return;
        this._notesContainer.innerHTML = '';

        if (this._notes.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No annotations yet.';
            Object.assign(empty.style, {
                color: PALETTE.textDim,
                fontSize: '0.68rem',
                textAlign: 'center',
                padding: '16px 0',
            });
            this._notesContainer.appendChild(empty);
            return;
        }

        // Group by type
        const groups = { gene: [], cell: [], patient: [] };
        this._notes.forEach((note, idx) => {
            const group = groups[note.type];
            if (group) group.push({ ...note, _idx: idx });
        });

        const typeLabels = { gene: 'Genes', cell: 'Cells', patient: 'Patients' };
        const typeColors = { gene: PALETTE.accent, cell: PALETTE.altitude, patient: PALETTE.overlap };

        for (const [type, notes] of Object.entries(groups)) {
            if (notes.length === 0) continue;

            const groupHeader = document.createElement('div');
            groupHeader.textContent = typeLabels[type];
            Object.assign(groupHeader.style, {
                fontSize: '0.7rem',
                fontWeight: '600',
                color: typeColors[type],
                marginTop: '8px',
                marginBottom: '4px',
            });
            this._notesContainer.appendChild(groupHeader);

            for (const note of notes) {
                const noteEl = document.createElement('div');
                Object.assign(noteEl.style, {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '6px 8px',
                    marginBottom: '3px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '4px',
                    fontSize: '0.66rem',
                });

                const left = document.createElement('div');
                left.style.flex = '1';

                const idLine = document.createElement('div');
                idLine.textContent = note.id;
                idLine.style.fontWeight = '600';
                idLine.style.color = PALETTE.text;
                left.appendChild(idLine);

                const textLine = document.createElement('div');
                textLine.textContent = note.text;
                textLine.style.color = PALETTE.textDim;
                textLine.style.marginTop = '2px';
                left.appendChild(textLine);

                const timeLine = document.createElement('div');
                const d = new Date(note.timestamp);
                timeLine.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                timeLine.style.color = 'rgba(136,136,170,0.5)';
                timeLine.style.marginTop = '2px';
                timeLine.style.fontSize = '0.58rem';
                left.appendChild(timeLine);

                const delBtn = document.createElement('button');
                delBtn.className = 'ib-btn';
                delBtn.textContent = 'X';
                delBtn.style.padding = '1px 6px';
                delBtn.style.marginLeft = '6px';
                delBtn.style.fontSize = '0.58rem';
                delBtn.style.flexShrink = '0';
                const capturedIdx = note._idx;
                delBtn.addEventListener('click', () => this.removeNoteByIndex(capturedIdx));

                noteEl.appendChild(left);
                noteEl.appendChild(delBtn);
                this._notesContainer.appendChild(noteEl);
            }
        }

        // Note count
        const countLabel = document.createElement('div');
        countLabel.textContent = `${this._notes.length}/${MAX_NOTES} notes`;
        Object.assign(countLabel.style, {
            fontSize: '0.6rem',
            color: PALETTE.textDim,
            textAlign: 'right',
            marginTop: '8px',
        });
        this._notesContainer.appendChild(countLabel);
    }

    hidePanel() {
        if (this._panel && this._panel.parentElement) {
            this._panel.parentElement.removeChild(this._panel);
        }
        this._panel = null;
        this._notesContainer = null;
    }
}


/* =========================================================================
   8. PresentationExport - Generate self-contained HTML slide deck
   ========================================================================= */

export class PresentationExport {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     */
    constructor(renderer, scene, camera) {
        this._renderer = renderer;
        this._scene = scene;
        this._camera = camera;
    }

    /**
     * Generate and download an HTML slide deck with screenshots.
     */
    async generate() {
        const screenshots = await this._captureScreenshots();
        const html = this._buildHTML(screenshots);

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'omniscope-presentation.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async _captureScreenshots() {
        const shots = [];

        // Render current view and capture
        this._renderer.render(this._scene, this._camera);
        shots.push({
            label: 'Current View',
            data: this._renderer.domElement.toDataURL('image/png'),
        });

        // Additional captures from different angles
        const originalPos = this._camera.position.clone();
        const originalTarget = new THREE.Vector3(0, 0, 0);

        const viewpoints = [
            { name: 'Gene Universe', pos: new THREE.Vector3(0, 0, 50), target: new THREE.Vector3(0, 0, 0) },
            { name: 'Cell Atlas', pos: new THREE.Vector3(30, 20, 40), target: new THREE.Vector3(0, 0, 0) },
            { name: 'Patient Landscape', pos: new THREE.Vector3(-20, 30, 35), target: new THREE.Vector3(0, 0, 0) },
            { name: 'Top-Down Overview', pos: new THREE.Vector3(0, 60, 5), target: new THREE.Vector3(0, 0, 0) },
            { name: 'Side Profile', pos: new THREE.Vector3(60, 10, 0), target: new THREE.Vector3(0, 0, 0) },
        ];

        for (const vp of viewpoints) {
            this._camera.position.copy(vp.pos);
            this._camera.lookAt(vp.target);
            this._camera.updateMatrixWorld(true);
            this._renderer.render(this._scene, this._camera);
            shots.push({
                label: vp.name,
                data: this._renderer.domElement.toDataURL('image/png'),
            });
        }

        // Restore camera
        this._camera.position.copy(originalPos);
        this._camera.lookAt(originalTarget);
        this._camera.updateMatrixWorld(true);
        this._renderer.render(this._scene, this._camera);

        return shots;
    }

    _buildHTML(screenshots) {
        const slides = [];

        // Slide 1: Title
        slides.push(`
            <div class="slide active">
                <h1>HCC OmniScope</h1>
                <h2>Multi-Scale 3D Cancer Biology Explorer</h2>
                <p class="subtitle">Interactive visualization of hepatocellular carcinoma gene signatures,<br>
                cell-type expression, and patient risk landscapes</p>
            </div>
        `);

        // Slide 2: Gene Universe
        const geneShot = screenshots.find(s => s.label === 'Gene Universe') || screenshots[0];
        slides.push(`
            <div class="slide">
                <h2>Gene Universe</h2>
                <img src="${geneShot.data}" alt="Gene Universe view" />
                <div class="stats">
                    <span>20 signature genes</span>
                    <span>2 risk signatures (ROS + Altitude)</span>
                    <span>169 candidate genes screened</span>
                </div>
            </div>
        `);

        // Slide 3: Cell Atlas
        const cellShot = screenshots.find(s => s.label === 'Cell Atlas') || screenshots[1];
        slides.push(`
            <div class="slide">
                <h2>Cell Atlas</h2>
                <img src="${cellShot.data}" alt="Cell Atlas view" />
                <div class="stats">
                    <span>85 cell types analyzed</span>
                    <span>14 tissues mapped</span>
                    <span>Key finding: Macrophages as specialist expressors</span>
                </div>
            </div>
        `);

        // Slide 4: Patient Landscape
        const patientShot = screenshots.find(s => s.label === 'Patient Landscape') || screenshots[2];
        slides.push(`
            <div class="slide">
                <h2>Patient Landscape</h2>
                <img src="${patientShot.data}" alt="Patient Landscape view" />
                <div class="stats">
                    <span>648 patients across 4 cohorts</span>
                    <span>C-index: 0.68 to 0.74</span>
                    <span>Consistent risk stratification</span>
                </div>
            </div>
        `);

        // Slide 5: Summary
        slides.push(`
            <div class="slide">
                <h2>Summary</h2>
                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="summary-num">20</div>
                        <div class="summary-label">Signature Genes</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-num">85</div>
                        <div class="summary-label">Cell Types</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-num">648</div>
                        <div class="summary-label">Patients Validated</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-num">4</div>
                        <div class="summary-label">External Cohorts</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-num">169</div>
                        <div class="summary-label">Candidate Genes</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-num">14</div>
                        <div class="summary-label">Tissues Mapped</div>
                    </div>
                </div>
                <p class="subtitle">Built with HCC OmniScope</p>
            </div>
        `);

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>HCC OmniScope Presentation</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: ${PALETTE.bg};
        color: ${PALETTE.text};
        overflow: hidden;
        height: 100vh;
    }
    .slide {
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        padding: 40px;
        text-align: center;
    }
    .slide.active { display: flex; }
    h1 {
        font-size: 2.4rem;
        font-weight: 800;
        color: ${PALETTE.accent};
        margin-bottom: 12px;
    }
    h2 {
        font-size: 1.5rem;
        font-weight: 600;
        color: ${PALETTE.text};
        margin-bottom: 20px;
    }
    .subtitle {
        font-size: 0.9rem;
        color: ${PALETTE.textDim};
        margin-top: 16px;
        line-height: 1.6;
    }
    img {
        max-width: 70vw;
        max-height: 50vh;
        border-radius: 8px;
        border: 1px solid rgba(108,140,255,0.2);
        margin-bottom: 16px;
    }
    .stats {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        justify-content: center;
    }
    .stats span {
        background: rgba(108,140,255,0.1);
        border: 1px solid rgba(108,140,255,0.2);
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 0.78rem;
        color: ${PALETTE.text};
    }
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        max-width: 600px;
        margin: 20px auto;
    }
    .summary-card {
        background: rgba(108,140,255,0.08);
        border: 1px solid rgba(108,140,255,0.2);
        border-radius: 8px;
        padding: 20px;
    }
    .summary-num {
        font-size: 2rem;
        font-weight: 800;
        color: ${PALETTE.accent};
    }
    .summary-label {
        font-size: 0.76rem;
        color: ${PALETTE.textDim};
        margin-top: 4px;
    }
    .nav {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 16px;
        z-index: 100;
    }
    .nav button {
        padding: 8px 20px;
        border: 1px solid rgba(108,140,255,0.4);
        border-radius: 6px;
        background: rgba(108,140,255,0.12);
        color: ${PALETTE.text};
        font-size: 0.82rem;
        cursor: pointer;
        transition: background 0.2s;
    }
    .nav button:hover { background: rgba(108,140,255,0.3); }
    .nav span { font-size: 0.76rem; color: ${PALETTE.textDim}; }
</style>
</head>
<body>
${slides.join('\n')}
<div class="nav">
    <button id="prev">&#8592; Prev</button>
    <span id="counter">1 / ${slides.length}</span>
    <button id="next">Next &#8594;</button>
</div>
<script>
(function(){
    const slides = document.querySelectorAll('.slide');
    const counter = document.getElementById('counter');
    let idx = 0;
    function show(i) {
        slides.forEach(s => s.classList.remove('active'));
        slides[i].classList.add('active');
        counter.textContent = (i + 1) + ' / ' + slides.length;
    }
    document.getElementById('prev').addEventListener('click', function() {
        idx = Math.max(0, idx - 1);
        show(idx);
    });
    document.getElementById('next').addEventListener('click', function() {
        idx = Math.min(slides.length - 1, idx + 1);
        show(idx);
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') { idx = Math.max(0, idx - 1); show(idx); }
        if (e.key === 'ArrowRight') { idx = Math.min(slides.length - 1, idx + 1); show(idx); }
    });
})();
</script>
</body>
</html>`;
    }
}
