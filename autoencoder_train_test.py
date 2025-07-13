import os
# import json # No longer used directly
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from sklearn.preprocessing import MinMaxScaler

import config # Import new config file

logger = config.get_logger(__name__)

# TensorFlow GPU setup
# Moved to a function to be callable and cleaner
def setup_gpu():
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            logger.info(f"Using GPU: {gpus}")
        except RuntimeError as e:
            logger.error(f"GPU setup error: {e}")
    else:
        logger.info("No GPU found, using CPU.")

def load_and_preprocess_single_dataset(path, label_column=None):
    """Loads a single dataset, selects numeric features, handles NaNs, and optionally drops a label column."""
    logger.info(f"Loading and preprocessing dataset: {path}")
    try:
        df = pd.read_csv(path)
    except FileNotFoundError:
        logger.error(f"File not found: {path}")
        return None

    if label_column and label_column in df.columns:
        df_features = df.drop(columns=[label_column])
        logger.info(f"Dropped label column: {label_column}")
    else:
        df_features = df

    df_numeric = df_features.select_dtypes(include=[np.number])
    if df_numeric.empty:
        logger.warning(f"No numeric columns found in {path} after potential label drop.")
        return None

    df_numeric.replace([np.inf, -np.inf], np.nan, inplace=True)
    df_numeric.dropna(inplace=True)

    if df_numeric.empty:
        logger.warning(f"DataFrame from {path} is empty after NaN removal.")
        return None

    return df_numeric

def build_autoencoder(input_dim):
    # Architecture: Input -> 64 -> BN -> Dropout(0.3) -> 32 -> BN -> Dropout(0.3) -> 16 (encoded)
    # -> 32 -> BN -> Dropout(0.3) -> 64 -> BN -> Dropout(0.3) -> Output (sigmoid)
    logger.info(f"Building Autoencoder with input_dim: {input_dim}")
    inputs = Input(shape=(input_dim,))
    # Encoder
    x = Dense(64, activation='relu')(inputs)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    x = Dense(32, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    encoded = Dense(16, activation='relu', name='encoder_output')(x) # Latent space

    # Decoder
    x = Dense(32, activation='relu')(encoded)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    x = Dense(64, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    decoded = Dense(input_dim, activation='sigmoid')(x) # Sigmoid for output in [0,1] range

    autoencoder = Model(inputs, decoded, name='autoencoder')
    encoder = Model(inputs, encoded, name='encoder') # Separate encoder model

    logger.info("Autoencoder and Encoder models built.")
    autoencoder.summary(print_fn=logger.info)
    encoder.summary(print_fn=logger.info)
    return autoencoder, encoder

def train_autoencoder(X_train_scaled, model_save_path, encoder_save_path, epochs=100, batch_size=64):
    logger.info("Starting Autoencoder training...")
    input_dim = X_train_scaled.shape[1]
    autoencoder_model, encoder_model = build_autoencoder(input_dim)

    autoencoder_model.compile(optimizer='adam', loss='mse') # Mean Squared Error loss

    # Callbacks
    early_stopping = EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True, verbose=1)
    model_checkpoint = ModelCheckpoint(model_save_path, save_best_only=True, monitor='val_loss', verbose=1)
    reduce_lr = ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, verbose=1, min_lr=1e-6)

    history = autoencoder_model.fit(X_train_scaled, X_train_scaled, # Autoencoder learns to reconstruct its input
                                    epochs=epochs,
                                    batch_size=batch_size,
                                    validation_split=0.1, # Use 10% of training data for validation
                                    callbacks=[early_stopping, model_checkpoint, reduce_lr],
                                    verbose=2) # 0 = silent, 1 = progress bar, 2 = one line per epoch

    logger.info(f"✅ Autoencoder model training complete. Best model saved to: {model_save_path}")

    # Save the encoder part separately
    try:
        encoder_model.save(encoder_save_path)
        logger.info(f"✅ Encoder part of the model saved to: {encoder_save_path}")
    except Exception as e:
        logger.error(f"Error saving encoder model to {encoder_save_path}: {e}")

    return autoencoder_model, encoder_model, history

def evaluate_autoencoder_mse(model, X_test_scaled):
    logger.info("Evaluating Autoencoder model (calculating MSE)...")
    reconstructions = model.predict(X_test_scaled)
    mse = np.mean(np.square(X_test_scaled - reconstructions), axis=1)
    logger.info(f"Autoencoder MSE mean on test data: {np.mean(mse):.6f}")
    return mse

def main():
    setup_gpu()
    logger.info("Starting Autoencoder training and testing script.")

    # Ensure data and model directories exist
    for p in config.AE_TRAIN_FILES:
        os.makedirs(os.path.dirname(p), exist_ok=True)
    os.makedirs(os.path.dirname(config.AE_TEST_FILE), exist_ok=True)
    os.makedirs(config.MODELS_DIR, exist_ok=True) # config.py already does this, but good practice

    # --- Load and Combine Training Datasets ---
    logger.info("Loading and combining training datasets...")
    all_train_df_list = []
    for path in config.AE_TRAIN_FILES:
        df_part = load_and_preprocess_single_dataset(path) # Assuming no label column in these specific training files
        if df_part is not None:
            all_train_df_list.append(df_part)

    if not all_train_df_list:
        logger.error("No training data loaded. Exiting.")
        return

    combined_train_df = pd.concat(all_train_df_list, ignore_index=True)
    logger.info(f"Combined training data shape: {combined_train_df.shape}")

    if combined_train_df.empty:
        logger.error("Combined training dataframe is empty. Exiting.")
        return

    X_train_unscaled = combined_train_df.values

    # --- Scale Combined Training Data ---
    logger.info("Scaling combined training data...")
    scaler = MinMaxScaler()
    X_train_scaled = scaler.fit_transform(X_train_unscaled)
    logger.info("✅ Combined training data scaled.")

    # Save the correctly trained scaler
    try:
        joblib.dump(scaler, config.AE_SCALER_PATH)
        logger.info(f"✅ Combined scaler saved to: {config.AE_SCALER_PATH}")
    except Exception as e:
        logger.error(f"Error saving combined scaler: {e}")
        # Decide if we should exit or continue without saving scaler
        return


    # --- Train Autoencoder ---
    logger.info(f"🚀 Training Autoencoder on combined datasets...")
    # Standardized model and encoder paths from config
    autoencoder_model, encoder_model, _ = train_autoencoder(X_train_scaled,
                                                            config.AE_MODEL_PATH,
                                                            config.AE_ENCODER_MODEL_PATH,
                                                            epochs=100, # Example: make configurable if needed
                                                            batch_size=64) # Example

    if autoencoder_model is None:
        logger.error("Autoencoder training failed. Exiting.")
        return

    # --- Load and Preprocess Test Dataset ---
    if not os.path.exists(config.AE_TEST_FILE):
        logger.warning(f"⚠️ Test dataset not found: {config.AE_TEST_FILE}. Skipping evaluation.")
    else:
        logger.info(f"\n🔍 Loading and preprocessing test dataset for evaluation: {config.AE_TEST_FILE}")
        # Assuming test dataset might have a label. If so, load_and_preprocess_single_dataset should handle it.
        # For autoencoder evaluation, we typically don't need the label for MSE calculation,
        # but it's good practice to be aware if it's there.
        df_test = load_and_preprocess_single_dataset(config.AE_TEST_FILE) # Potentially pass label_column if known

        if df_test is None or df_test.empty:
            logger.error(f"Failed to load or preprocess test data from {config.AE_TEST_FILE}. Skipping evaluation.")
        else:
            X_test_unscaled = df_test.values
            # Use the *same* scaler that was fit on the combined training data
            X_test_scaled = scaler.transform(X_test_unscaled)
            logger.info("✅ Test data scaled using the training scaler.")

            evaluate_autoencoder_mse(autoencoder_model, X_test_scaled)

    logger.info("Autoencoder training and testing script finished.")


class AutoencoderDetector:
    def __init__(self, model_path=config.AE_MODEL_PATH, scaler_path=config.AE_SCALER_PATH, threshold_percentile=None):
        self.model_path = model_path
        self.scaler_path = scaler_path
        self.model = None
        self.scaler = None
        self.threshold = None # This will be the actual MSE value threshold
        self.model_last_loaded_time = 0
        self._load_model_and_scaler()

        if threshold_percentile is not None:
            logger.warning("AutoencoderDetector: threshold_percentile passed to constructor is for dynamic calculation "
                           "on predict data if threshold is not pre-set. "
                           "A fixed, pre-calculated threshold is generally preferred for consistent detection.")
            self.threshold_percentile_dynamic = threshold_percentile
        else:
            # Use the configured threshold from aggregator settings as a default for verdict if not pre-calculated
            # This is a simplification; ideally, the AE threshold is learned from reconstruction errors on normal validation data
            # and saved/loaded, or the predict method needs a way to access a validation set's MSEs.
            # For now, we'll make the `predict` method capable of calculating it dynamically if not set.
            self.threshold_percentile_dynamic = config.ANOMALY_THRESHOLD_PERCENTILE # from autoencoder_test.py
            # A better approach would be to store the actual MSE threshold value, possibly in config or with the model.
            # Let's assume for now that the 'score' from this detector is the MSE, and the aggregator
            # will use its own logic (like AI_SCORE_THRESHOLD_AE_LSTM) to interpret it.
            # The detector itself can still determine a simple 'anomaly'/'normal' verdict based on a dynamic threshold if needed.
            logger.info(f"AE Detector: Defaulting to dynamic threshold calculation at {self.threshold_percentile_dynamic}th percentile if not set otherwise.")

    def _check_and_reload_model(self):
        """Checks if the model file has been updated and reloads it if so."""
        try:
            current_mod_time = os.path.getmtime(self.model_path)
            if current_mod_time > self.model_last_loaded_time:
                logger.info("AE Detector: Model file has changed. Reloading...")
                self._load_model_and_scaler()
        except OSError:
            logger.debug(f"AE Detector: Could not check modification time for {self.model_path}.")
            pass

    def _load_model_and_scaler(self):
        if not os.path.exists(self.model_path) or not os.path.exists(self.scaler_path):
            logger.warning(f"AE Detector: Model ({self.model_path}) or scaler ({self.scaler_path}) not found.")
            return
        try:
            self.model = tf.keras.models.load_model(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            self.model_last_loaded_time = os.path.getmtime(self.model_path)
            logger.info(f"AE Detector: Model and scaler loaded successfully from {self.model_path} and {self.scaler_path}")
            # Here, you might also load a pre-calculated MSE threshold if it was saved during training.
            # e.g., self.threshold = joblib.load(os.path.join(config.MODELS_DIR, "ae_mse_threshold.pkl"))
        except Exception as e:
            logger.error(f"AE Detector: Error loading model, scaler, or threshold: {e}")
            self.model = None
            self.scaler = None

    def set_mse_threshold(self, threshold_value):
        """Allows setting a pre-calculated MSE threshold."""
        self.threshold = threshold_value
        logger.info(f"AE Detector: MSE threshold explicitly set to {self.threshold:.6f}")

    def predict(self, data_df_numeric):
        """
        Predicts anomalies using the loaded Autoencoder model by calculating reconstruction MSE.

        Args:
            data_df_numeric (pd.DataFrame): DataFrame with only numeric features, already preprocessed (NaNs handled).
                                         This data should NOT be scaled yet.

        Returns:
            dict: {'verdict': 'normal'/'anomaly', 'score': mse_value (float), 'explanation': str, 'model_type': 'Autoencoder'}
        """
        self._check_and_reload_model()

        if self.model is None or self.scaler is None:
            logger.error("AE Detector: Model or scaler not loaded. Cannot predict.")
            return {"verdict": "error", "score": 0.0, "explanation": "AE Model/scaler not loaded.", "model_type": "Autoencoder"}

        if data_df_numeric.empty:
            logger.warning("AE Detector: Input data is empty.")
            return {"verdict": "error", "score": 0.0, "explanation": "Input data is empty.", "model_type": "Autoencoder"}

        try:
            X_values = data_df_numeric.values
            X_scaled = self.scaler.transform(X_values)
        except Exception as e:
            logger.error(f"AE Detector: Error scaling input data: {e}")
            return {"verdict": "error", "score": 0.0, "explanation": f"Error scaling input data: {e}", "model_type": "Autoencoder"}

        try:
            reconstructions = self.model.predict(X_scaled)
            mse_per_sample = np.mean(np.square(X_scaled - reconstructions), axis=1)
            avg_mse = np.mean(mse_per_sample) # Average MSE for the batch

            current_threshold = self.threshold
            dynamic_threshold_used = False
            if current_threshold is None: # If no fixed threshold is set, calculate dynamically for this batch
                current_threshold = np.percentile(mse_per_sample, self.threshold_percentile_dynamic)
                dynamic_threshold_used = True
                logger.warning(f"AE Detector: No fixed MSE threshold set. Dynamically calculated threshold for this batch: {current_threshold:.6f} ({self.threshold_percentile_dynamic}th percentile).")

            verdict = "anomaly" if avg_mse > current_threshold else "normal"

            explanation = (f"Autoencoder average MSE: {avg_mse:.6f}. "
                           f"Threshold: {current_threshold:.6f}{' (dynamic)' if dynamic_threshold_used else ' (fixed)'}. ")
            if verdict == "anomaly":
                explanation += "MSE exceeds threshold, indicating potential anomaly."
            else:
                explanation += "MSE within threshold, indicating normal behavior."

            return {"verdict": verdict, "score": float(avg_mse), "explanation": explanation, "model_type": "Autoencoder", "mse_values": mse_per_sample.tolist()}
        except Exception as e:
            logger.error(f"AE Detector: Error during prediction: {e}")
            return {"verdict": "error", "score": 0.0, "explanation": f"Error during prediction: {e}", "model_type": "Autoencoder"}

if __name__ == "__main__":
    main() # Keep original main for training

    # Example of using the detector class
    print("\n--- Testing AutoencoderDetector Class ---")
    # This assumes a model and scaler have been trained and saved by running main() first.
    # Or, point to existing model/scaler if available.
    ae_detector = AutoencoderDetector()
    # Optionally set a fixed threshold if known from validation:
    # ae_detector.set_mse_threshold(0.05) # Example fixed threshold

    if ae_detector.model and ae_detector.scaler:
        try:
            num_features = ae_detector.scaler.n_features_in_
            print(f"AE Detector expects {num_features} features.")

            # Create some dummy numeric data (unscaled)
            dummy_data_normal = pd.DataFrame(np.random.rand(5, num_features) * 0.8) # Should have low MSE
            dummy_data_anomaly = pd.DataFrame(np.random.rand(2, num_features) * 1.5 - 0.2) # Some values out of typical scaled range

            print("Predicting on likely normal data:")
            result_normal = ae_detector.predict(dummy_data_normal)
            print(result_normal)

            print("\nPredicting on likely anomalous data:")
            result_anomaly = ae_detector.predict(dummy_data_anomaly)
            print(result_anomaly)

        except AttributeError:
            print("Could not determine number of features from loaded scaler (scaler.n_features_in_ missing or scaler not loaded).")
        except Exception as e:
            print(f"Error during AE Detector class test: {e}")
    else:
        print("AE Detector class could not load model/scaler, skipping class test.")
