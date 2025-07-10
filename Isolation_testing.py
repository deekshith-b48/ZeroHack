import numpy as np
import joblib
import os
import config # Import new config file

logger = config.get_logger(__name__)

# Paths are now sourced from config.py
# model_path = os.path.join(data_dir, "isolation_forest_model.pkl") # Old path
# scaler_path = os.path.join(data_dir, "scaler.pkl") # Old path, also name was not standardized

def main():
    logger.info("Starting Isolation Forest testing script.")

    # ------------------ Load Model & Scaler ------------------
    if not os.path.exists(config.IF_MODEL_PATH):
        logger.error(f"Model not found at {config.IF_MODEL_PATH}. Cannot perform test.")
        return
    if not os.path.exists(config.IF_SCALER_PATH):
        logger.error(f"Scaler not found at {config.IF_SCALER_PATH}. Cannot perform test.")
        return

    try:
        model = joblib.load(config.IF_MODEL_PATH)
        scaler = joblib.load(config.IF_SCALER_PATH)
        logger.info("✅ Model and scaler loaded successfully.")
    except Exception as e:
        logger.error(f"Error loading model or scaler: {e}")
        return

    # ------------------ Create Synthetic Malicious Sample ------------------
    # Simulate outlier by generating high/abnormal values.
    # The model was trained on data scaled to 0-1.
    # This sample should also be scaled before prediction.

    try:
        num_features = scaler.n_features_in_
    except AttributeError:
        logger.error("Scaler does not have 'n_features_in_' attribute. Maybe it's not a scikit-learn scaler?")
        # Attempt to get num_features from the model if possible, though this is less direct
        if hasattr(model, 'n_features_in_'):
            num_features = model.n_features_in_
            logger.warning(f"Using n_features_in_ from model: {num_features}")
        else:
            logger.error("Cannot determine number of features from scaler or model. Exiting.")
            return


    # Generate a synthetic malicious-looking sample:
    # Values intentionally outside the typical 0-1 scaled range to represent an anomaly.
    malicious_sample_unscaled = np.random.uniform(low=1.2, high=2.0, size=(1, num_features))

    # Optionally, mix a few values that might be within the 0-1 range post-scaling,
    # but the overall vector should be anomalous.
    # This part depends on understanding what "unusual noise" means in context of features.
    # For simplicity, we'll stick to out-of-range values primarily.
    # Example: make the first 5 features look "normal" if they were scaled, but this sample is PRE-scaling.
    # malicious_sample_unscaled[0, :5] = np.random.uniform(0.0, 0.1, size=5) # This would be for already scaled data

    logger.info(f"Generated synthetic sample (unscaled): {malicious_sample_unscaled[:,:5]}...") # Log first 5 features

    # ------------------ Scale and Predict ------------------
    # Scaling the sample using the same scaler as training
    # The comment "this is intentionally unscaled" was misleading if the model expects scaled input.
    # Correct approach: Scale the synthetic sample just like any other input data.
    try:
        malicious_sample_scaled = scaler.transform(malicious_sample_unscaled)
        logger.info(f"Synthetic sample scaled: {malicious_sample_scaled[:,:5]}...")
    except Exception as e:
        logger.error(f"Error scaling the synthetic sample: {e}")
        return

    # Predict using Isolation Forest
    try:
        prediction = model.predict(malicious_sample_scaled)
    except Exception as e:
        logger.error(f"Error during prediction: {e}")
        return

    # In Isolation Forest: -1 = anomaly, 1 = normal
    result = 'Anomaly' if prediction[0] == -1 else 'Normal'
    logger.info(f"🔍 Prediction for synthetic malicious sample: {result}")

    if result == 'Anomaly':
        logger.info("✅ Test successful: Synthetic malicious sample correctly classified as Anomaly.")
    else:
        logger.warning("⚠️ Test potentially failed: Synthetic malicious sample classified as Normal. Check sample generation or model training.")

    logger.info("Isolation Forest testing script finished.")

if __name__ == "__main__":
    main()
