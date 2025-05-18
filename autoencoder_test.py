import os
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score
from tensorflow.keras.models import load_model

# === Load Model & Scaler ===
model_path = "models/autoencoder_combined.keras"
scaler_path = "models/scaler_combined.pkl"
test_path = "IDS_dataset/autoencoder/Wednesday-workingHours.pcap_ISCX.csv"

# === Load Trained Model and Scaler ===
model = load_model(model_path)
scaler = joblib.load(scaler_path)

# === Load and Preprocess Test Dataset ===
df_test = pd.read_csv(test_path)

# Make sure label column exists (adjust if needed)
label_col = None
for col in df_test.columns:
    if 'label' in col.lower():
        label_col = col
        break

if not label_col:
    raise ValueError("❌ No label column found in test dataset!")

y_true = df_test[label_col].values
X_test = df_test.select_dtypes(include=[np.number])
X_test.replace([np.inf, -np.inf], np.nan, inplace=True)
X_test.dropna(inplace=True)

# Ensure y_true length matches filtered test data
y_true = y_true[-len(X_test):]

# === Scale the Data ===
X_scaled = scaler.transform(X_test)

# === Predict and Compute MSE ===
reconstructions = model.predict(X_scaled)
mse = np.mean(np.square(X_scaled - reconstructions), axis=1)

# === Set Threshold (90th Percentile of MSE) ===
threshold = np.percentile(mse, 90)
print(f"🔧 MSE Threshold (90th percentile): {threshold:.6f}")

# === Classify Anomalies ===
y_pred = (mse > threshold).astype(int)

# === Compute Metrics ===
# Fix label type mismatch before evaluation
y_true = y_true.astype(str)
y_pred = y_pred.astype(str)

# Fix label type mismatch before evaluation
y_true = y_true.astype(str)
y_pred = y_pred.astype(str)

# Use average='weighted' for multiclass classification metrics
precision = precision_score(y_true, y_pred, average='weighted', zero_division=0)
recall = recall_score(y_true, y_pred, average='weighted', zero_division=0)
f1 = f1_score(y_true, y_pred, average='weighted', zero_division=0)
accuracy = accuracy_score(y_true, y_pred)

# === Print Results ===
print(f"\n📊 Evaluation Metrics on {os.path.basename(test_path)}:")
print(f"Accuracy:  {accuracy:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall:    {recall:.4f}")
print(f"F1 Score:  {f1:.4f}")

