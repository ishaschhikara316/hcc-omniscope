/**
 * Scale 1: Gene Universe — 3D force-directed network of 20 signature genes.
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { COLORS, geneSignature, signatureColor, mapSize } from '../utils/color-scales.js';

const ALTITUDE_GENES = ['GC', 'GRB2', 'LDHA', 'SENP1', 'CDC42', 'HMOX1', 'HK2', 'EPO', 'AEBP2'];
const ROS_GENES = ['TXNRD1', 'MAFG', 'G6PD', 'SQSTM1', 'SLC7A11', 'GSR', 'NCF2', 'MSRA', 'HMOX1', 'GLRX2', 'BACH1'];

export class GeneUniverse {
    constructor(scene, data, callbacks) {
        this.scene = scene;
        this.data = data;
        this.callbacks = callbacks; // { onHover, onUnhover, onClick }
        this.group = new THREE.Group();
        this.group.name = 'gene-universe';
        this.nodeMeshes = [];
        this.nodeData = [];
        this.edgeLines = [];
        this.labels = [];
        this.raycaster = new THREE.Raycaster();
        this.hoveredIndex = -1;
        this.selectedGene = null;

        this._build();
        this.group.visible = true;
        scene.add(this.group);
    }

    _build() {
        const { hazardRatios, correlations, coefficients } = this.data;

        // Collect all unique genes from both signatures
        const allGenes = new Set();
        for (const sig of Object.keys(hazardRatios)) {
            for (const entry of hazardRatios[sig]) {
                allGenes.add(entry.gene);
            }
        }
        const genes = [...allGenes];

        // Build gene info map
        const geneInfo = {};
        for (const sig of Object.keys(hazardRatios)) {
            for (const entry of hazardRatios[sig]) {
                if (!geneInfo[entry.gene]) geneInfo[entry.gene] = {};
                geneInfo[entry.gene][sig] = entry;
            }
        }

        // Get coefficients
        const absCoefs = genes.map(g => {
            const c = coefficients[g];
            return c ? Math.abs(c.coef || 0) : 0.1;
        });
        const maxCoef = Math.max(...absCoefs, 0.01);

        // Layout: 3D force simulation (simple spring layout)
        const positions = this._computeLayout(genes, correlations);

        // Create nodes
        const nodeGeo = new THREE.SphereGeometry(1, 24, 24);
        for (let i = 0; i < genes.length; i++) {
            const gene = genes[i];
            const sigType = geneSignature(gene, ALTITUDE_GENES, ROS_GENES);
            const color = signatureColor(sigType);
            const size = mapSize(absCoefs[i], 0, maxCoef, 0.4, 1.2);

            const mat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.4,
                metalness: 0.3,
                roughness: 0.5,
            });
            const mesh = new THREE.Mesh(nodeGeo, mat);
            mesh.scale.setScalar(size);
            mesh.position.copy(positions[i]);
            mesh.userData = { gene, index: i, sigType, size };
            this.nodeMeshes.push(mesh);
            this.group.add(mesh);

            // Gene label
            const labelDiv = document.createElement('div');
            labelDiv.className = 'node-label';
            labelDiv.textContent = gene;
            const label = new CSS2DObject(labelDiv);
            label.position.copy(positions[i]);
            label.position.y += size + 0.3;
            this.labels.push(label);
            this.group.add(label);

            // Build node data for hover cards
            const info = geneInfo[gene] || {};
            this.nodeData.push({
                gene,
                sigType,
                signatures: Object.keys(info),
                hr: info[Object.keys(info)[0]]?.hazard_ratio,
                pval: info[Object.keys(info)[0]]?.p_value,
                coef: coefficients[gene]?.coef,
                ci_lower: info[Object.keys(info)[0]]?.ci_lower,
                ci_upper: info[Object.keys(info)[0]]?.ci_upper,
            });
        }

        // Create edges from correlation matrix
        for (const sig of Object.keys(correlations)) {
            const { genes: corrGenes, matrix } = correlations[sig];
            if (!corrGenes || !matrix) continue;
            for (let i = 0; i < corrGenes.length; i++) {
                for (let j = i + 1; j < corrGenes.length; j++) {
                    const corr = Math.abs(matrix[i][j]);
                    if (corr < 0.15) continue; // threshold
                    const idxA = genes.indexOf(corrGenes[i]);
                    const idxB = genes.indexOf(corrGenes[j]);
                    if (idxA < 0 || idxB < 0) continue;

                    const opacity = Math.min(corr * 1.5, 0.8);
                    const lineColor = corr > 0.4 ? COLORS.edgeStrong : COLORS.edge;
                    const geo = new THREE.BufferGeometry().setFromPoints([
                        positions[idxA], positions[idxB]
                    ]);
                    const mat = new THREE.LineBasicMaterial({
                        color: lineColor,
                        transparent: true,
                        opacity: opacity,
                    });
                    const line = new THREE.Line(geo, mat);
                    this.edgeLines.push(line);
                    this.group.add(line);
                }
            }
        }

        // Add a subtle ambient glow sphere around the network center
        const glowGeo = new THREE.SphereGeometry(12, 32, 32);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x1a1a3a,
            transparent: true,
            opacity: 0.08,
            side: THREE.BackSide,
        });
        this.group.add(new THREE.Mesh(glowGeo, glowMat));
    }

    _computeLayout(genes, correlations) {
        // Simple force-directed layout in 3D
        const n = genes.length;
        const pos = [];
        // Initialize in a sphere
        for (let i = 0; i < n; i++) {
            const phi = Math.acos(1 - 2 * (i + 0.5) / n);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            const r = 6;
            pos.push(new THREE.Vector3(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            ));
        }

        // Build adjacency from correlations
        const adj = Array.from({ length: n }, () => []);
        for (const sig of Object.keys(correlations)) {
            const { genes: cg, matrix } = correlations[sig];
            if (!cg || !matrix) continue;
            for (let i = 0; i < cg.length; i++) {
                for (let j = i + 1; j < cg.length; j++) {
                    const idxA = genes.indexOf(cg[i]);
                    const idxB = genes.indexOf(cg[j]);
                    if (idxA >= 0 && idxB >= 0 && Math.abs(matrix[i][j]) > 0.15) {
                        adj[idxA].push({ target: idxB, weight: Math.abs(matrix[i][j]) });
                        adj[idxB].push({ target: idxA, weight: Math.abs(matrix[i][j]) });
                    }
                }
            }
        }

        // Iterate force simulation
        const repulsion = 8;
        const attraction = 0.3;
        const damping = 0.85;
        const vel = pos.map(() => new THREE.Vector3());
        const force = new THREE.Vector3();

        for (let iter = 0; iter < 150; iter++) {
            for (let i = 0; i < n; i++) {
                force.set(0, 0, 0);
                // Repulsion from all other nodes
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const diff = pos[i].clone().sub(pos[j]);
                    const dist = Math.max(diff.length(), 0.5);
                    diff.normalize().multiplyScalar(repulsion / (dist * dist));
                    force.add(diff);
                }
                // Attraction to connected nodes
                for (const edge of adj[i]) {
                    const diff = pos[edge.target].clone().sub(pos[i]);
                    const dist = diff.length();
                    diff.normalize().multiplyScalar(attraction * dist * edge.weight);
                    force.add(diff);
                }
                // Center gravity
                force.add(pos[i].clone().negate().multiplyScalar(0.02));

                vel[i].add(force).multiplyScalar(damping);
                pos[i].add(vel[i].clone().multiplyScalar(0.05));
            }
        }

        return pos;
    }

    checkHover(mouse, camera) {
        this.raycaster.setFromCamera(mouse, camera);
        const intersects = this.raycaster.intersectObjects(this.nodeMeshes);
        if (intersects.length > 0) {
            const idx = intersects[0].object.userData.index;
            if (idx !== this.hoveredIndex) {
                this._unhighlight();
                this.hoveredIndex = idx;
                this._highlight(idx);
                this.callbacks.onHover(this.nodeData[idx], intersects[0]);
            }
            return true;
        } else if (this.hoveredIndex >= 0) {
            this._unhighlight();
            this.hoveredIndex = -1;
            this.callbacks.onUnhover();
        }
        return false;
    }

    checkClick(mouse, camera) {
        this.raycaster.setFromCamera(mouse, camera);
        const intersects = this.raycaster.intersectObjects(this.nodeMeshes);
        if (intersects.length > 0) {
            const idx = intersects[0].object.userData.index;
            this.selectedGene = this.nodeData[idx].gene;
            this.callbacks.onClick(this.nodeData[idx]);
            return true;
        }
        return false;
    }

    _highlight(idx) {
        const mesh = this.nodeMeshes[idx];
        mesh.material.emissiveIntensity = 0.9;
        mesh.scale.setScalar(mesh.userData.size * 1.3);
        // Highlight connected edges
        this.edgeLines.forEach(line => {
            line.material.opacity = Math.max(line.material.opacity * 0.3, 0.05);
        });
    }

    _unhighlight() {
        if (this.hoveredIndex >= 0) {
            const mesh = this.nodeMeshes[this.hoveredIndex];
            mesh.material.emissiveIntensity = 0.4;
            mesh.scale.setScalar(mesh.userData.size);
        }
        this.edgeLines.forEach(line => {
            // Reset opacity based on original
            line.material.opacity = Math.min(line.material.opacity / 0.3, 0.8);
        });
    }

    show() { this.group.visible = true; }
    hide() { this.group.visible = false; }

    getCameraPosition() {
        return { pos: new THREE.Vector3(0, 0, 18), target: new THREE.Vector3(0, 0, 0) };
    }

    dispose() {
        this.scene.remove(this.group);
    }
}
