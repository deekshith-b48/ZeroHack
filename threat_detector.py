import pandas as pd
import datetime
import time # For performance timing
import uuid # For generating unique incident IDs

# Import detector classes and engines
from Isolation_forest import IsolationForestDetector
from autoencoder_train_test import AutoencoderDetector
from lstm_train_test import LSTMDETector
from signature_engine import SignatureEngine
from aggregator import Aggregator
from backend.blockchain_logger import log_incident_to_blockchain
from backend.ipfs_uploader import upload_incident_details_to_ipfs
from backend.incident_db import add_incident as add_incident_to_db, init_db as init_incident_db # Import DB functions

import config

logger = config.get_logger(__name__)

class ThreatDetectorPipeline:
    def __init__(self):
        logger.info("Initializing Threat Detector Pipeline...")
        self.if_detector = IsolationForestDetector()
        self.ae_detector = AutoencoderDetector()
        self.behavioral_detector = self.ae_detector
        self.signature_engine = SignatureEngine()
        self.aggregator = Aggregator()
        init_incident_db() # Ensure incident DB is initialized when pipeline is created
        logger.info("All detector components initialized and incident DB checked/initialized.")

    def _preprocess_for_ai_models(self, raw_data_df):
        logger.debug(f"Preprocessing data for AI models. Input shape: {raw_data_df.shape}")
        label_column_name = None
        for col in raw_data_df.columns:
            if 'label' in col.lower():
                label_column_name = col
                break

        if label_column_name and label_column_name in raw_data_df.columns:
            features_df = raw_data_df.drop(columns=[label_column_name])
            logger.debug(f"Dropped potential label column '{label_column_name}' for AI model input.")
        else:
            features_df = raw_data_df

        numeric_df = features_df.select_dtypes(include=['number'])
        if numeric_df.empty:
            logger.warning("No numeric features found after selection. AI models might fail.")
            return pd.DataFrame()

        numeric_df.replace([float('inf'), float('-inf')], pd.NA, inplace=True)
        numeric_df.dropna(inplace=True)
        logger.debug(f"Shape after numeric selection and NaN drop: {numeric_df.shape}")
        return numeric_df

    def _format_for_signature_engine(self, raw_data_df):
        logger.debug("Formatting data for Signature Engine...")
        session_events = []
        for _, row in raw_data_df.iterrows():
            event = {}
            ts_val = row.get('timestamp', row.get('Timestamp', pd.NaT))
            if pd.isna(ts_val): event['timestamp'] = datetime.datetime.now()
            elif isinstance(ts_val, str): event['timestamp'] = pd.to_datetime(ts_val).to_pydatetime()
            else: event['timestamp'] = ts_val

            event['source_ip'] = row.get('source_ip', row.get('Src IP', row.get('Source IP', '0.0.0.0')))
            event['dest_ip'] = row.get('dest_ip', row.get('Dst IP', row.get('Destination IP', '0.0.0.0')))
            event['dest_port'] = int(row.get('dest_port', row.get('Dst Port', row.get('Destination Port', 0))))
            session_events.append(event)
        return session_events

    def analyze_traffic_session(self, traffic_data_df):
        pipeline_total_start_time = time.perf_counter()
        logger.info(f"Starting analysis for traffic session with {len(traffic_data_df)} records.")

        if not isinstance(traffic_data_df, pd.DataFrame) or traffic_data_df.empty:
            logger.error("Invalid or empty traffic data provided to pipeline.")
            return {"final_verdict": "ERROR", "confidence": 0.0, "explanation_summary": "Invalid or empty input data.", "layer_outputs": []}

        # --- Stage: Data Preprocessing ---
        preprocess_start_time = time.perf_counter()
        ai_input_df = self._preprocess_for_ai_models(traffic_data_df.copy())
        signature_input_list = self._format_for_signature_engine(traffic_data_df.copy())
        preprocess_end_time = time.perf_counter()
        logger.debug(f"[TIMER] Data preprocessing: {preprocess_end_time - preprocess_start_time:.4f}s")

        # --- Stage: Detection Layers ---
        detection_layers_start_time = time.perf_counter()

        if_start_time = time.perf_counter()
        if_result = self.if_detector.predict(ai_input_df) if not ai_input_df.empty else \
                    {"verdict": "skipped", "score": 0.0, "explanation": "Input for IF was empty."}
        if_end_time = time.perf_counter()
        logger.debug(f"[TIMER] Isolation Forest detection: {if_end_time - if_start_time:.4f}s")

        behavioral_start_time = time.perf_counter()
        behavioral_result = self.behavioral_detector.predict(ai_input_df) if not ai_input_df.empty else \
                            {"verdict": "skipped", "score": 0.0, "explanation": f"Input for {self.behavioral_detector.__class__.__name__} was empty.", "model_type": self.behavioral_detector.__class__.__name__}
        behavioral_end_time = time.perf_counter()
        logger.debug(f"[TIMER] Behavioral ({self.behavioral_detector.__class__.__name__}) detection: {behavioral_end_time - behavioral_start_time:.4f}s")

        signature_start_time = time.perf_counter()
        signature_findings = self.signature_engine.analyze_session(signature_input_list)
        signature_end_time = time.perf_counter()
        logger.debug(f"[TIMER] Signature Engine analysis: {signature_end_time - signature_start_time:.4f}s")

        detection_layers_end_time = time.perf_counter()
        logger.debug(f"[TIMER] All detection layers (total): {detection_layers_end_time - detection_layers_start_time:.4f}s")

        # --- Stage: Aggregation ---
        aggregation_start_time = time.perf_counter()
        final_verdict_data = self.aggregator.aggregate_results(if_result, behavioral_result, signature_findings)
        aggregation_end_time = time.perf_counter()
        logger.debug(f"[TIMER] Aggregation: {aggregation_end_time - aggregation_start_time:.4f}s")

        logger.info(f"Final Verdict: {final_verdict_data['final_verdict']}, Confidence: {final_verdict_data['confidence']}")
        logger.debug(f"Explanation: {final_verdict_data['explanation_summary']}")
        logger.debug(f"Layer Outputs: {final_verdict_data['layer_outputs']}")

        # --- Stage: Post-aggregation actions (IPFS, Blockchain) ---
        post_aggregation_start_time = time.perf_counter()
        if final_verdict_data['final_verdict'] == "THREAT":
            # Pass the original traffic_data_df for context if needed by _handle_threat for IPFS
            self._handle_threat(final_verdict_data, traffic_data_df)
        else:
            self._handle_safe(final_verdict_data)
        post_aggregation_end_time = time.perf_counter()
        logger.debug(f"[TIMER] Post-aggregation actions (threat/safe handling): {post_aggregation_end_time - post_aggregation_start_time:.4f}s")

        pipeline_total_end_time = time.perf_counter()
        logger.info(f"[TIMER] Total analyze_traffic_session duration: {pipeline_total_end_time - pipeline_total_start_time:.4f}s")

        return final_verdict_data

    def _handle_threat(self, threat_data, original_traffic_df_sample=None):
        handle_threat_start_time = time.perf_counter()

        # Generate a unique ID for this incident
        incident_id = f"inc_{uuid.uuid4().hex[:12]}"
        threat_data['incident_id'] = incident_id # Add to the data that might be returned by API

        logger.warning(f"THREAT DETECTED (ID: {incident_id}): Confidence {threat_data['confidence']:.2f}. Details: {threat_data['explanation_summary']}")

        source_ip = "N/A"
        attack_type = threat_data.get('final_verdict_reason', "Aggregated Threat")

        if threat_data.get('layer_outputs'):
            for layer_out in threat_data['layer_outputs']:
                if layer_out.get('layer') == 'Signature' and layer_out.get('details'):
                    source_ip = layer_out['details'].get('source_ip', source_ip)
                    attack_type = layer_out.get('rule_id', attack_type)
                    break

        event_timestamp = threat_data.get('timestamp', datetime.datetime.now().isoformat())
        bc_explanation = f"Conf: {threat_data['confidence']:.2f}; {threat_data['explanation_summary'][:250]}"

        # --- IPFS Upload ---
        ipfs_upload_start_time = time.perf_counter()
        ipfs_hash_for_bc = ""
        detailed_incident_data_for_ipfs = {
            "final_verdict": threat_data.get("final_verdict"),
            "confidence": threat_data.get("confidence"),
            "detection_pipeline_timestamp": datetime.datetime.now().isoformat(),
            "approximated_event_timestamp": event_timestamp,
            "identified_source_ip": source_ip,
            "identified_attack_type": attack_type,
            "full_explanation_summary": threat_data.get("explanation_summary"),
            "layer_outputs": threat_data.get("layer_outputs"),
        }
        if original_traffic_df_sample is not None and not original_traffic_df_sample.empty:
            try:
                detailed_incident_data_for_ipfs["triggering_data_sample"] = original_traffic_df_sample.head().to_dict(orient='records')
            except Exception as e:
                logger.error(f"Could not serialize sample of original_traffic_df_sample for IPFS: {e}")

        logger.info("Attempting to upload detailed incident report to IPFS...")
        uploaded_cid = upload_incident_details_to_ipfs(detailed_incident_data_for_ipfs)
        ipfs_upload_end_time = time.perf_counter()

        if uploaded_cid:
            ipfs_hash_for_bc = uploaded_cid
            logger.info(f"Successfully uploaded incident details to IPFS. CID: {ipfs_hash_for_bc}")
            threat_data['ipfs_cid'] = ipfs_hash_for_bc
        else:
            logger.warning("Failed to upload incident details to IPFS. Proceeding with blockchain log without IPFS hash.")
        logger.debug(f"[TIMER] IPFS Upload: {ipfs_upload_end_time - ipfs_upload_start_time:.4f}s")

        # --- Blockchain Logging ---
        blockchain_log_start_time = time.perf_counter()
        try:
            logger.info(f"Attempting to log incident to blockchain: IP {source_ip}, Type {attack_type}, Timestamp {event_timestamp}, IPFS: {ipfs_hash_for_bc}")
            tx_hash = log_incident_to_blockchain(
                source_ip=str(source_ip),
                timestamp=str(event_timestamp),
                attack_type=str(attack_type),
                explanation=str(bc_explanation),
                ipfs_hash=str(ipfs_hash_for_bc)
            )
            if tx_hash:
                logger.info(f"Successfully logged threat to blockchain. Transaction Hash: {tx_hash}")
                threat_data['blockchain_tx_hash'] = tx_hash
            else:
                logger.error("Failed to log threat to blockchain (log_incident_to_blockchain returned None).")

        except Exception as e:
            logger.error(f"Error during blockchain logging preparation or call: {e}", exc_info=True)
        blockchain_log_end_time = time.perf_counter()
        logger.debug(f"[TIMER] Blockchain Logging: {blockchain_log_end_time - blockchain_log_start_time:.4f}s")

        # --- Log to Local Incident DB ---
        local_db_log_start_time = time.perf_counter()
        try:
            db_incident_id = add_incident_to_db(
                incident_id=incident_id, # Use the generated UUID
                detection_timestamp=datetime.datetime.now().isoformat(), # Timestamp of this pipeline's detection
                source_ip=source_ip,
                attack_type=attack_type,
                explanation=threat_data.get('explanation_summary'),
                confidence=threat_data.get('confidence'),
                ipfs_hash=threat_data.get('ipfs_cid'), # Get from threat_data if IPFS was successful
                blockchain_tx_hash=threat_data.get('blockchain_tx_hash'), # Get from threat_data
                layer_outputs=threat_data.get('layer_outputs'),
                full_threat_data=threat_data # Store the whole thing for detailed review
            )
            if db_incident_id:
                logger.info(f"Incident {db_incident_id} successfully logged to local database.")
            else:
                logger.error(f"Failed to log incident {incident_id} to local database.")
        except Exception as e:
            logger.error(f"Error logging incident {incident_id} to local database: {e}", exc_info=True)
        local_db_log_end_time = time.perf_counter()
        logger.debug(f"[TIMER] Local DB Logging: {local_db_log_end_time - local_db_log_start_time:.4f}s")

        # Placeholder: Smart contract trigger
        # Placeholder: WebSocket alert to dashboard

        handle_threat_end_time = time.perf_counter()
        logger.debug(f"[TIMER] Total _handle_threat duration: {handle_threat_end_time - handle_threat_start_time:.4f}s")
        pass

    def _handle_safe(self, data):
        logger.info(f"Traffic assessed as SAFE. Confidence: {data['confidence']:.2f}.")
        pass

if __name__ == '__main__':
    logger.info("Threat Detector Pipeline Test")
    pipeline = ThreatDetectorPipeline()

    now = pd.Timestamp.now()
    ssh_brute_force_events = []
    for i in range(7):
        ssh_brute_force_events.append({
            'timestamp': now - pd.Timedelta(seconds=i*5),
            'source_ip': '192.168.1.101',
            'dest_ip': '10.0.0.5',
            'dest_port': 22,
            'SomeFeature1': 0.5 + i*0.01,
            'SomeFeature2': 70 + i,
            'Label': 'Attack'
        })
    df_ssh_brute = pd.DataFrame(ssh_brute_force_events)

    print("\n--- Analyzing potential SSH Brute Force session ---")
    if pipeline.if_detector.model is None or pipeline.behavioral_detector.model is None:
         logger.warning("One or more AI models not loaded. AI predictions in this test will be errors/skipped.")
    result1 = pipeline.analyze_traffic_session(df_ssh_brute)
    print(f"Test 1 Result: {result1['final_verdict']} (Confidence: {result1['confidence']})")
    print(f"Explanation: {result1['explanation_summary']}")
    if 'ipfs_cid' in result1: print(f"IPFS CID: {result1['ipfs_cid']}")
    if 'blockchain_tx_hash' in result1: print(f"Blockchain Tx: {result1['blockchain_tx_hash']}")

    normal_events = []
    for i in range(10):
         normal_events.append({
            'timestamp': now - pd.Timedelta(minutes=i),
            'source_ip': f'192.168.0.{i+10}',
            'dest_ip': f'10.0.0.{20+i}',
            'dest_port': 80 if i % 2 == 0 else 443,
            'SomeFeature1': 0.1 + (i*0.005),
            'SomeFeature2': 20 + i*2,
            'Label': 'Benign'
        })
    df_normal = pd.DataFrame(normal_events)
    print("\n--- Analyzing potentially normal session ---")
    result2 = pipeline.analyze_traffic_session(df_normal)
    print(f"Test 2 Result: {result2['final_verdict']} (Confidence: {result2['confidence']})")
    print(f"Explanation: {result2['explanation_summary']}")

    logger.info("Threat Detector Pipeline Test Complete.")
