import joblib
import numpy as np
import tensorflow as tf

def load_models(scaler_path="models/scaler_unsw_nb15.pkl", lstm_model_path="models/lstm_unsw_nb15.keras"):
    scaler = joblib.load(scaler_path)
    lstm_model = tf.keras.models.load_model(lstm_model_path)
    return scaler, lstm_model

def reshape_sequences(X, timesteps=10):
    cut = (len(X) // timesteps) * timesteps
    X = X[:cut]
    return X.reshape(-1, timesteps, X.shape[1])

def detect_malicious_log(raw_log, scaler, lstm_model, threshold=0.01):
    """
    Detect if the given raw log is malicious based on reconstruction error from LSTM model.

    Parameters:
    - raw_log: numpy array of shape (samples, features)
    - scaler: fitted scaler model
    - lstm_model: trained LSTM model
    - threshold: float, reconstruction error threshold to classify as malicious

    Returns:
    - is_malicious: bool, True if malicious, False otherwise
    - mse: float, mean squared error of reconstruction
    """
    X_scaled = scaler.transform(raw_log)
    X_seq = reshape_sequences(X_scaled, timesteps=10)
    preds = lstm_model.predict(X_seq)
    mse = np.mean(np.square(X_seq - preds))
    is_malicious = mse > threshold
    return is_malicious, mse

if __name__ == "__main__":
    import numpy as np

    # Example raw log data (replace with actual log data)
    example_log = np.random.rand(20, 41)  # 20 samples, 41 features

    scaler, lstm_model = load_models()

    is_malicious, mse = detect_malicious_log(example_log, scaler, lstm_model)

    if is_malicious:
        print(f"Alert: The log is detected as malicious with MSE={mse:.6f}")
    else:
        print(f"The log is normal with MSE={mse:.6f}")
