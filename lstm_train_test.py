import os
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dropout, BatchNormalization, TimeDistributed, Dense
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

def reshape_sequences(X, timesteps=10):
    cut = (len(X) // timesteps) * timesteps
    X = X[:cut]
    return X.reshape(-1, timesteps, X.shape[1])

def build_lstm(input_shape):
    model = Sequential()
    model.add(LSTM(64, return_sequences=True, input_shape=input_shape))
    model.add(BatchNormalization())
    model.add(Dropout(0.4))
    model.add(LSTM(32, return_sequences=True))
    model.add(BatchNormalization())
    model.add(Dropout(0.4))
    model.add(TimeDistributed(Dense(input_shape[-1])))
    return model

def train_lstm(X_seq, save_path):
    model = build_lstm(X_seq.shape[1:])
    model.compile(optimizer='adam', loss='mse')

    model.fit(X_seq, X_seq,
              epochs=30,
              batch_size=64,
              validation_split=0.1,
              callbacks=[EarlyStopping(patience=10, restore_best_weights=True),
                         ModelCheckpoint(save_path, save_best_only=True),
                         ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, verbose=1)],
              verbose=2)
    return model

def evaluate_lstm(model, X_test_seq):
    preds = model.predict(X_test_seq)
    mse = np.mean(np.square(X_test_seq - preds), axis=(1,2))
    print(f"LSTM MSE mean: {np.mean(mse):.6f}")
    return mse

if __name__ == "__main__":
    train_dataset = "IDS_dataset/lstm/UNSW_NB15_training-set.csv"
    test_dataset = "IDS_dataset/lstm/UNSW_NB15_testing-set.csv"

    if not os.path.exists(train_dataset):
        print(f"⚠️ Training dataset not found: {train_dataset}")
    elif not os.path.exists(test_dataset):
        print(f"⚠️ Test dataset not found: {test_dataset}")
    else:
        print(f"\n🚀 Training LSTM on UNSW_NB15 training dataset...")
        X_train, scaler = load_and_preprocess_dataset(train_dataset)

        X_seq = reshape_sequences(X_train, timesteps=10)
        model = train_lstm(X_seq, "models/lstm_unsw_nb15.keras")
        joblib.dump(scaler, "models/scaler_unsw_nb15.pkl")

        print(f"\n🔍 Evaluating LSTM model on UNSW_NB15 test dataset...")
        X_test, _ = load_and_preprocess_dataset(test_dataset)
        X_test_seq = reshape_sequences(X_test, timesteps=10)
        evaluate_lstm(model, X_test_seq)
