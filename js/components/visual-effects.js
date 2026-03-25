/**
 * visual-effects.js
 * Visual effect classes for the HCC Omniscope Three.js cancer biology 3D visualization.
 * Three.js r160 ES module format.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Shared palette
const COLORS = {
    altitude: 0x4ade80,
    ros: 0xf87171,
    overlap: 0xfbbf24,
    accent: 0x6c8cff,
};


// ---------------------------------------------------------------------------
// 1. BloomEffect
// ---------------------------------------------------------------------------

export class BloomEffect {
    constructor(renderer, scene, camera, width, height) {
        this._renderer = renderer;
        this._scene = scene;
        this._camera = camera;

        this._composer = new EffectComposer(renderer);

        const renderPass = new RenderPass(scene, camera);
        this._composer.addPass(renderPass);

        this._bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            0.8,  // strength
            0.4,  // radius
            0.2   // threshold
        );
        this._composer.addPass(this._bloomPass);

        const outputPass = new OutputPass();
        this._composer.addPass(outputPass);
    }

    getComposer() {
        return this._composer;
    }

    setStrength(val) {
        this._bloomPass.strength = THREE.MathUtils.clamp(val, 0, 3);
    }

    setRadius(val) {
        this._bloomPass.radius = THREE.MathUtils.clamp(val, 0, 2);
    }

    setThreshold(val) {
        this._bloomPass.threshold = THREE.MathUtils.clamp(val, 0, 1);
    }

    resize(width, height) {
        this._composer.setSize(width, height);
        this._bloomPass.resolution.set(width, height);
    }

    render() {
        this._composer.render();
    }
}


// ---------------------------------------------------------------------------
// 2. AmbientParticles
// ---------------------------------------------------------------------------

const _particleVertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aOpacity;
    varying float vOpacity;
    void main() {
        vOpacity = aOpacity;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const _particleFragmentShader = /* glsl */ `
    varying float vOpacity;
    void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.15, d) * vOpacity;
        gl_FragColor = vec4(0.667, 0.733, 1.0, alpha);
    }
`;

export class AmbientParticles {
    constructor(scene, count = 300) {
        this._scene = scene;
        this._count = count;
        this._boundSize = 40;
        this._halfBound = this._boundSize / 2;

        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const opacities = new Float32Array(count);
        this._velocities = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * this._boundSize;
            positions[i3 + 1] = (Math.random() - 0.5) * this._boundSize;
            positions[i3 + 2] = (Math.random() - 0.5) * this._boundSize;

            sizes[i] = 0.03 + Math.random() * 0.03;
            opacities[i] = 0.15 + Math.random() * 0.20;

            const speed = 0.01 + Math.random() * 0.04;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            this._velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
            this._velocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
            this._velocities[i3 + 2] = speed * Math.cos(phi);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

        const material = new THREE.ShaderMaterial({
            vertexShader: _particleVertexShader,
            fragmentShader: _particleFragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        this._points = new THREE.Points(geometry, material);
        this._points.frustumCulled = false;
        scene.add(this._points);
    }

    update(dt) {
        const pos = this._points.geometry.attributes.position;
        const arr = pos.array;
        const half = this._halfBound;

        for (let i = 0; i < this._count; i++) {
            const i3 = i * 3;
            arr[i3] += this._velocities[i3] * dt;
            arr[i3 + 1] += this._velocities[i3 + 1] * dt;
            arr[i3 + 2] += this._velocities[i3 + 2] * dt;

            // Wrap around bounding box
            for (let a = 0; a < 3; a++) {
                if (arr[i3 + a] > half) arr[i3 + a] -= this._boundSize;
                else if (arr[i3 + a] < -half) arr[i3 + a] += this._boundSize;
            }
        }
        pos.needsUpdate = true;
    }

    setVisible(visible) {
        this._points.visible = visible;
    }
}


// ---------------------------------------------------------------------------
// 3. PulsingNodes
// ---------------------------------------------------------------------------

export class PulsingNodes {
    constructor() {
        this._nodes = new Map();
    }

    addNode(mesh, color, speed = 1.0, minScale = 0.9, maxScale = 1.1) {
        this._nodes.set(mesh, {
            color: new THREE.Color(color),
            speed,
            minScale,
            maxScale,
            phase: Math.random() * Math.PI * 2,
            elapsed: 0,
            originalScale: mesh.scale.clone(),
        });
    }

    removeNode(mesh) {
        const entry = this._nodes.get(mesh);
        if (entry) {
            mesh.scale.copy(entry.originalScale);
            if (mesh.material && mesh.material.emissiveIntensity !== undefined) {
                mesh.material.emissiveIntensity = 0.5;
            }
            this._nodes.delete(mesh);
        }
    }

    update(dt) {
        this._nodes.forEach((data, mesh) => {
            data.elapsed += dt;
            // One full cycle every 2 seconds at speed 1.0
            const t = Math.sin(data.elapsed * data.speed * Math.PI + data.phase);
            const normalized = (t + 1) / 2; // 0..1

            const s = data.minScale + normalized * (data.maxScale - data.minScale);
            mesh.scale.copy(data.originalScale).multiplyScalar(s);

            if (mesh.material && mesh.material.emissiveIntensity !== undefined) {
                mesh.material.emissiveIntensity = 0.3 + normalized * 0.5;
            }
        });
    }

    clear() {
        this._nodes.forEach((data, mesh) => {
            mesh.scale.copy(data.originalScale);
        });
        this._nodes.clear();
    }
}


// ---------------------------------------------------------------------------
// 4. ScaleTransitionWarp
// ---------------------------------------------------------------------------

export class ScaleTransitionWarp {
    constructor(scene, camera) {
        this._scene = scene;
        this._camera = camera;
    }

    play(duration = 1.5) {
        return new Promise((resolve) => {
            const lineCount = 60 + Math.floor(Math.random() * 21); // 60-80
            const positions = new Float32Array(lineCount * 6); // 2 vertices per line, 3 components each
            const baseDirections = [];

            for (let i = 0; i < lineCount; i++) {
                // Random direction radiating outward from center, biased along Z
                const theta = Math.random() * Math.PI * 2;
                const spread = 0.3 + Math.random() * 0.7;
                const dx = Math.cos(theta) * spread;
                const dy = Math.sin(theta) * spread;
                const dz = -(1.0 + Math.random() * 0.5); // forward (negative Z in camera space)

                baseDirections.push(new THREE.Vector3(dx, dy, dz).normalize());

                // Start point (near camera)
                const i6 = i * 6;
                positions[i6] = dx * 0.5;
                positions[i6 + 1] = dy * 0.5;
                positions[i6 + 2] = dz * 0.5;
                // End point (further)
                positions[i6 + 3] = dx * 2.0;
                positions[i6 + 4] = dy * 2.0;
                positions[i6 + 5] = dz * 2.0;
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const material = new THREE.LineBasicMaterial({
                color: 0x6c8cff,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });

            const lines = new THREE.LineSegments(geometry, material);
            // Attach to camera so lines move with it
            this._camera.add(lines);
            lines.position.set(0, 0, -3);

            const startTime = performance.now();
            const fadeInEnd = 0.2;
            const fadeOutStart = 0.8;

            const animate = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                const progress = Math.min(elapsed / duration, 1);

                // Fade envelope
                let opacity;
                if (progress < fadeInEnd) {
                    opacity = progress / fadeInEnd;
                } else if (progress > fadeOutStart) {
                    opacity = 1 - (progress - fadeOutStart) / (1 - fadeOutStart);
                } else {
                    opacity = 1;
                }
                material.opacity = opacity * 0.5;

                // Stretch lines outward over time
                const stretch = 1 + progress * 4;
                const posArr = geometry.attributes.position.array;
                for (let i = 0; i < lineCount; i++) {
                    const dir = baseDirections[i];
                    const i6 = i * 6;
                    posArr[i6 + 3] = dir.x * stretch * 2;
                    posArr[i6 + 4] = dir.y * stretch * 2;
                    posArr[i6 + 5] = dir.z * stretch * 2;
                }
                geometry.attributes.position.needsUpdate = true;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this._camera.remove(lines);
                    geometry.dispose();
                    material.dispose();
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }
}


// ---------------------------------------------------------------------------
// 5. GradientFloor
// ---------------------------------------------------------------------------

const _floorVertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const _floorFragmentShader = /* glsl */ `
    varying vec2 vUv;
    uniform float uOpacity;

    void main() {
        // Gradient: bottom-left blue to top-right red
        float t = (vUv.x + vUv.y) * 0.5;
        vec3 blue = vec3(0.376, 0.647, 0.98);  // #60a5fa
        vec3 red = vec3(0.937, 0.267, 0.267);   // #ef4444
        vec3 color = mix(blue, red, t);

        // Grid lines at 10% opacity
        float gridX = smoothstep(0.01, 0.0, abs(fract(vUv.x * 10.0) - 0.5) - 0.48);
        float gridY = smoothstep(0.01, 0.0, abs(fract(vUv.y * 10.0) - 0.5) - 0.48);
        float grid = max(gridX, gridY) * 0.1;

        float alpha = uOpacity + grid;
        gl_FragColor = vec4(color, alpha);
    }
`;

export class GradientFloor {
    constructor(scene, size = 20) {
        this._scene = scene;

        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.ShaderMaterial({
            vertexShader: _floorVertexShader,
            fragmentShader: _floorFragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: {
                uOpacity: { value: 0.08 },
            },
        });

        this._mesh = new THREE.Mesh(geometry, material);
        this._mesh.rotation.x = -Math.PI / 2;
        this._mesh.position.y = -9;
        this._added = false;
    }

    show() {
        if (!this._added) {
            this._scene.add(this._mesh);
            this._added = true;
        }
        this._mesh.visible = true;
    }

    hide() {
        this._mesh.visible = false;
    }

    setScale(scaleName) {
        if (scaleName === 'patients') {
            this.show();
        } else {
            this.hide();
        }
    }
}


// ---------------------------------------------------------------------------
// 6. RingHalos
// ---------------------------------------------------------------------------

export class RingHalos {
    constructor(scene) {
        this._scene = scene;
        this._halos = [];
        this._maxHalos = 10;
    }

    addHalo(position, radius, color) {
        if (this._halos.length >= this._maxHalos) return null;

        const geometry = new THREE.TorusGeometry(radius, 0.015, 8, 64);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.3,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);

        // Random tilt for variety
        const tiltX = (Math.random() - 0.5) * Math.PI * 0.5;
        const tiltZ = (Math.random() - 0.5) * Math.PI * 0.5;
        mesh.rotation.x = tiltX;
        mesh.rotation.z = tiltZ;

        const speed = 0.3 + Math.random() * 0.5;
        const axis = new THREE.Vector3(
            Math.random() - 0.5,
            1,
            Math.random() - 0.5
        ).normalize();

        this._halos.push({ mesh, speed, axis });
        this._scene.add(mesh);
        return mesh;
    }

    update(dt) {
        for (const halo of this._halos) {
            halo.mesh.rotateOnAxis(halo.axis, halo.speed * dt);
        }
    }

    clear() {
        for (const halo of this._halos) {
            this._scene.remove(halo.mesh);
            halo.mesh.geometry.dispose();
            halo.mesh.material.dispose();
        }
        this._halos = [];
    }

    setVisible(visible) {
        for (const halo of this._halos) {
            halo.mesh.visible = visible;
        }
    }
}


// ---------------------------------------------------------------------------
// 7. ClickRipple
// ---------------------------------------------------------------------------

export class ClickRipple {
    constructor(scene) {
        this._scene = scene;
        this._ripples = [];
        this._maxRipples = 3;
    }

    trigger(position, color) {
        // Evict oldest if at capacity
        if (this._ripples.length >= this._maxRipples) {
            const oldest = this._ripples.shift();
            this._scene.remove(oldest.mesh);
            oldest.mesh.geometry.dispose();
            oldest.mesh.material.dispose();
        }

        const geometry = new THREE.RingGeometry(0.2, 0.25, 64);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);

        this._scene.add(mesh);
        this._ripples.push({
            mesh,
            elapsed: 0,
            duration: 0.8,
            startRadius: 0.2,
            endRadius: 3.0,
        });
    }

    update(dt) {
        const camera = this._scene.userData.camera; // optional billboard
        for (let i = this._ripples.length - 1; i >= 0; i--) {
            const r = this._ripples[i];
            r.elapsed += dt;
            const t = Math.min(r.elapsed / r.duration, 1);

            // Scale ring outward
            const currentRadius = r.startRadius + (r.endRadius - r.startRadius) * t;
            const scaleFactor = currentRadius / r.startRadius;
            r.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

            // Fade opacity
            r.mesh.material.opacity = 0.6 * (1 - t);

            // Billboard: face camera if available
            if (camera) {
                r.mesh.quaternion.copy(camera.quaternion);
            }

            // Remove when complete
            if (t >= 1) {
                this._scene.remove(r.mesh);
                r.mesh.geometry.dispose();
                r.mesh.material.dispose();
                this._ripples.splice(i, 1);
            }
        }
    }
}


// ---------------------------------------------------------------------------
// 8. NebulaBackground
// ---------------------------------------------------------------------------

export class NebulaBackground {
    constructor(scene) {
        this._scene = scene;
        this._group = new THREE.Group();

        const configs = [
            { radius: 60, color: 0x1a0533, opacity: 0.05, axis: new THREE.Vector3(1, 0.3, 0).normalize(), speed: 0.005 },
            { radius: 70, color: 0x0a1a3a, opacity: 0.04, axis: new THREE.Vector3(0, 1, 0.5).normalize(), speed: 0.003 },
            { radius: 80, color: 0x0a2a2a, opacity: 0.03, axis: new THREE.Vector3(0.5, 0, 1).normalize(), speed: 0.004 },
        ];

        this._spheres = configs.map((cfg) => {
            const geometry = new THREE.SphereGeometry(cfg.radius, 32, 32);
            const material = new THREE.MeshBasicMaterial({
                color: cfg.color,
                transparent: true,
                opacity: cfg.opacity,
                side: THREE.BackSide,
                depthWrite: false,
            });
            const mesh = new THREE.Mesh(geometry, material);
            // Give each an initial random rotation for variety
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            this._group.add(mesh);
            return { mesh, axis: cfg.axis, speed: cfg.speed };
        });

        scene.add(this._group);
    }

    update(dt) {
        for (const s of this._spheres) {
            s.mesh.rotateOnAxis(s.axis, s.speed * (dt || 0.016));
        }
    }

    setVisible(visible) {
        this._group.visible = visible;
    }
}


// ---------------------------------------------------------------------------
// 9. FloatingStats
// ---------------------------------------------------------------------------

export class FloatingStats {
    constructor(scene) {
        this._scene = scene;
        this._stats = [];
        this._maxStats = 8;
    }

    addStat(text, position, color = '#6c8cff', size = '0.7rem') {
        if (this._stats.length >= this._maxStats) return null;

        const div = document.createElement('div');
        div.textContent = text;
        div.style.fontFamily = 'monospace';
        div.style.fontSize = size;
        div.style.color = color;
        div.style.background = 'rgba(10, 12, 20, 0.65)';
        div.style.padding = '3px 8px';
        div.style.borderRadius = '4px';
        div.style.border = '1px solid rgba(108, 140, 255, 0.2)';
        div.style.pointerEvents = 'none';
        div.style.userSelect = 'none';
        div.style.whiteSpace = 'nowrap';

        const label = new CSS2DObject(div);
        label.position.copy(position);

        this._scene.add(label);
        this._stats.push({
            label,
            baseY: position.y,
            phase: Math.random() * Math.PI * 2,
            elapsed: 0,
        });
        return label;
    }

    clear() {
        for (const s of this._stats) {
            this._scene.remove(s.label);
            if (s.label.element && s.label.element.parentNode) {
                s.label.element.parentNode.removeChild(s.label.element);
            }
        }
        this._stats = [];
    }

    update(dt) {
        for (const s of this._stats) {
            s.elapsed += dt;
            // Gentle bobbing: amplitude 0.1, period 3 seconds
            const offset = Math.sin(s.elapsed * (Math.PI * 2 / 3) + s.phase) * 0.1;
            s.label.position.y = s.baseY + offset;
        }
    }

    setVisible(visible) {
        for (const s of this._stats) {
            s.label.visible = visible;
        }
    }
}


// ---------------------------------------------------------------------------
// 10. DNAHelix
// ---------------------------------------------------------------------------

export class DNAHelix {
    constructor(scene) {
        this._scene = scene;
        this._group = new THREE.Group();
        this._group.position.set(10, 0, 0);

        const height = 5;
        const sphereCount = 30;
        const radius = 0.6;
        const turns = 2;
        const sphereRadius = 0.04;

        const strandMat1 = new THREE.MeshBasicMaterial({
            color: COLORS.altitude,
            transparent: true,
            opacity: 0.4,
        });
        const strandMat2 = new THREE.MeshBasicMaterial({
            color: COLORS.ros,
            transparent: true,
            opacity: 0.4,
        });
        const rungMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
        });

        const sphereGeo = new THREE.SphereGeometry(sphereRadius, 8, 8);
        const rungGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 4);

        for (let i = 0; i < sphereCount; i++) {
            const t = i / (sphereCount - 1);
            const y = (t - 0.5) * height;
            const angle = t * turns * Math.PI * 2;

            // Strand 1
            const x1 = Math.cos(angle) * radius;
            const z1 = Math.sin(angle) * radius;
            const s1 = new THREE.Mesh(sphereGeo, strandMat1);
            s1.position.set(x1, y, z1);
            this._group.add(s1);

            // Strand 2 (offset by pi)
            const x2 = Math.cos(angle + Math.PI) * radius;
            const z2 = Math.sin(angle + Math.PI) * radius;
            const s2 = new THREE.Mesh(sphereGeo, strandMat2);
            s2.position.set(x2, y, z2);
            this._group.add(s2);

            // Cross-rung connecting the pair
            const midX = (x1 + x2) / 2;
            const midZ = (z1 + z2) / 2;
            const dist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);

            const rung = new THREE.Mesh(rungGeo, rungMat);
            rung.position.set(midX, y, midZ);
            rung.scale.y = dist;
            // Rotate rung to connect the two spheres
            rung.lookAt(new THREE.Vector3(x2, y, z2));
            rung.rotateX(Math.PI / 2);
            this._group.add(rung);
        }

        this._rotationSpeed = 0.2;
        scene.add(this._group);
    }

    update(dt) {
        this._group.rotation.y += this._rotationSpeed * dt;
    }

    setVisible(visible) {
        this._group.visible = visible;
    }

    setPosition(x, y, z) {
        this._group.position.set(x, y, z);
    }
}
