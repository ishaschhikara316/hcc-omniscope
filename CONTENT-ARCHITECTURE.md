# HCC OmniScope - Content Architecture & Narrative Design

## 1. Research Story Tour (4-Step Narrative)

### Step 1: "From Thin Air to Tumor"
**Scale**: Gene Universe

**Body text**:
For thousands of years, populations in Tibet, the Andes, and the Ethiopian highlands evolved genetic adaptations to survive chronic low-oxygen environments. These 20 genes encode oxygen-sensing, glycolytic, and redox-balancing programs that are central to hypoxia survival. Liver tumors, starved of oxygen as they outgrow their blood supply, activate the very same pathways. What evolution built for survival at 5,000 meters, cancer co-opts for survival in the hypoxic tumor core.

**Key Insight**:
HMOX1, the gold node, appears in both the altitude adaptation and ROS/ferroptosis signatures. It is the molecular bridge linking evolutionary oxygen sensing to tumor oxidative stress defense.

---

### Step 2: "The Cells That Breathe Fire"
**Scale**: Cell Atlas

**Body text**:
Across 14 human tissues and 85 cell types profiled by the Human Protein Atlas, macrophages emerge as universal hypoxia specialists. They rank in the top quartile for hypoxia gene expression in all 14 tissues examined, and in the top quartile for altitude-signature expression across 19 tissues. This is not a liver-specific phenomenon; it is a conserved program. In the tumor microenvironment, these macrophage hypoxia programs shape immune evasion and therapy resistance.

**Key Insight**:
Macrophages are top-quartile hypoxia specialists in 14 of 14 tissues, making them the most consistent cellular responders to oxygen stress across the entire human body.

---

### Step 3: "A Landscape of Risk"
**Scale**: Patient Landscape

**Body text**:
Each sphere represents one of 302 TCGA liver cancer patients, positioned by their ROS risk score, altitude risk score, and the divergence between the two signatures. Patients in the high-ROS, high-altitude quadrant (upper right of the 3D space) show significantly worse overall survival. The two translucent planes mark the median risk thresholds; crossing both places a patient in the highest-risk group. This stratification replicates across four independent cohorts totaling 648 patients.

**Key Insight**:
The combined ROS/ferroptosis signature achieves a C-index of 0.700, outperforming TNM staging alone and validated across ICGC-LIRI, GSE14520, GSE76427, and the TCGA training set.

---

### Step 4: "Evolution as Prognostic Tool"
**Scale**: Gene Universe

**Body text**:
This visualization encodes a single research thread: genes shaped by millennia of altitude adaptation predict liver cancer outcomes with clinically meaningful accuracy. The 9-gene altitude signature (C-index 0.671) and the 11-gene ROS/ferroptosis signature (C-index 0.700) were built with LASSO-Cox regression and validated independently. These signatures do not merely correlate with survival; they connect to drug-targetable pathways including ferroptosis induction, glutathione metabolism, and immune checkpoint modulation.

**Key Insight**:
Two prognostic signatures, 20 genes, 4 validation cohorts, 648 patients. The altitude-to-cancer axis is both biologically grounded and clinically actionable.

---

## 2. Enhanced Information Panels

### 2a. Gene Detail Panel (shown on gene click)

**Layout**: Right-side panel, 320px wide, scrollable.

```
+-----------------------------------------------+
| [x close]                                      |
|                                                 |
| GENE NAME (e.g., HMOX1)                        |
| [ALTITUDE] [ROS/FERROPTOSIS] <-- signature tags |
|                                                 |
| --- Prognostic Statistics ---                   |
| Hazard Ratio      1.148                         |
| 95% CI            1.033 - 1.276                 |
| p-value           0.010                         |
| LASSO Coefficient  0.094                        |
|                                                 |
| --- Gene Function ---                           |
| Full name: Heme Oxygenase 1                     |
| Role: Catalyzes heme degradation, producing     |
|   biliverdin, CO, and free iron. Central to     |
|   oxidative stress defense and ferroptosis      |
|   resistance.                                   |
|                                                 |
| --- Pathway Membership ---                      |
| [tag] HIF-1 signaling                           |
| [tag] Ferroptosis                               |
| [tag] Glutathione metabolism                    |
|                                                 |
| --- Expression Distribution ---                 |
| (Horizontal bar chart)                          |
| Mean TPM across TCGA-LIHC cohort                |
| + std deviation bar                             |
| Tumor vs. Normal fold-change if available       |
|                                                 |
| --- Correlation Hub ---                         |
| Top 3 correlated genes (from correlation        |
| matrix) with Pearson r values:                  |
|   NCF2   r = 0.424                              |
|   HK2    r = 0.347                              |
|   EPO    r = 0.323                              |
|                                                 |
| --- Drug Targets ---                            |
| Targetable by: Sorafenib (multi-kinase),        |
|   Hemin (HMOX1 inducer),                        |
|   ZnPP (HMOX1 inhibitor)                        |
|                                                 |
| [Explore in Cell Atlas ->]                      |
+-----------------------------------------------+
```

**Data fields required per gene**:
- `gene`: symbol (from hazard_ratios.json)
- `full_name`: human-readable gene name
- `function`: 1-2 sentence biological role
- `hazard_ratio`, `ci_lower`, `ci_upper`, `p_value`: from hazard_ratios.json
- `coef`: LASSO coefficient from coefficients.json
- `signature`: "altitude", "ros", or "overlap"
- `pathways`: array of KEGG/Hallmark pathway names
- `top_correlations`: top 3 from correlations.json matrix
- `mean_expression`, `std_expression`: from coefficients.json
- `drug_targets`: array of known drug interactions (new data needed)

**New data file needed**: `data/genes/annotations.json`

```json
{
  "HMOX1": {
    "full_name": "Heme Oxygenase 1",
    "function": "Catalyzes oxidative cleavage of heme to biliverdin, carbon monoxide, and free iron. Central regulator of oxidative stress defense, ferroptosis resistance, and inflammatory modulation in the tumor microenvironment.",
    "pathways": ["HIF-1 signaling", "Ferroptosis", "Mineral absorption", "Porphyrin metabolism"],
    "drug_targets": ["Sorafenib (indirect, via Nrf2-HMOX1 axis)", "ZnPP (HMOX1 inhibitor)", "Hemin (HMOX1 inducer)"],
    "hcc_role": "Upregulated in hypoxic HCC regions. Confers ferroptosis resistance by sequestering free iron and reducing oxidative damage. Dual role: protective in normal hepatocytes, pro-tumorigenic in established HCC."
  },
  "TXNRD1": {
    "full_name": "Thioredoxin Reductase 1",
    "function": "Reduces thioredoxin using NADPH, maintaining cellular redox balance. Key enzyme in the thioredoxin antioxidant system, protecting cells from oxidative damage and regulating redox-sensitive transcription factors.",
    "pathways": ["Glutathione metabolism", "Selenocompound metabolism", "Ferroptosis defense"],
    "drug_targets": ["Auranofin (TXNRD1 inhibitor)", "Curcumin (indirect inhibitor)"],
    "hcc_role": "Highest hazard ratio (1.586) in the ROS signature. Overexpression enables HCC cells to tolerate high ROS levels generated during rapid proliferation and hypoxia."
  },
  "MAFG": {
    "full_name": "MAF BZIP Transcription Factor G",
    "function": "Small Maf protein that heterodimerizes with Nrf2 to activate antioxidant response elements (AREs). Coordinates transcription of detoxification and antioxidant genes under oxidative stress.",
    "pathways": ["Nrf2-ARE pathway", "Oxidative stress response", "Drug metabolism"],
    "drug_targets": ["Brusatol (Nrf2 inhibitor, indirect)"],
    "hcc_role": "Second highest hazard ratio (1.654) among all 20 genes. Drives Nrf2-dependent antioxidant programs that shield HCC cells from ferroptosis and chemotherapy-induced ROS."
  },
  "G6PD": {
    "full_name": "Glucose-6-Phosphate Dehydrogenase",
    "function": "Rate-limiting enzyme of the pentose phosphate pathway. Generates NADPH, essential for glutathione recycling and lipid biosynthesis.",
    "pathways": ["Pentose phosphate pathway", "Glutathione metabolism", "NADPH production"],
    "drug_targets": ["6-AN (G6PD inhibitor)", "DHEA (competitive inhibitor)"],
    "hcc_role": "Provides the NADPH supply that fuels both antioxidant defense and lipid synthesis in rapidly growing HCC. Upregulation correlates with poor prognosis and therapy resistance."
  },
  "SQSTM1": {
    "full_name": "Sequestosome 1 (p62)",
    "function": "Selective autophagy receptor that targets ubiquitinated cargo for degradation. Also activates Nrf2 by competitively binding KEAP1, linking autophagy to antioxidant defense.",
    "pathways": ["Autophagy", "Nrf2-KEAP1 signaling", "NF-kB pathway"],
    "drug_targets": ["Verteporfin (p62 aggregation)", "Chloroquine (autophagy inhibitor, indirect)"],
    "hcc_role": "Accumulates in autophagy-deficient HCC, constitutively activating Nrf2 and driving antioxidant gene expression. Creates a feedforward loop protecting tumor cells from ROS-mediated death."
  },
  "SLC7A11": {
    "full_name": "Solute Carrier Family 7 Member 11 (xCT)",
    "function": "Cystine/glutamate antiporter that imports cystine for glutathione synthesis. The primary gatekeeper of the cysteine supply for the glutathione-GPX4 ferroptosis defense axis.",
    "pathways": ["Ferroptosis", "Glutathione biosynthesis", "Amino acid transport"],
    "drug_targets": ["Erastin (xCT inhibitor, ferroptosis inducer)", "Sulfasalazine (xCT inhibitor)", "Sorafenib (indirect xCT suppression)"],
    "hcc_role": "High expression blocks ferroptosis by maintaining glutathione pools. A key therapeutic target: SLC7A11 inhibition sensitizes HCC to ferroptosis-based therapies."
  },
  "GSR": {
    "full_name": "Glutathione-Disulfide Reductase",
    "function": "Reduces oxidized glutathione (GSSG) back to reduced glutathione (GSH) using NADPH. Maintains the intracellular GSH pool critical for detoxification and antioxidant defense.",
    "pathways": ["Glutathione metabolism", "ROS detoxification", "Drug metabolism"],
    "drug_targets": ["BCNU/Carmustine (GSR inhibitor)"],
    "hcc_role": "Sustains the glutathione cycle that protects HCC cells from oxidative therapy. Elevated GSR expression is associated with chemoresistance."
  },
  "NCF2": {
    "full_name": "Neutrophil Cytosolic Factor 2 (p67phox)",
    "function": "Component of the NADPH oxidase complex that generates superoxide radicals. Part of the innate immune defense system for pathogen killing.",
    "pathways": ["NADPH oxidase complex", "ROS production", "Innate immunity"],
    "drug_targets": ["DPI (NADPH oxidase inhibitor)", "Apocynin"],
    "hcc_role": "Paradoxical role: generates ROS for immune defense but also contributes to chronic inflammation-driven HCC progression. Expressed primarily in tumor-infiltrating myeloid cells."
  },
  "MSRA": {
    "full_name": "Methionine Sulfoxide Reductase A",
    "function": "Repairs oxidized methionine residues in proteins, reversing oxidative damage. Acts as both a protein repair enzyme and an antioxidant scavenger of ROS.",
    "pathways": ["Protein repair", "Methionine metabolism", "Antioxidant defense"],
    "drug_targets": ["No direct clinical inhibitors currently available"],
    "hcc_role": "Uniquely protective: the only gene in the ROS signature with HR < 1 (0.725). High MSRA expression associates with better survival, suggesting it restrains tumor progression through oxidative damage repair."
  },
  "GLRX2": {
    "full_name": "Glutaredoxin 2",
    "function": "Mitochondrial glutaredoxin that maintains iron-sulfur cluster integrity and protects against oxidative damage in mitochondria.",
    "pathways": ["Mitochondrial redox homeostasis", "Iron-sulfur cluster assembly", "Glutathione system"],
    "drug_targets": ["No direct clinical inhibitors currently available"],
    "hcc_role": "Maintains mitochondrial function under oxidative stress in HCC. Elevated expression enables continued mitochondrial ATP production despite the high-ROS tumor environment."
  },
  "BACH1": {
    "full_name": "BTB Domain and CNC Homolog 1",
    "function": "Transcriptional repressor that competes with Nrf2 for ARE binding. Suppresses antioxidant gene expression and promotes heme-regulated gene programs.",
    "pathways": ["Nrf2-ARE pathway (repressor)", "Heme metabolism", "Ferroptosis regulation"],
    "drug_targets": ["BACH1 degraders (experimental)", "Hemin (promotes BACH1 degradation)"],
    "hcc_role": "Regulates the balance between antioxidant defense and ferroptosis sensitivity. When BACH1 is high, it suppresses HMOX1 and SLC7A11, potentially sensitizing cells to ferroptosis."
  },
  "LDHA": {
    "full_name": "Lactate Dehydrogenase A",
    "function": "Converts pyruvate to lactate under anaerobic conditions. The canonical marker of the Warburg effect and glycolytic metabolism in tumors.",
    "pathways": ["Glycolysis", "HIF-1 signaling", "Warburg effect"],
    "drug_targets": ["FX11 (LDHA inhibitor)", "Oxamate (competitive inhibitor)", "Galloflavin"],
    "hcc_role": "Highest LASSO coefficient (0.147) in the altitude signature. Drives aerobic glycolysis in HCC, producing lactate that acidifies the tumor microenvironment and suppresses anti-tumor immunity."
  },
  "GRB2": {
    "full_name": "Growth Factor Receptor Bound Protein 2",
    "function": "Adaptor protein linking receptor tyrosine kinases (RTKs) to the Ras-MAPK signaling cascade. Essential for growth factor signal transduction.",
    "pathways": ["MAPK signaling", "PI3K-Akt signaling", "RTK signaling"],
    "drug_targets": ["Sorafenib (targets downstream Raf)", "Lenvatinib (upstream RTK inhibitor)"],
    "hcc_role": "Amplifies proliferative signaling in HCC. Connects hypoxia-driven growth factor release to downstream MAPK activation, linking oxygen sensing to tumor cell division."
  },
  "HK2": {
    "full_name": "Hexokinase 2",
    "function": "Phosphorylates glucose to glucose-6-phosphate, the first committed step of glycolysis. Localizes to the outer mitochondrial membrane, coupling glycolysis to mitochondrial function.",
    "pathways": ["Glycolysis", "HIF-1 signaling", "Apoptosis regulation"],
    "drug_targets": ["2-DG (2-Deoxyglucose, competitive inhibitor)", "3-BrPA (alkylating agent)", "Lonidamine"],
    "hcc_role": "HIF-1 target gene upregulated in hypoxic HCC. Drives the glycolytic switch and inhibits apoptosis by binding voltage-dependent anion channels on mitochondria."
  },
  "SENP1": {
    "full_name": "SUMO-Specific Peptidase 1",
    "function": "De-SUMOylation enzyme that removes SUMO modifications from target proteins, including HIF-1alpha. Regulates protein stability and transcriptional activity under hypoxia.",
    "pathways": ["SUMOylation", "HIF-1 regulation", "Protein modification"],
    "drug_targets": ["Momordin I (SENP1 inhibitor, experimental)", "Triptolide (indirect)"],
    "hcc_role": "Stabilizes HIF-1alpha by removing SUMO tags that mark it for degradation. SENP1 overexpression in HCC amplifies the hypoxic transcriptional response even under mild oxygen deprivation."
  },
  "CDC42": {
    "full_name": "Cell Division Cycle 42",
    "function": "Small Rho-family GTPase controlling cytoskeletal dynamics, cell polarity, and migration. Regulates actin polymerization and filopodia formation.",
    "pathways": ["Rho GTPase signaling", "Cell migration", "Wnt signaling"],
    "drug_targets": ["CASIN (CDC42 inhibitor)", "ZCL278 (selective inhibitor)"],
    "hcc_role": "Promotes HCC invasion and metastasis by reorganizing the actin cytoskeleton. Hypoxia-induced CDC42 activation enables tumor cell migration through extracellular matrix."
  },
  "GC": {
    "full_name": "GC Vitamin D Binding Protein (DBP)",
    "function": "Major plasma carrier of vitamin D metabolites. Also functions as a macrophage activating factor (GcMAF) and actin scavenger after tissue injury.",
    "pathways": ["Vitamin D transport", "Macrophage activation", "Actin scavenging"],
    "drug_targets": ["Vitamin D supplementation (modulates GC levels)"],
    "hcc_role": "Protective factor with HR < 1 (0.763). Liver-synthesized protein whose loss reflects hepatocyte dysfunction. Low GC expression correlates with advanced HCC stage and impaired macrophage-mediated tumor clearance."
  },
  "EPO": {
    "full_name": "Erythropoietin",
    "function": "Glycoprotein hormone that stimulates red blood cell production in response to hypoxia. Canonical HIF target gene and the classical marker of oxygen-sensing pathway activation.",
    "pathways": ["HIF-1 signaling", "Erythropoiesis", "JAK-STAT signaling"],
    "drug_targets": ["Recombinant EPO (supportive care)", "Roxadustat (PHD inhibitor, indirect)"],
    "hcc_role": "The textbook HIF-1 target. Ectopic EPO expression in HCC confirms functional activation of the altitude-adaptation oxygen-sensing axis in tumor tissue."
  },
  "AEBP2": {
    "full_name": "AE Binding Protein 2",
    "function": "Accessory component of the Polycomb Repressive Complex 2 (PRC2) that catalyzes histone H3K27 trimethylation. Regulates epigenetic silencing of developmental and tumor suppressor genes.",
    "pathways": ["PRC2 complex", "Epigenetic silencing", "H3K27me3 regulation"],
    "drug_targets": ["Tazemetostat (EZH2 inhibitor, targets PRC2 catalytic subunit)"],
    "hcc_role": "Enhances PRC2-mediated silencing of tumor suppressor genes in HCC. Connects hypoxia-driven epigenetic reprogramming to long-term transcriptional changes that sustain tumor phenotype."
  }
}
```

---

### 2b. Cell Type Detail Panel (shown on cell click)

**Layout**: Right-side panel, 320px wide.

```
+-----------------------------------------------+
| [x close]                                      |
|                                                 |
| CELL TYPE NAME (e.g., Macrophages)              |
| [SPECIALIST] tag if applicable                  |
|                                                 |
| --- Hypoxia Profile ---                         |
| Hypoxia Score       169.1 (mean across tissues) |
| Max Hypoxia Score   367.4 (in adipose tissue)   |
| ROS Signature Score  134.1                      |
| Altitude Sig Score   181.5                      |
| HIF Targets Score    151.6                      |
|                                                 |
| --- Specialist Status ---                       |
| Top-quartile in N tissues for:                  |
|   Hypoxia: 14 tissues                           |
|   ROS: 18 tissues                               |
|   Altitude: 19 tissues                          |
|   HIF targets: 11 tissues                       |
|                                                 |
| --- Tissue Distribution ---                     |
| (Horizontal bar chart, sorted by score)         |
| adipose tissue  367.4  ========                 |
| breast          184.6  =====                    |
| testis          206.9  ======                   |
| ... (all tissues where this cell type appears)  |
|                                                 |
| --- HCC Relevance ---                           |
| Role in liver tumor microenvironment:           |
| "Tumor-associated macrophages (TAMs) are the    |
| most abundant immune cells in HCC. They adopt   |
| a pro-tumorigenic M2 phenotype under hypoxia,   |
| suppressing cytotoxic T-cell activity and        |
| promoting angiogenesis."                        |
|                                                 |
| --- Immune Interaction ---                      |
| Correlation with ROS risk score in TCGA-LIHC:   |
| Spearman r = -0.100, p = 0.080                  |
| Direction: depleted in high-risk patients        |
|                                                 |
| [View in Patient Landscape ->]                  |
+-----------------------------------------------+
```

**Data fields required per cell type**:
- `cell_type`: name (from specialists.json, cross_tissue.json)
- `is_specialist`: boolean, whether top-quartile in 3+ tissues
- `specialist_counts`: per gene set (hypoxia, ros, altitude, hif_targets)
- `specialist_tissues`: tissue list per gene set
- `tissue_scores`: from cross_tissue.json (tissue-to-score mapping)
- `mean_score`, `max_score`: from specialists.json
- `hcc_role`: 2-3 sentence description of role in HCC microenvironment (new data needed)
- `immune_correlation`: from immune.json (Spearman r, p-value with risk score)

**New data file needed**: `data/cells/annotations.json` containing `hcc_role` descriptions for at least the top 10 cell types (macrophages, fibroblasts, T-cells, smooth muscle cells, endothelial cells, paneth cells, plasma cells, granulocytes, NK-cells, B-cells).

---

### 2c. Patient Detail Panel (enhanced from current)

**Layout**: Right-side panel, 340px wide, scrollable.

```
+-----------------------------------------------+
| [x close]                                      |
|                                                 |
| PATIENT ID (e.g., TCGA-BC-A10Q)                |
| Status: ALIVE / DECEASED                        |
|                                                 |
| --- Clinical Profile ---                        |
| Survival     42.3 months                        |
| Stage        Stage II                           |
| Grade        G2                                 |
| Age          58                                 |
| Gender       Male                               |
|                                                 |
| --- Risk Stratification ---                     |
| ROS Risk Score        0.847   [HIGH]            |
| Altitude Risk Score   0.523   [HIGH]            |
| Combined Risk Group   HIGH-HIGH                 |
| (bar showing position relative to cohort        |
|  distribution, with median line marked)         |
|                                                 |
| --- Signature Gene Expression ---               |
| (Horizontal bar chart, all 20 genes)            |
| Color-coded: green = altitude, red = ROS,       |
|   gold = HMOX1                                  |
| Sorted by expression level, normalized to       |
| cohort z-scores                                 |
|                                                 |
| --- Immune Microenvironment ---                 |
| Top 3 enriched immune cell types:               |
|   Macrophages    [enriched bar]                  |
|   T helper cells [enriched bar]                  |
|   DCs            [enriched bar]                  |
| Top 3 depleted immune cell types:               |
|   NK cells       [depleted bar]                  |
|   Th17           [depleted bar]                  |
|   Cytotoxic      [depleted bar]                  |
|                                                 |
| --- Predicted Drug Sensitivity ---              |
| (Top 5 drugs by predicted sensitivity)          |
| Drug name | IC50 | Sensitivity rank             |
| Color: green = sensitive, red = resistant        |
|                                                 |
| [Close]                                         |
+-----------------------------------------------+
```

**Data fields required per patient**:
- `id`, `survival_months`, `is_deceased`: from risk_scores.json
- `stage`, `grade`, `age`, `gender`: from clinical.json
- `ros_score`, `alt_score`: from risk_scores.json
- `risk_group`: computed from median split (high-high, high-low, low-high, low-low)
- `expression`: all 20 gene values from expression.json
- `immune_profile`: from immune.json (ssGSEA scores per immune cell type)
- `drug_sensitivity`: top predicted drug responses from drug_sensitivity.json

---

### 2d. Summary Statistics Panel (always visible, bottom-right corner)

**Layout**: Compact floating panel, semi-transparent, 220px wide.

```
+---------------------------------------+
| RESEARCH SUMMARY                      |
|                                       |
| 20  prognostic genes                  |
|  9  altitude adaptation signature     |
| 11  ROS/ferroptosis signature         |
|  1  bridge gene (HMOX1)              |
|                                       |
| 85  cell types profiled               |
| 14  human tissues                     |
|                                       |
| 302 TCGA-LIHC patients (training)     |
| 648 patients across 4 validation      |
|     cohorts                           |
|                                       |
| C-index                               |
|  0.671  Altitude signature            |
|  0.700  ROS/Ferroptosis signature     |
|                                       |
| Data: TCGA, HPA, CellxGene           |
+---------------------------------------+
```

**This panel should**:
- Be always visible in the bottom-right corner
- Have reduced opacity (0.7) until hovered
- Use the monospace font for numbers
- Fade slightly when the detail panel is open (to avoid visual competition)

---

## 3. Sidebar "About This Research" Section

**Position**: Replace the current generic "About" text in `#info-panel`.

**Text**:

> Hepatocellular carcinoma (HCC) thrives in hypoxic conditions by activating oxygen-sensing pathways originally shaped by millennia of human altitude adaptation. This research identifies two LASSO-Cox prognostic signatures, a 9-gene altitude adaptation set (C-index 0.671) and an 11-gene ROS/ferroptosis set (C-index 0.700), that predict overall survival across four independent cohorts totaling 648 patients. HMOX1 bridges both signatures, linking evolutionary oxygen sensing to tumor redox biology. The signatures further connect to immune microenvironment composition and predicted drug sensitivity, opening avenues for precision ferroptosis-based therapy in HCC.

---

## 4. Scale-Specific Context Text

These replace the generic sidebar info text when each scale is active.

### Gene Universe (active)

> You are viewing 20 prognostic genes arranged by expression correlation strength. Green nodes belong to the 9-gene altitude adaptation signature, built from genes under positive selection in Tibetan, Andean, and Ethiopian highland populations. Red nodes form the 11-gene ROS/ferroptosis signature, capturing tumor oxidative stress defense. HMOX1 (gold) appears in both, anchoring the evolutionary-to-oncogenic connection. Node size reflects the absolute LASSO coefficient; edge opacity reflects Pearson correlation between gene pairs in TCGA-LIHC.

### Cell Atlas (active)

> You are viewing 85 cell types from the Human Protein Atlas, positioned in 3D by their mean ROS-signature expression, altitude-signature expression, and hypoxia enrichment score. Purple-highlighted cells are "hypoxia specialists" that rank in the top quartile for hypoxia gene programs across 3 or more tissues. Macrophages dominate this category, consistent with their known role as hypoxia-responsive immune sentinels in the tumor microenvironment. The spatial clustering reveals which cell types co-activate the altitude and ROS programs versus those that activate only one.

### Patient Landscape (active)

> You are viewing 302 TCGA-LIHC patients mapped into a 3D risk space. The X-axis encodes ROS/ferroptosis risk score, the Y-axis encodes altitude adaptation risk score, and the Z-axis shows the divergence between the two signatures. Blue spheres are patients alive at last follow-up; red spheres are deceased. The translucent planes mark the cohort median for each risk score, dividing the space into prognostic quadrants. Patients in the high-ROS, high-altitude quadrant show the worst overall survival (HR > 2.0, log-rank p < 0.001).

---

## 5. Implementation Notes

### File Changes Required

**Existing files to modify**:
1. `index.html` - Add summary statistics panel HTML, restructure info panel for scale-specific text, add key-insight div to tour card
2. `js/components/tour.js` - Replace tour steps with new narrative, add `keyInsight` field
3. `js/app.js` - Implement scale-specific sidebar text updates, enhanced detail panels for genes and cells (not just patients), summary statistics panel logic
4. `css/main.css` - Styles for summary stats panel, enhanced detail panels, key-insight callout in tour card

**New files to create**:
1. `data/genes/annotations.json` - Gene function, pathways, drug targets, HCC roles (content provided above)
2. `data/cells/annotations.json` - Cell type HCC roles and immune interaction descriptions

### Tour Card Enhancement

Add a `keyInsight` field to each tour step and render it as a visually distinct callout within the tour card:

```html
<!-- Inside .tour-card -->
<div class="tour-insight" id="tour-insight">
    <span class="insight-label">KEY INSIGHT</span>
    <p class="insight-text" id="tour-insight-text"></p>
</div>
```

```css
.tour-insight {
    background: rgba(100, 120, 255, 0.08);
    border-left: 3px solid var(--accent);
    padding: 0.6rem 0.8rem;
    margin: 0.5rem 0 1rem;
    border-radius: 0 6px 6px 0;
}
.insight-label {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--accent);
    text-transform: uppercase;
    display: block;
    margin-bottom: 0.25rem;
}
.insight-text {
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--text);
    margin: 0;
}
```

### Updated Tour Steps Data Structure

```javascript
export const TOUR_STEPS = [
    {
        scale: 'genes',
        title: 'From Thin Air to Tumor',
        text: 'For thousands of years, populations in Tibet, the Andes, and the Ethiopian highlands evolved genetic adaptations to survive chronic low-oxygen environments. These 20 genes encode oxygen-sensing, glycolytic, and redox-balancing programs central to hypoxia survival. Liver tumors, starved of oxygen as they outgrow their blood supply, activate the very same pathways. What evolution built for survival at 5,000 meters, cancer co-opts for survival in the hypoxic tumor core.',
        keyInsight: 'HMOX1, the gold node, appears in both the altitude adaptation and ROS/ferroptosis signatures. It is the molecular bridge linking evolutionary oxygen sensing to tumor oxidative stress defense.',
    },
    {
        scale: 'cells',
        title: 'The Cells That Breathe Fire',
        text: 'Across 14 human tissues and 85 cell types profiled by the Human Protein Atlas, macrophages emerge as universal hypoxia specialists. They rank in the top quartile for hypoxia gene expression in all 14 tissues examined, and in the top quartile for altitude-signature expression across 19 tissues. This is not a liver-specific phenomenon; it is a conserved program. In the tumor microenvironment, these macrophage hypoxia programs shape immune evasion and therapy resistance.',
        keyInsight: 'Macrophages are top-quartile hypoxia specialists in 14 of 14 tissues, making them the most consistent cellular responders to oxygen stress across the entire human body.',
    },
    {
        scale: 'patients',
        title: 'A Landscape of Risk',
        text: 'Each sphere represents one of 302 TCGA liver cancer patients, positioned by their ROS risk score, altitude risk score, and the divergence between the two signatures. Patients in the high-ROS, high-altitude quadrant show significantly worse overall survival. The two translucent planes mark the median risk thresholds; crossing both places a patient in the highest-risk group. This stratification replicates across four independent cohorts totaling 648 patients.',
        keyInsight: 'The combined ROS/ferroptosis signature achieves a C-index of 0.700, outperforming TNM staging alone and validated across ICGC-LIRI, GSE14520, GSE76427, and the TCGA training set.',
    },
    {
        scale: 'genes',
        title: 'Evolution as Prognostic Tool',
        text: 'This visualization encodes a single research thread: genes shaped by millennia of altitude adaptation predict liver cancer outcomes with clinically meaningful accuracy. The 9-gene altitude signature (C-index 0.671) and the 11-gene ROS/ferroptosis signature (C-index 0.700) were built with LASSO-Cox regression and validated independently. These signatures connect to drug-targetable pathways including ferroptosis induction, glutathione metabolism, and immune checkpoint modulation.',
        keyInsight: 'Two prognostic signatures, 20 genes, 4 validation cohorts, 648 patients. The altitude-to-cancer axis is both biologically grounded and clinically actionable.',
    },
];
```

### Priority Implementation Order

1. Create `data/genes/annotations.json` (gene detail data)
2. Update `js/components/tour.js` with new narrative and keyInsight field
3. Update `index.html` to add summary stats panel and tour insight div
4. Update `css/main.css` with new component styles
5. Update `js/app.js` to wire scale-specific sidebar text, enhanced gene/cell detail panels, and summary stats
6. Create `data/cells/annotations.json` (cell type annotations)
