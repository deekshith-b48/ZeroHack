import numpy as np
import joblib
import os

# Paths
data_dir = r"C:\Users\varsh\projects\Multilayerd_ai\IDS_dataset\isolation"
model_path = os.path.join(data_dir, "isolation_forest_model.pkl")
scaler_path = os.path.join(data_dir, "scaler.pkl")

# ------------------ Load Model & Scaler ------------------
if not os.path.exists(model_path):
    raise FileNotFoundError(f"Model not found at {model_path}")
if not os.path.exists(scaler_path):
    raise FileNotFoundError(f"Scaler not found at {scaler_path}")

model = joblib.load(model_path)
scaler = joblib.load(scaler_path)

# ------------------ Create Synthetic Malicious Sample ------------------
# Simulate outlier by generating high/abnormal values (based on Isolation Forest training data range 0-1)
# You can increase/decrease features based on your dataset
num_features = scaler.n_features_in_

# Generate a synthetic malicious-looking sample: mostly extreme high or low values
malicious_sample = np.random.uniform(low=1.2, high=2.0, size=(1, num_features))  # Out of range

# Optionally, mix a few small values to look more like "unusual noise"
malicious_sample[0, :5] = np.random.uniform(0.0, 0.1, size=5)

# ------------------ Scale and Predict ------------------
# Scaling the sample using same scaler as training
malicious_sample_scaled = malicious_sample  # Since training data was already scaled to 0-1, this is intentionally unscaled

# Predict using Isolation Forest
prediction = model.predict(malicious_sample_scaled)

# In Isolation Forest: -1 = anomaly, 1 = normal
print("🔍 Prediction for synthetic malicious sample:")
print(f"Prediction: {'Anomaly' if prediction[0] == -1 else 'Normal'}")
