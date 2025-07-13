import os
import json
import glob
import pandas as pd
import argparse
import logging
from datetime import datetime

# To import train_model, we need to ensure the path is correct.
# Assuming this script is run from the project root.
from ml.training.train_model import train_model

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---
# This assumes a structure where feedback logs and datasets are relative to the project root.
FEEDBACK_LOGS_DIR = "feedback_logs/"
PROCESSED_FEEDBACK_TRACKER = os.path.join(FEEDBACK_LOGS_DIR, ".processed_retrain_feedback.txt")
BASE_DATASET_PATH = "ml/datasets/unsw_nb15/cleaned_unsw_nb15.csv" # The base dataset to augment
MODELS_DIR = "ml/models/"

def collect_and_prepare_feedback_data():
    """
    Collects new feedback and prepares it as a DataFrame.
    This is a simplified version of the logic in `backend/retrainer.py`.
    """
    if not os.path.exists(FEEDBACK_LOGS_DIR):
        logging.warning(f"Feedback logs directory not found: {FEEDBACK_LOGS_DIR}")
        return pd.DataFrame()

    processed_files = set()
    if os.path.exists(PROCESSED_FEEDBACK_TRACKER):
        with open(PROCESSED_FEEDBACK_TRACKER, 'r') as f:
            processed_files = set(line.strip() for line in f)

    new_feedback_records = []
    newly_processed_files = []

    feedback_files = glob.glob(os.path.join(FEEDBACK_LOGS_DIR, "feedback_*.json"))

    for filepath in feedback_files:
        filename = os.path.basename(filepath)
        if filename in processed_files:
            continue

        with open(filepath, 'r') as f:
            data = json.load(f)

        # We need to transform the feedback into a row that matches the training data format.
        # This is highly dependent on the feature set.
        # Let's assume 'original_features' contains the data.
        # And the label is determined by 'user_feedback'.
        features = data.get('original_features', {})
        feedback = data.get('user_feedback', {})

        # Determine the label. This is a crucial step.
        # If it's a false positive, the true label is 'Normal' (or 0).
        # If it's a false negative or misclassified, the label is the corrected type.
        # This requires a mapping from attack type strings to integer labels if the model needs it.
        # For now, let's assume a simple binary case: 1 for any attack, 0 for normal.
        if feedback.get('is_false_positive'):
            features['label'] = 0 # Correct label is Normal
        elif feedback.get('is_false_negative') or feedback.get('corrected_attack_type'):
            features['label'] = 1 # Correct label is Attack
        else:
            # Not enough info in feedback to create a labeled sample, skip.
            continue

        new_feedback_records.append(features)
        newly_processed_files.append(filename)

    if newly_processed_files:
        with open(PROCESSED_FEEDBACK_TRACKER, 'a') as f:
            for fname in newly_processed_files:
                f.write(f"{fname}\n")

    if not new_feedback_records:
        logging.info("No new feedback data to process for retraining.")
        return pd.DataFrame()

    return pd.DataFrame(new_feedback_records)


def run_retraining_cycle(base_dataset_path: str, models_base_dir: str):
    """
    Runs a full retraining cycle:
    1. Collects new feedback data.
    2. Merges it with the base dataset.
    3. Trains a new model.
    4. Updates the 'current_model.pkl' symlink.
    """
    logging.info("--- Starting Retraining Cycle ---")

    # 1. Collect feedback
    feedback_df = collect_and_prepare_feedback_data()
    if feedback_df.empty:
        logging.info("Retraining cycle finished: No new feedback data.")
        return

    # 2. Merge with base dataset
    if not os.path.exists(base_dataset_path):
        logging.error(f"Base dataset not found at {base_dataset_path}. Cannot proceed with retraining.")
        return

    base_df = pd.read_csv(base_dataset_path)
    logging.info(f"Loaded base dataset with {len(base_df)} records.")

    # IMPORTANT: Ensure columns match perfectly.
    # This is a major challenge in real systems. For this script, we assume they align.
    # We align columns based on the base dataset.
    feedback_df_aligned = feedback_df.reindex(columns=base_df.columns, fill_value=0)

    combined_df = pd.concat([base_df, feedback_df_aligned], ignore_index=True)

    # Save the new combined dataset for auditing and future use
    new_dataset_filename = f"combined_dataset_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
    new_dataset_path = os.path.join(os.path.dirname(base_dataset_path), new_dataset_filename)
    combined_df.to_csv(new_dataset_path, index=False)
    logging.info(f"Created new combined dataset for retraining at: {new_dataset_path}")

    # 3. Train a new model
    # Create a new versioned directory for the model
    new_model_version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
    new_model_save_dir = os.path.join(models_base_dir, new_model_version)

    train_model(dataset_path=new_dataset_path, save_dir=new_model_save_dir)

    # 4. Update symlink to point to the new model
    current_model_symlink = os.path.join(models_base_dir, "current_model.pkl")
    new_model_path = os.path.join(new_model_save_dir, "model.pkl")

    if os.path.exists(new_model_path):
        if os.path.lexists(current_model_symlink): # Use lexists for symlinks
            os.remove(current_model_symlink)

        # Create a relative symlink from the new model path to the symlink location
        # This makes the models directory more portable
        relative_model_path = os.path.relpath(new_model_path, start=models_base_dir)
        os.symlink(relative_model_path, current_model_symlink)
        logging.info(f"[✔] Symlink '{current_model_symlink}' updated to point to '{relative_model_path}'")
    else:
        logging.error(f"New model was not found at {new_model_path}. Symlink not updated.")

    logging.info("--- Retraining Cycle Complete ---")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run feedback-based retraining for ZeroHack models.")
    parser.add_argument("--base-dataset", type=str, default=BASE_DATASET_PATH,
                        help="Path to the base training dataset to augment with feedback.")
    parser.add_argument("--models-dir", type=str, default=MODELS_DIR,
                        help="Base directory where versioned models are stored.")

    args = parser.parse_args()

    run_retraining_cycle(base_dataset_path=args.base_dataset, models_base_dir=args.models_dir)
