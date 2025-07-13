import os
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dropout, BatchNormalization, TimeDistributed, Dense
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from sklearn.preprocessing import MinMaxScaler

import config # Import new config file

logger = config.get_logger(__name__)

# Default timesteps for LSTM sequences
TIMESTEPS = 10

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

def find_label_column_name(df_columns):
    """Finds a potential label column name (case-insensitive)."""
    for col in df_columns:
        if 'label' in col.lower():
            logger.info(f"Identified potential label column: {col}")
            return col
    logger.info("No column containing 'label' (case-insensitive) found in provided columns.")
    return None

def load_and_preprocess_dataset(path, scaler_to_use=None, label_column_name=None):
    """
    Loads dataset, optionally drops label, selects numeric, handles NaN/inf.
    If scaler_to_use is None, fits a new scaler. Otherwise, uses the provided scaler.
    Returns X_scaled (features) and the scaler used.
    """
    logger.info(f"Loading and preprocessing dataset: {path}")
    try:
        df = pd.read_csv(path)
    except FileNotFoundError:
        logger.error(f"File not found: {path}")
        return None, None
    except Exception as e:
        logger.error(f"Error reading CSV {path}: {e}")
        return None, None

    # If label_column_name is not provided, try to find it
    if label_column_name is None:
        label_column_name = find_label_column_name(df.columns)

    if label_column_name and label_column_name in df.columns:
        X_df = df.drop(columns=[label_column_name])
        logger.info(f"Dropped label column '{label_column_name}' for feature set X from {path}.")
    else:
        if label_column_name: # It was provided but not found
             logger.warning(f"Specified label column '{label_column_name}' not found in {path}. Using all columns.")
        X_df = df

    X_numeric = X_df.select_dtypes(include=[np.number])

    if X_numeric.empty:
        logger.warning(f"No numeric features found in {path} after potential label drop. Cannot proceed with this file.")
        return None, None

    X_numeric.replace([np.inf, -np.inf], np.nan, inplace=True)
    X_numeric.dropna(inplace=True)

    if X_numeric.empty:
        logger.warning(f"DataFrame from {path} is empty after NaN removal.")
        return None, None

    X_values = X_numeric.values

    current_scaler = scaler_to_use
    if current_scaler is None:
        logger.info(f"Fitting a new MinMaxScaler for {path}.")
        current_scaler = MinMaxScaler()
        X_scaled = current_scaler.fit_transform(X_values)
    else:
        logger.info(f"Using provided scaler to transform {path}.")
        try:
            X_scaled = current_scaler.transform(X_values)
        except Exception as e:
            logger.error(f"Error transforming data from {path} with provided scaler: {e}")
            return None, current_scaler # Return scaler for potential saving attempt

    logger.info(f"Successfully preprocessed and scaled data from {path}. Shape: {X_scaled.shape}")
    return X_scaled, current_scaler

def reshape_sequences(X, timesteps=TIMESTEPS):
    if X is None or len(X) == 0:
        logger.warning("Input data for reshaping is None or empty.")
        return None
    if len(X) < timesteps:
        logger.warning(f"Not enough data ({len(X)} samples) to form even one sequence of {timesteps} timesteps.")
        return None

    # Ensure data length is a multiple of timesteps by truncating
    num_sequences = len(X) // timesteps
    cut_point = num_sequences * timesteps
    X_trimmed = X[:cut_point]

    # Reshape [samples, features] into [num_sequences, timesteps, features]
    num_features = X_trimmed.shape[1]
    X_reshaped = X_trimmed.reshape(-1, timesteps, num_features)
    logger.info(f"Data reshaped into sequences: {X_reshaped.shape}")
    return X_reshaped

def build_lstm(input_shape):
    # input_shape will be (timesteps, num_features)
    # Architecture: LSTM(64, rs=T) -> BN -> Dropout(0.4) -> LSTM(32, rs=T) -> BN -> Dropout(0.4) -> TimeDistributed(Dense(num_features))
    logger.info(f"Building LSTM model with input_shape: {input_shape}")
    model = Sequential([
        LSTM(64, return_sequences=True, input_shape=input_shape),
        BatchNormalization(),
        Dropout(0.4),
        LSTM(32, return_sequences=True), # Set return_sequences=True if the next layer is also recurrent or TimeDistributed
        BatchNormalization(),
        Dropout(0.4),
        TimeDistributed(Dense(input_shape[-1])) # Output layer, predicting features for each timestep
    ], name="lstm_autoencoder")

    logger.info("LSTM model built.")
    model.summary(print_fn=logger.info)
    return model

def train_lstm(X_seq, model_save_path, epochs=30, batch_size=64):
    logger.info("Starting LSTM model training...")
    # X_seq.shape is (num_sequences, timesteps, num_features)
    # The input_shape for the first LSTM layer is (timesteps, num_features)
    model = build_lstm(X_seq.shape[1:])
    model.compile(optimizer='adam', loss='mse') # Mean Squared Error for reconstruction

    callbacks = [
        EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True, verbose=1),
        ModelCheckpoint(model_save_path, save_best_only=True, monitor='val_loss', verbose=1),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, verbose=1, min_lr=1e-6)
    ]

    history = model.fit(X_seq, X_seq, # LSTM autoencoder reconstructs its input sequences
                        epochs=epochs,
                        batch_size=batch_size,
                        validation_split=0.1,
                        callbacks=callbacks,
                        verbose=2)

    logger.info(f"✅ LSTM model training complete. Best model saved to: {model_save_path}")
    return model, history # Return model and history

def evaluate_lstm_mse(model, X_test_seq):
    logger.info("Evaluating LSTM model (calculating MSE)...")
    preds = model.predict(X_test_seq)
    # Calculate MSE across timesteps and features for each sequence
    mse_per_sequence = np.mean(np.square(X_test_seq - preds), axis=(1,2))
    logger.info(f"LSTM MSE mean on test data: {np.mean(mse_per_sequence):.6f}")
    return mse_per_sequence

def main():
    setup_gpu()
    logger.info("Starting LSTM training and testing script.")

    # Ensure data and model directories exist
    os.makedirs(os.path.dirname(config.LSTM_TRAIN_FILE), exist_ok=True)
    os.makedirs(os.path.dirname(config.LSTM_TEST_FILE), exist_ok=True)
    os.makedirs(config.MODELS_DIR, exist_ok=True)

    X_train_scaled, scaler = None, None
    model = None

    # --- Training Phase ---
    if not os.path.exists(config.LSTM_TRAIN_FILE):
        logger.warning(f"⚠️ Training dataset not found: {config.LSTM_TRAIN_FILE}. Skipping training.")
        logger.info("Will attempt to load a pre-trained model and scaler for testing if they exist.")
    else:
        logger.info(f"\n🚀 Processing LSTM training data from: {config.LSTM_TRAIN_FILE}")
        # Specify label column if known, e.g., label_column_name='Label' for UNSW-NB15
        # For this example, we'll try to auto-detect it.
        X_train_scaled, scaler = load_and_preprocess_dataset(config.LSTM_TRAIN_FILE, label_column_name=None)

        if X_train_scaled is None or scaler is None:
            logger.error("Failed to load or preprocess training data. Cannot train LSTM model.")
            return # Critical failure if training data can't be processed

        try:
            joblib.dump(scaler, config.LSTM_SCALER_PATH)
            logger.info(f"✅ Training scaler saved to: {config.LSTM_SCALER_PATH}")
        except Exception as e:
            logger.error(f"Error saving training scaler: {e}")
            # Continue with training even if scaler saving fails, but log error

        X_train_seq = reshape_sequences(X_train_scaled, timesteps=TIMESTEPS)
        if X_train_seq is None:
            logger.error("Failed to reshape training data into sequences. Cannot train LSTM model.")
            return

        model, _ = train_lstm(X_train_seq, config.LSTM_MODEL_PATH) # history is returned but not used here
        if model is None:
            logger.error("LSTM model training failed. Exiting.")
            return

    # --- Testing Phase ---
    if not os.path.exists(config.LSTM_TEST_FILE):
        logger.warning(f"⚠️ Test dataset not found: {config.LSTM_TEST_FILE}. Skipping testing.")
    else:
        logger.info(f"\n🔍 Processing LSTM test data from: {config.LSTM_TEST_FILE}")

        # Load model if not trained in this session
        if model is None:
            if os.path.exists(config.LSTM_MODEL_PATH):
                try:
                    model = tf.keras.models.load_model(config.LSTM_MODEL_PATH)
                    logger.info(f"Loaded pre-trained LSTM model from {config.LSTM_MODEL_PATH}")
                except Exception as e:
                    logger.error(f"Error loading pre-trained LSTM model: {e}. Cannot perform testing.")
                    return
            else:
                logger.error(f"Pre-trained LSTM model not found at {config.LSTM_MODEL_PATH} and no model was trained in this session. Cannot test.")
                return

        # Load scaler if not available from training phase
        if scaler is None:
            if os.path.exists(config.LSTM_SCALER_PATH):
                try:
                    scaler = joblib.load(config.LSTM_SCALER_PATH)
                    logger.info(f"Loaded pre-trained scaler from {config.LSTM_SCALER_PATH}")
                except Exception as e:
                    logger.error(f"Error loading pre-trained scaler: {e}. Cannot accurately preprocess test data.")
                    return
            else:
                logger.error(f"Scaler not found at {config.LSTM_SCALER_PATH} and no scaler was prepared in this session. Cannot test.")
                return

        # Preprocess test data using the (fit on train or loaded) scaler
        X_test_scaled, _ = load_and_preprocess_dataset(config.LSTM_TEST_FILE, scaler_to_use=scaler, label_column_name=None)

        if X_test_scaled is None:
            logger.error("Failed to load or preprocess test data. Skipping LSTM evaluation.")
        else:
            X_test_seq = reshape_sequences(X_test_scaled, timesteps=TIMESTEPS)
            if X_test_seq is None:
                logger.error("Failed to reshape test data into sequences. Skipping LSTM evaluation.")
            else:
                evaluate_lstm_mse(model, X_test_seq)

    logger.info("LSTM training and testing script finished.")


class LSTMDETector:
    def __init__(self, model_path=config.LSTM_MODEL_PATH, scaler_path=config.LSTM_SCALER_PATH,
                 timesteps=TIMESTEPS, threshold_percentile=None):
        self.model_path = model_path
        self.scaler_path = scaler_path
        self.timesteps = timesteps
        self.model = None
        self.scaler = None
        self.threshold = None # Actual MSE value threshold
        self.model_last_loaded_time = 0
        self._load_model_and_scaler()

        if threshold_percentile is not None:
            logger.warning("LSTMDETector: threshold_percentile for dynamic calculation is provided. "
                           "A fixed, pre-calculated MSE threshold is generally preferred.")
            self.threshold_percentile_dynamic = threshold_percentile
        else:
            self.threshold_percentile_dynamic = config.DETECTOR_DYNAMIC_THRESHOLD_PERCENTILE
            logger.info(f"LSTM Detector: Defaulting to dynamic threshold calculation at {self.threshold_percentile_dynamic}th percentile if not set otherwise.")

    def _check_and_reload_model(self):
        """Checks if the model file has been updated and reloads it if so."""
        try:
            current_mod_time = os.path.getmtime(self.model_path)
            if current_mod_time > self.model_last_loaded_time:
                logger.info("LSTM Detector: Model file has changed. Reloading...")
                self._load_model_and_scaler()
        except OSError:
            logger.debug(f"LSTM Detector: Could not check modification time for {self.model_path}.")
            pass

    def _load_model_and_scaler(self):
        if not os.path.exists(self.model_path) or not os.path.exists(self.scaler_path):
            logger.warning(f"LSTM Detector: Model ({self.model_path}) or scaler ({self.scaler_path}) not found.")
            return
        try:
            self.model = tf.keras.models.load_model(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            self.model_last_loaded_time = os.path.getmtime(self.model_path)
            logger.info(f"LSTM Detector: Model and scaler loaded successfully from {self.model_path} and {self.scaler_path}")
            # Potentially load a pre-calculated MSE threshold here too
            # e.g., self.threshold = joblib.load(os.path.join(config.MODELS_DIR, "lstm_mse_threshold.pkl"))
        except Exception as e:
            logger.error(f"LSTM Detector: Error loading model, scaler, or threshold: {e}")
            self.model = None
            self.scaler = None

    def set_mse_threshold(self, threshold_value):
        """Allows setting a pre-calculated MSE threshold."""
        self.threshold = threshold_value
        logger.info(f"LSTM Detector: MSE threshold explicitly set to {self.threshold:.6f}")

    def predict(self, data_df_numeric):
        """
        Predicts anomalies using the loaded LSTM model by calculating reconstruction MSE on sequences.

        Args:
            data_df_numeric (pd.DataFrame): DataFrame with only numeric features, preprocessed (NaNs handled).
                                         NOT YET SCALED.

        Returns:
            dict: {'verdict': 'normal'/'anomaly', 'score': mse_value (float), 'explanation': str, 'model_type': 'LSTM'}
        """
        self._check_and_reload_model()

        if self.model is None or self.scaler is None:
            logger.error("LSTM Detector: Model or scaler not loaded.")
            return {"verdict": "error", "score": 0.0, "explanation": "LSTM Model/scaler not loaded.", "model_type": "LSTM"}

        if data_df_numeric.empty:
            logger.warning("LSTM Detector: Input data is empty.")
            return {"verdict": "error", "score": 0.0, "explanation": "Input data is empty.", "model_type": "LSTM"}

        try:
            X_values = data_df_numeric.values
            X_scaled = self.scaler.transform(X_values)
        except Exception as e:
            logger.error(f"LSTM Detector: Error scaling input data: {e}")
            return {"verdict": "error", "score": 0.0, "explanation": f"Error scaling input data: {e}", "model_type": "LSTM"}

        X_seq = reshape_sequences(X_scaled, timesteps=self.timesteps) # Uses existing reshape_sequences function
        if X_seq is None or X_seq.shape[0] == 0: # Check if any sequences were formed
            logger.warning("LSTM Detector: Not enough data to form sequences after scaling, or reshaping failed.")
            return {"verdict": "error", "score": 0.0, "explanation": "Not enough data for sequences or reshaping error.", "model_type": "LSTM"}

        try:
            reconstructions = self.model.predict(X_seq)
            mse_per_sequence = np.mean(np.square(X_seq - reconstructions), axis=(1,2))
            avg_mse = np.mean(mse_per_sequence)

            current_threshold = self.threshold
            dynamic_threshold_used = False
            if current_threshold is None:
                current_threshold = np.percentile(mse_per_sequence, self.threshold_percentile_dynamic)
                dynamic_threshold_used = True
                logger.warning(f"LSTM Detector: No fixed MSE threshold set. Dynamically calculated threshold for this batch: {current_threshold:.6f} ({self.threshold_percentile_dynamic}th percentile).")

            verdict = "anomaly" if avg_mse > current_threshold else "normal"

            explanation = (f"LSTM average sequence MSE: {avg_mse:.6f}. "
                           f"Threshold: {current_threshold:.6f}{' (dynamic)' if dynamic_threshold_used else ' (fixed)'}. ")
            if verdict == "anomaly":
                explanation += "MSE exceeds threshold, indicating potential anomaly in temporal patterns."
            else:
                explanation += "MSE within threshold, indicating normal temporal patterns."

            return {"verdict": verdict, "score": float(avg_mse), "explanation": explanation, "model_type": "LSTM", "mse_values_per_sequence": mse_per_sequence.tolist()}
        except Exception as e:
            logger.error(f"LSTM Detector: Error during prediction: {e}")
            return {"verdict": "error", "score": 0.0, "explanation": f"Error during prediction: {e}", "model_type": "LSTM"}


if __name__ == "__main__":
    main() # Original main for training/testing the script

    # Example of using the detector class
    print("\n--- Testing LSTMDETector Class ---")
    lstm_detector = LSTMDETector()
    # Optionally set a fixed threshold:
    # lstm_detector.set_mse_threshold(0.03) # Example

    if lstm_detector.model and lstm_detector.scaler:
        try:
            num_features = lstm_detector.scaler.n_features_in_
            print(f"LSTM Detector expects {num_features} features per timestep.")

            # Create dummy data for at least `timesteps` samples
            # e.g., 2 sequences of `timesteps` length
            num_samples_normal = lstm_detector.timesteps * 2
            dummy_data_normal = pd.DataFrame(np.random.rand(num_samples_normal, num_features) * 0.7)

            num_samples_anomaly = lstm_detector.timesteps
            dummy_data_anomaly_vals = np.random.rand(num_samples_anomaly, num_features)
            dummy_data_anomaly_vals[:, :num_features//2] *= 2.5 # Make some features anomalous
            dummy_data_anomaly = pd.DataFrame(dummy_data_anomaly_vals)


            print("Predicting on likely normal sequential data:")
            result_normal = lstm_detector.predict(dummy_data_normal)
            print(result_normal)

            print("\nPredicting on likely anomalous sequential data:")
            result_anomaly = lstm_detector.predict(dummy_data_anomaly)
            print(result_anomaly)

        except AttributeError:
            print("Could not determine number of features from loaded scaler (scaler.n_features_in_ missing or scaler not loaded).")
        except Exception as e:
            print(f"Error during LSTM Detector class test: {e}")
    else:
        print("LSTM Detector class could not load model/scaler, skipping class test.")
