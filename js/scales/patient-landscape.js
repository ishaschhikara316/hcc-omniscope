/**
 * Scale 3: Patient Landscape — 302 TCGA-LIHC patients in 3D risk space.
 * Axes: ROS risk score × Altitude risk score × Total immune score
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { COLORS, survivalColor, mapSize } from '../utils/color-scales.js';

export class PatientLandscape {
    constructor(scene, data, callbacks) {
        this.scene = scene;
        this.data = data;
        this.callbacks = callbacks;
        this.group = new THREE.Group();
        this.group.name = 'patient-landscape';
        this.instancedMesh = null;
        this.patients = [];
        this.raycaster = new THREE.Raycaster();
        this.hoveredIndex = -1;
        this.medianPlanes = [];
        this.showPlanes = true;

        this._build();
        this.group.visible = false;
        scene.add(this.group);
    }

    _build() {
        const { riskScores, clinical, expression } = this.data;

        // Get per-patient risk scores
        const rosScores = riskScores['ROS/Ferroptosis']?.scores || {};
        const altScores = riskScores['Altitude Adaptation']?.scores || {};

        // Build patient list with matched data
        const clinicalMap = {};
        for (const p of clinical) {
            clinicalMap[p.patientId] = p;
        }

        // Use ROS patients as the base (most complete)
        const patientIds = Object.keys(rosScores).filter(id => altScores[id] !== undefined);

        const rosVals = patientIds.map(id => rosScores[id]);
        const altVals = patientIds.map(id => altScores[id]);
        const rosMin = Math.min(...rosVals), rosMax = Math.max(...rosVals);
        const altMin = Math.min(...altVals), altMax = Math.max(...altVals);

        // Third axis: compute a composite "immune score" from expression of immune-related genes
        // Use NCF2 (neutrophil) as proxy, or simply use ROS+Alt combined as z
        const combVals = patientIds.map((id, i) => {
            // Use absolute difference between ROS and Altitude as a "divergence" axis
            return Math.abs(rosVals[i] - altVals[i]);
        });
        const combMin = Math.min(...combVals), combMax = Math.max(...combVals);

        const SPREAD = 16;
        const norm = (v, min, max) => max > min ? (v - min) / (max - min) : 0.5;

        // Build patient data and positions
        for (let i = 0; i < patientIds.length; i++) {
            const id = patientIds[i];
            const clin = clinicalMap[id] || {};
            const ros = rosScores[id];
            const alt = altScores[id];

            const x = (norm(ros, rosMin, rosMax) - 0.5) * SPREAD;
            const y = (norm(alt, altMin, altMax) - 0.5) * SPREAD;
            const z = (norm(combVals[i], combMin, combMax) - 0.5) * SPREAD;

            const isDeceased = clin.OS_event === 1 || clin.vital_status === 'Dead';
            const survMonths = clin.OS_months || 0;

            this.patients.push({
                id, x, y, z,
                rosScore: Math.round(ros * 1000) / 1000,
                altScore: Math.round(alt * 1000) / 1000,
                isDeceased,
                survivalMonths: Math.round(survMonths * 10) / 10,
                stage: clin.tumor_stage || 'N/A',
                grade: clin.tumor_grade || 'N/A',
                gender: clin.gender || 'N/A',
                age: clin.age_at_diagnosis || 'N/A',
                expression: expression?.[id] || {},
            });
        }

        // Create instanced mesh
        const count = this.patients.length;
        const geo = new THREE.SphereGeometry(0.15, 12, 12);
        const mat = new THREE.MeshStandardMaterial({
            metalness: 0.3,
            roughness: 0.5,
        });
        this.instancedMesh = new THREE.InstancedMesh(geo, mat, count);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        // Survival time range for sizing
        const survTimes = this.patients.map(p => p.survivalMonths);
        const maxSurv = Math.max(...survTimes, 1);

        for (let i = 0; i < count; i++) {
            const p = this.patients[i];
            const scale = 0.6 + (p.survivalMonths / maxSurv) * 0.8;
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, dummy.matrix);

            const c = survivalColor(p.isDeceased);
            this.instancedMesh.setColorAt(i, c);
        }
        this.instancedMesh.instanceColor.needsUpdate = true;
        this.group.add(this.instancedMesh);

        // Median split planes
        const rosMedian = rosVals.sort((a, b) => a - b)[Math.floor(rosVals.length / 2)];
        const altMedian = altVals.sort((a, b) => a - b)[Math.floor(altVals.length / 2)];
        const rosX = (norm(rosMedian, rosMin, rosMax) - 0.5) * SPREAD;
        const altY = (norm(altMedian, altMin, altMax) - 0.5) * SPREAD;

        // ROS median plane (YZ plane at x=rosX)
        const planeGeo = new THREE.PlaneGeometry(SPREAD * 1.2, SPREAD * 1.2);
        const planeMat1 = new THREE.MeshBasicMaterial({
            color: COLORS.ros,
            transparent: true,
            opacity: 0.04,
            side: THREE.DoubleSide,
        });
        const plane1 = new THREE.Mesh(planeGeo, planeMat1);
        plane1.position.set(rosX, 0, 0);
        plane1.rotation.y = Math.PI / 2;
        this.medianPlanes.push(plane1);
        this.group.add(plane1);

        // Altitude median plane (XZ plane at y=altY)
        const planeMat2 = new THREE.MeshBasicMaterial({
            color: COLORS.altitude,
            transparent: true,
            opacity: 0.04,
            side: THREE.DoubleSide,
        });
        const plane2 = new THREE.Mesh(planeGeo, planeMat2);
        plane2.position.set(0, altY, 0);
        plane2.rotation.x = Math.PI / 2;
        this.medianPlanes.push(plane2);
        this.group.add(plane2);

        // Axes
        this._addAxes(SPREAD);
    }

    _addAxes(spread) {
        const halfLen = spread / 2 + 1;
        const axisMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.3 });

        const axes = [
            [[- halfLen, -halfLen, -halfLen], [halfLen, -halfLen, -halfLen]],
            [[-halfLen, -halfLen, -halfLen], [-halfLen, halfLen, -halfLen]],
            [[-halfLen, -halfLen, -halfLen], [-halfLen, -halfLen, halfLen]],
        ];
        for (const [a, b] of axes) {
            const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(...a), new THREE.Vector3(...b)
            ]);
            this.group.add(new THREE.Line(geo, axisMat));
        }

        const labels = [
            { text: 'ROS Risk Score \u2192', pos: [halfLen + 0.5, -halfLen, -halfLen] },
            { text: 'Altitude Risk Score \u2192', pos: [-halfLen, halfLen + 0.5, -halfLen] },
            { text: 'Signature Divergence \u2192', pos: [-halfLen, -halfLen, halfLen + 0.5] },
        ];
        for (const l of labels) {
            const div = document.createElement('div');
            div.className = 'axis-label';
            div.textContent = l.text;
            const obj = new CSS2DObject(div);
            obj.position.set(...l.pos);
            this.group.add(obj);
        }

        // Grid on floor
        const gridMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.08 });
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

    checkHover(mouse, camera) {
        this.raycaster.setFromCamera(mouse, camera);
        const intersects = this.raycaster.intersectObject(this.instancedMesh);
        if (intersects.length > 0) {
            const idx = intersects[0].instanceId;
            if (idx !== this.hoveredIndex) {
                this.hoveredIndex = idx;
                this.callbacks.onHover(this.patients[idx], intersects[0]);
            }
            return true;
        } else if (this.hoveredIndex >= 0) {
            this.hoveredIndex = -1;
            this.callbacks.onUnhover();
        }
        return false;
    }

    checkClick(mouse, camera) {
        this.raycaster.setFromCamera(mouse, camera);
        const intersects = this.raycaster.intersectObject(this.instancedMesh);
        if (intersects.length > 0) {
            const idx = intersects[0].instanceId;
            this.callbacks.onClick(this.patients[idx]);
            return true;
        }
        return false;
    }

    togglePlanes() {
        this.showPlanes = !this.showPlanes;
        this.medianPlanes.forEach(p => p.visible = this.showPlanes);
    }

    show() { this.group.visible = true; }
    hide() { this.group.visible = false; }

    getCameraPosition() {
        return { pos: new THREE.Vector3(14, 10, 18), target: new THREE.Vector3(0, 0, 0) };
    }

    dispose() {
        this.scene.remove(this.group);
    }
}
