import os
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler

def load_and_preprocess_dataset(path):
    df = pd.read_csv(path)
    df = df.select_dtypes(include=[np.number])
    df.replace([np.inc f, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)
    X = df.values
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)
    return X_scaled, scaler

def reshape_sequences(X, timesteps):
    cut = (len(X) // timesteps) * timesteps
    X = X[:cut]
    return X.reshape(-1, timesteps, X.shape[1])

def evaluate_autoencoder(day, test_csv_path):
    print(f"Evaluating Autoencoder for {day} on test dataset {test_csv_path}...")

    if not os.path.exists(test_csv_path):
        print(f"Test dataset {test_csv_path} not found.")
        return

    X_test_scaled, _ = load_and_preprocess_dataset(test_csv_path)

    ae_model_path = f"models/autoencoder_{day.lower()}.keras"
    ae_model = tf.keras.models.load_model(ae_model_path)

    reconstructions = ae_model.predict(X_test_scaled)
    ae_mse = np.mean(np.square(X_test_scaled - reconstructions), axis=1)

    print(f"Autoencoder MSE mean: {np.mean(ae_mse):.6f}")


def evaluate_lstm(day, test_csv_path):
    print(f"Evaluating LSTM for {day} on test dataset {test_csv_path}...")

    if not os.path.exists(test_csv_path):
        print(f"Test dataset {test_csv_path} not found.")
        return

    X_test_scaled, _ = load_and_preprocess_dataset(test_csv_path)

    ae_model_path = f"models/autoencoder_{day.lower()}.keras"
    encoder_model_path = f"models/encoder_{day.lower()}.keras"
    ae_model = tf.keras.models.load_model(ae_model_path)

    if os.path.exists(encoder_model_path):
        encoder = tf.keras.models.load_model(encoder_model_path)
    else:
        input_layer = ae_model.input
        encoded_layer = ae_model.layers[-7].output  # Adjust index if model structure changes
        encoder = tf.keras.Model(inputs=input_layer, outputs=encoded_layer)

    X_test_encoded = encoder.predict(X_test_scaled)

    lstm_model_path = f"models/lstm_{day.lower()}.keras"
    lstm_model = tf.keras.models.load_model(lstm_model_path)

    expected_input_shape = lstm_model.input_shape
    timesteps = expected_input_shape[1]
    features = expected_input_shape[2]

    cut = (len(X_test_encoded) // timesteps) * timesteps
    X_test_seq = X_test_encoded[:cut].reshape(-1, timesteps, features)

    lstm_preds = lstm_model.predict(X_test_seq)
    lstm_mse = np.mean(np.square(X_test_seq - lstm_preds), axis=(1, 2))

    print(f"LSTM MSE mean: {np.mean(lstm_mse):.6f}")


def evaluate_isolation_forest(day, test_csv_path):
    print(f"Evaluating Isolation Forest for {day} on test dataset {test_csv_path}...")

    if not os.path.exists(test_csv_path):
        print(f"Test dataset {test_csv_path} not found.")
        return

    X_test_scaled, _ = load_and_preprocess_dataset(test_csv_path)

    ae_model_path = f"models/autoencoder_{day.lower()}.keras"
    encoder_model_path = f"models/encoder_{day.lower()}.keras"
    ae_model = tf.keras.models.load_model(ae_model_path)

    if os.path.exists(encoder_model_path):
        encoder = tf.keras.models.load_model(encoder_model_path)
    else:
        input_layer = ae_model.input
        encoded_layer = ae_model.layers[-7].output  # Adjust index if model structure changes
        encoder = tf.keras.Model(inputs=input_layer, outputs=encoded_layer)

    X_test_encoded = encoder.predict(X_test_scaled)

    iso_model_path = f"models/isoforest_{day.lower()}.pkl"
    iso_model = joblib.load(iso_model_path)
    iso_scores = iso_model.decision_function(X_test_encoded)

    print(f"Isolation Forest score mean: {np.mean(iso_scores):.6f}")


if __name__ == "__main__":
    datasets = {
        "Monday": "IDS_dataset/Monday-WorkingHours-Test.pcap_ISCX.csv",
        "Tuesday": "IDS_dataset/Tuesday-WorkingHours-Test.pcap_ISCX.csv",
        "Wednesday": "IDS_dataset/Wednesday-WorkingHours.pcap_ISCX.csv"
    }

    wednesday_test_path = datasets["Wednesday"]
    for day in ["Monday", "Tuesday"]:
        evaluate_autoencoder(day, wednesday_test_path)
        evaluate_lstm(day, wednesday_test_path)
        evaluate_isolation_forest(day, wednesday_test_path)


if __name__ == "__main__":
    datasets = {
        "Monday": "IDS_dataset/Monday-WorkingHours-Test.pcap_ISCX.csv",
        "Tuesday": "IDS_dataset/Tuesday-WorkingHours-Test.pcap_ISCX.csv",
        "Wednesday": "IDS_dataset/Wednesday-WorkingHours.pcap_ISCX.csv"
    }

    # Evaluate Monday and Tuesday models on Wednesday dataset
    test_path = datasets["Wednesday"]
    for day in ["Monday", "Tuesday"]:
        evaluate_models(day, test_path)
