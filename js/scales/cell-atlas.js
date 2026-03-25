/**
 * Scale 2: Cell Atlas — 3D scatter of ~85 cell types across 14 tissues.
 * Axes: ROS score × Altitude score × Hypoxia hallmark score
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { COLORS, lerpColor } from '../utils/color-scales.js';

export class CellAtlas {
    constructor(scene, data, callbacks) {
        this.scene = scene;
        this.data = data;
        this.callbacks = callbacks;
        this.group = new THREE.Group();
        this.group.name = 'cell-atlas';
        this.nodeMeshes = [];
        this.nodeData = [];
        this.raycaster = new THREE.Raycaster();
        this.hoveredIndex = -1;
        this.highlightedGene = null;

        this._build();
        this.group.visible = false;
        scene.add(this.group);
    }

    _build() {
        const { coactivation, specialists, crossTissue, geneTissue } = this.data;

        // Build specialist lookup: cell_type -> count of gene_sets where it's specialist
        const specMap = {};
        for (const s of specialists) {
            const key = s.cell_type;
            specMap[key] = (specMap[key] || 0) + s.n_tissues_top_quartile;
        }

        // Compute hypoxia hallmark score per cell type from crossTissue
        const hypoxiaScores = {};
        for (const [ct, tissues] of Object.entries(crossTissue)) {
            const vals = Object.values(tissues);
            hypoxiaScores[ct] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }

        // Normalize axes
        const rosVals = coactivation.map(c => c.ros_mean);
        const altVals = coactivation.map(c => c.altitude_mean);
        const hypVals = coactivation.map(c => hypoxiaScores[c.cell_type] || 0);
        const normalize = (v, arr) => {
            const min = Math.min(...arr);
            const max = Math.max(...arr);
            return max > min ? (v - min) / (max - min) : 0.5;
        };
        const SPREAD = 16;

        // Create nodes
        const nodeGeo = new THREE.SphereGeometry(1, 16, 16);
        for (let i = 0; i < coactivation.length; i++) {
            const ct = coactivation[i];
            const hypScore = hypoxiaScores[ct.cell_type] || 0;
            const specCount = specMap[ct.cell_type] || 0;

            const x = (normalize(ct.ros_mean, rosVals) - 0.5) * SPREAD;
            const y = (normalize(ct.altitude_mean, altVals) - 0.5) * SPREAD;
            const z = (normalize(hypScore, hypVals) - 0.5) * SPREAD;

            // Color by quadrant: high-ROS & high-altitude = red, low-both = blue
            const rosNorm = normalize(ct.ros_mean, rosVals);
            const altNorm = normalize(ct.altitude_mean, altVals);
            const intensity = (rosNorm + altNorm) / 2;
            const color = lerpColor(COLORS.alive, COLORS.deceased, intensity);

            // Size by specialist count
            const size = specCount > 0 ? 0.3 + Math.min(specCount / 10, 0.7) : 0.25;

            const mat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: specCount > 5 ? COLORS.specialist : color,
                emissiveIntensity: specCount > 5 ? 0.5 : 0.15,
                metalness: 0.2,
                roughness: 0.6,
                transparent: true,
                opacity: 0.85,
            });
            const mesh = new THREE.Mesh(nodeGeo, mat);
            mesh.scale.setScalar(size);
            mesh.position.set(x, y, z);
            mesh.userData = { index: i, cellType: ct.cell_type, size };
            this.nodeMeshes.push(mesh);
            this.group.add(mesh);

            // Tissue count from crossTissue
            const tissueData = crossTissue[ct.cell_type] || {};
            const nTissues = Object.keys(tissueData).length;

            this.nodeData.push({
                cellType: ct.cell_type,
                rosMean: ct.ros_mean,
                altMean: ct.altitude_mean,
                hypoxiaScore: Math.round(hypScore * 100) / 100,
                specialistCount: specCount,
                nTissues,
                tissues: Object.keys(tissueData),
                isSpecialist: specCount > 3,
            });

            // Label for specialists only
            if (specCount > 3) {
                const labelDiv = document.createElement('div');
                labelDiv.className = 'node-label';
                labelDiv.textContent = ct.cell_type;
                labelDiv.style.color = '#c084fc';
                const label = new CSS2DObject(labelDiv);
                label.position.set(x, y + size + 0.3, z);
                this.group.add(label);
            }
        }

        // Axes
        this._addAxes(SPREAD);
    }

    _addAxes(spread) {
        const halfLen = spread / 2 + 1;
        const axisColor = 0x334155;
        const axisMat = new THREE.LineBasicMaterial({ color: axisColor, transparent: true, opacity: 0.3 });

        // X axis (ROS)
        const xGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-halfLen, -halfLen, -halfLen),
            new THREE.Vector3(halfLen, -halfLen, -halfLen)
        ]);
        this.group.add(new THREE.Line(xGeo, axisMat));

        // Y axis (Altitude)
        const yGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-halfLen, -halfLen, -halfLen),
            new THREE.Vector3(-halfLen, halfLen, -halfLen)
        ]);
        this.group.add(new THREE.Line(yGeo, axisMat));

        // Z axis (Hypoxia)
        const zGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-halfLen, -halfLen, -halfLen),
            new THREE.Vector3(-halfLen, -halfLen, halfLen)
        ]);
        this.group.add(new THREE.Line(zGeo, axisMat));

        // Axis labels
        const labels = [
            { text: 'ROS Score \u2192', pos: [halfLen + 0.5, -halfLen, -halfLen] },
            { text: 'Altitude Score \u2192', pos: [-halfLen, halfLen + 0.5, -halfLen] },
            { text: 'Hypoxia Score \u2192', pos: [-halfLen, -halfLen, halfLen + 0.5] },
        ];
        for (const l of labels) {
            const div = document.createElement('div');
            div.className = 'axis-label';
            div.textContent = l.text;
            const obj = new CSS2DObject(div);
            obj.position.set(...l.pos);
            this.group.add(obj);
        }

        // Grid lines on floor
        const gridMat = new THREE.LineBasicMaterial({ color: axisColor, transparent: true, opacity: 0.08 });
        for (let i = -4; i <= 4; i++) {
            const t = (i / 4) * halfLen;
            const g1 = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(t, -halfLen, -halfLen),
                new THREE.Vector3(t, -halfLen, halfLen)
            ]);
            this.group.add(new THREE.Line(g1, gridMat));
            const g2 = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-halfLen, -halfLen, t),
                new THREE.Vector3(halfLen, -halfLen, t)
            ]);
            this.group.add(new THREE.Line(g2, gridMat));
        }
    }

    highlightByGene(geneName) {
        this.highlightedGene = geneName;
        const { geneTissue } = this.data;
        const geneData = geneTissue[geneName];
        if (!geneData) return;

        // Compute expression levels per cell type (approximate via tissue matching)
        const maxExpr = Math.max(...Object.values(geneData), 0.01);

        for (let i = 0; i < this.nodeMeshes.length; i++) {
            const nd = this.nodeData[i];
            // Average expression across tissues this cell type appears in
            let totalExpr = 0, count = 0;
            for (const tissue of nd.tissues) {
                if (geneData[tissue] !== undefined) {
                    totalExpr += geneData[tissue];
                    count++;
                }
            }
            const avgExpr = count > 0 ? totalExpr / count : 0;
            const intensity = avgExpr / maxExpr;

            this.nodeMeshes[i].material.emissiveIntensity = 0.1 + intensity * 0.8;
            this.nodeMeshes[i].material.opacity = 0.3 + intensity * 0.7;
        }
    }

    resetHighlight() {
        this.highlightedGene = null;
        for (let i = 0; i < this.nodeMeshes.length; i++) {
            const specCount = this.nodeData[i].specialistCount;
            this.nodeMeshes[i].material.emissiveIntensity = specCount > 5 ? 0.5 : 0.15;
            this.nodeMeshes[i].material.opacity = 0.85;
        }
    }

    checkHover(mouse, camera) {
        this.raycaster.setFromCamera(mouse, camera);
        const intersects = this.raycaster.intersectObjects(this.nodeMeshes);
        if (intersects.length > 0) {
            const idx = intersects[0].object.userData.index;
            if (idx !== this.hoveredIndex) {
                this._unhighlight();
                this.hoveredIndex = idx;
                this.nodeMeshes[idx].scale.setScalar(this.nodeMeshes[idx].userData.size * 1.5);
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
            this.callbacks.onClick(this.nodeData[idx]);
            return true;
        }
        return false;
    }

    _unhighlight() {
        if (this.hoveredIndex >= 0) {
            this.nodeMeshes[this.hoveredIndex].scale.setScalar(
                this.nodeMeshes[this.hoveredIndex].userData.size
            );
        }
    }

    show() { this.group.visible = true; }
    hide() { this.group.visible = false; }

    getCameraPosition() {
        return { pos: new THREE.Vector3(12, 12, 18), target: new THREE.Vector3(0, 0, 0) };
    }

    dispose() {
        this.scene.remove(this.group);
    }
}
