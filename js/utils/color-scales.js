/**
 * Color utilities — diverging and categorical scales for the visualization.
 */
import * as THREE from 'three';

// Signature colors
export const COLORS = {
    altitude: new THREE.Color(0x4ade80),
    ros: new THREE.Color(0xf87171),
    overlap: new THREE.Color(0xfbbf24),
    alive: new THREE.Color(0x60a5fa),
    deceased: new THREE.Color(0xef4444),
    accent: new THREE.Color(0x6c8cff),
    specialist: new THREE.Color(0xc084fc),
    bg: new THREE.Color(0x0a0a1a),
    edge: new THREE.Color(0x334155),
    edgeStrong: new THREE.Color(0x6c8cff),
};

// Tissue palette (colorblind-safe, 14 distinct)
const TISSUE_HEX = [
    0x4ade80, 0x60a5fa, 0xf87171, 0xfbbf24, 0xc084fc,
    0x2dd4bf, 0xfb923c, 0xa78bfa, 0x38bdf8, 0xf472b6,
    0x34d399, 0xe879f9, 0xfacc15, 0x94a3b8,
];

const TISSUES = [
    'adipose tissue', 'bone marrow', 'brain', 'breast', 'bronchus',
    'colon', 'endometrium', 'esophagus', 'kidney', 'liver',
    'lung', 'pancreas', 'skin', 'spleen',
];

export function tissueColor(tissue) {
    const idx = TISSUES.indexOf(tissue.toLowerCase());
    return new THREE.Color(idx >= 0 ? TISSUE_HEX[idx] : 0x94a3b8);
}

/**
 * Linear interpolation between two colors based on t in [0, 1].
 */
export function lerpColor(c1, c2, t) {
    const color = new THREE.Color();
    color.r = c1.r + (c2.r - c1.r) * t;
    color.g = c1.g + (c2.g - c1.g) * t;
    color.b = c1.b + (c2.b - c1.b) * t;
    return color;
}

/**
 * Diverging blue-red scale for survival.
 * t=0 -> blue (alive), t=1 -> red (deceased)
 */
export function survivalColor(isDeceased) {
    return isDeceased ? COLORS.deceased.clone() : COLORS.alive.clone();
}

/**
 * Risk score to color: low (blue) -> mid (white) -> high (red).
 */
export function riskColor(score, min, max) {
    const mid = (min + max) / 2;
    if (score <= mid) {
        const t = (score - min) / (mid - min + 0.001);
        return lerpColor(COLORS.alive, new THREE.Color(0xffffff), t);
    } else {
        const t = (score - mid) / (max - mid + 0.001);
        return lerpColor(new THREE.Color(0xffffff), COLORS.deceased, t);
    }
}

/**
 * Map a value to a size within [minSize, maxSize].
 */
export function mapSize(value, dataMin, dataMax, minSize, maxSize) {
    if (dataMax === dataMin) return (minSize + maxSize) / 2;
    const t = (Math.abs(value) - dataMin) / (dataMax - dataMin);
    return minSize + t * (maxSize - minSize);
}

/**
 * Signature type for a gene name.
 */
export function geneSignature(gene, altGenes, rosGenes) {
    const inAlt = altGenes.includes(gene);
    const inRos = rosGenes.includes(gene);
    if (inAlt && inRos) return 'overlap';
    if (inAlt) return 'altitude';
    return 'ros';
}

export function signatureColor(type) {
    return COLORS[type] || COLORS.accent;
}
