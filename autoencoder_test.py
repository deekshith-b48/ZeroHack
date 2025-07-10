import os
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score
from tensorflow.keras.models import load_model
import config # Import new config file

logger = config.get_logger(__name__)

# Anomaly detection threshold percentile (configurable or documented)
# This value (e.g., 90th, 95th, 99th percentile of reconstruction errors on normal data or a validation set)
# is crucial for determining what constitutes an anomaly.
# It should ideally be tuned based on the desired balance of precision/recall for anomalies.
ANOMALY_THRESHOLD_PERCENTILE = 90

def find_label_column(df_columns):
    """Finds a potential label column (case-insensitive)."""
    for col in df_columns:
        if 'label' in col.lower():
            logger.info(f"Found label column: {col}")
            return col
    logger.warning("No column containing 'label' (case-insensitive) found.")
    return None

def main():
    logger.info("Starting Autoencoder testing script.")

    # Ensure data and model directories exist
    os.makedirs(os.path.dirname(config.AE_TEST_FILE), exist_ok=True)
    # config.py ensures MODELS_DIR exists

    # === Load Trained Model and Scaler ===
    if not os.path.exists(config.AE_MODEL_PATH) or not os.path.exists(config.AE_SCALER_PATH):
        logger.error(f"Model ({config.AE_MODEL_PATH}) or scaler ({config.AE_SCALER_PATH}) not found. Exiting.")
        return

    try:
        model = load_model(config.AE_MODEL_PATH)
        scaler = joblib.load(config.AE_SCALER_PATH)
        logger.info("✅ Model and scaler loaded successfully.")
    except Exception as e:
        logger.error(f"Error loading model or scaler: {e}")
        return

    # === Load and Preprocess Test Dataset ===
    if not os.path.exists(config.AE_TEST_FILE):
        logger.error(f"Test data file not found: {config.AE_TEST_FILE}. Exiting.")
        return

    try:
        df_test = pd.read_csv(config.AE_TEST_FILE)
        logger.info(f"Loaded test data from {config.AE_TEST_FILE}, shape: {df_test.shape}")
    except Exception as e:
        logger.error(f"Error loading test data: {e}")
        return

    label_col = find_label_column(df_test.columns)
    if not label_col:
        logger.error("❌ No label column found in test dataset! Cannot perform evaluation with metrics. Will only show MSE.")
        # Fallback: process all numeric columns if no label is found for reconstruction error calculation
        X_df = df_test.select_dtypes(include=[np.number]).copy()
        y_true_aligned = None # No ground truth for metrics
    else:
        y_true_original = df_test[label_col]
        X_df = df_test.select_dtypes(include=[np.number]).copy()
        # Ensure label column is NOT in X_df if it happens to be numeric
        if label_col in X_df.columns:
            X_df = X_df.drop(columns=[label_col])
            logger.info(f"Dropped numeric label column '{label_col}' from feature set X.")

    if X_df.empty:
        logger.error("No numeric features found in the test data after excluding label. Exiting.")
        return

    # Handle NaNs and Infs in features (X_df)
    X_df.replace([np.inf, -np.inf], np.nan, inplace=True)

    # --- Critical step: Align y_true with X_df AFTER NaN handling ---
    # Store original indices before dropping NaNs from X_df to align y_true
    # This is only relevant if y_true_original exists (i.e., label_col was found)
    if y_true_original is not None:
        kept_indices = X_df.dropna().index
        X_df_cleaned = X_df.loc[kept_indices]
        y_true_aligned = y_true_original.loc[kept_indices].values
        logger.info(f"Shape of X_df after NaN drop: {X_df_cleaned.shape}, y_true_aligned: {y_true_aligned.shape}")
    else: # No label column, just clean X_df
        X_df_cleaned = X_df.dropna()
        logger.info(f"Shape of X_df after NaN drop (no label): {X_df_cleaned.shape}")


    if X_df_cleaned.empty:
        logger.error("Feature set X became empty after dropping NaNs. Exiting.")
        return

    X_test_values = X_df_cleaned.values

    # === Scale the Data ===
    try:
        X_scaled = scaler.transform(X_test_values)
        logger.info("✅ Test data scaled successfully.")
    except Exception as e:
        logger.error(f"Error scaling test data: {e}")
        return

    # === Predict and Compute MSE ===
    logger.info("Predicting and computing Mean Squared Error (MSE)...")
    reconstructions = model.predict(X_scaled)
    mse = np.mean(np.square(X_scaled - reconstructions), axis=1)
    logger.info(f"MSE calculated for {len(mse)} samples. Mean MSE: {np.mean(mse):.6f}")


    if y_true_aligned is None:
        logger.warning("No aligned ground truth labels (y_true_aligned). Skipping thresholding and metric calculation.")
        logger.info("Autoencoder testing script finished (MSE calculation only).")
        return

    # === Set Threshold based on MSE ===
    # The threshold is typically set based on reconstruction errors on normal data.
    # If this script is for testing on mixed data (normal + anomalies),
    # using a percentile of the current MSEs might not be ideal for a fixed threshold,
    # but it can give an idea of relative anomaly scores.
    # For a production system, this threshold should be pre-determined.
    threshold = np.percentile(mse, ANOMALY_THRESHOLD_PERCENTILE)
    logger.info(f"🔧 MSE Threshold ({ANOMALY_THRESHOLD_PERCENTILE}th percentile of current test MSEs): {threshold:.6f}")
    logger.warning("Note: This threshold is dynamically calculated on the current test set's MSEs. For robust anomaly detection, a threshold should be pre-determined from a dataset of normal samples.")


    # === Classify Anomalies ===
    y_pred = (mse > threshold).astype(int) # 1 if anomaly (mse > threshold), 0 if normal

    # === Compute Metrics ===
    logger.info("Computing evaluation metrics...")
    # Ensure y_true and y_pred are of the same type, typically integer for binary classification.
    # The labels in UNSW_NB15 are often 0 for normal, 1 for attack.
    # Our y_pred is already 0 (normal) / 1 (anomaly).
    # If y_true_aligned contains string labels like "BENIGN", "ATTACK", they need conversion.
    # Assuming y_true_aligned is already 0/1 or can be converted.
    try:
        # Attempt conversion if y_true_aligned contains strings like '0', '1'
        if isinstance(y_true_aligned[0], str):
            y_true_aligned = y_true_aligned.astype(int)
        logger.info(f"Sample of y_true_aligned (first 5): {y_true_aligned[:5]}")
        logger.info(f"Sample of y_pred (first 5): {y_pred[:5]}")
    except ValueError as ve:
        logger.error(f"Could not convert y_true_aligned to int: {ve}. Check label format. Assuming binary 0/1 needed.")
        # Handle specific string labels if necessary, e.g. map {'BENIGN':0, 'ATTACK':1}
        # For now, we'll proceed and let metrics fail if types are incompatible.

    # Removed duplicate astype(str) conversions. Using int for 0/1 labels.

    try:
        # average='binary' is appropriate if your positive label is 1 (anomaly)
        # If your labels are multi-class or different, adjust 'average'
        precision = precision_score(y_true_aligned, y_pred, average='binary', pos_label=1, zero_division=0)
        recall = recall_score(y_true_aligned, y_pred, average='binary', pos_label=1, zero_division=0)
        f1 = f1_score(y_true_aligned, y_pred, average='binary', pos_label=1, zero_division=0)
        accuracy = accuracy_score(y_true_aligned, y_pred)

        logger.info(f"\n📊 Evaluation Metrics on {os.path.basename(config.AE_TEST_FILE)}:")
        logger.info(f"Accuracy:  {accuracy:.4f}")
        logger.info(f"Precision (for anomalies): {precision:.4f}")
        logger.info(f"Recall (for anomalies):    {recall:.4f}")
        logger.info(f"F1 Score (for anomalies):  {f1:.4f}")
    except Exception as e:
        logger.error(f"Error calculating metrics: {e}. Check label types and values (y_true vs y_pred).")

    logger.info("Autoencoder testing script finished.")

if __name__ == "__main__":
    main()
