import os
import json
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from sklearn.preprocessing import MinMaxScaler

# TensorFlow GPU setup
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        print(f"Using GPU: {gpus}")
    except RuntimeError as e:
        print(e)
else:
    print("No GPU found, using CPU.")

def load_and_preprocess_dataset(path):
    df = pd.read_csv(path)
    df = df.select_dtypes(include=[np.number])
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)
    X = df.values
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)
    return X_scaled, scaler

def build_autoencoder(input_dim):
    inputs = Input(shape=(input_dim,))
    x = Dense(64, activation='relu')(inputs)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    x = Dense(32, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    encoded = Dense(16, activation='relu')(x)

    x = Dense(32, activation='relu')(encoded)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    x = Dense(64, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    decoded = Dense(input_dim, activation='sigmoid')(x)

    autoencoder = Model(inputs, decoded)
    encoder = Model(inputs, encoded)
    return autoencoder, encoder

def train_autoencoder(X, save_path):
    input_dim = X.shape[1]
    model, encoder = build_autoencoder(input_dim)
    model.compile(optimizer='adam', loss='mse')

    model.fit(X, X,
              epochs=100,
              batch_size=64,
              validation_split=0.1,
              callbacks=[EarlyStopping(patience=15, restore_best_weights=True),
                         ModelCheckpoint(save_path, save_best_only=True),
                         ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, verbose=1)],
              verbose=2)
    return model, encoder

def evaluate_autoencoder(model, X_test):
    reconstructions = model.predict(X_test)
    mse = np.mean(np.square(X_test - reconstructions), axis=1)
    print(f"Autoencoder MSE mean: {np.mean(mse):.6f}")
    return mse

if __name__ == "__main__":
    train_paths = [
        "IDS_dataset/autoencoder/Monday-WorkingHours.pcap_ISCX.csv",
        "IDS_dataset/autoencoder/Tuesday-WorkingHours.pcap_ISCX.csv"
    ]
    test_dataset = "IDS_dataset/autoencoder/Wednesday-workingHours.pcap_ISCX.csv"

    # Load and combine training datasets
    X_train_list = []
    for path in train_paths:
        if not os.path.exists(path):
            print(f"⚠️ Training dataset not found: {path}, skipping.")
            continue
        X_part, scaler = load_and_preprocess_dataset(path)
        X_train_list.append(X_part)
    if not X_train_list:
        raise ValueError("No training data loaded.")
    X_train = np.vstack(X_train_list)

    print(f"\n🚀 Training Autoencoder on combined Monday and Tuesday datasets...")
    model, encoder = train_autoencoder(X_train, "models/autoencoder_combined.keras")
    encoder.save("models/encoder_combined.keras")
    joblib.dump(scaler, "models/scaler_combined.pkl")

    if not os.path.exists(test_dataset):
        print(f"⚠️ Test dataset not found: {test_dataset}")
    else:
        print(f"\n🔍 Evaluating Autoencoder model on Wednesday test dataset...")
        X_test, _ = load_and_preprocess_dataset(test_dataset)
        evaluate_autoencoder(model, X_test)
