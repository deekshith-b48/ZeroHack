import os
import json
import glob # For finding files

import config # For logger

logger = config.get_logger(__name__)

# Directory where feedback logs are stored (consistent with feedback_logger.py)
FEEDBACK_LOGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "feedback_logs")
# Directory to potentially store processed retraining data (optional for this phase)
# RETRAINING_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "retraining_data")


def collect_feedback_for_retraining(processed_feedback_file_tracker="feedback_logs/.processed_feedback.txt"):
    """
    Scans the feedback_logs directory for new feedback files, parses them,
    and collects the data for potential retraining.

    Args:
        processed_feedback_file_tracker (str): Path to a file that lists already processed feedback files.
                                              This helps avoid reprocessing the same feedback.
    Returns:
        list: A list of dictionaries, where each dictionary contains the parsed content
              of a new feedback file (original_features, user_feedback, incident_identifier).
    """
    if not os.path.exists(FEEDBACK_LOGS_DIR):
        logger.warning(f"Feedback logs directory not found: {FEEDBACK_LOGS_DIR}. No feedback to process.")
        return []

    processed_files = set()
    try:
        if os.path.exists(processed_feedback_file_tracker):
            with open(processed_feedback_file_tracker, 'r') as f_tracker:
                processed_files = set(line.strip() for line in f_tracker)
        logger.info(f"Loaded {len(processed_files)} previously processed feedback file names.")
    except Exception as e:
        logger.error(f"Error reading processed feedback tracker file {processed_feedback_file_tracker}: {e}")
        # Continue without tracking if file is corrupted or unreadable, might reprocess.

    collected_feedback_data = []
    newly_processed_files = []

    # Find all JSON files in the feedback logs directory
    feedback_files = glob.glob(os.path.join(FEEDBACK_LOGS_DIR, "feedback_*.json"))
    logger.info(f"Found {len(feedback_files)} total feedback files in {FEEDBACK_LOGS_DIR}.")

    for filepath in feedback_files:
        filename = os.path.basename(filepath)
        if filename in processed_files:
            # logger.debug(f"Skipping already processed feedback file: {filename}")
            continue

        logger.info(f"Processing new feedback file: {filename}")
        try:
            with open(filepath, 'r') as f:
                feedback_content = json.load(f)

            # Basic validation of content (can be expanded)
            if not all(k in feedback_content for k in ['incident_identifier', 'original_features', 'user_feedback']):
                logger.warning(f"Skipping file {filename}: Missing one or more required keys "
                               f"('incident_identifier', 'original_features', 'user_feedback').")
                continue

            collected_feedback_data.append(feedback_content)
            newly_processed_files.append(filename)
            logger.debug(f"Successfully parsed and collected feedback from {filename}.")

        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON from file: {filepath}. Skipping.")
        except Exception as e:
            logger.error(f"Unexpected error processing file {filepath}: {e}", exc_info=True)

    # Update the processed files tracker
    if newly_processed_files:
        try:
            with open(processed_feedback_file_tracker, 'a') as f_tracker:
                for fname in newly_processed_files:
                    f_tracker.write(f"{fname}\n")
            logger.info(f"Updated processed feedback tracker with {len(newly_processed_files)} new files.")
        except Exception as e:
            logger.error(f"Error updating processed feedback tracker file {processed_feedback_file_tracker}: {e}")


    logger.info(f"Collected {len(collected_feedback_data)} new feedback entries for potential retraining.")
    return collected_feedback_data


def structure_data_for_models(collected_feedback: list):
    """
    (Placeholder for future development)
    Processes collected feedback and structures it into datasets suitable for
    retraining specific AI models.

    For unsupervised models (IF, AE, LSTM):
    - False Positives: Identify features of normal data that were misclassified. These can be added
      to the respective model's training set to learn these as normal patterns.
    - False Negatives: Harder to use directly for unsupervised retraining. Might indicate need for
      new signatures, feature engineering, or threshold adjustments.
    - Corrected Attack Type: Primarily useful if we evolve to supervised classifiers for specific attack types.

    Args:
        collected_feedback (list): List of feedback data dictionaries.

    Returns:
        dict: A dictionary where keys are model names (e.g., "IsolationForest_Normal", "Autoencoder_Normal")
              and values are lists of feature sets (e.g., lists of lists, or DataFrames).
    """
    logger.info("Structuring data for models (initial phase - logging content)...")

    # Example: Segregate data based on feedback type
    if_false_positives_features = []
    ae_lstm_false_positives_features = []
    # ... other categories as needed ...

    for feedback_item in collected_feedback:
        incident_id = feedback_item.get('incident_identifier')
        features = feedback_item.get('original_features')
        feedback = feedback_item.get('user_feedback')

        if not features or not feedback:
            logger.warning(f"Skipping feedback for {incident_id} due to missing features or feedback details.")
            continue

        logger.info(f"  Feedback for Incident ID: {incident_id}")
        logger.info(f"    Original Features (sample): {dict(list(features.items())[:3])}...") # Log sample
        logger.info(f"    User Feedback: {feedback}")

        if feedback.get("is_false_positive"):
            logger.info(f"    Marked as FALSE POSITIVE. Features could be added to 'normal' training sets.")
            # Depending on which model made the original error (not explicitly tracked here yet),
            # these features might be suitable for different retraining sets.
            # For now, just log.
            # if model_type == 'IsolationForest': if_false_positives_features.append(features)
            # elif model_type in ['Autoencoder', 'LSTM']: ae_lstm_false_positives_features.append(features)

        if feedback.get("is_false_negative"):
            logger.info(f"    Marked as FALSE NEGATIVE. Features: {features}. Label: {feedback.get('corrected_attack_type', 'Unknown Attack')}")
            # This data is valuable for creating supervised datasets or new signatures.

        if feedback.get("corrected_attack_type") and not feedback.get("is_false_positive") and not feedback.get("is_false_negative"):
            logger.info(f"    Marked as MISCLASSIFIED. Features: {features}. Corrected Type: {feedback.get('corrected_attack_type')}")
            # Also valuable for supervised learning.

    # In a real scenario, you would return structured data like:
    # return {
    #     "IsolationForest_normal_retrain_data": pd.DataFrame(if_false_positives_features),
    #     "Autoencoder_normal_retrain_data": pd.DataFrame(ae_lstm_false_positives_features),
    #     # ... etc.
    # }
    return {} # Placeholder for now

if __name__ == '__main__':
    logger.info("Running Retrainer Data Collection Test...")

    # Ensure the feedback_logs directory exists for the test
    if not os.path.exists(FEEDBACK_LOGS_DIR):
        os.makedirs(FEEDBACK_LOGS_DIR)
        logger.info(f"Created directory: {FEEDBACK_LOGS_DIR}")

    # Create some dummy feedback files if they don't exist to simulate prior feedback
    dummy_file_1_path = os.path.join(FEEDBACK_LOGS_DIR, "feedback_testinc001_20230101_100000_000000.json")
    if not os.path.exists(dummy_file_1_path):
        with open(dummy_file_1_path, 'w') as f:
            json.dump({
                "incident_identifier": "testinc001",
                "original_features": {"featA": 1.0, "featB": 2.0, "source_ip": "1.1.1.1"},
                "user_feedback": {"is_false_positive": True, "notes": "User confirmed normal"}
            }, f, indent=2)
        logger.info(f"Created dummy feedback file: {dummy_file_1_path}")

    dummy_file_2_path = os.path.join(FEEDBACK_LOGS_DIR, "feedback_testinc002_20230101_110000_000000.json")
    if not os.path.exists(dummy_file_2_path):
         with open(dummy_file_2_path, 'w') as f:
            json.dump({
                "incident_identifier": "testinc002",
                "original_features": {"featA": 10.5, "featB": 20.5, "source_ip": "2.2.2.2"},
                "user_feedback": {"is_false_negative": True, "corrected_attack_type": "Stealth Scan", "notes": "Missed by AI"}
            }, f, indent=2)
         logger.info(f"Created dummy feedback file: {dummy_file_2_path}")

    # Optionally, reset the tracker file for a clean test run of collection
    tracker_file = os.path.join(FEEDBACK_LOGS_DIR, ".processed_feedback.txt")
    if os.path.exists(tracker_file):
        logger.info(f"Removing existing tracker file for clean test: {tracker_file}")
        os.remove(tracker_file)


    collected_data = collect_feedback_for_retraining(processed_feedback_file_tracker=tracker_file)

    if collected_data:
        logger.info(f"\n--- Collected {len(collected_data)} feedback entries: ---")
        for item in collected_data:
            logger.info(f"  Incident ID: {item.get('incident_identifier')}, User Notes: {item.get('user_feedback', {}).get('notes', 'N/A')}")

        # Further process this data (placeholder for now)
        structured_model_data = structure_data_for_models(collected_data)
        if structured_model_data: # Will be empty for now
            logger.info("\n--- Structured Data for Models (Example Keys) ---")
            for model_key, data_list in structured_model_data.items():
                logger.info(f"  {model_key}: {len(data_list)} items")
        else:
            logger.info("\nNo specific model data structured in this initial phase (logged details above).")

    else:
        logger.info("No new feedback data collected in this run (or FEEDBACK_LOGS_DIR is empty/all processed).")

    logger.info("\nRetrainer Data Collection Test complete.")
    logger.info(f"To re-run and re-process, delete the tracker file: {os.path.abspath(tracker_file)}")
