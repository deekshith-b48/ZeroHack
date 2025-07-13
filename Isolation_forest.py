import os
import joblib
import numpy as np
import pandas as pd
# import h5py # Removed unused import
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import precision_score, recall_score, f1_score

import config # Import new config file

logger = config.get_logger(__name__)

# Paths are now sourced from config.py
# data_dir = r"C:\Users\varsh\projects\Multilayerd_ai\IDS_dataset\isolation" # Old path
# train_file = os.path.join(data_dir, "UNSW_NB15_training-set.csv") # Old path
# test_file = os.path.join(data_dir, "UNSW_NB15_testing-set.csv") # Old path
# processed_file = os.path.join(data_dir, "processed_isolation_data.csv") # Old path
# model_path = os.path.join(data_dir, "isolation_forest_model.pkl") # Old path
# model_h5_path = os.path.join(data_dir, "isolation_forest_model.h5") # Removed, not used for .pkl

# ------------------ Load and Preprocess ------------------

def preprocess_normal_data(filepath, scaler_save_path, processed_save_path):
    logger.info(f"Starting preprocessing for: {filepath}")
    try:
        df = pd.read_csv(filepath)
    except FileNotFoundError:
        logger.error(f"File not found: {filepath}")
        return None, None
    
    # Keep only numeric columns
    df_numeric = df.select_dtypes(include=[np.number])
    if df_numeric.empty:
        logger.warning("No numeric columns found in the dataframe.")
        return None, None

    # Remove NaNs and infs
    df_numeric.replace([np.inf, -np.inf], np.nan, inplace=True)
    df_numeric.dropna(inplace=True)

    if df_numeric.empty:
        logger.warning("DataFrame became empty after removing NaNs.")
        return None, None

    # Normalize
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(df_numeric)

    # Save preprocessed data
    df_scaled = pd.DataFrame(X_scaled, columns=df_numeric.columns)
    try:
        df_scaled.to_csv(processed_save_path, index=False)
        logger.info(f"✅ Preprocessed data saved to: {processed_save_path}")
    except Exception as e:
        logger.error(f"Error saving processed data to {processed_save_path}: {e}")

    # Save scaler
    try:
        joblib.dump(scaler, scaler_save_path)
        logger.info(f"✅ Scaler saved to: {scaler_save_path}")
    except Exception as e:
        logger.error(f"Error saving scaler to {scaler_save_path}: {e}")
        return X_scaled, None # Return X_scaled even if scaler saving fails, but None for scaler
    
    return X_scaled, scaler

# ------------------ Train Isolation Forest ------------------

def train_isolation_forest(X, model_save_path, contamination=0.05):
    """
    Train Isolation Forest model with configurable contamination.

    Parameters:
    - X: training data
    - model_save_path: path to save the trained model
    - contamination: float, the proportion of outliers in the data set.
    Returns:
    - trained Isolation Forest model
    """
    logger.info(f"Training Isolation Forest model with contamination={contamination}...")
    model = IsolationForest(contamination=contamination, random_state=42)
    model.fit(X)
    try:
        joblib.dump(model, model_save_path)
        logger.info(f"✅ Isolation Forest model saved to: {model_save_path}")
    except Exception as e:
        logger.error(f"Error saving model to {model_save_path}: {e}")
        return None
    return model

# ------------------ Test and Evaluate ------------------

def test_isolation_forest(test_filepath, model_filepath, scaler_filepath):
    logger.info(f"Testing Isolation Forest model. Test data: {test_filepath}")
    try:
        model = joblib.load(model_filepath)
        scaler = joblib.load(scaler_filepath)
    except FileNotFoundError as e:
        logger.error(f"Model or scaler file not found: {e}")
        return None, None, None
    except Exception as e:
        logger.error(f"Error loading model or scaler: {e}")
        return None, None, None

    try:
        df_test = pd.read_csv(test_filepath)
    except FileNotFoundError:
        logger.error(f"Test file not found: {test_filepath}")
        return None, None, None

    df_test_numeric = df_test.select_dtypes(include=[np.number])
    if df_test_numeric.empty:
        logger.warning("No numeric columns in test data.")
        return None, None, df_test # Return original df_test for context if needed

    df_test_numeric.replace([np.inf, -np.inf], np.nan, inplace=True)
    df_test_numeric.dropna(inplace=True)

    if df_test_numeric.empty:
        logger.warning("Test DataFrame became empty after removing NaNs.")
        return None, None, df_test

    # Store original indices before dropping rows, to align labels if they exist outside numeric data
    original_indices = df_test_numeric.index

    X_test_values = df_test_numeric.values
    try:
        X_test_scaled = scaler.transform(X_test_values)
    except Exception as e:
        logger.error(f"Error transforming test data with scaler: {e}")
        return None, None, df_test

    scores = model.decision_function(X_test_scaled)
    predictions = model.predict(X_test_scaled)

    anomaly_count = np.sum(predictions == -1)
    logger.info(f"🔍 Anomalies detected in test set: {anomaly_count} out of {len(predictions)}")

    # Pass the df_test with original_indices for evaluate_model to correctly align labels
    return predictions, scores, df_test.loc[original_indices]


def evaluate_model(predictions, df_test_evaluated_portion):
    # df_test_evaluated_portion is the part of the original df_test that corresponds to `predictions`
    if 'label' not in df_test_evaluated_portion.columns:
        logger.warning("⚠️ No 'label' column found in the evaluated portion of test data. Skipping metrics.")
        return None # Return None or an empty dict

    y_true = df_test_evaluated_portion['label'].values
    # Convert Isolation Forest predictions: -1 -> 1 (anomaly), 1 -> 0 (normal)
    y_pred = np.where(predictions == -1, 1, 0) # Assuming 1 is anomaly, 0 is normal in ground truth

    try:
        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        logger.info(f"📊 Evaluation Metrics:\nPrecision: {precision:.4f}\nRecall: {recall:.4f}\nF1 Score: {f1:.4f}")
        return {"precision": precision, "recall": recall, "f1_score": f1}
    except Exception as e:
        logger.error(f"Error calculating metrics: {e}. Ensure labels are in correct format (e.g., binary).")
        return None

# ------------------ Main Execution Logic ------------------
def main():
    logger.info("Starting Isolation Forest script execution.")

    # Ensure data directories exist (config.py should handle models dir)
    os.makedirs(os.path.dirname(config.IF_TRAIN_FILE), exist_ok=True)
    os.makedirs(os.path.dirname(config.IF_PROCESSED_FILE), exist_ok=True)


    if not os.path.exists(config.IF_TRAIN_FILE):
        logger.error(f"❌ Training file not found: {config.IF_TRAIN_FILE}")
        logger.info("Attempting to load pre-trained model and scaler for testing if available.")
        model = None # Explicitly nullify if training data is missing
    else:
        X_train, _ = preprocess_normal_data(config.IF_TRAIN_FILE,
                                            config.IF_SCALER_PATH,
                                            config.IF_PROCESSED_FILE)
        if X_train is None:
            logger.error("Preprocessing failed. Cannot train model.")
            return # Exit if preprocessing fails

        # Increase contamination to improve recall; adjust as needed
        model = train_isolation_forest(X_train, config.IF_MODEL_PATH, contamination=0.1)
        if model is None:
            logger.error("Model training failed.")
            # Decide if to proceed with testing if an old model exists
            # For now, we'll assume if training fails, we shouldn't proceed with a potentially stale model.
            return

    # Attempt to test even if training was skipped (model might exist from previous run)
    if not os.path.exists(config.IF_TEST_FILE):
        logger.warning(f"⚠️ Test file not found: {config.IF_TEST_FILE}. Skipping testing and evaluation.")
    elif not os.path.exists(config.IF_MODEL_PATH) or not os.path.exists(config.IF_SCALER_PATH):
        logger.warning(f"⚠️ Model ({config.IF_MODEL_PATH}) or scaler ({config.IF_SCALER_PATH}) not found. Skipping testing and evaluation.")
    else:
        logger.info("Proceeding with testing and evaluation.")
        predictions, scores, df_test_evaluated = test_isolation_forest(config.IF_TEST_FILE,
                                                                      config.IF_MODEL_PATH,
                                                                      config.IF_SCALER_PATH)
        if predictions is not None and df_test_evaluated is not None:
            evaluate_model(predictions, df_test_evaluated)
        else:
            logger.warning("Testing returned no predictions or data. Skipping evaluation.")

    logger.info("Isolation Forest script execution finished.")


class IsolationForestDetector:
    def __init__(self, model_path=config.IF_MODEL_PATH, scaler_path=config.IF_SCALER_PATH):
        self.model_path = model_path
        self.scaler_path = scaler_path
        self.model = None
        self.scaler = None
        self.model_last_loaded_time = 0
        self._load_model()

    def _check_and_reload_model(self):
        """Checks if the model file has been updated and reloads it if so."""
        try:
            current_mod_time = os.path.getmtime(self.model_path)
            if current_mod_time > self.model_last_loaded_time:
                logger.info("IF Detector: Model file has changed. Reloading...")
                self._load_model()
        except OSError:
            # File might not exist yet or other OS error
            logger.debug(f"IF Detector: Could not check modification time for {self.model_path}.")
            pass # Fail gracefully, predict will handle the None model

    def _load_model(self):
        if not os.path.exists(self.model_path) or not os.path.exists(self.scaler_path):
            logger.warning(f"IF Detector: Model ({self.model_path}) or scaler ({self.scaler_path}) not found.")
            # Allow initialization, but predict will fail or return error
            return
        try:
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            self.model_last_loaded_time = os.path.getmtime(self.model_path)
            logger.info(f"IF Detector: Model and scaler loaded successfully from {self.model_path} and {self.scaler_path}")
        except Exception as e:
            logger.error(f"IF Detector: Error loading model or scaler: {e}")
            self.model = None # Ensure model is None if loading failed
            self.scaler = None

    def predict(self, data_df_numeric):
        """
        Predicts anomalies using the loaded Isolation Forest model.

        Args:
            data_df_numeric (pd.DataFrame): DataFrame with only numeric features, already preprocessed (e.g. NaNs handled).
                                         This data should NOT be scaled yet. The detector's scaler will be used.

        Returns:
            dict: {'verdict': 'normal'/'anomaly', 'score': float, 'explanation': str}
                  Returns None or error dict if model/scaler not loaded or prediction fails.
        """
        self._check_and_reload_model() # Check for model updates before predicting

        if self.model is None or self.scaler is None:
            logger.error("IF Detector: Model or scaler not loaded. Cannot predict.")
            return {"verdict": "error", "score": 0.0, "explanation": "Model/scaler not loaded."}

        if data_df_numeric.empty:
            logger.warning("IF Detector: Input data is empty. Cannot predict.")
            return {"verdict": "error", "score": 0.0, "explanation": "Input data is empty."}

        try:
            X_values = data_df_numeric.values
            X_scaled = self.scaler.transform(X_values)
        except Exception as e:
            logger.error(f"IF Detector: Error scaling input data: {e}")
            return {"verdict": "error", "score": 0.0, "explanation": f"Error scaling input data: {e}"}

        try:
            # decision_function: lower scores are more anomalous. Negative scores are outliers.
            # predict: returns -1 for outliers and 1 for inliers.
            scores = self.model.decision_function(X_scaled) # Average anomaly score for the batch
            predictions = self.model.predict(X_scaled) # Individual predictions

            # For a batch, we might average the score or take the most anomalous one.
            # Here, let's consider the average score.
            avg_score = np.mean(scores)

            # Determine overall verdict for the batch. If any prediction is -1, consider it an anomaly.
            # Or, base it on the avg_score. Let's use avg_score for now.
            # (This might need refinement based on how batch results are interpreted by aggregator)
            verdict = "anomaly" if avg_score < config.Aggregator.AI_SCORE_THRESHOLD_IF else "normal" # Using example threshold
            # A more robust way for batch:
            # num_anomalies = np.sum(predictions == -1)
            # verdict = "anomaly" if num_anomalies > 0 else "normal"

            explanation = f"Isolation Forest average score: {avg_score:.4f}. "
            if verdict == "anomaly":
                explanation += f"Score is below threshold ({config.Aggregator.AI_SCORE_THRESHOLD_IF}), indicating potential anomaly."
            else:
                explanation += "Score is above threshold, indicating normal behavior."

            return {"verdict": verdict, "score": float(avg_score), "explanation": explanation, "raw_predictions": predictions.tolist()}
        except Exception as e:
            logger.error(f"IF Detector: Error during prediction: {e}")
            return {"verdict": "error", "score": 0.0, "explanation": f"Error during prediction: {e}"}

if __name__ == "__main__":
    # Keep the original main function for standalone training and testing of the script
    main()

    # Example of using the detector class (assuming model/scaler exist)
    print("\n--- Testing IsolationForestDetector Class ---")
    detector = IsolationForestDetector()
    if detector.model and detector.scaler:
        # Create some dummy numeric data (unscaled)
        # Number of features should match what the scaler expects
        try:
            num_features = detector.scaler.n_features_in_
            print(f"Detector expects {num_features} features.")
            # Example: 2 samples, num_features features
            dummy_data_ok = pd.DataFrame(np.random.rand(2, num_features) * 0.5) # Likely normal
            dummy_data_anomaly = pd.DataFrame(np.random.rand(1, num_features) * 2 - 0.5 ) # Likely anomalous features

            print("Predicting on likely normal data:")
            result_ok = detector.predict(dummy_data_ok)
            print(result_ok)

            print("\nPredicting on likely anomalous data:")
            result_anomaly = detector.predict(dummy_data_anomaly)
            print(result_anomaly)

        except AttributeError:
             print("Could not determine number of features from loaded scaler (scaler.n_features_in_ missing or scaler not loaded).")
        except Exception as e:
            print(f"Error during detector class test: {e}")
    else:
        print("IF Detector class could not load model/scaler, skipping class test.")
