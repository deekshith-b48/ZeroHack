import os
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler

import config # Import new config file

logger = config.get_logger(__name__)

# Default timesteps for LSTM sequences if needed for reshaping
LSTM_TIMESTEPS = 10 # Should match the TIMESTEPS in lstm_train_test.py if models are from there

def find_label_column_name_eval(df_columns):
    """Finds a potential label column name (case-insensitive) for evaluation datasets."""
    for col in df_columns:
        if 'label' in col.lower(): # Common naming convention
            logger.info(f"Identified potential label column for exclusion: {col}")
            return col
    logger.info("No column containing 'label' (case-insensitive) found in evaluation dataset columns.")
    return None

def load_and_preprocess_eval_dataset(path, scaler_path_to_load=None, label_column_name_to_exclude=None):
    """
    Loads a dataset for evaluation.
    - Optionally excludes a label column.
    - Selects numeric features, handles NaN/inf.
    - If scaler_path_to_load is provided, loads and uses it. Otherwise, fits a new scaler (less common for eval).
    Returns X_scaled (features) and the scaler used.
    """
    logger.info(f"Loading and preprocessing evaluation dataset: {path}")
    try:
        df = pd.read_csv(path)
    except FileNotFoundError:
        logger.error(f"File not found: {path}")
        return None, None
    except Exception as e:
        logger.error(f"Error reading CSV {path}: {e}")
        return None, None

    # If label_column_name_to_exclude is not provided, try to find it
    if label_column_name_to_exclude is None:
        label_column_name_to_exclude = find_label_column_name_eval(df.columns)

    if label_column_name_to_exclude and label_column_name_to_exclude in df.columns:
        X_df = df.drop(columns=[label_column_name_to_exclude])
        logger.info(f"Dropped label column '{label_column_name_to_exclude}' for feature set X from {path}.")
    else:
        if label_column_name_to_exclude:
             logger.warning(f"Specified label column '{label_column_name_to_exclude}' not found in {path}. Using all columns.")
        X_df = df

    X_numeric = X_df.select_dtypes(include=[np.number])

    if X_numeric.empty:
        logger.warning(f"No numeric features found in {path} after potential label drop.")
        return None, None

    X_numeric.replace([np.inf, -np.inf], np.nan, inplace=True) # Corrected np.inc f to np.inf
    X_numeric.dropna(inplace=True)

    if X_numeric.empty:
        logger.warning(f"DataFrame from {path} is empty after NaN removal.")
        return None, None

    X_values = X_numeric.values

    scaler = None
    if scaler_path_to_load and os.path.exists(scaler_path_to_load):
        try:
            scaler = joblib.load(scaler_path_to_load)
            logger.info(f"Loaded scaler from {scaler_path_to_load} for {path}.")
            X_scaled = scaler.transform(X_values)
        except Exception as e:
            logger.error(f"Error loading/using scaler from {scaler_path_to_load} for {path}: {e}. Fitting new scaler as fallback.")
            scaler = MinMaxScaler()
            X_scaled = scaler.fit_transform(X_values)
    else:
        if scaler_path_to_load: # Path was given but not found
            logger.warning(f"Scaler not found at {scaler_path_to_load}. Fitting a new scaler for {path} (this might be unintended for evaluation).")
        else: # No scaler path given
            logger.info(f"No specific scaler provided. Fitting a new scaler for {path} (this might be unintended for evaluation).")
        scaler = MinMaxScaler()
        X_scaled = scaler.fit_transform(X_values)

    logger.info(f"Successfully preprocessed and scaled data from {path}. Shape: {X_scaled.shape}")
    return X_scaled, scaler


def reshape_sequences_eval(X, timesteps):
    if X is None or len(X) == 0:
        logger.warning("Input data for reshaping is None or empty.")
        return None
    if len(X) < timesteps:
        logger.warning(f"Not enough data ({len(X)} samples) to form even one sequence of {timesteps} timesteps.")
        return None
    num_features = X.shape[1]
    cut = (len(X) // timesteps) * timesteps
    X_trimmed = X[:cut]
    return X_trimmed.reshape(-1, timesteps, num_features)

def evaluate_autoencoder(model_path_template, scaler_path_template, test_csv_path, model_id=""):
    """Evaluates a given autoencoder model."""
    # model_id could be "monday", "tuesday", or "" for combined/general model
    current_model_path = model_path_template.format(id=model_id) if model_id else model_path_template
    current_scaler_path = scaler_path_template.format(id=model_id) if model_id else scaler_path_template

    logger.info(f"Evaluating Autoencoder (model: {current_model_path}, scaler: {current_scaler_path}) on test dataset {test_csv_path}...")

    if not os.path.exists(test_csv_path):
        logger.error(f"Test dataset {test_csv_path} not found.")
        return
    if not os.path.exists(current_model_path):
        logger.error(f"Autoencoder model {current_model_path} not found.")
        return

    # For autoencoder evaluation, we typically don't pass a label column to exclude,
    # as it reconstructs features. The scaler used should be the one trained with the AE.
    X_test_scaled, _ = load_and_preprocess_eval_dataset(test_csv_path, scaler_path_to_load=current_scaler_path)
    if X_test_scaled is None:
        logger.error(f"Failed to load/preprocess data for Autoencoder from {test_csv_path} with scaler {current_scaler_path}")
        return

    try:
        ae_model = tf.keras.models.load_model(current_model_path)
    except Exception as e:
        logger.error(f"Error loading Autoencoder model from {current_model_path}: {e}")
        return

    reconstructions = ae_model.predict(X_test_scaled)
    ae_mse = np.mean(np.square(X_test_scaled - reconstructions), axis=1)
    logger.info(f"Autoencoder ({model_id if model_id else 'general'}) MSE mean: {np.mean(ae_mse):.6f} on {os.path.basename(test_csv_path)}")


def evaluate_lstm(lstm_model_path_template, ae_encoder_model_path_template, lstm_scaler_path_template, test_csv_path, model_id=""):
    """Evaluates a given LSTM model, potentially using an AE encoder's output."""
    current_lstm_model_path = lstm_model_path_template.format(id=model_id) if model_id else lstm_model_path_template
    current_encoder_path = ae_encoder_model_path_template.format(id=model_id) if model_id else ae_encoder_model_path_template
    current_lstm_scaler_path = lstm_scaler_path_template.format(id=model_id) if model_id else lstm_scaler_path_template

    logger.info(f"Evaluating LSTM (model: {current_lstm_model_path}, encoder: {current_encoder_path}, scaler: {current_lstm_scaler_path}) on {test_csv_path}...")

    if not os.path.exists(test_csv_path):
        logger.error(f"Test dataset {test_csv_path} not found.")
        return
    if not os.path.exists(current_lstm_model_path):
        logger.error(f"LSTM model {current_lstm_model_path} not found.")
        return

    # Data for LSTM might first be encoded by an autoencoder's encoder part.
    # The scaler used here should be the one associated with the LSTM's training (or AE if features are from AE)
    X_test_input_scaled, _ = load_and_preprocess_eval_dataset(test_csv_path, scaler_path_to_load=current_lstm_scaler_path) # Or AE scaler if inputs are AE encoded
    if X_test_input_scaled is None:
        logger.error(f"Failed to load/preprocess data for LSTM from {test_csv_path}")
        return

    X_for_lstm = X_test_input_scaled
    # If an encoder path is provided and exists, use it to transform features first
    if current_encoder_path and os.path.exists(current_encoder_path):
        logger.info(f"Using AE encoder {current_encoder_path} to transform features for LSTM.")
        try:
            encoder = tf.keras.models.load_model(current_encoder_path)
            X_for_lstm = encoder.predict(X_test_input_scaled)
            logger.info(f"Features encoded by AE encoder. New shape: {X_for_lstm.shape}")
        except Exception as e:
            logger.error(f"Error loading/using AE encoder from {current_encoder_path}: {e}. Using original scaled features for LSTM.")
    elif current_encoder_path: # Path provided but not found
        logger.warning(f"AE Encoder model {current_encoder_path} not found. Using original scaled features for LSTM.")


    try:
        lstm_model = tf.keras.models.load_model(current_lstm_model_path)
    except Exception as e:
        logger.error(f"Error loading LSTM model from {current_lstm_model_path}: {e}")
        return

    # Determine timesteps from the loaded LSTM model
    try:
        timesteps = lstm_model.input_shape[1]
        if timesteps is None: # Might happen with dynamic input shapes
            logger.warning(f"LSTM model input_shape[1] (timesteps) is None. Using default: {LSTM_TIMESTEPS}")
            timesteps = LSTM_TIMESTEPS
    except:
        logger.warning(f"Could not determine timesteps from LSTM model input_shape. Using default: {LSTM_TIMESTEPS}")
        timesteps = LSTM_TIMESTEPS

    X_test_seq = reshape_sequences_eval(X_for_lstm, timesteps)
    if X_test_seq is None:
        logger.error(f"Failed to reshape data into sequences for LSTM model {current_lstm_model_path}.")
        return

    lstm_preds = lstm_model.predict(X_test_seq)
    lstm_mse = np.mean(np.square(X_test_seq - lstm_preds), axis=(1, 2))
    logger.info(f"LSTM ({model_id if model_id else 'general'}) MSE mean: {np.mean(lstm_mse):.6f} on {os.path.basename(test_csv_path)}")


def evaluate_isolation_forest(model_path_template, scaler_path_template, test_csv_path, model_id=""):
    """Evaluates a given Isolation Forest model."""
    current_model_path = model_path_template.format(id=model_id) if model_id else model_path_template
    current_scaler_path = scaler_path_template.format(id=model_id) if model_id else scaler_path_template

    logger.info(f"Evaluating Isolation Forest (model: {current_model_path}, scaler: {current_scaler_path}) on {test_csv_path}...")

    if not os.path.exists(test_csv_path):
        logger.error(f"Test dataset {test_csv_path} not found.")
        return
    if not os.path.exists(current_model_path):
        logger.error(f"Isolation Forest model {current_model_path} not found.")
        return

    X_test_scaled, _ = load_and_preprocess_eval_dataset(test_csv_path, scaler_path_to_load=current_scaler_path)
    if X_test_scaled is None:
        logger.error(f"Failed to load/preprocess data for Isolation Forest from {test_csv_path}")
        return

    # The original script used an AE encoder before IF. This logic can be added here if needed.
    # For now, assuming IF is evaluated on directly scaled features from its own scaler.
    # If features need to be encoded by an AE first:
    # 1. Load AE encoder
    # 2. X_test_scaled_for_ae = load_and_preprocess_eval_dataset(test_csv_path, scaler_path_to_load=config.AE_SCALER_PATH)
    # 3. X_test_encoded = ae_encoder.predict(X_test_scaled_for_ae)
    # 4. Then use X_test_encoded with Isolation Forest (IF might need its own scaler for these encoded features if trained that way)

    try:
        iso_model = joblib.load(current_model_path)
    except Exception as e:
        logger.error(f"Error loading Isolation Forest model from {current_model_path}: {e}")
        return

    iso_scores = iso_model.decision_function(X_test_scaled) # Use X_test_scaled or X_test_encoded if AE step added
    logger.info(f"Isolation Forest ({model_id if model_id else 'general'}) score mean: {np.mean(iso_scores):.6f} on {os.path.basename(test_csv_path)}")


def main():
    logger.info("Starting model evaluation script.")

    # Ensure necessary directories exist (config.py handles MODELS_DIR)
    # Data directories for evaluation files
    os.makedirs(os.path.dirname(config.EVAL_MONDAY_TEST_FILE), exist_ok=True)
    os.makedirs(os.path.dirname(config.EVAL_TUESDAY_TEST_FILE), exist_ok=True)
    os.makedirs(os.path.dirname(config.EVAL_WEDNESDAY_TEST_FILE), exist_ok=True)

    # --- Datasets for evaluation ---
    # Using specific evaluation datasets defined in config.py
    # The original script evaluated Monday & Tuesday models on Wednesday's data.
    # This can be adapted based on what `config.EVAL_..._FILE` point to.

    # Example: Evaluate the primary models (trained on their respective full datasets)
    # on a common test set, e.g., Wednesday's data.
    common_test_set = config.EVAL_WEDNESDAY_TEST_FILE
    # Or use config.AE_TEST_FILE if that's the intended general test set from autoencoder training.
    # common_test_set = config.AE_TEST_FILE

    logger.info(f"--- Evaluating Autoencoder model ({config.AE_MODEL_PATH}) ---")
    evaluate_autoencoder(
        model_path_template=config.AE_MODEL_PATH, # This is a direct path, not a template
        scaler_path_template=config.AE_SCALER_PATH, # Direct path
        test_csv_path=common_test_set
    )

    logger.info(f"--- Evaluating LSTM model ({config.LSTM_MODEL_PATH}) ---")
    evaluate_lstm(
        lstm_model_path_template=config.LSTM_MODEL_PATH, # Direct path
        ae_encoder_model_path_template=config.AE_ENCODER_MODEL_PATH, # Optional: Provide if LSTM uses AE encoded features
        lstm_scaler_path_template=config.LSTM_SCALER_PATH, # Scaler for LSTM input features
        test_csv_path=common_test_set
    )

    logger.info(f"--- Evaluating Isolation Forest model ({config.IF_MODEL_PATH}) ---")
    evaluate_isolation_forest(
        model_path_template=config.IF_MODEL_PATH, # Direct path
        scaler_path_template=config.IF_SCALER_PATH, # Direct path
        test_csv_path=common_test_set
    )

    # The original script had logic for evaluating models named "autoencoder_monday.keras", etc.
    # If that's still desired, the evaluate_ functions can be called with model_id="monday", "tuesday"
    # and the path templates in config.py would need to support {id}, e.g.:
    # config.AE_MODEL_PATH_TEMPLATE = os.path.join(MODELS_DIR, "autoencoder_{id}.keras")
    #
    # Example for evaluating day-specific models (if they exist and paths are templated in config):
    # for day_id in ["monday", "tuesday"]:
    #     logger.info(f"--- Evaluating {day_id.capitalize()} Autoencoder model ---")
    #     evaluate_autoencoder(
    #         model_path_template=config.AE_MODEL_PATH_TEMPLATE, # Assuming this is templated
    #         scaler_path_template=config.AE_SCALER_PATH_TEMPLATE, # Assuming this is templated
    #         test_csv_path=common_test_set,
    #         model_id=day_id
    #     )
    #     # ... similar for LSTM and IF if day-specific versions exist

    logger.info("Model evaluation script finished.")

if __name__ == "__main__":
    # Removed the duplicate if __name__ == "__main__": block
    # The original script had two such blocks. Consolidating.
    main()
