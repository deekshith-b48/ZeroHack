import pandas as pd
import joblib
import os
import argparse
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.preprocessing import LabelEncoder

# It's good practice to manage logging
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def train_model(dataset_path: str, save_dir: str):
    """
    Trains a RandomForestClassifier model on the given dataset and saves it.

    Args:
        dataset_path (str): The full path to the training dataset (CSV).
        save_dir (str): The directory where the trained model and scaler will be saved.
    """
    logging.info(f"Starting model training with dataset: {dataset_path}")

    if not os.path.exists(dataset_path):
        logging.error(f"Dataset not found at {dataset_path}")
        return

    try:
        df = pd.read_csv(dataset_path)
        logging.info(f"Dataset loaded successfully. Shape: {df.shape}")
    except Exception as e:
        logging.error(f"Failed to load dataset: {e}")
        return

    # --- Feature Engineering & Preprocessing ---
    # This is a simplified example. A real-world scenario would involve more
    # sophisticated feature selection, scaling, and handling of categorical data.

    # Drop non-feature columns (assuming 'label' or 'attack_cat' are labels)
    # This needs to be adapted to the actual columns of the UNSW-NB15 dataset.
    # For now, let's assume a 'label' (binary 0/1) and 'attack_cat' (categorical) exist.
    if 'attack_cat' in df.columns and 'label' in df.columns:
        X = df.drop(['attack_cat', 'label'], axis=1)
        y = df['label'] # Using binary label for this simple classifier
    elif 'label' in df.columns:
        X = df.drop('label', axis=1)
        y = df['label']
    else:
        logging.error("No 'label' column found in the dataset. Cannot train model.")
        return

    # Convert all categorical columns to numeric using one-hot encoding or label encoding
    # For simplicity, we select only numeric types and drop others.
    # A robust solution would handle categorical features properly.
    X_numeric = X.select_dtypes(include=['number'])
    if X_numeric.shape[1] < X.shape[1]:
        logging.warning(f"Dropped {X.shape[1] - X_numeric.shape[1]} non-numeric columns. "
                        "Consider proper encoding for categorical features.")

    # Split data for evaluation
    X_train, X_test, y_train, y_test = train_test_split(X_numeric, y, test_size=0.2, random_state=42, stratify=y)
    logging.info(f"Data split: {len(X_train)} training samples, {len(X_test)} testing samples.")

    # --- Model Training ---
    logging.info("Training RandomForestClassifier...")
    clf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1) # Use all available cores
    clf.fit(X_train, y_train)
    logging.info("Model training complete.")

    # --- Evaluation ---
    logging.info("Evaluating model performance on test set...")
    y_pred = clf.predict(X_test)
    report = classification_report(y_test, y_pred)
    logging.info(f"Classification Report:\n{report}")

    # --- Save Model ---
    try:
        os.makedirs(save_dir, exist_ok=True)
        model_path = os.path.join(save_dir, "model.pkl")
        joblib.dump(clf, model_path)
        logging.info(f"[✔] Model saved successfully to: {model_path}")

        # In a real scenario, you'd also save the scaler, feature list, and performance metrics
        # Example:
        # with open(os.path.join(save_dir, "report.txt"), "w") as f:
        #     f.write(report)
    except Exception as e:
        logging.error(f"Failed to save model: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train a RandomForest model for ZeroHack.")
    parser.add_argument("--dataset", type=str, required=True,
                        help="Path to the training dataset CSV file (e.g., 'ml/datasets/unsw_nb15/cleaned.csv').")
    parser.add_argument("--save-dir", type=str, required=True,
                        help="Directory to save the trained model (e.g., 'ml/models/v1').")

    args = parser.parse_args()

    train_model(dataset_path=args.dataset, save_dir=args.save_dir)
