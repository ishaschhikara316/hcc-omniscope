/**
 * HCC OmniScope - UI Enhancement Classes
 * Theme toggle, minimap, navigation history, share URL, and responsive touch.
 * Pure vanilla JS + Three.js ES module. No frameworks, no em dashes.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 1. ThemeToggle - Toggle between dark and light themes
// ---------------------------------------------------------------------------

export class ThemeToggle {
    /**
     * @param {HTMLElement} containerEl - DOM element to append the toggle button into
     */
    constructor(containerEl) {
        this._isDark = true;
        this.containerEl = containerEl;

        // Restore preference from localStorage
        const stored = localStorage.getItem('omniscope-theme');
        if (stored === 'light') {
            this._isDark = false;
        }

        this._injectTransitionStyle();
        this._build();
        this._applyTheme();
    }

    get isDark() {
        return this._isDark;
    }

    _injectTransitionStyle() {
        if (document.getElementById('theme-transition-style')) return;
        const style = document.createElement('style');
        style.id = 'theme-transition-style';
        style.textContent = `
            *, *::before, *::after {
                transition: background-color 0.3s ease,
                            color 0.3s ease,
                            border-color 0.3s ease,
                            box-shadow 0.3s ease !important;
            }
        `;
        document.head.appendChild(style);
        // Remove the blanket transition after initial apply so it does not
        // interfere with animations elsewhere. Re-inject briefly on toggle.
        setTimeout(() => style.remove(), 400);
        this._transitionStyle = style;
    }

    _build() {
        this.btn = document.createElement('button');
        this.btn.className = 'theme-toggle-btn';
        this.btn.setAttribute('aria-label', 'Toggle light/dark theme');
        this.btn.title = 'Toggle theme';
        Object.assign(this.btn.style, {
            position: 'fixed',
            top: '12px',
            right: '12px',
            zIndex: '900',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--bg-panel)',
            color: 'var(--text)',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            lineHeight: '1',
            padding: '0',
        });

        this._updateIcon();

        this.btn.addEventListener('click', () => {
            this._isDark = !this._isDark;
            this._applyTheme();
            this._updateIcon();
            localStorage.setItem('omniscope-theme', this._isDark ? 'dark' : 'light');
        });

        this.containerEl.appendChild(this.btn);
    }

    _updateIcon() {
        // Sun for dark mode (click to go light), moon for light mode (click to go dark)
        this.btn.textContent = this._isDark ? '\u2600' : '\u263D';
    }

    _applyTheme() {
        const root = document.documentElement;

        // Briefly inject transition style for smooth switch
        if (!document.getElementById('theme-transition-style')) {
            const style = document.createElement('style');
            style.id = 'theme-transition-style';
            style.textContent = `
                *, *::before, *::after {
                    transition: background-color 0.3s ease,
                                color 0.3s ease,
                                border-color 0.3s ease,
                                box-shadow 0.3s ease !important;
                }
            `;
            document.head.appendChild(style);
            setTimeout(() => style.remove(), 400);
        }

        if (this._isDark) {
            root.style.setProperty('--bg', '#0a0a1a');
            root.style.setProperty('--bg-panel', 'rgba(12,12,30,0.92)');
            root.style.setProperty('--border', 'rgba(100,120,255,0.15)');
            root.style.setProperty('--text', '#e0e0f0');
            root.style.setProperty('--text-dim', '#8888aa');
            root.style.setProperty('--accent', '#6c8cff');
        } else {
            root.style.setProperty('--bg', '#f0f2f5');
            root.style.setProperty('--bg-panel', 'rgba(255,255,255,0.95)');
            root.style.setProperty('--border', 'rgba(0,0,0,0.1)');
            root.style.setProperty('--text', '#1a1a2e');
            root.style.setProperty('--text-dim', '#666680');
            root.style.setProperty('--accent', '#4a5eff');
        }

        // Dispatch event so Three.js scene can update background/fog
        window.dispatchEvent(new CustomEvent('theme-changed', {
            detail: { isDark: this._isDark },
        }));
    }
}

// ---------------------------------------------------------------------------
// 2. Minimap - Small 2D canvas overview showing camera position
// ---------------------------------------------------------------------------

export class Minimap {
    /**
     * @param {THREE.PerspectiveCamera} mainCamera
     * @param {THREE.Scene} mainScene
     */
    constructor(mainCamera, mainScene) {
        this.mainCamera = mainCamera;
        this.mainScene = mainScene;
        this._visible = true;
        this._lastCamX = null;
        this._lastCamY = null;
        this._lastCamZ = null;

        this._build();
    }

    _build() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 120;
        this.canvas.height = 120;
        Object.assign(this.canvas.style, {
            position: 'fixed',
            bottom: '70px',
            left: '292px',
            zIndex: '800',
            width: '120px',
            height: '120px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
        });
        this.ctx = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);
    }

    /**
     * Call every frame. Redraws only when camera moves beyond a threshold.
     */
    update() {
        if (!this._visible) return;

        const cam = this.mainCamera;
        const dx = Math.abs(cam.position.x - (this._lastCamX || 0));
        const dy = Math.abs(cam.position.y - (this._lastCamY || 0));
        const dz = Math.abs(cam.position.z - (this._lastCamZ || 0));

        if (dx < 0.5 && dy < 0.5 && dz < 0.5 && this._lastCamX !== null) return;

        this._lastCamX = cam.position.x;
        this._lastCamY = cam.position.y;
        this._lastCamZ = cam.position.z;

        this._draw();
    }

    _draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Gather node positions from currently visible scale group
        const positions = this._gatherNodePositions();
        if (positions.length === 0) return;

        // Compute bounds for orthographic projection (top-down: x, z)
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (const p of positions) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.z < minZ) minZ = p.z;
            if (p.z > maxZ) maxZ = p.z;
        }

        // Add padding
        const pad = 2;
        minX -= pad; maxX += pad;
        minZ -= pad; maxZ += pad;

        const rangeX = maxX - minX || 1;
        const rangeZ = maxZ - minZ || 1;

        const margin = 8;
        const drawW = w - margin * 2;
        const drawH = h - margin * 2;

        const toScreenX = (x) => margin + ((x - minX) / rangeX) * drawW;
        const toScreenZ = (z) => margin + ((z - minZ) / rangeZ) * drawH;

        // Draw node dots
        ctx.fillStyle = 'rgba(108, 140, 255, 0.5)';
        for (const p of positions) {
            const sx = toScreenX(p.x);
            const sz = toScreenZ(p.z);
            ctx.beginPath();
            ctx.arc(sx, sz, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw camera position as a highlighted indicator
        const camSX = toScreenX(this.mainCamera.position.x);
        const camSZ = toScreenZ(this.mainCamera.position.z);

        // Camera direction arrow
        const dir = new THREE.Vector3();
        this.mainCamera.getWorldDirection(dir);
        const arrowLen = 8;
        const endX = camSX + dir.x * arrowLen;
        const endZ = camSZ + dir.z * arrowLen;

        // Draw arrow body
        ctx.strokeStyle = '#ff6c6c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(camSX, camSZ);
        ctx.lineTo(endX, endZ);
        ctx.stroke();

        // Draw camera dot
        ctx.fillStyle = '#ff6c6c';
        ctx.beginPath();
        ctx.arc(camSX, camSZ, 3, 0, Math.PI * 2);
        ctx.fill();

        // Small border highlight
        ctx.strokeStyle = 'rgba(108, 140, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    }

    /**
     * Collect 3D positions from the currently visible scale group in the scene.
     */
    _gatherNodePositions() {
        const positions = [];
        const scaleNames = ['gene-universe', 'cell-atlas', 'patient-landscape'];

        for (const name of scaleNames) {
            const group = this.mainScene.getObjectByName(name);
            if (!group || !group.visible) continue;

            // For instanced meshes (patient landscape)
            group.traverse((child) => {
                if (child.isInstancedMesh) {
                    const dummy = new THREE.Matrix4();
                    const pos = new THREE.Vector3();
                    const count = Math.min(child.count, 500); // cap for performance
                    for (let i = 0; i < count; i++) {
                        child.getMatrixAt(i, dummy);
                        pos.setFromMatrixPosition(dummy);
                        positions.push({ x: pos.x, y: pos.y, z: pos.z });
                    }
                } else if (child.isMesh && child.geometry) {
                    // Individual meshes (gene universe, cell atlas nodes)
                    positions.push({
                        x: child.position.x,
                        y: child.position.y,
                        z: child.position.z,
                    });
                }
            });
            break; // Only process the first visible scale
        }

        return positions;
    }

    setVisible(visible) {
        this._visible = visible;
        this.canvas.style.display = visible ? 'block' : 'none';
    }
}

// ---------------------------------------------------------------------------
// 3. NavigationHistory - Back/forward navigation between views
// ---------------------------------------------------------------------------

export class NavigationHistory {
    /**
     * @param {function} onNavigate - Callback(historyEntry) when user navigates back/forward
     */
    constructor(onNavigate) {
        this.onNavigate = onNavigate;
        this._stack = [];
        this._index = -1;
        this._maxSize = 50;
        this._navigating = false; // flag to prevent push during back/forward

        this._build();
        this._attachKeyboard();
    }

    get canGoBack() {
        return this._index > 0;
    }

    get canGoForward() {
        return this._index < this._stack.length - 1;
    }

    /**
     * Push a new view state. Clears any forward history.
     * @param {Object} entry - { scale, selectedGene, selectedCell, cameraPos, cameraTarget }
     */
    push(entry) {
        if (this._navigating) return;

        // Trim forward history
        if (this._index < this._stack.length - 1) {
            this._stack = this._stack.slice(0, this._index + 1);
        }

        // Enforce max size
        if (this._stack.length >= this._maxSize) {
            this._stack.shift();
            this._index--;
        }

        this._stack.push(entry);
        this._index = this._stack.length - 1;
        this._updateButtons();
    }

    back() {
        if (!this.canGoBack) return;
        this._index--;
        this._navigating = true;
        this.onNavigate(this._stack[this._index]);
        this._navigating = false;
        this._updateButtons();
    }

    forward() {
        if (!this.canGoForward) return;
        this._index++;
        this._navigating = true;
        this.onNavigate(this._stack[this._index]);
        this._navigating = false;
        this._updateButtons();
    }

    _build() {
        this.container = document.createElement('div');
        this.container.className = 'nav-history-buttons';
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '850',
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
        });

        const btnStyle = {
            width: '30px',
            height: '30px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg-panel)',
            color: 'var(--text)',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            padding: '0',
            lineHeight: '1',
        };

        this.backBtn = document.createElement('button');
        this.backBtn.setAttribute('aria-label', 'Go back');
        this.backBtn.title = 'Back (Alt+Left)';
        this.backBtn.textContent = '\u2190';
        Object.assign(this.backBtn.style, btnStyle);

        this.forwardBtn = document.createElement('button');
        this.forwardBtn.setAttribute('aria-label', 'Go forward');
        this.forwardBtn.title = 'Forward (Alt+Right)';
        this.forwardBtn.textContent = '\u2192';
        Object.assign(this.forwardBtn.style, btnStyle);

        this.backBtn.addEventListener('click', () => this.back());
        this.forwardBtn.addEventListener('click', () => this.forward());

        this.container.appendChild(this.backBtn);
        this.container.appendChild(this.forwardBtn);
        document.body.appendChild(this.container);

        this._updateButtons();
    }

    _updateButtons() {
        this.backBtn.disabled = !this.canGoBack;
        this.forwardBtn.disabled = !this.canGoForward;

        this.backBtn.style.opacity = this.canGoBack ? '1' : '0.3';
        this.forwardBtn.style.opacity = this.canGoForward ? '1' : '0.3';
        this.backBtn.style.pointerEvents = this.canGoBack ? 'auto' : 'none';
        this.forwardBtn.style.pointerEvents = this.canGoForward ? 'auto' : 'none';
    }

    _attachKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.back();
            } else if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                this.forward();
            }
        });
    }
}

// ---------------------------------------------------------------------------
// 4. ShareURL - Encode and decode view state in URL hash
// ---------------------------------------------------------------------------

export class ShareURL {
    constructor() {
        this._modal = null;
    }

    /**
     * Encode a state object into a URL hash string.
     * @param {Object} state - { scale, gene, cell, patient, cameraPos: {x,y,z} }
     * @returns {string} Hash string, e.g. "#scale=genes&gene=HMOX1&cx=0&cy=0&cz=18"
     */
    encodeState(state) {
        const params = new URLSearchParams();

        if (state.scale) params.set('scale', state.scale);
        if (state.gene) params.set('gene', state.gene);
        if (state.cell) params.set('cell', state.cell);
        if (state.patient) params.set('patient', state.patient);

        if (state.cameraPos) {
            params.set('cx', Math.round(state.cameraPos.x * 100) / 100);
            params.set('cy', Math.round(state.cameraPos.y * 100) / 100);
            params.set('cz', Math.round(state.cameraPos.z * 100) / 100);
        }

        return '#' + params.toString();
    }

    /**
     * Decode the current URL hash into a state object.
     * @returns {Object|null} Parsed state or null if no hash present
     */
    decodeState() {
        const hash = window.location.hash;
        if (!hash || hash.length < 2) return null;

        const params = new URLSearchParams(hash.slice(1));
        const state = {};

        if (params.has('scale')) state.scale = params.get('scale');
        if (params.has('gene')) state.gene = params.get('gene');
        if (params.has('cell')) state.cell = params.get('cell');
        if (params.has('patient')) state.patient = params.get('patient');

        if (params.has('cx') && params.has('cy') && params.has('cz')) {
            state.cameraPos = {
                x: parseFloat(params.get('cx')),
                y: parseFloat(params.get('cy')),
                z: parseFloat(params.get('cz')),
            };
        }

        return Object.keys(state).length > 0 ? state : null;
    }

    /**
     * Update the URL hash without triggering a page reload.
     * @param {Object} state
     */
    updateURL(state) {
        const hash = this.encodeState(state);
        history.replaceState(null, '', hash);
    }

    /**
     * Get a full shareable link with the current hash.
     * @returns {string}
     */
    getShareableLink() {
        return window.location.href;
    }

    /**
     * Show a small modal dialog with the URL and a copy button.
     * @param {string} url
     */
    showShareDialog(url) {
        // Remove existing modal if any
        if (this._modal) {
            this._modal.remove();
            this._modal = null;
        }

        // Overlay backdrop
        const overlay = document.createElement('div');
        overlay.className = 'share-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '9998',
            background: 'rgba(0,0,0,0.4)',
        });

        // Modal container
        const modal = document.createElement('div');
        modal.className = 'share-modal';
        Object.assign(modal.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '9999',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            minWidth: '340px',
            maxWidth: '480px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            fontFamily: 'var(--font)',
        });

        // Title
        const title = document.createElement('div');
        title.textContent = 'Share this view';
        Object.assign(title.style, {
            color: 'var(--text)',
            fontSize: '0.95rem',
            fontWeight: '600',
            marginBottom: '12px',
        });

        // URL input row
        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'flex',
            gap: '8px',
        });

        const input = document.createElement('input');
        input.type = 'text';
        input.readOnly = true;
        input.value = url;
        input.setAttribute('aria-label', 'Shareable URL');
        Object.assign(input.style, {
            flex: '1',
            padding: '0.4rem 0.6rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text)',
            fontSize: '0.74rem',
            fontFamily: 'var(--mono)',
            outline: 'none',
        });

        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.setAttribute('aria-label', 'Copy link to clipboard');
        Object.assign(copyBtn.style, {
            padding: '0.4rem 0.8rem',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.74rem',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
        });

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(url).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
            }).catch(() => {
                // Fallback: select text
                input.select();
                document.execCommand('copy');
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
            });
        });

        row.appendChild(input);
        row.appendChild(copyBtn);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '\u2715';
        closeBtn.setAttribute('aria-label', 'Close dialog');
        Object.assign(closeBtn.style, {
            position: 'absolute',
            top: '8px',
            right: '10px',
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: '1',
        });

        const closeModal = () => {
            overlay.remove();
            modal.remove();
            this._modal = null;
        };

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);

        modal.appendChild(closeBtn);
        modal.appendChild(title);
        modal.appendChild(row);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        this._modal = modal;

        // Auto-select URL text
        input.select();
    }
}

// ---------------------------------------------------------------------------
// 5. ResponsiveTouch - Touch controls for mobile/tablet
// ---------------------------------------------------------------------------

export class ResponsiveTouch {
    /**
     * @param {HTMLElement} rendererDomElement - The Three.js renderer DOM element
     * @param {THREE.PerspectiveCamera} camera
     * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
     */
    constructor(rendererDomElement, camera, controls) {
        this.domElement = rendererDomElement;
        this.camera = camera;
        this.controls = controls;
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        if (this.isTouchDevice) {
            this._enhanceTouch();
            this._showHint();
        }

        this._adjustResponsive();
        this._attachResizeListener();
    }

    _enhanceTouch() {
        // Increase hit test radius for easier selection on touch
        // Store original threshold to restore if needed
        if (this.controls.rotateSpeed !== undefined) {
            this.controls.rotateSpeed = 0.8;
        }

        // Double-tap to reset camera view
        let lastTap = 0;
        this.domElement.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTap < 300 && e.changedTouches.length === 1) {
                e.preventDefault();
                this._resetCamera();
            }
            lastTap = now;
        }, { passive: false });

        // Pinch-to-zoom is handled by OrbitControls natively when
        // enableZoom is true, but ensure it is on
        if (this.controls.enableZoom !== undefined) {
            this.controls.enableZoom = true;
        }
    }

    _resetCamera() {
        // Smooth transition to default position
        const startPos = this.camera.position.clone();
        const endPos = new THREE.Vector3(0, 0, 18);
        const startTarget = this.controls.target.clone();
        const endTarget = new THREE.Vector3(0, 0, 0);
        const duration = 600;
        const startTime = performance.now();

        const animate = (time) => {
            const elapsed = time - startTime;
            const t = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - t, 3);

            this.camera.position.lerpVectors(startPos, endPos, ease);
            this.controls.target.lerpVectors(startTarget, endTarget, ease);
            this.controls.update();

            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    _showHint() {
        const hint = document.createElement('div');
        hint.className = 'touch-hint';
        hint.textContent = 'Tap objects to explore';
        Object.assign(hint.style, {
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '850',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '8px 16px',
            color: 'var(--text)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font)',
            backdropFilter: 'blur(8px)',
            opacity: '1',
            transition: 'opacity 0.5s ease',
            pointerEvents: 'none',
        });

        document.body.appendChild(hint);

        // Fade out after 3 seconds
        setTimeout(() => {
            hint.style.opacity = '0';
            setTimeout(() => hint.remove(), 500);
        }, 3000);
    }

    _adjustResponsive() {
        const width = window.innerWidth;
        if (width < 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.style.width = '100%';
                sidebar.style.maxWidth = '240px';
            }
        }
    }

    _attachResizeListener() {
        window.addEventListener('resize', () => {
            this._adjustResponsive();
        });
    }
}
