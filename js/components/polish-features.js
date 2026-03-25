/**
 * HCC OmniScope - Polish Features
 * Utility classes for screenshot export, fullscreen, load animations,
 * particle trails, and keyboard navigation.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 1. ScreenshotExporter
// ---------------------------------------------------------------------------

export class ScreenshotExporter {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     * @param {CSS2DRenderer} labelRenderer
     */
    constructor(renderer, scene, camera, labelRenderer) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.labelRenderer = labelRenderer;
    }

    /**
     * Capture the current Three.js canvas as a PNG data URL with a watermark.
     * @returns {string} PNG data URL
     */
    captureScreenshot() {
        // Force a fresh render so the canvas is up to date
        this.renderer.render(this.scene, this.camera);

        const srcCanvas = this.renderer.domElement;
        const width = srcCanvas.width;
        const height = srcCanvas.height;

        // Create an offscreen canvas for compositing
        const outCanvas = document.createElement('canvas');
        outCanvas.width = width;
        outCanvas.height = height;
        const ctx = outCanvas.getContext('2d');

        // Draw the 3D scene
        ctx.drawImage(srcCanvas, 0, 0);

        // Overlay the CSS2D label layer if available
        if (this.labelRenderer) {
            const labelCanvas = this.labelRenderer.domElement;
            // html2canvas is not available, so we skip label overlay
            // Labels are DOM elements and cannot be trivially composited
        }

        // Draw watermark at bottom-right
        const fontSize = Math.max(12, Math.round(height * 0.018));
        ctx.font = `${fontSize}px "Inter", system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(108, 140, 255, 0.55)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('HCC OmniScope - Isha Chhikara', width - 16, height - 12);

        return outCanvas.toDataURL('image/png');
    }

    /**
     * Trigger a browser download of a PNG screenshot.
     * @param {string} [filename] - Suggested filename. Defaults to timestamped name.
     */
    downloadScreenshot(filename) {
        const dataUrl = this.captureScreenshot();
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const name = filename || `omniscope-${ts}.png`;

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Export a data object (array of objects) as a CSV download.
     * @param {Array<Object>} data - Array of flat objects
     * @param {string} [filename] - Suggested filename
     */
    exportCSV(data, filename) {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]);
        const rows = data.map(row =>
            headers.map(h => {
                const val = row[h];
                if (val == null) return '';
                const str = String(val);
                // Quote fields that contain commas, quotes, or newlines
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            }).join(',')
        );

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const name = filename || `omniscope-data-${ts}.csv`;

        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}


// ---------------------------------------------------------------------------
// 2. FullscreenManager
// ---------------------------------------------------------------------------

export class FullscreenManager {
    /**
     * @param {HTMLElement} sidebarEl
     * @param {HTMLElement} summaryStatsEl
     * @param {HTMLElement} breadcrumbEl
     */
    constructor(sidebarEl, summaryStatsEl, breadcrumbEl) {
        this.sidebarEl = sidebarEl;
        this.summaryStatsEl = summaryStatsEl;
        this.breadcrumbEl = breadcrumbEl;
        this._isFullscreen = false;
        this._hint = null;
        this._hintTimeout = null;

        // Inject transition styles once
        this._injectStyles();
    }

    /** @returns {boolean} */
    get isFullscreen() {
        return this._isFullscreen;
    }

    /** Toggle fullscreen mode on/off. */
    toggle() {
        this._isFullscreen = !this._isFullscreen;

        if (this._isFullscreen) {
            this._enter();
        } else {
            this._exit();
        }
    }

    _enter() {
        if (this.sidebarEl) {
            this.sidebarEl.classList.add('omniscope-fs-hidden-sidebar');
        }
        if (this.summaryStatsEl) {
            this.summaryStatsEl.classList.add('omniscope-fs-hidden');
        }
        if (this.breadcrumbEl) {
            this.breadcrumbEl.classList.add('omniscope-fs-hidden');
        }
        this._showHint();
    }

    _exit() {
        if (this.sidebarEl) {
            this.sidebarEl.classList.remove('omniscope-fs-hidden-sidebar');
        }
        if (this.summaryStatsEl) {
            this.summaryStatsEl.classList.remove('omniscope-fs-hidden');
        }
        if (this.breadcrumbEl) {
            this.breadcrumbEl.classList.remove('omniscope-fs-hidden');
        }
        this._removeHint();
    }

    _showHint() {
        this._removeHint();

        const hint = document.createElement('div');
        hint.className = 'omniscope-fs-hint';
        hint.textContent = 'Press F to exit fullscreen';
        document.body.appendChild(hint);
        this._hint = hint;

        // Trigger reflow then add visible class for transition
        void hint.offsetWidth;
        hint.classList.add('omniscope-fs-hint-visible');

        // Fade out after 3 seconds
        this._hintTimeout = setTimeout(() => {
            hint.classList.remove('omniscope-fs-hint-visible');
            setTimeout(() => {
                this._removeHint();
            }, 500);
        }, 3000);
    }

    _removeHint() {
        if (this._hintTimeout) {
            clearTimeout(this._hintTimeout);
            this._hintTimeout = null;
        }
        if (this._hint && this._hint.parentNode) {
            this._hint.parentNode.removeChild(this._hint);
            this._hint = null;
        }
    }

    _injectStyles() {
        if (document.getElementById('omniscope-fs-styles')) return;

        const style = document.createElement('style');
        style.id = 'omniscope-fs-styles';
        style.textContent = `
            .omniscope-fs-hidden-sidebar {
                transform: translateX(-100%) !important;
                opacity: 0 !important;
                pointer-events: none !important;
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                            opacity 0.3s ease !important;
            }
            .omniscope-fs-hidden {
                opacity: 0 !important;
                pointer-events: none !important;
                transition: opacity 0.3s ease !important;
            }
            .omniscope-fs-hint {
                position: fixed;
                bottom: 32px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(12, 12, 30, 0.92);
                color: #e0e0f0;
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 0.8rem;
                padding: 8px 20px;
                border-radius: 8px;
                border: 1px solid rgba(100, 120, 255, 0.3);
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.4s ease;
                pointer-events: none;
            }
            .omniscope-fs-hint-visible {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }
}


// ---------------------------------------------------------------------------
// 3. LoadAnimator
// ---------------------------------------------------------------------------

/**
 * Ease-out cubic: decelerating to zero velocity.
 * @param {number} t - Progress 0..1
 * @returns {number}
 */
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-out bounce for the patient rain animation.
 * @param {number} t - Progress 0..1
 * @returns {number}
 */
function easeOutBounce(t) {
    if (t < 1 / 2.75) {
        return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
        t -= 1.5 / 2.75;
        return 7.5625 * t * t + 0.75;
    } else if (t < 2.5 / 2.75) {
        t -= 2.25 / 2.75;
        return 7.5625 * t * t + 0.9375;
    } else {
        t -= 2.625 / 2.75;
        return 7.5625 * t * t + 0.984375;
    }
}

export class LoadAnimator {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Gene spiral entrance: nodes start at center with scale 0, spiral out
     * to their final positions over the given duration.
     *
     * @param {THREE.Mesh[]} nodeMeshes - Array of gene node meshes
     * @param {number} [duration=1500] - Duration in ms
     * @returns {Promise<void>}
     */
    animateGeneEntrance(nodeMeshes, duration = 1500) {
        if (!nodeMeshes || nodeMeshes.length === 0) return Promise.resolve();

        // Store original transforms
        const originals = nodeMeshes.map(mesh => ({
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
            sx: mesh.scale.x,
            sy: mesh.scale.y,
            sz: mesh.scale.z,
        }));

        // Set start state: all at center, scale 0
        for (const mesh of nodeMeshes) {
            mesh.position.set(0, 0, 0);
            mesh.scale.set(0.001, 0.001, 0.001);
        }

        const startTime = performance.now();

        return new Promise(resolve => {
            const tick = (now) => {
                const elapsed = now - startTime;
                const rawT = Math.min(elapsed / duration, 1);
                const t = easeOutCubic(rawT);

                for (let i = 0; i < nodeMeshes.length; i++) {
                    const mesh = nodeMeshes[i];
                    const orig = originals[i];

                    // Stagger: each node starts slightly later
                    const stagger = (i / nodeMeshes.length) * 0.3;
                    const localT = Math.max(0, Math.min((rawT - stagger) / (1 - stagger), 1));
                    const easedT = easeOutCubic(localT);

                    // Spiral: add a rotational offset that diminishes over time
                    const angle = (1 - easedT) * Math.PI * 2 * 1.5;
                    const spiralRadius = (1 - easedT) * 2;

                    mesh.position.x = orig.x * easedT + Math.cos(angle + i) * spiralRadius;
                    mesh.position.y = orig.y * easedT + Math.sin(angle + i) * spiralRadius;
                    mesh.position.z = orig.z * easedT;

                    mesh.scale.set(
                        orig.sx * easedT,
                        orig.sy * easedT,
                        orig.sz * easedT,
                    );
                }

                if (rawT < 1) {
                    requestAnimationFrame(tick);
                } else {
                    // Snap to exact final positions
                    for (let i = 0; i < nodeMeshes.length; i++) {
                        const mesh = nodeMeshes[i];
                        const orig = originals[i];
                        mesh.position.set(orig.x, orig.y, orig.z);
                        mesh.scale.set(orig.sx, orig.sy, orig.sz);
                    }
                    resolve();
                }
            };
            requestAnimationFrame(tick);
        });
    }

    /**
     * Cell fade entrance: cells start transparent at small scale, grow to
     * final size with staggered timing.
     *
     * @param {THREE.Mesh[]} nodeMeshes - Array of cell node meshes
     * @param {number} [duration=1200] - Duration in ms
     * @returns {Promise<void>}
     */
    animateCellEntrance(nodeMeshes, duration = 1200) {
        if (!nodeMeshes || nodeMeshes.length === 0) return Promise.resolve();

        const originals = nodeMeshes.map(mesh => ({
            sx: mesh.scale.x,
            sy: mesh.scale.y,
            sz: mesh.scale.z,
            opacity: mesh.material.opacity != null ? mesh.material.opacity : 1,
        }));

        // Set start state
        for (const mesh of nodeMeshes) {
            mesh.scale.set(0.1, 0.1, 0.1);
            if (mesh.material) {
                mesh.material.transparent = true;
                mesh.material.opacity = 0;
            }
        }

        const startTime = performance.now();

        return new Promise(resolve => {
            const tick = (now) => {
                const elapsed = now - startTime;
                const rawT = Math.min(elapsed / duration, 1);

                for (let i = 0; i < nodeMeshes.length; i++) {
                    const mesh = nodeMeshes[i];
                    const orig = originals[i];

                    // Stagger each cell
                    const stagger = (i / nodeMeshes.length) * 0.4;
                    const localT = Math.max(0, Math.min((rawT - stagger) / (1 - stagger), 1));
                    const easedT = easeOutCubic(localT);

                    const s = 0.1 + (1 - 0.1) * easedT;
                    mesh.scale.set(orig.sx * s, orig.sy * s, orig.sz * s);

                    if (mesh.material) {
                        mesh.material.opacity = orig.opacity * easedT;
                    }
                }

                if (rawT < 1) {
                    requestAnimationFrame(tick);
                } else {
                    // Snap to final state
                    for (let i = 0; i < nodeMeshes.length; i++) {
                        const mesh = nodeMeshes[i];
                        const orig = originals[i];
                        mesh.scale.set(orig.sx, orig.sy, orig.sz);
                        if (mesh.material) {
                            mesh.material.opacity = orig.opacity;
                        }
                    }
                    resolve();
                }
            };
            requestAnimationFrame(tick);
        });
    }

    /**
     * Patient rain entrance: patients start above final Y, fall down with bounce.
     * Works with THREE.InstancedMesh via per-instance matrix manipulation.
     *
     * @param {THREE.InstancedMesh} instancedMesh
     * @param {number} count - Number of instances
     * @param {number} [duration=1800] - Duration in ms
     * @returns {Promise<void>}
     */
    animatePatientEntrance(instancedMesh, count, duration = 1800) {
        if (!instancedMesh || count === 0) return Promise.resolve();

        const dummy = new THREE.Object3D();
        const tempMatrix = new THREE.Matrix4();

        // Store original transforms
        const originals = [];
        for (let i = 0; i < count; i++) {
            instancedMesh.getMatrixAt(i, tempMatrix);
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            const scl = new THREE.Vector3();
            tempMatrix.decompose(pos, quat, scl);
            originals.push({ pos, quat, scl });
        }

        // Set start state: same X/Z but Y raised above
        const dropHeight = 15;
        for (let i = 0; i < count; i++) {
            const orig = originals[i];
            dummy.position.set(orig.pos.x, orig.pos.y + dropHeight, orig.pos.z);
            dummy.quaternion.copy(orig.quat);
            dummy.scale.copy(orig.scl);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;

        const startTime = performance.now();

        return new Promise(resolve => {
            const tick = (now) => {
                const elapsed = now - startTime;
                const rawT = Math.min(elapsed / duration, 1);

                for (let i = 0; i < count; i++) {
                    const orig = originals[i];

                    // Stagger: patients fall in sequence
                    const stagger = (i / count) * 0.5;
                    const localT = Math.max(0, Math.min((rawT - stagger) / (1 - stagger), 1));
                    const easedT = easeOutBounce(localT);

                    const currentY = orig.pos.y + dropHeight * (1 - easedT);

                    dummy.position.set(orig.pos.x, currentY, orig.pos.z);
                    dummy.quaternion.copy(orig.quat);
                    dummy.scale.copy(orig.scl);
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(i, dummy.matrix);
                }
                instancedMesh.instanceMatrix.needsUpdate = true;

                if (rawT < 1) {
                    requestAnimationFrame(tick);
                } else {
                    // Snap to final positions
                    for (let i = 0; i < count; i++) {
                        const orig = originals[i];
                        dummy.position.copy(orig.pos);
                        dummy.quaternion.copy(orig.quat);
                        dummy.scale.copy(orig.scl);
                        dummy.updateMatrix();
                        instancedMesh.setMatrixAt(i, dummy.matrix);
                    }
                    instancedMesh.instanceMatrix.needsUpdate = true;
                    resolve();
                }
            };
            requestAnimationFrame(tick);
        });
    }
}


// ---------------------------------------------------------------------------
// 4. ParticleTrails
// ---------------------------------------------------------------------------

const MAX_PARTICLES = 100;
const PARTICLES_PER_EDGE = 2;

export class ParticleTrails {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.scene = scene;
        this.trails = [];       // { start, end, color, speed, particles[] }
        this.points = null;     // THREE.Points object
        this._positions = null; // Float32Array for positions
        this._colors = null;    // Float32Array for colors
        this._opacities = null; // Float32Array for per-particle alpha
        this._particleCount = 0;
        this._visible = true;

        this._initGeometry();
    }

    _initGeometry() {
        const geometry = new THREE.BufferGeometry();

        this._positions = new Float32Array(MAX_PARTICLES * 3);
        this._colors = new Float32Array(MAX_PARTICLES * 3);
        this._opacities = new Float32Array(MAX_PARTICLES);

        geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this._colors, 3));
        geometry.setAttribute('aOpacity', new THREE.BufferAttribute(this._opacities, 1));

        // Custom shader material for per-particle opacity
        const material = new THREE.ShaderMaterial({
            vertexShader: `
                attribute float aOpacity;
                varying float vOpacity;
                varying vec3 vColor;
                void main() {
                    vOpacity = aOpacity;
                    vColor = color;
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = 3.0 * (8.0 / -mvPos.z);
                    gl_PointSize = clamp(gl_PointSize, 1.0, 6.0);
                    gl_Position = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                varying float vOpacity;
                varying vec3 vColor;
                void main() {
                    // Soft circle
                    float d = length(gl_PointCoord - vec2(0.5));
                    if (d > 0.5) discard;
                    float alpha = smoothstep(0.5, 0.15, d) * vOpacity;
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true,
        });

        this.points = new THREE.Points(geometry, material);
        this.points.frustumCulled = false;
        this.scene.add(this.points);
    }

    /**
     * Add an animated particle trail along an edge.
     * @param {THREE.Vector3} startPos
     * @param {THREE.Vector3} endPos
     * @param {THREE.Color|number} color
     * @param {number} speed - Range ~0.2 to 1.0
     */
    addTrail(startPos, endPos, color, speed) {
        if (this._particleCount >= MAX_PARTICLES) return;

        const col = color instanceof THREE.Color ? color : new THREE.Color(color);
        const particlesToAdd = Math.min(
            PARTICLES_PER_EDGE,
            MAX_PARTICLES - this._particleCount
        );

        const particles = [];
        for (let i = 0; i < particlesToAdd; i++) {
            // Offset each particle so they are spaced along the edge
            const t = i / particlesToAdd;
            particles.push({
                t: t,                     // progress 0..1 along edge
                index: this._particleCount,
            });

            // Initialize position and color in the buffers
            const idx = this._particleCount;
            this._colors[idx * 3] = col.r;
            this._colors[idx * 3 + 1] = col.g;
            this._colors[idx * 3 + 2] = col.b;
            this._opacities[idx] = 0;

            this._particleCount++;
        }

        this.trails.push({
            start: startPos.clone(),
            end: endPos.clone(),
            color: col,
            speed: Math.max(0.05, speed),
            particles: particles,
        });
    }

    /**
     * Update all particle positions. Call every frame.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (!this._visible || this.trails.length === 0) return;

        for (const trail of this.trails) {
            for (const p of trail.particles) {
                // Advance along the edge
                p.t += trail.speed * dt * 0.5;
                if (p.t > 1) p.t -= 1;

                // Lerp position
                const idx = p.index;
                this._positions[idx * 3] = trail.start.x + (trail.end.x - trail.start.x) * p.t;
                this._positions[idx * 3 + 1] = trail.start.y + (trail.end.y - trail.start.y) * p.t;
                this._positions[idx * 3 + 2] = trail.start.z + (trail.end.z - trail.start.z) * p.t;

                // Fade in at start, fade out at end
                let opacity = 1;
                if (p.t < 0.15) {
                    opacity = p.t / 0.15;
                } else if (p.t > 0.85) {
                    opacity = (1 - p.t) / 0.15;
                }
                this._opacities[idx] = opacity;
            }
        }

        // Mark buffers as needing update
        const geom = this.points.geometry;
        geom.attributes.position.needsUpdate = true;
        geom.attributes.aOpacity.needsUpdate = true;
        // Only draw active particles
        geom.setDrawRange(0, this._particleCount);
    }

    /** Remove all trails and reset particles. */
    clear() {
        this.trails = [];
        this._particleCount = 0;
        this._positions.fill(0);
        this._opacities.fill(0);
        const geom = this.points.geometry;
        geom.attributes.position.needsUpdate = true;
        geom.attributes.aOpacity.needsUpdate = true;
        geom.setDrawRange(0, 0);
    }

    /**
     * Toggle visibility of all particle trails.
     * @param {boolean} visible
     */
    setVisible(visible) {
        this._visible = visible;
        this.points.visible = visible;
    }
}


// ---------------------------------------------------------------------------
// 5. KeyboardNavigator
// ---------------------------------------------------------------------------

export class KeyboardNavigator {
    /**
     * @param {function} onGeneSelect - Called with gene name when cycling
     * @param {function} onScaleSwitch - Called with scale name string
     */
    constructor(onGeneSelect, onScaleSwitch) {
        this.onGeneSelect = onGeneSelect;
        this.onScaleSwitch = onScaleSwitch;
        this.genes = [];
        this._currentIndex = -1;
        this._overlay = null;
        this._handlers = {};

        this._bind();
    }

    /**
     * Set the list of gene names for arrow key cycling.
     * @param {string[]} genes
     */
    setGeneList(genes) {
        this.genes = genes || [];
        this._currentIndex = -1;
    }

    _bind() {
        this._handlers.keydown = (e) => {
            // Skip if user is typing in an input, textarea, or contenteditable
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this._cycleGene(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this._cycleGene(1);
                    break;
                case 'f':
                case 'F':
                    // Fullscreen is handled externally; we just document it here.
                    // The consuming code should wire F to FullscreenManager.toggle().
                    break;
                case 's':
                case 'S':
                    // Screenshot - handled externally
                    break;
                case 'd':
                case 'D':
                    // Drug explorer - handled externally
                    break;
                case 'k':
                case 'K':
                    // KM curves - handled externally
                    break;
                case '/':
                    e.preventDefault();
                    this._focusSearch();
                    break;
                case '?':
                    e.preventDefault();
                    this._toggleShortcutsOverlay();
                    break;
                default:
                    break;
            }
        };

        document.addEventListener('keydown', this._handlers.keydown);
    }

    _cycleGene(direction) {
        if (this.genes.length === 0) return;

        this._currentIndex += direction;
        if (this._currentIndex < 0) {
            this._currentIndex = this.genes.length - 1;
        } else if (this._currentIndex >= this.genes.length) {
            this._currentIndex = 0;
        }

        const gene = this.genes[this._currentIndex];
        if (this.onGeneSelect) {
            this.onGeneSelect(gene);
        }
    }

    _focusSearch() {
        const searchInput = document.querySelector('#gene-search')
            || document.querySelector('input[type="search"]')
            || document.querySelector('input[placeholder*="search" i]');
        if (searchInput) {
            searchInput.focus();
        }
    }

    _toggleShortcutsOverlay() {
        if (this._overlay) {
            this._removeOverlay();
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'omniscope-kb-overlay';

        const shortcuts = [
            ['Left / Right', 'Cycle through genes'],
            ['1 / 2 / 3', 'Switch scale (Genes / Cells / Patients)'],
            ['F', 'Toggle fullscreen'],
            ['S', 'Capture screenshot'],
            ['D', 'Open drug explorer'],
            ['K', 'Kaplan-Meier curves'],
            ['/', 'Focus search'],
            ['?', 'Show / hide this overlay'],
        ];

        const rows = shortcuts.map(([key, desc]) =>
            `<div class="omniscope-kb-row">
                <kbd class="omniscope-kbd">${key}</kbd>
                <span class="omniscope-kb-desc">${desc}</span>
            </div>`
        ).join('');

        overlay.innerHTML = `
            <div class="omniscope-kb-modal">
                <div class="omniscope-kb-title">Keyboard Shortcuts</div>
                ${rows}
                <div class="omniscope-kb-hint">Press ? or Escape to close</div>
            </div>
        `;

        // Close on click outside or Escape
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._removeOverlay();
        });
        this._handlers.escOverlay = (e) => {
            if (e.key === 'Escape' && this._overlay) {
                this._removeOverlay();
            }
        };
        document.addEventListener('keydown', this._handlers.escOverlay);

        this._injectOverlayStyles();
        document.body.appendChild(overlay);
        this._overlay = overlay;

        // Fade in
        void overlay.offsetWidth;
        overlay.classList.add('omniscope-kb-overlay-visible');
    }

    _removeOverlay() {
        if (!this._overlay) return;
        this._overlay.classList.remove('omniscope-kb-overlay-visible');
        const el = this._overlay;
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 300);
        this._overlay = null;

        if (this._handlers.escOverlay) {
            document.removeEventListener('keydown', this._handlers.escOverlay);
            this._handlers.escOverlay = null;
        }
    }

    _injectOverlayStyles() {
        if (document.getElementById('omniscope-kb-styles')) return;

        const style = document.createElement('style');
        style.id = 'omniscope-kb-styles';
        style.textContent = `
            .omniscope-kb-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.25s ease;
            }
            .omniscope-kb-overlay-visible {
                opacity: 1;
            }
            .omniscope-kb-modal {
                background: rgba(12, 12, 30, 0.96);
                border: 1px solid rgba(100, 120, 255, 0.3);
                border-radius: 12px;
                padding: 24px 32px;
                min-width: 320px;
                max-width: 420px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            }
            .omniscope-kb-title {
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 1rem;
                font-weight: 600;
                color: #e0e0f0;
                margin-bottom: 16px;
                text-align: center;
            }
            .omniscope-kb-row {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 6px 0;
            }
            .omniscope-kbd {
                font-family: 'JetBrains Mono', 'SF Mono', monospace;
                font-size: 0.72rem;
                background: rgba(100, 120, 255, 0.12);
                color: #6c8cff;
                border: 1px solid rgba(100, 120, 255, 0.25);
                border-radius: 4px;
                padding: 2px 8px;
                min-width: 80px;
                text-align: center;
                white-space: nowrap;
            }
            .omniscope-kb-desc {
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 0.78rem;
                color: #b0b0cc;
            }
            .omniscope-kb-hint {
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 0.65rem;
                color: #666688;
                text-align: center;
                margin-top: 16px;
            }
        `;
        document.head.appendChild(style);
    }

    /** Clean up event listeners. */
    destroy() {
        if (this._handlers.keydown) {
            document.removeEventListener('keydown', this._handlers.keydown);
        }
        if (this._handlers.escOverlay) {
            document.removeEventListener('keydown', this._handlers.escOverlay);
        }
        this._removeOverlay();
    }
}
