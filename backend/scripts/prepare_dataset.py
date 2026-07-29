import os
import json
import pandas as pd
from datasets import load_dataset
import random

# Visible and easily editable mapping from source labels to our taxonomy
LABEL_MAP = {
    "lex_glue": {
        "Arbitration": "arbitration",
        "Unilateral change": "auto_renewal",
        "Limitation of liability": "liability",
        "Unilateral termination": "termination",
        "Contract by using": "none",
        "Jurisdiction": "none",
        "Choice of law": "none",
        "Content removal": "penalty",
        "Other": "none"
    },
    "claudette": {
        "fair": "none",
        "unfair": "none" # We will use keywords to extract data_sharing if it's unfair
    },
    "cuad": {
        "Cap On Liability": "liability",
        "Uncapped Liability": "liability",
        "Termination For Convenience": "termination",
        "Non-Compete": "penalty"
    }
}

# The lex_glue unfair_tos dataset uses index-based labels:
LEX_GLUE_TAGS = [
    "Limitation of liability",
    "Unilateral change",
    "Unilateral termination",
    "Contract by using",
    "Arbitration",
    "Jurisdiction",
    "Choice of law",
    "Content removal"
]

def assign_severity(text: str, category: str) -> str:
    """
    Rule-based logic to assign a severity to a clause.
    This is a heuristic, not a model.
    """
    text_lower = text.lower()
    high_keywords = ["sole discretion", "without notice", "waive", "irrevocable", "binding", "indemnify", "penalty"]
    
    # Mild/procedural or fair clauses are low severity
    if category == "none":
        return "low"
        
    # High severity if it contains extreme keywords
    if any(kw in text_lower for kw in high_keywords):
        return "high"
        
    # Default to medium if flagged but no high severity keywords
    return "medium"

def extract_data_sharing(text: str, current_category: str) -> str:
    """Keyword filter to help populate the 'data_sharing' category."""
    text_lower = text.lower()
    sharing_keywords = ["personal data", "third parties", "share your information", "disclose", "privacy policy"]
    
    if current_category == "none" and any(kw in text_lower for kw in sharing_keywords):
        return "data_sharing"
    return current_category

def main():
    os.makedirs("data", exist_ok=True)
    all_data = []

    # 1. LexGLUE (unfair_tos)
    try:
        print("Loading coastalcph/lex_glue (unfair_tos)...")
        # Load train and validation splits to get more data
        ds_lex = load_dataset("coastalcph/lex_glue", "unfair_tos", split="train+validation")
        for row in ds_lex:
            text = row["text"]
            labels = row["labels"]
            
            if not labels:
                cat = "none"
            else:
                tag_name = LEX_GLUE_TAGS[labels[0]]
                cat = LABEL_MAP["lex_glue"].get(tag_name, "none")
                
            cat = extract_data_sharing(text, cat)
            severity = assign_severity(text, cat)
            all_data.append({"text": text, "category": cat, "severity": severity})
    except Exception as e:
        print(f"Warning: Failed to load coastalcph/lex_glue: {e}")

    # 2. CUAD (The Atticus Project)
    try:
        print("Loading theatticusproject/cuad-qa...")
        ds_cuad = load_dataset("theatticusproject/cuad-qa", split="train")
        for row in ds_cuad:
            text = row["context"]
            question = row["question"]
            
            cat = "none"
            # CUAD asks questions based on the categories
            for k, v in LABEL_MAP["cuad"].items():
                if k.lower() in question.lower():
                    cat = v
                    break
                    
            # We mostly want flagged categories from CUAD, skip 'none' to avoid overwhelming
            if cat != "none":
                cat = extract_data_sharing(text, cat)
                severity = assign_severity(text, cat)
                all_data.append({"text": text, "category": cat, "severity": severity})
    except Exception as e:
        print(f"Warning: Failed to load cuad-qa: {e}")

    # Deduplication and Formatting
    print("Deduplicating chunks...")
    df = pd.DataFrame(all_data)
    
    if len(df) == 0:
        print("Error: No data was loaded at all. Check network connection.")
        return
        
    df = df.drop_duplicates(subset=["text"])
    
    # Cap the "none" examples
    df_none = df[df["category"] == "none"]
    df_flagged = df[df["category"] != "none"]
    
    flagged_count = len(df_flagged)
    print(f"Found {flagged_count} flagged clauses and {len(df_none)} 'none' clauses.")
    
    # Rebalance: none should roughly equal total flagged
    if len(df_none) > flagged_count and flagged_count > 0:
        print(f"Capping 'none' categories to {flagged_count} to prevent class imbalance...")
        df_none = df_none.sample(n=flagged_count, random_state=42)
        
    df_final = pd.concat([df_flagged, df_none]).sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Save Outputs
    csv_path = "data/training.csv"
    json_path = "data/training_summary.json"
    
    print(f"Saving dataset to {csv_path}...")
    df_final.to_csv(csv_path, index=False)
    
    dist = df_final["category"].value_counts().to_dict()
    print("\n--- Label Distribution Summary ---")
    for k, v in dist.items():
        print(f"{k.ljust(15)}: {v}")
        
    with open(json_path, "w") as f:
        json.dump(dist, f, indent=2)
        
    print(f"\nDone! Dataset created successfully. Total rows: {len(df_final)}")

if __name__ == "__main__":
    main()
