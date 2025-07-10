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

if __name__ == "__main__":
    main()
