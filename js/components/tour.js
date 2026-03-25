/**
 * Guided Research Story Tour - Rich narrative with key insights
 */
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
        text: 'Across 14 human tissues and 85 cell types profiled by the Human Protein Atlas, macrophages emerge as universal hypoxia specialists. They rank in the top quartile for hypoxia gene expression in all 14 tissues examined. This is not a liver-specific phenomenon; it is a deeply conserved myeloid program. In the tumor microenvironment, these macrophage hypoxia programs drive immune evasion and therapy resistance.',
        keyInsight: 'Macrophages are top-quartile hypoxia specialists in 14 of 14 tissues, making them the most consistent cellular responders to oxygen stress across the entire human body.',
    },
    {
        scale: 'patients',
        title: 'A Landscape of Risk',
        text: 'Each sphere represents one of 302 TCGA liver cancer patients, positioned by their ROS risk score, altitude risk score, and the divergence between the two signatures. Patients in the high-ROS, high-altitude quadrant show significantly worse overall survival. The translucent planes mark the median risk thresholds; crossing both places a patient in the highest-risk group. This stratification replicates across four independent cohorts totaling 648 patients.',
        keyInsight: 'The ROS/ferroptosis signature achieves a C-index of 0.700, outperforming TNM staging alone. Validated across ICGC-LIRI (Japan), GSE14520 (China), GSE76427 (Europe), and the TCGA training set.',
    },
    {
        scale: 'genes',
        title: 'Evolution as Prognostic Tool',
        text: 'This visualization encodes a single research thread: genes shaped by millennia of altitude adaptation predict liver cancer outcomes with clinically meaningful accuracy. The 9-gene altitude signature (C-index 0.671) and the 11-gene ROS/ferroptosis signature (C-index 0.700) were built with LASSO-Cox regression and validated independently. These signatures connect to drug-targetable pathways including ferroptosis induction, glutathione metabolism, and immune checkpoint modulation.',
        keyInsight: 'Two prognostic signatures, 20 genes, 4 validation cohorts, 648 patients. The altitude-to-cancer axis is both biologically grounded and clinically actionable.',
    },
];
