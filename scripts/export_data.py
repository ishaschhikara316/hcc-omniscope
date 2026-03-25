#!/usr/bin/env python3
"""Export data from hcc-explorer and sc-hypoxia-atlas into optimized JSON for HCC OmniScope."""

import json
import csv
import os
from pathlib import Path

# Paths
BASE = Path(__file__).resolve().parent.parent.parent  # projects/
EXPLORER = BASE / "hcc-explorer" / "data"
ATLAS = BASE / "sc-hypoxia-atlas" / "results" / "tables"
OUT = Path(__file__).resolve().parent.parent / "data"


import math

def round_val(v, n=3):
    """Round numeric values for compact JSON. Replace NaN/Inf with None."""
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return round(v, n)
    return v


def export_gene_data():
    """Export gene coefficients, hazard ratios, and correlations."""
    print("Exporting gene data...")

    # Hazard ratios — already JSON, just copy and slim down
    with open(EXPLORER / "hazard_ratios.json") as f:
        hr_data = json.load(f)
    # Round floats
    for sig in hr_data:
        for gene_entry in hr_data[sig]:
            for k, v in gene_entry.items():
                gene_entry[k] = round_val(v)
    with open(OUT / "genes" / "hazard_ratios.json", "w") as f:
        json.dump(hr_data, f, separators=(",", ":"))
    print(f"  hazard_ratios.json written")

    # Correlations — already JSON
    with open(EXPLORER / "correlation_matrices.json") as f:
        corr_data = json.load(f)
    # Round nested values
    for sig in corr_data:
        if isinstance(corr_data[sig], dict):
            genes = corr_data[sig].get("genes", [])
            matrix = corr_data[sig].get("matrix", [])
            corr_data[sig]["matrix"] = [[round(v, 3) for v in row] for row in matrix]
    with open(OUT / "genes" / "correlations.json", "w") as f:
        json.dump(corr_data, f, separators=(",", ":"))
    print(f"  correlations.json written")

    # Coefficients — from parquet
    try:
        import pandas as pd
        coef_df = pd.read_parquet(EXPLORER / "model_coefficients.parquet")
        coef_dict = {}
        for _, row in coef_df.iterrows():
            entry = {}
            for col in coef_df.columns:
                val = row[col]
                if hasattr(val, 'item'):
                    val = val.item()
                entry[col] = round_val(val)
            key = entry.get("gene", entry.get("Gene", str(_)))
            coef_dict[key] = entry
        with open(OUT / "genes" / "coefficients.json", "w") as f:
            json.dump(coef_dict, f, separators=(",", ":"))
        print(f"  coefficients.json written ({len(coef_dict)} genes)")
    except ImportError:
        print("  WARNING: pandas not available, skipping coefficients.parquet export")
        # Create from hazard_ratios as fallback
        coef_dict = {}
        for sig in hr_data:
            for gene_entry in hr_data[sig]:
                gene = gene_entry["gene"]
                coef_dict[gene] = {
                    "gene": gene,
                    "signature": sig,
                    "coef": gene_entry.get("coef", 0),
                    "hazard_ratio": gene_entry.get("hazard_ratio", 1),
                }
        with open(OUT / "genes" / "coefficients.json", "w") as f:
            json.dump(coef_dict, f, separators=(",", ":"))
        print(f"  coefficients.json written from HR data ({len(coef_dict)} genes)")


def export_cell_data():
    """Export cell type coactivation, specialists, and tissue matrices."""
    print("Exporting cell data...")

    # ROS-altitude coactivation
    coact = []
    with open(ATLAS / "ros_altitude_coactivation.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            coact.append({
                "cell_type": row["cell_type"],
                "ros_mean": round(float(row["ros_mean"]), 3),
                "altitude_mean": round(float(row["altitude_mean"]), 3),
            })
    with open(OUT / "cells" / "coactivation.json", "w") as f:
        json.dump(coact, f, separators=(",", ":"))
    print(f"  coactivation.json written ({len(coact)} cell types)")

    # Hypoxia specialists
    specialists = []
    with open(ATLAS / "hypoxia_specialists.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            specialists.append({
                "cell_type": row["cell_type"],
                "n_tissues_top_quartile": int(row["n_tissues_top_quartile"]),
                "tissues": row["tissues_top_quartile"],
                "mean_score": round(float(row["mean_score"]), 3),
                "max_score": round(float(row["max_score"]), 3),
                "source": row["source"],
                "gene_set": row["gene_set"],
            })
    with open(OUT / "cells" / "specialists.json", "w") as f:
        json.dump(specialists, f, separators=(",", ":"))
    print(f"  specialists.json written ({len(specialists)} entries)")

    # Cross-tissue scores (cell_type x tissue matrix)
    cross_tissue = {}
    with open(ATLAS / "cross_tissue_scores.csv") as f:
        reader = csv.DictReader(f)
        tissues = [col for col in reader.fieldnames if col != "cell_type"]
        for row in reader:
            ct = row["cell_type"]
            scores = {}
            for t in tissues:
                val = float(row[t])
                if val > 0:
                    scores[t] = round(val, 2)
            if scores:
                cross_tissue[ct] = scores
    with open(OUT / "cells" / "cross_tissue.json", "w") as f:
        json.dump(cross_tissue, f, separators=(",", ":"))
    print(f"  cross_tissue.json written ({len(cross_tissue)} cell types)")

    # Signature gene tissue matrix
    gene_tissue = {}
    with open(ATLAS / "signature_gene_tissue_matrix.csv") as f:
        reader = csv.DictReader(f)
        tissues = [col for col in reader.fieldnames if col != "gene"]
        for row in reader:
            gene = row["gene"]
            expr = {}
            for t in tissues:
                val = float(row[t])
                if val > 0:
                    expr[t] = round(val, 2)
            gene_tissue[gene] = expr
    with open(OUT / "cells" / "gene_tissue_matrix.json", "w") as f:
        json.dump(gene_tissue, f, separators=(",", ":"))
    print(f"  gene_tissue_matrix.json written ({len(gene_tissue)} genes)")


def export_patient_data():
    """Export patient risk scores, clinical, immune, drug, and KM data."""
    print("Exporting patient data...")

    # Risk scores — already JSON, copy
    with open(EXPLORER / "risk_scores.json") as f:
        risk = json.load(f)
    with open(OUT / "patients" / "risk_scores.json", "w") as f:
        json.dump(risk, f, separators=(",", ":"))
    print(f"  risk_scores.json copied")

    # KM curves — already JSON, copy
    with open(EXPLORER / "km_curves.json") as f:
        km = json.load(f)
    with open(OUT / "patients" / "km_curves.json", "w") as f:
        json.dump(km, f, separators=(",", ":"))
    print(f"  km_curves.json copied")

    # Clinical, immune, drug sensitivity — from parquet
    try:
        import pandas as pd

        # Clinical
        clinical_df = pd.read_parquet(EXPLORER / "clinical.parquet")
        clinical = []
        for _, row in clinical_df.iterrows():
            entry = {}
            for col in clinical_df.columns:
                val = row[col]
                if hasattr(val, 'item'):
                    val = val.item()
                if isinstance(val, float):
                    val = round(val, 3)
                entry[col] = val
            clinical.append(entry)
        with open(OUT / "patients" / "clinical.json", "w") as f:
            json.dump(clinical, f, separators=(",", ":"), default=str)
        print(f"  clinical.json written ({len(clinical)} patients)")

        # Immune infiltration
        immune_df = pd.read_parquet(EXPLORER / "immune_infiltration.parquet")
        immune = {}
        for _, row in immune_df.iterrows():
            patient_id = row.get("patient_id", row.get("Patient_ID", row.name))
            if hasattr(patient_id, 'item'):
                patient_id = patient_id.item()
            scores = {}
            for col in immune_df.columns:
                if col in ("patient_id", "Patient_ID"):
                    continue
                val = row[col]
                if hasattr(val, 'item'):
                    val = val.item()
                if isinstance(val, (int, float)):
                    scores[col] = round(float(val), 3)
            immune[str(patient_id)] = scores
        with open(OUT / "patients" / "immune.json", "w") as f:
            json.dump(immune, f, separators=(",", ":"))
        print(f"  immune.json written ({len(immune)} patients)")

        # Drug sensitivity
        drug_df = pd.read_parquet(EXPLORER / "drug_sensitivity.parquet")
        drug_data = []
        for _, row in drug_df.iterrows():
            entry = {}
            for col in drug_df.columns:
                val = row[col]
                if hasattr(val, 'item'):
                    val = val.item()
                if isinstance(val, float):
                    val = round(val, 4)
                entry[col] = val
            drug_data.append(entry)
        with open(OUT / "patients" / "drug_sensitivity.json", "w") as f:
            json.dump(drug_data, f, separators=(",", ":"), default=str)
        print(f"  drug_sensitivity.json written ({len(drug_data)} entries)")

    except ImportError:
        print("  WARNING: pandas not available, skipping parquet exports")


def main():
    print(f"Source: hcc-explorer at {EXPLORER}")
    print(f"Source: sc-hypoxia-atlas at {ATLAS}")
    print(f"Output: {OUT}")
    print()

    export_gene_data()
    print()
    export_cell_data()
    print()
    export_patient_data()
    print()
    print("Done! All JSON files exported to data/")


if __name__ == "__main__":
    main()
