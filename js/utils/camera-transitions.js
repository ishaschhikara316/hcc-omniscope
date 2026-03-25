/**
 * Smooth camera transitions between scales.
 */
import * as THREE from 'three';

const tmpVec = new THREE.Vector3();

export class CameraTransition {
    constructor(camera, controls) {
        this.camera = camera;
        this.controls = controls;
        this.isAnimating = false;
        this._startPos = new THREE.Vector3();
        this._endPos = new THREE.Vector3();
        this._startTarget = new THREE.Vector3();
        this._endTarget = new THREE.Vector3();
        this._progress = 0;
        this._duration = 1.5;
        this._onComplete = null;
    }

    transitionTo(position, target, duration = 1.5, onComplete = null) {
        this._startPos.copy(this.camera.position);
        this._endPos.copy(position);
        this._startTarget.copy(this.controls.target);
        this._endTarget.copy(target);
        this._progress = 0;
        this._duration = duration;
        this._onComplete = onComplete;
        this.isAnimating = true;
    }

    update(dt) {
        if (!this.isAnimating) return;
        this._progress += dt / this._duration;
        if (this._progress >= 1) {
            this._progress = 1;
            this.isAnimating = false;
        }
        // Smooth ease in-out
        const t = this._easeInOutCubic(this._progress);

        this.camera.position.lerpVectors(this._startPos, this._endPos, t);
        tmpVec.lerpVectors(this._startTarget, this._endTarget, t);
        this.controls.target.copy(tmpVec);
        this.controls.update();

        if (this._progress >= 1 && this._onComplete) {
            this._onComplete();
            this._onComplete = null;
        }
    }

    _easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}
