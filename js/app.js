/**
 * HCC OmniScope — Main Application
 * Multi-Scale 3D Cancer Biology Explorer
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { loadAllData } from './loaders/data-loader.js';
import { CameraTransition } from './utils/camera-transitions.js';
import { GeneUniverse } from './scales/gene-universe.js';
import { CellAtlas } from './scales/cell-atlas.js';
import { PatientLandscape } from './scales/patient-landscape.js';
import { TOUR_STEPS } from './components/tour.js';
import { KMCurveViewer } from './components/km-curves.js';
import { DrugExplorer } from './components/drug-explorer.js';
import { GeneSearch, ExternalLinks, PatientFilter, RiskCalculator, CohortSwitcher } from './components/interactive-features.js';
import { ScreenshotExporter, FullscreenManager, LoadAnimator, ParticleTrails, KeyboardNavigator } from './components/polish-features.js';
import { ExpressionHeatmap, SignatureVenn, PathwayDiagram } from './components/visualizations.js';
import { GeneComparison, DataTableView, NetworkStats, CorrelationExplorer, MultiSelect } from './components/analysis-tools.js';
import { ThemeToggle, Minimap, NavigationHistory, ShareURL, ResponsiveTouch } from './components/ui-enhancements.js';
import { BloomEffect, AmbientParticles, PulsingNodes, ScaleTransitionWarp, GradientFloor, RingHalos, ClickRipple, NebulaBackground, FloatingStats, DNAHelix } from './components/visual-effects.js';
import { ForestPlot, ROCCurves, CalibrationCurves, Nomogram } from './components/academic-validation.js';
import { EnrichmentPanel, SignatureBenchmark, MutationLandscape, ImmuneHeatmap, MethodsPanel, ResearchGaps, HypothesisGenerator } from './components/academic-biology.js';
import { CohortDashboard, GeneLeaderboard, VolcanoPlot, SankeyDiagram, RadarChart, CorrelationMatrix } from './components/dashboard-panels.js';
import { SpotlightMode, SurvivalTimeline, BrushSelect, LiveFilterSliders, TreatmentRecommendation, ResearchTimeline, AnnotationSystem, PresentationExport } from './components/interactive-behaviors.js';

// === State ===
let scene, camera, renderer, labelRenderer, controls, camTransition;
let clock;
let scales = {};
let currentScale = 'genes';
let data = null;
let mouse = new THREE.Vector2(-999, -999);
let starField;

// Feature instances
let kmViewer, drugExplorer, geneSearch, patientFilter, riskCalculator;
let cohortSwitcher, screenshotExporter, fullscreenManager, loadAnimator;
let particleTrails, keyboardNav;
let heatmap, vennDiagram, pathwayDiagram;
let geneComparison, dataTableView, networkStats, correlationExplorer, multiSelect;
let themeToggle, minimap, navHistory, shareURL, responsiveTouch;
let bloomEffect, ambientParticles, pulsingNodes, warpEffect, gradientFloor;
let ringHalos, clickRipple, nebulaBackground, floatingStats, dnaHelix;
let forestPlot, rocCurves, calibrationCurves, nomogram;
let enrichmentPanel, signatureBenchmark, mutationLandscape, immuneHeatmap;
let methodsPanel, researchGaps, hypothesisGenerator;
let cohortDashboard, geneLeaderboard, volcanoPlot, sankeyDiagram, radarChart, correlationMatrix;
let spotlightMode, survivalTimeline, brushSelect, liveFilterSliders;
let treatmentRec, researchTimeline, annotationSystem, presentationExport;

// DOM refs
const container = document.getElementById('canvas-container');
const loadingScreen = document.getElementById('loading-screen');
const loadProgress = document.getElementById('load-progress');
const loadStatus = document.getElementById('load-status');
const hoverCard = document.getElementById('hover-card');
const detailPanel = document.getElementById('detail-panel');
const detailContent = document.getElementById('detail-content');
const breadcrumb = document.getElementById('breadcrumb');
const colorModeSelect = document.getElementById('color-mode');
const legendPanel = document.getElementById('legend-panel');
const legendContent = document.getElementById('legend-content');
const scaleContextText = document.getElementById('scale-context-text');

// === Init ===
async function init() {
    // Three.js setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.008);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 18);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // CSS2D renderer for labels
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 60;
    controls.minDistance = 3;

    // Camera transitions
    camTransition = new CameraTransition(camera, controls);
    clock = new THREE.Clock();

    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 15, 10);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x6c8cff, 0.4, 40);
    pointLight.position.set(-5, 5, 5);
    scene.add(pointLight);

    // Star field background
    createStarField();

    // Load data
    console.log('[OmniScope] Starting data load...');
    try {
        data = await loadAllData((progress, status) => {
            loadProgress.style.width = `${progress * 100}%`;
            loadStatus.textContent = status;
            console.log(`[OmniScope] Load ${Math.round(progress*100)}%: ${status}`);
        });
        console.log('[OmniScope] Data loaded:', Object.keys(data));
    } catch (e) {
        console.error('[OmniScope] Data load failed:', e);
        loadStatus.textContent = `Data load error: ${e.message}`;
        return;
    }

    loadStatus.textContent = 'Building visualizations...';
    await new Promise(r => setTimeout(r, 50)); // Let UI update

    // Build scales
    const scaleCallbacks = {
        onHover: showHoverCard,
        onUnhover: hideHoverCard,
        onClick: handleClick,
    };

    try {
        console.log('[OmniScope] Building Gene Universe...');
        scales.genes = new GeneUniverse(scene, data, scaleCallbacks);
        console.log('[OmniScope] Building Cell Atlas...');
        scales.cells = new CellAtlas(scene, data, scaleCallbacks);
        console.log('[OmniScope] Building Patient Landscape...');
        scales.patients = new PatientLandscape(scene, data, scaleCallbacks);
        console.log('[OmniScope] All scales built.');
    } catch (e) {
        console.error('[OmniScope] Scale build failed:', e);
        loadStatus.textContent = `Build error: ${e.message}`;
        return;
    }

    // === Initialize Features ===
    console.log('[OmniScope] Initializing features...');

    // KM Curve Viewer
    kmViewer = new KMCurveViewer('canvas-container', data.kmCurves);

    // Drug Explorer
    drugExplorer = new DrugExplorer(data.drugSensitivity);

    // Gene Search
    const allGeneNames = [...new Set([
        ...Object.keys(data.geneAnnotations || {}),
        ...(data.hazardRatios?.['ROS/Ferroptosis'] || []).map(g => g.gene),
        ...(data.hazardRatios?.['Altitude Adaptation'] || []).map(g => g.gene),
    ])];
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
        geneSearch = new GeneSearch(searchContainer, allGeneNames, (geneName) => {
            // Find and click the gene in the gene universe
            if (currentScale !== 'genes') switchScale('genes');
            const geneData = scales.genes?.nodeData?.find(n => n.gene === geneName);
            if (geneData) {
                showGeneDetail(geneData);
            }
        });
    }

    // Patient Filter
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer && scales.patients) {
        patientFilter = new PatientFilter(filterContainer, scales.patients.patients, (filteredIndices) => {
            // Update patient visibility
            if (scales.patients.instancedMesh) {
                const dummy = new THREE.Object3D();
                for (let i = 0; i < scales.patients.patients.length; i++) {
                    const visible = filteredIndices.includes(i);
                    dummy.position.set(
                        scales.patients.patients[i].x,
                        scales.patients.patients[i].y,
                        scales.patients.patients[i].z
                    );
                    dummy.scale.setScalar(visible ? (0.6 + (scales.patients.patients[i].survivalMonths / 120) * 0.8) : 0.001);
                    dummy.updateMatrix();
                    scales.patients.instancedMesh.setMatrixAt(i, dummy.matrix);
                }
                scales.patients.instancedMesh.instanceMatrix.needsUpdate = true;
            }
        });
    }

    // Risk Calculator
    riskCalculator = new RiskCalculator(data.coefficients, data.geneAnnotations);

    // Screenshot Exporter
    screenshotExporter = new ScreenshotExporter(renderer, scene, camera, labelRenderer);

    // Fullscreen Manager
    fullscreenManager = new FullscreenManager(
        document.getElementById('sidebar'),
        document.getElementById('summary-stats'),
        document.getElementById('breadcrumb')
    );

    // Load Animator
    loadAnimator = new LoadAnimator(scene);

    // Particle Trails (on gene correlation edges)
    particleTrails = new ParticleTrails(scene);

    // Keyboard Navigator
    keyboardNav = new KeyboardNavigator(
        (geneName) => {
            if (currentScale === 'genes') {
                const geneData = scales.genes?.nodeData?.find(n => n.gene === geneName);
                if (geneData) showGeneDetail(geneData);
            }
        },
        (scaleName) => switchScale(scaleName)
    );
    keyboardNav.setGeneList(allGeneNames);

    console.log('[OmniScope] Features initialized.');

    // === Initialize Visualizations ===
    console.log('[OmniScope] Initializing visualizations...');
    try {
        heatmap = new ExpressionHeatmap(data.expression, data.riskScores, data.geneAnnotations);
    } catch (e) { console.warn('[OmniScope] Heatmap init skipped:', e.message); }

    try {
        vennDiagram = new SignatureVenn();
        vennDiagram.onGeneClick = (gene) => {
            vennDiagram.hide();
            if (currentScale !== 'genes') switchScale('genes');
            const gd = scales.genes?.nodeData?.find(n => n.gene === gene);
            if (gd) showGeneDetail(gd);
        };
    } catch (e) { console.warn('[OmniScope] Venn init skipped:', e.message); }

    try {
        pathwayDiagram = new PathwayDiagram(data.geneAnnotations);
        pathwayDiagram.onGeneClick = (gene) => {
            const gd = scales.genes?.nodeData?.find(n => n.gene === gene);
            if (gd) showGeneDetail(gd);
        };
    } catch (e) { console.warn('[OmniScope] Pathway init skipped:', e.message); }

    // === Initialize Analysis Tools ===
    console.log('[OmniScope] Initializing analysis tools...');
    try {
        geneComparison = new GeneComparison(data.hazardRatios, data.correlations, data.geneAnnotations);
    } catch (e) { console.warn('[OmniScope] GeneComparison init skipped:', e.message); }

    try {
        dataTableView = new DataTableView();
    } catch (e) { console.warn('[OmniScope] DataTableView init skipped:', e.message); }

    try {
        networkStats = new NetworkStats(data.correlations, data.hazardRatios);
    } catch (e) { console.warn('[OmniScope] NetworkStats init skipped:', e.message); }

    try {
        correlationExplorer = new CorrelationExplorer(data.correlations, data.expression);
    } catch (e) { console.warn('[OmniScope] CorrelationExplorer init skipped:', e.message); }

    try {
        multiSelect = new MultiSelect();
    } catch (e) { console.warn('[OmniScope] MultiSelect init skipped:', e.message); }

    // === Initialize UI Enhancements ===
    console.log('[OmniScope] Initializing UI enhancements...');
    try {
        const themeContainer = document.getElementById('theme-container');
        if (themeContainer) {
            themeToggle = new ThemeToggle(themeContainer);
            // Listen for theme changes to update Three.js scene
            document.addEventListener('theme-changed', (e) => {
                const isDark = e.detail.isDark;
                const bgColor = isDark ? 0x0a0a1a : 0xf0f2f5;
                scene.background = new THREE.Color(bgColor);
                scene.fog = new THREE.FogExp2(bgColor, 0.008);
            });
        }
    } catch (e) { console.warn('[OmniScope] ThemeToggle init skipped:', e.message); }

    try {
        minimap = new Minimap(camera, scene);
    } catch (e) { console.warn('[OmniScope] Minimap init skipped:', e.message); }

    try {
        navHistory = new NavigationHistory((entry) => {
            if (entry.scale && entry.scale !== currentScale) {
                switchScale(entry.scale);
            }
        });
        // Push initial state
        navHistory.push({ scale: 'genes' });
    } catch (e) { console.warn('[OmniScope] NavHistory init skipped:', e.message); }

    try {
        shareURL = new ShareURL();
        // Restore state from URL on load
        const urlState = shareURL.decodeState();
        if (urlState && urlState.scale && urlState.scale !== currentScale) {
            switchScale(urlState.scale);
            if (urlState.gene) {
                const gd = scales.genes?.nodeData?.find(n => n.gene === urlState.gene);
                if (gd) setTimeout(() => showGeneDetail(gd), 500);
            }
        }
    } catch (e) { console.warn('[OmniScope] ShareURL init skipped:', e.message); }

    try {
        responsiveTouch = new ResponsiveTouch(renderer.domElement, camera, controls);
    } catch (e) { console.warn('[OmniScope] ResponsiveTouch init skipped:', e.message); }

    console.log('[OmniScope] All enhancements initialized.');

    // === Initialize Visual Effects ===
    console.log('[OmniScope] Initializing visual effects...');

    try {
        bloomEffect = new BloomEffect(renderer, scene, camera, window.innerWidth, window.innerHeight);
        console.log('[OmniScope] Bloom effect ready.');
    } catch (e) { console.warn('[OmniScope] Bloom skipped:', e.message); }

    try {
        ambientParticles = new AmbientParticles(scene, 300);
    } catch (e) { console.warn('[OmniScope] Ambient particles skipped:', e.message); }

    try {
        pulsingNodes = new PulsingNodes();
        // Register HMOX1 (overlap gene) with gold pulse
        if (scales.genes?.nodeMeshes) {
            for (const mesh of scales.genes.nodeMeshes) {
                const gene = mesh.userData.gene;
                if (gene === 'HMOX1') {
                    pulsingNodes.addNode(mesh, 0xfbbf24, 1.2, mesh.userData.size * 0.9, mesh.userData.size * 1.15);
                } else if (mesh.userData.sigType === 'ros') {
                    pulsingNodes.addNode(mesh, 0xf87171, 0.6, mesh.userData.size * 0.95, mesh.userData.size * 1.05);
                } else {
                    pulsingNodes.addNode(mesh, 0x4ade80, 0.5, mesh.userData.size * 0.97, mesh.userData.size * 1.03);
                }
            }
        }
    } catch (e) { console.warn('[OmniScope] Pulsing nodes skipped:', e.message); }

    try {
        warpEffect = new ScaleTransitionWarp(scene, camera);
    } catch (e) { console.warn('[OmniScope] Warp effect skipped:', e.message); }

    try {
        gradientFloor = new GradientFloor(scene, 20);
        gradientFloor.setScale('genes'); // hidden initially
    } catch (e) { console.warn('[OmniScope] Gradient floor skipped:', e.message); }

    try {
        ringHalos = new RingHalos(scene);
        // Add halos to HMOX1 and top-degree genes
        if (scales.genes?.nodeMeshes) {
            const hmox = scales.genes.nodeMeshes.find(m => m.userData.gene === 'HMOX1');
            if (hmox) ringHalos.addHalo(hmox.position, 1.5, 0xfbbf24);
            // Add to top 3 genes by coefficient
            const sorted = [...scales.genes.nodeMeshes].sort((a, b) => (b.userData.size || 0) - (a.userData.size || 0));
            for (let i = 0; i < Math.min(3, sorted.length); i++) {
                if (sorted[i].userData.gene !== 'HMOX1') {
                    const c = sorted[i].userData.sigType === 'ros' ? 0xf87171 : 0x4ade80;
                    ringHalos.addHalo(sorted[i].position, sorted[i].userData.size + 0.5, c);
                }
            }
        }
    } catch (e) { console.warn('[OmniScope] Ring halos skipped:', e.message); }

    try {
        clickRipple = new ClickRipple(scene);
        scene.userData.camera = camera; // For billboarding
    } catch (e) { console.warn('[OmniScope] Click ripple skipped:', e.message); }

    try {
        nebulaBackground = new NebulaBackground(scene);
    } catch (e) { console.warn('[OmniScope] Nebula background skipped:', e.message); }

    try {
        floatingStats = new FloatingStats(scene);
        // Add key stats floating near relevant areas
        floatingStats.addStat('C-index: 0.700', new THREE.Vector3(6, 5, 0), '#f87171', 0.7);
        floatingStats.addStat('C-index: 0.671', new THREE.Vector3(-6, 5, 0), '#4ade80', 0.7);
        floatingStats.addStat('20 Genes', new THREE.Vector3(0, -5, 0), '#6c8cff', 0.65);
    } catch (e) { console.warn('[OmniScope] Floating stats skipped:', e.message); }

    try {
        dnaHelix = new DNAHelix(scene);
    } catch (e) { console.warn('[OmniScope] DNA helix skipped:', e.message); }

    console.log('[OmniScope] Visual effects initialized.');

    // === Academic Validation ===
    console.log('[OmniScope] Initializing academic tools...');
    try { forestPlot = new ForestPlot(data.hazardRatios); } catch(e) { console.warn('ForestPlot:', e.message); }

    // Pre-process data for ROC/Calibration: convert our format to array format
    const _buildRocData = (sigName) => {
        const scores = data.riskScores?.[sigName]?.scores || {};
        const clinMap = {};
        for (const c of (data.clinical || [])) {
            clinMap[c.patientId] = c;
        }
        const riskArr = [];
        const clinArr = [];
        for (const [pid, score] of Object.entries(scores)) {
            const c = clinMap[pid];
            if (c && c.OS_days != null) {
                riskArr.push({ patientId: pid, score });
                clinArr.push({ patientId: pid, time: c.OS_days, event: c.OS_event || 0 });
            }
        }
        return { riskArr, clinArr };
    };
    const rocData = _buildRocData('ROS/Ferroptosis');

    try { rocCurves = new ROCCurves(rocData.riskArr, rocData.clinArr); } catch(e) { console.warn('ROC:', e.message); }
    try { calibrationCurves = new CalibrationCurves(rocData.riskArr, rocData.clinArr); } catch(e) { console.warn('Calibration:', e.message); }
    // Build enriched clinical for Nomogram (merge risk scores into clinical)
    try {
        const rosScoresObj = data.riskScores?.['ROS/Ferroptosis']?.scores || {};
        const altScoresObj = data.riskScores?.['Altitude Adaptation']?.scores || {};
        const enrichedClinical = (data.clinical || []).map(c => ({
            ...c,
            rosScore: rosScoresObj[c.patientId] ?? null,
            altScore: altScoresObj[c.patientId] ?? null,
        }));
        nomogram = new Nomogram(data.hazardRatios, data.coefficients, enrichedClinical);
    } catch(e) { console.warn('Nomogram:', e.message); }

    // === Academic Biology ===
    try { enrichmentPanel = new EnrichmentPanel(data.geneAnnotations); } catch(e) { console.warn('Enrichment:', e.message); }
    try { signatureBenchmark = new SignatureBenchmark(); } catch(e) { console.warn('Benchmark:', e.message); }
    try { mutationLandscape = new MutationLandscape(); } catch(e) { console.warn('Mutations:', e.message); }
    try { immuneHeatmap = new ImmuneHeatmap(data.immune); } catch(e) { console.warn('ImmuneHeatmap:', e.message); }
    try { methodsPanel = new MethodsPanel(); } catch(e) { console.warn('Methods:', e.message); }
    try { researchGaps = new ResearchGaps(); } catch(e) { console.warn('ResearchGaps:', e.message); }
    try { hypothesisGenerator = new HypothesisGenerator(data.geneAnnotations, data.hazardRatios); } catch(e) { console.warn('Hypotheses:', e.message); }

    // === Dashboard Panels ===
    try { cohortDashboard = new CohortDashboard(data.clinical); } catch(e) { console.warn('CohortDash:', e.message); }
    try { geneLeaderboard = new GeneLeaderboard(data.hazardRatios, data.correlations, data.geneAnnotations); } catch(e) { console.warn('Leaderboard:', e.message); }
    try { volcanoPlot = new VolcanoPlot(data.expression, data.riskScores); } catch(e) { console.warn('Volcano:', e.message); }
    try { sankeyDiagram = new SankeyDiagram(scales.patients?.patients || []); } catch(e) { console.warn('Sankey:', e.message); }
    try { radarChart = new RadarChart(); } catch(e) { console.warn('Radar:', e.message); }
    try {
        correlationMatrix = new CorrelationMatrix(data.correlations, data.geneAnnotations);
        correlationMatrix.onCellClick = (g1, g2) => {
            correlationMatrix.hide();
            if (correlationExplorer) correlationExplorer.show(g1, g2);
        };
    } catch(e) { console.warn('CorrMatrix:', e.message); }

    // === Interactive Behaviors ===
    try { spotlightMode = new SpotlightMode(scene); } catch(e) { console.warn('Spotlight:', e.message); }
    try {
        if (scales.patients?.patients && scales.patients?.instancedMesh) {
            const timelineContainer = document.getElementById('timeline-container');
            if (timelineContainer) {
                survivalTimeline = new SurvivalTimeline(timelineContainer, scales.patients.patients, scales.patients.instancedMesh);
            }
        }
    } catch(e) { console.warn('Timeline:', e.message); }
    try { brushSelect = new BrushSelect(renderer, camera, (indices) => { console.log('Brush selected:', indices.length, 'patients'); }); } catch(e) { console.warn('Brush:', e.message); }
    try {
        const sliderContainer = document.getElementById('slider-container');
        if (sliderContainer && scales.patients?.patients) {
            liveFilterSliders = new LiveFilterSliders(sliderContainer, scales.patients.patients, (indices) => {
                if (scales.patients?.instancedMesh) {
                    const dummy = new THREE.Object3D();
                    for (let i = 0; i < scales.patients.patients.length; i++) {
                        const vis = indices.includes(i);
                        const p = scales.patients.patients[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(vis ? (0.6 + (p.survivalMonths / 120) * 0.8) : 0.001);
                        dummy.updateMatrix();
                        scales.patients.instancedMesh.setMatrixAt(i, dummy.matrix);
                    }
                    scales.patients.instancedMesh.instanceMatrix.needsUpdate = true;
                }
            });
        }
    } catch(e) { console.warn('LiveFilters:', e.message); }
    try { treatmentRec = new TreatmentRecommendation(data.geneAnnotations, data.drugSensitivity); } catch(e) { console.warn('Treatment:', e.message); }
    try { researchTimeline = new ResearchTimeline(); } catch(e) { console.warn('ResTimeline:', e.message); }
    try { annotationSystem = new AnnotationSystem(); } catch(e) { console.warn('Annotations:', e.message); }
    try { presentationExport = new PresentationExport(renderer, scene, camera); } catch(e) { console.warn('Presentation:', e.message); }

    console.log('[OmniScope] All systems initialized.');

    // Setup event listeners
    setupEvents();
    updateSidebar();
    updateLegend();

    // Dismiss loading
    loadProgress.style.width = '100%';
    loadStatus.textContent = 'Ready';
    setTimeout(() => {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => loadingScreen.style.display = 'none', 800);
    }, 300);

    // Start render loop
    animate();

    // Run entrance animation for initial scale
    try {
        if (loadAnimator && scales.genes?.nodeMeshes) {
            loadAnimator.animateGeneEntrance(scales.genes.nodeMeshes, 1.5);
        }
    } catch (e) {
        console.warn('[OmniScope] Entrance animation skipped:', e.message);
    }
}

function createStarField() {
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({
        color: 0x4466aa,
        size: 0.08,
        transparent: true,
        opacity: 0.5,
    });
    starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);
}

// === Scale Navigation ===
function switchScale(scaleName, selectedData = null) {
    if (scaleName === currentScale) return;
    const prevScale = currentScale;

    // Hide current
    scales[currentScale].hide();

    // Show new
    currentScale = scaleName;
    scales[currentScale].show();

    // Cross-scale data passing
    if (scaleName === 'cells' && prevScale === 'genes' && selectedData?.gene) {
        scales.cells.highlightByGene(selectedData.gene);
    } else if (scaleName === 'cells') {
        scales.cells.resetHighlight();
    }

    // Camera transition with warp effect
    const target = scales[currentScale].getCameraPosition();
    camTransition.transitionTo(target.pos, target.target, 1.5);
    if (warpEffect) {
        try { warpEffect.play(1.5); } catch (e) { /* ignore */ }
    }

    // Update gradient floor visibility
    if (gradientFloor) gradientFloor.setScale(currentScale);

    // Update UI
    updateSidebar();
    updateLegend();
    updateBreadcrumb();
    hideHoverCard();
    hideDetailPanel();

    // Track navigation
    if (navHistory) navHistory.push({ scale: currentScale });
    if (shareURL) shareURL.updateURL({ scale: currentScale });
}

function updateSidebar() {
    document.querySelectorAll('.scale-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.scale === currentScale);
    });

    // Update color mode options based on scale
    colorModeSelect.innerHTML = '';
    const options = {
        genes: [['signature', 'Signature'], ['hr', 'Hazard Ratio']],
        cells: [['quadrant', 'ROS/Altitude Quadrant'], ['specialist', 'Specialist Status']],
        patients: [['survival', 'Survival Status'], ['rosRisk', 'ROS Risk Score']],
    };
    for (const [val, label] of (options[currentScale] || [])) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        colorModeSelect.appendChild(opt);
    }

    // Show/hide patient-specific sections based on scale
    const filterSection = document.getElementById('filter-section');
    if (filterSection) {
        filterSection.style.display = currentScale === 'patients' ? 'block' : 'none';
    }
    // Show/hide survival timeline
    if (survivalTimeline && survivalTimeline._bar) {
        survivalTimeline._bar.style.display = currentScale === 'patients' ? 'flex' : 'none';
    }

    // Scale-specific context text
    const contexts = {
        genes: '<p>You are viewing 20 prognostic genes arranged by expression correlation strength. Green nodes belong to the 9-gene altitude adaptation signature, built from genes under positive selection in Tibetan, Andean, and Ethiopian highland populations. Red nodes form the 11-gene ROS/ferroptosis signature, capturing tumor oxidative stress defense. HMOX1 (gold) appears in both, anchoring the evolutionary-to-oncogenic connection.</p><p style="margin-top:0.3rem;font-size:0.65rem;color:var(--text-dim);">Node size = |LASSO coefficient|. Edge opacity = Pearson correlation in TCGA-LIHC. Click a gene for detailed biological annotation.</p>',
        cells: '<p>You are viewing 85 cell types from the Human Protein Atlas, positioned in 3D by their mean ROS-signature expression, altitude-signature expression, and hypoxia enrichment score. Purple-highlighted cells are "hypoxia specialists" that rank in the top quartile for hypoxia gene programs across 3 or more tissues.</p><p style="margin-top:0.3rem;font-size:0.65rem;color:var(--text-dim);">Macrophages dominate as universal specialists, consistent with their known role as hypoxia-responsive immune sentinels.</p>',
        patients: '<p>You are viewing 302 TCGA-LIHC patients mapped into a 3D risk space. X-axis = ROS/ferroptosis risk score, Y-axis = altitude adaptation risk score, Z-axis = signature divergence. Blue spheres are alive at last follow-up; red spheres are deceased.</p><p style="margin-top:0.3rem;font-size:0.65rem;color:var(--text-dim);">Translucent planes mark cohort medians. Patients in the high-ROS, high-altitude quadrant show HR > 2.0 (log-rank p < 0.001). Click a patient for full clinical profile.</p>',
    };
    scaleContextText.innerHTML = contexts[currentScale] || '';
}

function updateLegend() {
    legendPanel.style.display = 'block';
    if (currentScale === 'genes') {
        legendContent.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.72rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#4ade80;display:inline-block;"></span>
                    Altitude Adaptation Genes
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#f87171;display:inline-block;"></span>
                    ROS/Ferroptosis Genes
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#fbbf24;display:inline-block;"></span>
                    HMOX1 (Shared)
                </div>
                <div style="font-size:0.65rem;color:#8888aa;margin-top:0.3rem;">
                    Node size = |LASSO coefficient|<br>
                    Edge opacity = |correlation|<br>
                    Click gene to explore in Cell Atlas
                </div>
            </div>`;
    } else if (currentScale === 'cells') {
        legendContent.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.72rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#c084fc;display:inline-block;"></span>
                    Hypoxia Specialist Cells
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#60a5fa;display:inline-block;"></span>
                    Low ROS/Altitude
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
                    High ROS/Altitude
                </div>
                <div style="font-size:0.65rem;color:#8888aa;margin-top:0.3rem;">
                    85 cell types across 14 tissues<br>
                    Size = specialist count<br>
                    Click to see in Patient Landscape
                </div>
            </div>`;
    } else if (currentScale === 'patients') {
        legendContent.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.72rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#60a5fa;display:inline-block;"></span>
                    Alive
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
                    Deceased
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:6px;height:20px;background:rgba(248,113,113,0.15);display:inline-block;border:1px solid rgba(248,113,113,0.3);"></span>
                    ROS Median Plane
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="width:6px;height:20px;background:rgba(74,222,128,0.15);display:inline-block;border:1px solid rgba(74,222,128,0.3);"></span>
                    Altitude Median Plane
                </div>
                <div style="font-size:0.65rem;color:#8888aa;margin-top:0.3rem;">
                    302 TCGA-LIHC patients<br>
                    Size = survival time<br>
                    Click patient for full profile
                </div>
            </div>`;
    }
}

function updateBreadcrumb() {
    breadcrumb.style.display = 'flex';
    const scaleNames = { genes: 'Genes', cells: 'Cells', patients: 'Patients' };
    breadcrumb.innerHTML = Object.entries(scaleNames).map(([key, label]) =>
        `<span class="crumb ${key === currentScale ? 'active' : ''}" data-scale="${key}">${label}</span>`
    ).join('<span class="crumb-sep">\u203A</span>');

    breadcrumb.querySelectorAll('.crumb').forEach(el => {
        el.addEventListener('click', () => switchScale(el.dataset.scale));
    });
}

// === Hover Cards ===
function showHoverCard(nodeData, intersect) {
    let html = '';

    if (currentScale === 'genes') {
        const sigClass = nodeData.sigType;
        const ann = data.geneAnnotations?.[nodeData.gene] || {};
        const pStr = nodeData.pval < 0.001 ? nodeData.pval.toExponential(1) : nodeData.pval?.toFixed(4);
        const hrColor = nodeData.hr > 1 ? '#f87171' : '#4ade80';
        const hrLabel = nodeData.hr > 1 ? 'Risk' : 'Protective';
        html = `
            <h4 class="gene-name ${sigClass}">${nodeData.gene}</h4>
            <div style="font-size:0.65rem;color:#8888aa;margin:-0.2rem 0 0.3rem;">${ann.fullName || ''}</div>
            <div class="stat-row"><span class="stat-label">Hazard Ratio</span><span class="stat-value" style="color:${hrColor}">${nodeData.hr?.toFixed(3) || 'N/A'} <span style="font-size:0.55rem;opacity:0.7;">${hrLabel}</span></span></div>
            <div class="stat-row"><span class="stat-label">p-value</span><span class="stat-value ${nodeData.pval < 0.05 ? 'sig' : 'nonsig'}">${pStr || 'N/A'}</span></div>
            <div style="font-size:0.62rem;color:#e0e0f0;margin-top:0.3rem;line-height:1.4;">${(ann.function || '').slice(0, 80)}${(ann.function || '').length > 80 ? '...' : ''}</div>
            <div style="margin-top:0.3rem;"><span class="tag ${sigClass}">${sigClass === 'both' ? 'Altitude + ROS' : sigClass === 'overlap' ? 'Altitude + ROS' : sigClass}</span></div>
            <div style="font-size:0.55rem;color:#6c8cff;margin-top:0.3rem;">Click for full details</div>
        `;
    } else if (currentScale === 'cells') {
        const cellAnn = data.immuneRoles?.[nodeData.cellType] || data.cellAnnotations?.[nodeData.cellType] || {};
        const effectColor = cellAnn.tumorEffect === 'pro-tumor' ? '#f87171' : cellAnn.tumorEffect === 'anti-tumor' ? '#4ade80' : '#fbbf24';
        html = `
            <h4>${nodeData.cellType.charAt(0).toUpperCase() + nodeData.cellType.slice(1)}</h4>
            ${cellAnn.fullName ? `<div style="font-size:0.62rem;color:#8888aa;margin:-0.2rem 0 0.3rem;">${cellAnn.fullName}</div>` : ''}
            <div class="stat-row"><span class="stat-label">ROS Score</span><span class="stat-value">${nodeData.rosMean.toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-label">Altitude Score</span><span class="stat-value">${nodeData.altMean.toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-label">Tissues</span><span class="stat-value">${nodeData.nTissues} / 14</span></div>
            <div style="margin-top:0.3rem;">
                ${nodeData.isSpecialist ? '<span class="tag" style="background:rgba(192,132,252,0.2);color:#c084fc;">Specialist</span>' : ''}
                ${cellAnn.tumorEffect ? `<span class="tag" style="background:${effectColor}22;color:${effectColor};">${cellAnn.tumorEffect}</span>` : ''}
            </div>
            <div style="font-size:0.55rem;color:#6c8cff;margin-top:0.3rem;">Click for full details</div>
        `;
    } else if (currentScale === 'patients') {
        html = `
            <h4>${nodeData.id}</h4>
            <div class="stat-row"><span class="stat-label">Status</span><span class="stat-value" style="color:${nodeData.isDeceased ? '#ef4444' : '#60a5fa'}">${nodeData.isDeceased ? 'Deceased' : 'Alive'}</span></div>
            <div class="stat-row"><span class="stat-label">Survival</span><span class="stat-value">${nodeData.survivalMonths} mo</span></div>
            <div class="stat-row"><span class="stat-label">ROS Risk</span><span class="stat-value">${nodeData.rosScore}</span></div>
            <div class="stat-row"><span class="stat-label">Altitude Risk</span><span class="stat-value">${nodeData.altScore}</span></div>
            <div class="stat-row"><span class="stat-label">Stage</span><span class="stat-value">${nodeData.stage}</span></div>
        `;
    }

    hoverCard.innerHTML = html;
    hoverCard.style.display = 'block';

    // Position near mouse
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((mouse.x + 1) / 2) * rect.width + rect.left;
    const y = ((-mouse.y + 1) / 2) * rect.height + rect.top;
    hoverCard.style.left = `${x + 15}px`;
    hoverCard.style.top = `${y - 10}px`;

    // Keep on screen
    const cardRect = hoverCard.getBoundingClientRect();
    if (cardRect.right > window.innerWidth) {
        hoverCard.style.left = `${x - cardRect.width - 15}px`;
    }
    if (cardRect.bottom > window.innerHeight) {
        hoverCard.style.top = `${y - cardRect.height + 10}px`;
    }
}

function hideHoverCard() {
    hoverCard.style.display = 'none';
}

// === Click / Detail Panel ===
function handleClick(nodeData) {
    if (currentScale === 'genes') {
        showGeneDetail(nodeData);
    } else if (currentScale === 'cells') {
        showCellDetail(nodeData);
    } else if (currentScale === 'patients') {
        showPatientDetail(nodeData);
    }
}

function showGeneDetail(geneData) {
    const gene = geneData.gene;
    const ann = data.geneAnnotations?.[gene] || {};
    const sigType = geneData.sigType;
    const isOverlap = sigType === 'both' || sigType === 'overlap';
    const sigLabel = isOverlap ? 'Altitude + ROS/Ferroptosis' : sigType === 'altitude' ? 'Altitude Adaptation' : 'ROS/Ferroptosis';
    const sigColor = isOverlap ? '#fbbf24' : sigType === 'altitude' ? '#4ade80' : '#f87171';

    // Build pathway tags
    const pathwayHtml = (ann.pathways || []).map(p =>
        `<span class="pathway-tag">${p}</span>`
    ).join('');

    // Build drug tags
    const drugHtml = (ann.drugs || []).map(d =>
        `<span class="drug-tag">${d}</span>`
    ).join('');

    // Top correlations from correlation matrix
    let corrHtml = '';
    for (const sig of Object.keys(data.correlations)) {
        const { genes: cGenes, matrix } = data.correlations[sig];
        if (!cGenes) continue;
        const idx = cGenes.indexOf(gene);
        if (idx < 0) continue;
        const pairs = cGenes.map((g, j) => ({ gene: g, r: matrix[idx][j] }))
            .filter(p => p.gene !== gene && Math.abs(p.r) > 0.1)
            .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
            .slice(0, 3);
        if (pairs.length > 0) {
            corrHtml = pairs.map(p => `
                <div class="bar-row">
                    <span class="bar-label">${p.gene}</span>
                    <div class="bar-track">
                        <div class="bar-fill" style="width:${Math.abs(p.r) * 100}%;background:${p.r > 0 ? '#6c8cff' : '#f87171'};"></div>
                    </div>
                    <span style="font-size:0.6rem;color:var(--text-dim);font-family:var(--mono);width:40px;text-align:right;">${p.r.toFixed(3)}</span>
                </div>
            `).join('');
        }
    }

    const pStr = geneData.pval != null ? (geneData.pval < 0.001 ? geneData.pval.toExponential(1) : geneData.pval.toFixed(4)) : 'N/A';

    detailContent.innerHTML = `
        <h4 style="color:${sigColor}">${gene}</h4>
        <p style="font-size:0.72rem;color:var(--text-dim);margin:-0.4rem 0 0.6rem;">${ann.fullName || ''}</p>
        <span class="tag" style="background:${sigColor}22;color:${sigColor}">${sigLabel}</span>

        <div class="section-title">Prognostic Statistics</div>
        <div class="detail-grid">
            <div class="detail-item">
                <div class="label">Hazard Ratio</div>
                <div class="value" style="color:${geneData.hr > 1 ? '#f87171' : '#4ade80'}">${geneData.hr?.toFixed(3) || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="label">95% CI</div>
                <div class="value">${geneData.ci_lower?.toFixed(2) || '?'} - ${geneData.ci_upper?.toFixed(2) || '?'}</div>
            </div>
            <div class="detail-item">
                <div class="label">p-value</div>
                <div class="value" style="color:${geneData.pval < 0.05 ? '#4ade80' : '#f87171'}">${pStr}</div>
            </div>
            <div class="detail-item">
                <div class="label">LASSO Coef</div>
                <div class="value">${geneData.coef?.toFixed(4) || 'N/A'}</div>
            </div>
        </div>

        <div class="section-title">Gene Function</div>
        <p class="gene-function">${ann.function || 'No annotation available.'}</p>

        <div class="section-title">Role in HCC</div>
        <div class="hcc-role">${ann.hccRole || 'No HCC-specific annotation available.'}</div>

        ${pathwayHtml ? `<div class="section-title">Pathways</div><div class="pathway-tags">${pathwayHtml}</div>` : ''}

        ${drugHtml ? `<div class="section-title">Drug Targets</div><div class="pathway-tags">${drugHtml}</div>` : ''}

        ${corrHtml ? `<div class="section-title">Top Correlated Genes</div><div class="bar-chart">${corrHtml}</div>` : ''}

        ${ann.keyFinding ? `<p class="key-finding">${ann.keyFinding}</p>` : ''}

        <div class="section-title">External Databases</div>
        ${ExternalLinks.getLinksHTML(gene)}

        <button class="navigate-btn" id="gene-pathway-btn" style="margin-top:0.5rem;">View in Pathway Diagram</button>
        <button class="navigate-btn" id="gene-to-cells">Explore ${gene} in Cell Atlas &rarr;</button>
    `;
    detailPanel.style.display = 'block';

    // Wire navigate buttons
    document.getElementById('gene-pathway-btn')?.addEventListener('click', () => {
        if (pathwayDiagram) pathwayDiagram.show(gene);
    });
    document.getElementById('gene-to-cells')?.addEventListener('click', () => {
        hideDetailPanel();
        switchScale('cells', { gene });
    });
}

function showCellDetail(cellData) {
    const ct = cellData.cellType;
    const ann = data.cellAnnotations?.[ct] || data.immuneRoles?.[ct] || {};

    // Tissue distribution bars
    const tissueScores = data.crossTissue?.[ct] || {};
    const sortedTissues = Object.entries(tissueScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    const maxTissueScore = sortedTissues.length > 0 ? sortedTissues[0][1] : 1;
    const tissueHtml = sortedTissues.map(([tissue, score]) => `
        <div class="bar-row">
            <span class="bar-label">${tissue}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width:${(score / maxTissueScore) * 100}%;background:#c084fc;"></div>
            </div>
            <span style="font-size:0.6rem;color:var(--text-dim);font-family:var(--mono);width:35px;text-align:right;">${Math.round(score)}</span>
        </div>
    `).join('');

    detailContent.innerHTML = `
        <h4>${ct.charAt(0).toUpperCase() + ct.slice(1)}</h4>
        <p style="font-size:0.72rem;color:var(--text-dim);margin:-0.4rem 0 0.6rem;">${ann.full_name || ann.fullName || ''}</p>
        ${cellData.isSpecialist ? '<span class="tag" style="background:rgba(192,132,252,0.2);color:#c084fc;">Hypoxia Specialist</span>' : ''}
        ${ann.tumorEffect ? `<span class="tag" style="background:${ann.tumorEffect === 'pro-tumor' ? 'rgba(248,113,113,0.2)' : ann.tumorEffect === 'anti-tumor' ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.2)'};color:${ann.tumorEffect === 'pro-tumor' ? '#f87171' : ann.tumorEffect === 'anti-tumor' ? '#4ade80' : '#fbbf24'};margin-left:0.3rem;">${ann.tumorEffect}</span>` : ''}

        <div class="section-title">Hypoxia Profile</div>
        <div class="detail-grid">
            <div class="detail-item">
                <div class="label">ROS Score</div>
                <div class="value">${cellData.rosMean?.toFixed(1) || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="label">Altitude Score</div>
                <div class="value">${cellData.altMean?.toFixed(1) || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="label">Hypoxia Score</div>
                <div class="value">${cellData.hypoxiaScore || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="label">Tissues Present</div>
                <div class="value">${cellData.nTissues || 0}</div>
            </div>
        </div>

        ${ann.hcc_role || ann.hccRole ? `
            <div class="section-title">Role in HCC</div>
            <div class="hcc-role">${ann.hcc_role || ann.hccRole}</div>
        ` : ''}

        ${ann.prognosis_implication || ann.prognosis ? `
            <div class="section-title">Prognosis</div>
            <p class="gene-function">${ann.prognosis_implication || ann.prognosis}</p>
        ` : ''}

        ${ann.therapeutic_relevance || ann.therapy ? `
            <div class="section-title">Therapeutic Angle</div>
            <p class="gene-function">${ann.therapeutic_relevance || ann.therapy}</p>
        ` : ''}

        ${tissueHtml ? `
            <div class="section-title">Tissue Distribution (Hypoxia Score)</div>
            <div class="bar-chart">${tissueHtml}</div>
        ` : ''}

        <button class="navigate-btn" id="cell-to-patients">View in Patient Landscape &rarr;</button>
    `;
    detailPanel.style.display = 'block';

    document.getElementById('cell-to-patients')?.addEventListener('click', () => {
        hideDetailPanel();
        switchScale('patients', cellData);
    });
}

function showPatientDetail(patient) {
    // Risk group classification
    const rosMedian = data.riskScores?.['ROS/Ferroptosis']?.median || 0;
    const altMedian = data.riskScores?.['Altitude Adaptation']?.median || 0;
    const rosGroup = patient.rosScore > rosMedian ? 'HIGH' : 'LOW';
    const altGroup = patient.altScore > altMedian ? 'HIGH' : 'LOW';
    const riskGroup = `${rosGroup}-${altGroup}`;
    const riskColor = riskGroup === 'HIGH-HIGH' ? '#ef4444' : riskGroup === 'LOW-LOW' ? '#4ade80' : '#fbbf24';

    // Gene expression bars (sorted, color-coded by signature)
    const ALTITUDE_GENES = ['GC', 'GRB2', 'LDHA', 'SENP1', 'CDC42', 'HMOX1', 'HK2', 'EPO', 'AEBP2'];
    const ROS_GENES = ['TXNRD1', 'MAFG', 'G6PD', 'SQSTM1', 'SLC7A11', 'GSR', 'NCF2', 'MSRA', 'GLRX2', 'BACH1'];
    const allGenes = Object.entries(patient.expression || {})
        .sort((a, b) => b[1] - a[1]);
    const maxExpr = allGenes.length > 0 ? allGenes[0][1] : 1;
    const exprHtml = allGenes.slice(0, 15).map(([gene, val]) => {
        const isAlt = ALTITUDE_GENES.includes(gene);
        const isRos = ROS_GENES.includes(gene);
        const color = (gene === 'HMOX1') ? '#fbbf24' : isAlt ? '#4ade80' : isRos ? '#f87171' : '#6c8cff';
        return `
        <div class="bar-row">
            <span class="bar-label" style="color:${color}">${gene}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width:${(val / maxExpr) * 100}%;background:${color};"></div>
            </div>
            <span style="font-size:0.55rem;color:var(--text-dim);font-family:var(--mono);width:35px;text-align:right;">${val.toFixed(0)}</span>
        </div>`;
    }).join('');

    // Immune landscape summary from aggregate data
    const immuneHtml = (data.immune || []).slice(0, 6).map(ic => {
        const diff = ic.mean_high - ic.mean_low;
        const direction = diff > 0 ? 'enriched in high-risk' : 'depleted in high-risk';
        const color = diff > 0 ? '#f87171' : '#4ade80';
        return `
        <div class="bar-row">
            <span class="bar-label">${ic.cell_type}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width:${Math.min(Math.abs(ic.spearman_r) * 200, 100)}%;background:${color};"></div>
            </div>
            <span style="font-size:0.5rem;color:var(--text-dim);width:20px;">${ic.spearman_r > 0 ? '+' : '-'}</span>
        </div>`;
    }).join('');

    detailContent.innerHTML = `
        <h4>${patient.id}</h4>
        <div style="display:flex;gap:0.3rem;margin-bottom:0.6rem;">
            <span class="tag" style="background:${patient.isDeceased ? 'rgba(239,68,68,0.2)' : 'rgba(96,165,250,0.2)'};color:${patient.isDeceased ? '#ef4444' : '#60a5fa'}">${patient.isDeceased ? 'Deceased' : 'Alive'}</span>
            <span class="tag" style="background:${riskColor}22;color:${riskColor}">Risk: ${riskGroup}</span>
        </div>

        <div class="section-title">Clinical Profile</div>
        <div class="detail-grid">
            <div class="detail-item">
                <div class="label">Survival</div>
                <div class="value">${patient.survivalMonths} mo</div>
            </div>
            <div class="detail-item">
                <div class="label">Stage</div>
                <div class="value">${patient.stage}</div>
            </div>
            <div class="detail-item">
                <div class="label">Grade</div>
                <div class="value">${patient.grade}</div>
            </div>
            <div class="detail-item">
                <div class="label">Age</div>
                <div class="value">${patient.age}</div>
            </div>
        </div>

        <div class="section-title">Risk Stratification</div>
        <div class="detail-grid">
            <div class="detail-item">
                <div class="label">ROS Risk</div>
                <div class="value" style="color:${patient.rosScore > 0 ? '#f87171' : '#60a5fa'}">${patient.rosScore}</div>
            </div>
            <div class="detail-item">
                <div class="label">Altitude Risk</div>
                <div class="value" style="color:${patient.altScore > 0 ? '#f87171' : '#60a5fa'}">${patient.altScore}</div>
            </div>
        </div>

        <div class="section-title">Signature Gene Expression</div>
        <p style="font-size:0.6rem;color:var(--text-dim);margin-bottom:0.3rem;">
            <span style="color:#4ade80;">&#9632;</span> Altitude
            <span style="color:#f87171;margin-left:0.5rem;">&#9632;</span> ROS
            <span style="color:#fbbf24;margin-left:0.5rem;">&#9632;</span> HMOX1
        </p>
        <div class="bar-chart">${exprHtml}</div>

        ${immuneHtml ? `
            <div class="section-title">Immune Landscape (cohort-level)</div>
            <p style="font-size:0.58rem;color:var(--text-dim);margin-bottom:0.3rem;">Spearman correlation with risk score</p>
            <div class="bar-chart">${immuneHtml}</div>
        ` : ''}

        <button class="navigate-btn" id="btn-patient-treatment" style="margin-top:0.5rem;">Treatment Suggestions</button>
        <button class="navigate-btn" id="btn-patient-radar" style="margin-top:0.3rem;">Radar Profile</button>
        <button class="navigate-btn" onclick="document.getElementById('detail-panel').style.display='none'">Close</button>
    `;
    detailPanel.style.display = 'block';

    document.getElementById('btn-patient-treatment')?.addEventListener('click', () => {
        if (treatmentRec) treatmentRec.show(patient);
    });
    document.getElementById('btn-patient-radar')?.addEventListener('click', () => {
        if (radarChart) radarChart.showPatientProfile(patient);
    });
}

function hideDetailPanel() {
    detailPanel.style.display = 'none';
}

// === Tour ===
let tourStep = 0;
let tourActive = false;

function startTour() {
    tourStep = 0;
    tourActive = true;
    showTourStep();
}

function showTourStep() {
    const step = TOUR_STEPS[tourStep];
    document.getElementById('tour-overlay').style.display = 'flex';
    document.getElementById('tour-step').textContent = `${tourStep + 1} / ${TOUR_STEPS.length}`;
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-text').textContent = step.text;
    document.getElementById('tour-prev').style.visibility = tourStep === 0 ? 'hidden' : 'visible';
    document.getElementById('tour-next').textContent = tourStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next \u2192';

    // Show key insight
    const insightEl = document.getElementById('tour-insight');
    const insightText = document.getElementById('tour-insight-text');
    if (step.keyInsight) {
        insightEl.style.display = 'block';
        insightText.textContent = step.keyInsight;
    } else {
        insightEl.style.display = 'none';
    }

    if (step.scale !== currentScale) {
        switchScale(step.scale);
    }
}

function nextTourStep() {
    if (tourStep < TOUR_STEPS.length - 1) {
        tourStep++;
        showTourStep();
    } else {
        endTour();
    }
}

function prevTourStep() {
    if (tourStep > 0) {
        tourStep--;
        showTourStep();
    }
}

function endTour() {
    tourActive = false;
    document.getElementById('tour-overlay').style.display = 'none';
}

// === Events ===
function setupEvents() {
    // Scale buttons
    document.querySelectorAll('.scale-btn').forEach(btn => {
        btn.addEventListener('click', () => switchScale(btn.dataset.scale));
    });

    // Mouse move
    renderer.domElement.addEventListener('mousemove', (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    // Click
    renderer.domElement.addEventListener('click', () => {
        if (camTransition.isAnimating) return;
        const hit = scales[currentScale]?.checkClick(mouse, camera);
        // Trigger click ripple at intersection point
        if (clickRipple && hit) {
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const meshes = currentScale === 'genes' ? scales.genes.nodeMeshes :
                           currentScale === 'cells' ? scales.cells.nodeMeshes :
                           scales.patients.instancedMesh ? [scales.patients.instancedMesh] : [];
            const intersects = raycaster.intersectObjects(meshes);
            if (intersects.length > 0) {
                const sigType = intersects[0].object?.userData?.sigType;
                const color = sigType === 'ros' ? 0xf87171 : sigType === 'altitude' ? 0x4ade80 : 0x6c8cff;
                clickRipple.trigger(intersects[0].point, color);
            }
        }
    });

    // Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
        if (bloomEffect) bloomEffect.resize(window.innerWidth, window.innerHeight);
    });

    // Close detail
    document.getElementById('close-detail').addEventListener('click', hideDetailPanel);

    // Tour
    document.getElementById('start-tour').addEventListener('click', startTour);
    document.getElementById('tour-next').addEventListener('click', nextTourStep);
    document.getElementById('tour-prev').addEventListener('click', prevTourStep);

    // Tool buttons
    document.getElementById('btn-km')?.addEventListener('click', () => {
        const sig = currentScale === 'patients' ? 'ROS/Ferroptosis' : 'Altitude Adaptation';
        if (kmViewer) kmViewer.show(sig, sig + ' Survival');
    });
    document.getElementById('btn-drugs')?.addEventListener('click', () => {
        if (drugExplorer) drugExplorer.show();
    });
    document.getElementById('btn-calc')?.addEventListener('click', () => {
        if (riskCalculator) riskCalculator.show();
    });
    document.getElementById('btn-screenshot')?.addEventListener('click', () => {
        if (screenshotExporter) screenshotExporter.downloadScreenshot(`omniscope-${currentScale}.png`);
    });
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
        if (fullscreenManager) fullscreenManager.toggle();
    });
    document.getElementById('btn-heatmap')?.addEventListener('click', () => {
        if (heatmap) heatmap.show();
    });
    document.getElementById('btn-venn')?.addEventListener('click', () => {
        if (vennDiagram) vennDiagram.show();
    });
    document.getElementById('btn-network')?.addEventListener('click', () => {
        if (networkStats) networkStats.show();
    });
    document.getElementById('btn-table')?.addEventListener('click', () => {
        if (dataTableView) {
            if (currentScale === 'genes') dataTableView.showGeneTable(data.hazardRatios, data.geneAnnotations);
            else if (currentScale === 'cells') dataTableView.showCellTable(data.coactivation, data.specialists, data.cellAnnotations);
            else if (currentScale === 'patients') dataTableView.showPatientTable(scales.patients?.patients || []);
        }
    });
    document.getElementById('btn-share')?.addEventListener('click', () => {
        if (shareURL) shareURL.showShareDialog(shareURL.getShareableLink());
    });

    // Academic buttons
    document.getElementById('btn-forest')?.addEventListener('click', () => { if (forestPlot) forestPlot.show('ROS/Ferroptosis'); });
    document.getElementById('btn-roc')?.addEventListener('click', () => {
        console.log('[OmniScope] ROC button clicked, instance:', !!rocCurves);
        if (rocCurves) { try { rocCurves.show('ROS/Ferroptosis'); } catch(e) { console.error('ROC show error:', e); } }
    });
    document.getElementById('btn-calibration')?.addEventListener('click', () => {
        console.log('[OmniScope] Calibration button clicked, instance:', !!calibrationCurves);
        if (calibrationCurves) { try { calibrationCurves.show('ROS/Ferroptosis'); } catch(e) { console.error('Calibration show error:', e); } }
    });
    document.getElementById('btn-nomogram')?.addEventListener('click', () => {
        console.log('[OmniScope] Nomogram button clicked, instance:', !!nomogram);
        if (nomogram) {
            try { nomogram.show(); } catch(e) { console.error('Nomogram show error:', e); }
        } else {
            console.error('Nomogram not initialized');
        }
    });
    document.getElementById('btn-enrichment')?.addEventListener('click', () => { if (enrichmentPanel) enrichmentPanel.show(); });
    document.getElementById('btn-benchmark')?.addEventListener('click', () => { if (signatureBenchmark) signatureBenchmark.show(); });
    document.getElementById('btn-mutations')?.addEventListener('click', () => { if (mutationLandscape) mutationLandscape.show(); });
    document.getElementById('btn-immune')?.addEventListener('click', () => { if (immuneHeatmap) immuneHeatmap.show(); });
    document.getElementById('btn-methods')?.addEventListener('click', () => { if (methodsPanel) methodsPanel.show(); });
    document.getElementById('btn-gaps')?.addEventListener('click', () => { if (researchGaps) researchGaps.show(); });
    document.getElementById('btn-hypotheses')?.addEventListener('click', () => { if (hypothesisGenerator) hypothesisGenerator.show(); });
    document.getElementById('btn-cohort-dash')?.addEventListener('click', () => { if (cohortDashboard) cohortDashboard.show(); });

    // Dashboard buttons
    document.getElementById('btn-leaderboard')?.addEventListener('click', () => { if (geneLeaderboard) geneLeaderboard.show(); });
    document.getElementById('btn-volcano')?.addEventListener('click', () => { if (volcanoPlot) volcanoPlot.show('ROS/Ferroptosis'); });
    document.getElementById('btn-sankey')?.addEventListener('click', () => { if (sankeyDiagram) sankeyDiagram.show(); });
    document.getElementById('btn-radar')?.addEventListener('click', () => { if (radarChart) radarChart.showGeneProfile(scales.genes?.nodeData?.[0], data.geneAnnotations); });
    document.getElementById('btn-corrmatrix')?.addEventListener('click', () => { if (correlationMatrix) correlationMatrix.show(); });
    document.getElementById('btn-timeline')?.addEventListener('click', () => { if (researchTimeline) researchTimeline.show(); });
    document.getElementById('btn-presentation')?.addEventListener('click', () => { if (presentationExport) presentationExport.generate(); });
    document.getElementById('btn-annotations')?.addEventListener('click', () => { if (annotationSystem) annotationSystem.showPanel(); });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        // Skip if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.key === 'Escape') {
            if (tourActive) endTour();
            else if (detailPanel.style.display !== 'none') hideDetailPanel();
            else if (kmViewer) kmViewer.hide();
            else if (drugExplorer) drugExplorer.hide();
        }
        if (e.key === '1') switchScale('genes');
        if (e.key === '2') switchScale('cells');
        if (e.key === '3') switchScale('patients');
        if (e.key === 'k' || e.key === 'K') {
            if (kmViewer) kmViewer.show(currentScale === 'patients' ? 'ROS/Ferroptosis' : 'Altitude Adaptation');
        }
        if (e.key === 'd' || e.key === 'D') {
            if (drugExplorer) drugExplorer.show();
        }
        if (e.key === 'f' || e.key === 'F') {
            if (fullscreenManager) fullscreenManager.toggle();
        }
        if (e.key === 's' || e.key === 'S') {
            if (screenshotExporter) screenshotExporter.downloadScreenshot(`omniscope-${currentScale}.png`);
        }
        if (e.key === 'r' || e.key === 'R') {
            if (riskCalculator) riskCalculator.show();
        }
        if (e.key === '/') {
            e.preventDefault();
            const searchInput = document.querySelector('#search-container input');
            if (searchInput) searchInput.focus();
        }
        if (e.key === 'h' || e.key === 'H') {
            if (heatmap) heatmap.show();
        }
        if (e.key === 'v' || e.key === 'V') {
            if (vennDiagram) vennDiagram.show();
        }
        if (e.key === 'p' || e.key === 'P') {
            if (pathwayDiagram) pathwayDiagram.show(scales.genes?.selectedGene || 'HMOX1');
        }
        if (e.key === 'n' || e.key === 'N') {
            if (networkStats) networkStats.show();
        }
        if (e.key === 't' || e.key === 'T') {
            if (dataTableView) {
                if (currentScale === 'genes') dataTableView.showGeneTable(data.hazardRatios, data.geneAnnotations);
                else if (currentScale === 'cells') dataTableView.showCellTable(data.coactivation, data.specialists, data.cellAnnotations);
                else if (currentScale === 'patients') dataTableView.showPatientTable(scales.patients?.patients || []);
            }
        }
        if (e.key === 'u' || e.key === 'U') {
            if (shareURL) shareURL.showShareDialog(shareURL.getShareableLink());
        }
    });
}

// === Render Loop ===
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    // Update camera transition
    camTransition.update(dt);

    // Orbit controls
    if (!camTransition.isAnimating) {
        controls.update();
    }

    // Hover detection
    if (!camTransition.isAnimating) {
        scales[currentScale]?.checkHover(mouse, camera);
    }

    // Slow star rotation
    if (starField) {
        starField.rotation.y += 0.00005;
        starField.rotation.x += 0.00002;
    }

    // Update particle trails
    if (particleTrails) particleTrails.update(dt);

    // Update visual effects
    if (ambientParticles) ambientParticles.update(dt);
    if (pulsingNodes) pulsingNodes.update(dt);
    if (clickRipple) clickRipple.update(dt);
    if (ringHalos) ringHalos.update(dt);
    if (floatingStats) floatingStats.update(dt);
    if (dnaHelix) dnaHelix.update(dt);

    // Update minimap
    if (minimap) minimap.update();

    // Render with bloom or plain
    if (bloomEffect) {
        bloomEffect.render();
    } else {
        renderer.render(scene, camera);
    }
    labelRenderer.render(scene, camera);
}

// === Start ===
init().catch(err => {
    console.error('Failed to initialize:', err);
    loadStatus.textContent = `Error: ${err.message}`;
});
