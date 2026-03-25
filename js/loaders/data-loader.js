/**
 * Data loader — fetches and caches all JSON data for the 3 scales.
 */

const cache = {};

async function loadJSON(path) {
    if (cache[path]) return cache[path];
    console.log(`[DataLoader] Fetching ${path}...`);
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
    const data = await resp.json();
    cache[path] = data;
    console.log(`[DataLoader] OK: ${path}`);
    return data;
}

export async function loadAllData(onProgress) {
    const files = [
        { key: 'hazardRatios', path: 'data/genes/hazard_ratios.json' },
        { key: 'correlations', path: 'data/genes/correlations.json' },
        { key: 'coefficients', path: 'data/genes/coefficients.json' },
        { key: 'coactivation', path: 'data/cells/coactivation.json' },
        { key: 'specialists', path: 'data/cells/specialists.json' },
        { key: 'crossTissue', path: 'data/cells/cross_tissue.json' },
        { key: 'geneTissue', path: 'data/cells/gene_tissue_matrix.json' },
        { key: 'riskScores', path: 'data/patients/risk_scores.json' },
        { key: 'clinical', path: 'data/patients/clinical.json' },
        { key: 'immune', path: 'data/patients/immune.json' },
        { key: 'kmCurves', path: 'data/patients/km_curves.json' },
        { key: 'drugSensitivity', path: 'data/patients/drug_sensitivity.json' },
        { key: 'expression', path: 'data/patients/expression.json' },
        { key: 'geneAnnotations', path: 'data/genes/annotations.json' },
        { key: 'cellAnnotations', path: 'data/cells/annotations.json' },
        { key: 'immuneRoles', path: 'data/cells/immune_roles.json' },
    ];

    const result = {};
    for (let i = 0; i < files.length; i++) {
        const { key, path } = files[i];
        result[key] = await loadJSON(path);
        if (onProgress) onProgress((i + 1) / files.length, `Loading ${key}...`);
    }
    return result;
}
