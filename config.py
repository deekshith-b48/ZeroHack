import os
import logging

# --- Configuration ---

# Base directory for datasets
# Try to set a sensible default if an environment variable is not set.
# User might need to adjust 'ZERO_HACK_DATA_DIR' environment variable
# or the default_data_dir value.
DEFAULT_DATA_DIR = os.path.join(os.path.expanduser("~"), "ZeroHack", "data")
DATA_DIR = os.getenv("ZERO_HACK_DATA_DIR", DEFAULT_DATA_DIR)

# Model save directory
DEFAULT_MODELS_DIR = os.path.join(os.path.expanduser("~"), "ZeroHack", "models")
MODELS_DIR = os.getenv("ZERO_HACK_MODELS_DIR", DEFAULT_MODELS_DIR)

# Ensure models directory exists
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True) # Also ensure base data dir exists for processed files

# --- File Paths ---

# Isolation Forest
IF_TRAIN_FILE = os.path.join(DATA_DIR, "isolation_forest", "UNSW_NB15_training-set.csv")
IF_TEST_FILE = os.path.join(DATA_DIR, "isolation_forest", "UNSW_NB15_testing-set.csv")
IF_PROCESSED_FILE = os.path.join(DATA_DIR, "isolation_forest", "processed_isolation_data.csv")
IF_MODEL_PATH = os.path.join(MODELS_DIR, "isolation_forest_model.pkl")
IF_SCALER_PATH = os.path.join(MODELS_DIR, "scaler_isolation_forest.pkl")

# Autoencoder
AE_TRAIN_FILES = [
    os.path.join(DATA_DIR, "autoencoder", "Monday-WorkingHours.pcap_ISCX.csv"),
    os.path.join(DATA_DIR, "autoencoder", "Tuesday-WorkingHours.pcap_ISCX.csv")
]
AE_TEST_FILE = os.path.join(DATA_DIR, "autoencoder", "Wednesday-workingHours.pcap_ISCX.csv")
AE_MODEL_PATH = os.path.join(MODELS_DIR, "autoencoder_model.keras") # Full autoencoder model
AE_ENCODER_MODEL_PATH = os.path.join(MODELS_DIR, "encoder_model.keras") # Separate encoder part of the autoencoder
# Note: The encoder model is saved explicitly in autoencoder_train_test.py.
# If deriving encoder from the full AE model by layer name/index, ensure consistency.
AE_SCALER_PATH = os.path.join(MODELS_DIR, "scaler_autoencoder.pkl")

# LSTM
LSTM_TRAIN_FILE = os.path.join(DATA_DIR, "lstm", "UNSW_NB15_training-set.csv")
LSTM_TEST_FILE = os.path.join(DATA_DIR, "lstm", "UNSW_NB15_testing-set.csv")
LSTM_MODEL_PATH = os.path.join(MODELS_DIR, "lstm_model.keras")
LSTM_SCALER_PATH = os.path.join(MODELS_DIR, "scaler_lstm.pkl") # Standardized name

# Model Evaluation Specific (example, might need more if datasets differ)
EVAL_MONDAY_TEST_FILE = os.path.join(DATA_DIR, "evaluation", "Monday-WorkingHours-Test.pcap_ISCX.csv")
EVAL_TUESDAY_TEST_FILE = os.path.join(DATA_DIR, "evaluation", "Tuesday-WorkingHours-Test.pcap_ISCX.csv")
EVAL_WEDNESDAY_TEST_FILE = os.path.join(DATA_DIR, "evaluation", "Wednesday-WorkingHours.pcap_ISCX.csv")


# --- Logging Configuration ---
LOG_LEVEL = os.getenv("ZERO_HACK_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler()  # Outputs to console
        # To add file logging:
        # logging.FileHandler("zerohack_backend.log")
    ]
)

def get_logger(name):
    return logging.getLogger(name)

# --- Example Usage (for testing this config file) ---
if __name__ == "__main__":
    logger = get_logger(__name__)
    logger.info(f"Data directory: {DATA_DIR}")
    logger.info(f"Models directory: {MODELS_DIR}")
    logger.info(f"Isolation Forest model path: {IF_MODEL_PATH}")
    logger.info(f"Autoencoder model path: {AE_MODEL_PATH}")
    logger.info(f"LSTM model path: {LSTM_MODEL_PATH}")

    # Create dummy dataset directories if they don't exist for local testing
    os.makedirs(os.path.join(DATA_DIR, "isolation_forest"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "autoencoder"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "lstm"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "evaluation"), exist_ok=True)
    logger.info("Created dummy dataset directories if they didn't exist.")
    logger.info("To use actual data, ensure it's placed in the paths above or set ZERO_HACK_DATA_DIR.")
