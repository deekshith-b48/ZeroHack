import os
import joblib
import numpy as np
import pandas as pd
import h5py
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler

# Paths
data_dir = r"C:\Users\varsh\projects\Multilayerd_ai\IDS_dataset\isolation"
train_file = os.path.join(data_dir, "UNSW_NB15_training-set.csv")  # You should replace with actual train filename
test_file = os.path.join(data_dir, "UNSW_NB15_testing-set.csv")  # You should replace with actual test filename
processed_file = os.path.join(data_dir, "processed_isolation_data.csv")
model_path = os.path.join(data_dir, "isolation_forest_model.pkl")
model_h5_path = os.path.join(data_dir, "isolation_forest_model.h5")

# ------------------ Load and Preprocess ------------------

def preprocess_normal_data(filepath):
    df = pd.read_csv(filepath)
    
    # Keep only numeric columns
    df = df.select_dtypes(include=[np.number])

    # Remove NaNs and infs
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)
    # Removed dropping rows with zeros to avoid empty dataset

    # Normalize
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(df)

    # Save preprocessed data
    df_scaled = pd.DataFrame(X_scaled, columns=df.columns)
    
    # Save scaler
    joblib.dump(scaler, os.path.join(data_dir, "scaler.pkl"))
    
    print(f"✅ Preprocessed data saved to: {processed_file}")
    return X_scaled

# ------------------ Train Isolation Forest ------------------

def train_isolation_forest(X, model_path, contamination=0.05):
    """
    Train Isolation Forest model with configurable contamination.

    Parameters:
    - X: training data
    - model_path: path to save the trained model
    - contamination: float, the proportion of outliers in the data set. Increasing this value can increase recall.

    Returns:
    - trained Isolation Forest model
    """
    model = IsolationForest(contamination=contamination, random_state=42)
    model.fit(X)
    joblib.dump(model, model_path)
    print(f"✅ Isolation Forest model saved to: {model_path} with contamination={contamination}")
    return model

# ------------------ Test and Evaluate ------------------

from sklearn.metrics import precision_score, recall_score, f1_score

def test_isolation_forest(test_path, model_path, scaler_path):
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)

    df_test = pd.read_csv(test_path)
    df_test = df_test.select_dtypes(include=[np.number])
    df_test.replace([np.inf, -np.inf], np.nan, inplace=True)
    df_test.dropna(inplace=True)
    # Removed dropping rows with zeros to avoid empty dataset in test data

    X_test = scaler.transform(df_test.values)
    scores = model.decision_function(X_test)
    predictions = model.predict(X_test)

    # In Isolation Forest, -1 = anomaly, 1 = normal
    anomaly_count = np.sum(predictions == -1)
    print(f"🔍 Anomalies detected in test set: {anomaly_count} out of {len(predictions)}")
    return predictions, scores, df_test

def evaluate_model(predictions, df_test):
    # Assuming the dataset has a 'label' column for ground truth anomalies (0=normal, 1=anomaly)
    # We need to check if 'label' exists in df_test, else evaluation cannot be done
    if 'label' not in df_test.columns:
        print("⚠️ No 'label' column found in test data for evaluation metrics.")
        return

    y_true = df_test['label'].values
    # Convert Isolation Forest predictions: -1 -> 1 (anomaly), 1 -> 0 (normal)
    y_pred = np.where(predictions == -1, 1, 0)

    precision = precision_score(y_true, y_pred)
    recall = recall_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred)

    print(f"📊 Evaluation Metrics:\nPrecision: {precision:.4f}\nRecall: {recall:.4f}\nF1 Score: {f1:.4f}")

# ------------------ Run All ------------------

if not os.path.exists(train_file):
    print(f"❌ Training file not found: {train_file}")
else:
    X_train = preprocess_normal_data(train_file)
    # Increase contamination to improve recall; adjust as needed
    model = train_isolation_forest(X_train, model_path, contamination=0.1)

    if os.path.exists(test_file):
        predictions, scores, df_test = test_isolation_forest(test_file, model_path, os.path.join(data_dir, "scaler.pkl"))
        evaluate_model(predictions, df_test)
    else:
        print(f"⚠️ Test file not found: {test_file}")
