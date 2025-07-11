import os
import json
import datetime
import uuid # For potentially more unique filenames if needed

import config # For logger

logger = config.get_logger(__name__)

# Define the directory for storing feedback logs relative to the project root
# Assuming this script is in backend/, so ../feedback_logs/
FEEDBACK_LOGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "feedback_logs")


def log_incident_feedback(feedback_data: dict):
    """
    Logs the provided feedback data to a JSON file in the feedback_logs directory.

    Args:
        feedback_data (dict): A dictionary containing the feedback.
                              Expected to include 'incident_identifier',
                              'original_features', and 'user_feedback'.
    Returns:
        str: The path to the saved feedback file if successful, else None.
    """
    if not isinstance(feedback_data, dict):
        logger.error("Invalid feedback_data: Must be a dictionary.")
        return None

    incident_id = feedback_data.get('incident_identifier', 'unknown_incident')

    try:
        # Ensure the feedback_logs directory exists
        os.makedirs(FEEDBACK_LOGS_DIR, exist_ok=True)

        # Create a unique filename
        timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        # Sanitize incident_id for filename, or use a UUID if incident_id can be complex/long
        safe_incident_id = "".join(c if c.isalnum() else "_" for c in str(incident_id))
        filename = f"feedback_{safe_incident_id}_{timestamp_str}.json"
        filepath = os.path.join(FEEDBACK_LOGS_DIR, filename)

        # Write the feedback data to the JSON file
        with open(filepath, 'w') as f:
            json.dump(feedback_data, f, indent=2)

        logger.info(f"Feedback for incident '{incident_id}' successfully logged to: {filepath}")
        return filepath

    except Exception as e:
        logger.error(f"Failed to log feedback for incident '{incident_id}': {e}", exc_info=True)
        return None

if __name__ == '__main__':
    # Example Usage
    logger.info("Testing feedback_logger.py...")

    # Mock data similar to what FeedbackRequest Pydantic model would produce
    sample_feedback_1 = {
        "incident_identifier": "incident_abc_123",
        "original_features": {"feature1": 0.5, "feature2": 120, "source_ip": "1.2.3.4"},
        "user_feedback": {
            "is_false_positive": True,
            "notes": "This was actually normal operational traffic for server X."
        }
    }

    sample_feedback_2 = {
        "incident_identifier": "threat_xyz_789",
        "original_features": {"feature1": 0.9, "SomeFeature2": 500, "source_ip": "5.6.7.8"},
        "user_feedback": {
            "is_false_positive": False,
            "corrected_attack_type": "Specific Malware Variant Y",
            "notes": "Initial classification was too generic."
        }
    }

    sample_feedback_3 = { # Example with a more complex identifier
        "incident_identifier": "ts_2023-10-27T10:30:00_ip_10.20.30.40_type_DDoS",
        "original_features": {"avg_packet_rate": 15000, "unique_sources": 250},
        "user_feedback": {
            "is_false_positive": False,
            "notes": "Confirmed DDoS, but threshold for alert was a bit low."
        }
    }

    log_path1 = log_incident_feedback(sample_feedback_1)
    if log_path1:
        print(f"Sample feedback 1 logged to: {log_path1}")
    else:
        print("Failed to log sample feedback 1.")

    log_path2 = log_incident_feedback(sample_feedback_2)
    if log_path2:
        print(f"Sample feedback 2 logged to: {log_path2}")
    else:
        print("Failed to log sample feedback 2.")

    log_path3 = log_incident_feedback(sample_feedback_3)
    if log_path3:
        print(f"Sample feedback 3 logged to: {log_path3}")
    else:
        print("Failed to log sample feedback 3.")

    # Test invalid input
    log_invalid = log_incident_feedback("not a dict")
    if log_invalid is None:
        print("Correctly handled invalid input for feedback logging.")

    print(f"\nCheck the '{os.path.abspath(FEEDBACK_LOGS_DIR)}' directory for generated log files.")
