import pandas as pd
import logging # Use logging for better output control

# Configure basic logging for the test runner
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

# Assuming threat_detector is in the root directory, and test_utils is also accessible
# If backend modules are structured differently, adjust imports
try:
    from threat_detector import ThreatDetectorPipeline
    from test_utils.mock_data_generator import (
        generate_ssh_brute_force_data,
        generate_port_scan_data,
        generate_normal_traffic_data
    )
    # This import is for the config used by the backend modules
    import config
except ImportError as e:
    logger.error(f"Failed to import necessary modules. Ensure PYTHONPATH is set correctly or run from project root. Error: {e}")
    logger.error("Make sure 'threat_detector.py', 'test_utils/mock_data_generator.py', and 'config.py' are accessible.")
    exit(1)


def run_scenario(pipeline: ThreatDetectorPipeline, scenario_name: str, data_df: pd.DataFrame):
    """
    Runs a specific scenario through the threat detection pipeline and prints results.
    """
    logger.info(f"\n--- Running Scenario: {scenario_name} ---")
    if data_df.empty:
        logger.warning(f"Data for scenario '{scenario_name}' is empty. Skipping analysis.")
        return

    logger.info(f"Input data sample (first 3 rows):\n{data_df.head(3).to_string()}")

    # Ensure blockchain_logger's connection is attempted/checked before analysis
    # This might already be handled by pipeline's init or first call, but good to be aware
    if not pipeline.aggregator: # A simple check if pipeline seems initialized
        logger.error("Pipeline does not seem to be initialized correctly.")
        return

    try:
        result = pipeline.analyze_traffic_session(data_df)
    except Exception as e:
        logger.error(f"Exception during '{scenario_name}' analysis: {e}", exc_info=True)
        return

    logger.info(f"--- Result for Scenario: {scenario_name} ---")
    logger.info(f"  Final Verdict: {result.get('final_verdict')}")
    logger.info(f"  Confidence: {result.get('confidence')}")
    logger.info(f"  Explanation Summary:\n    {result.get('explanation_summary', '').replacechr(10), '    ')}") # Indent summary

    if result.get('ipfs_cid'):
        logger.info(f"  IPFS CID: {result.get('ipfs_cid')}")
    if result.get('blockchain_tx_hash'):
        logger.info(f"  Blockchain Tx Hash: {result.get('blockchain_tx_hash')}")

    logger.info("  Layer Outputs:")
    if result.get('layer_outputs'):
        for i, layer_out in enumerate(result.get('layer_outputs', [])):
            logger.info(f"    Layer {i+1}: {layer_out.get('layer')}")
            logger.info(f"      Verdict: {layer_out.get('verdict')}")
            logger.info(f"      Score: {layer_out.get('score')}")
            logger.info(f"      Explanation: {layer_out.get('explanation')}")
            if layer_out.get('rule_id'):
                 logger.info(f"      Rule ID: {layer_out.get('rule_id')}")
    else:
        logger.info("    No layer outputs recorded in result.")
    logger.info(f"--- End of Scenario: {scenario_name} ---\n")


def main():
    logger.info("Initializing Threat Detection Pipeline for Test Scenarios...")

    # Reminder for the user
    logger.info("IMPORTANT: Ensure your .env file is configured with blockchain and IPFS (if used) details.")
    logger.info("Ensure Ganache/Hardhat and IPFS daemon (if testing IPFS) are running.")
    logger.info("Ensure AI models (IF, AE, LSTM) and their scalers are present in the configured 'models' directory if you expect their full participation.")
    logger.info("If AI models are not present, their respective detectors will likely report errors or skip prediction, affecting aggregated results.\n")

    try:
        pipeline = ThreatDetectorPipeline()
    except Exception as e:
        logger.error(f"Failed to initialize ThreatDetectorPipeline: {e}", exc_info=True)
        return

    # Scenario 1: SSH Brute Force
    ssh_brute_df = generate_ssh_brute_force_data(num_attempts=7, window_seconds=20)
    run_scenario(pipeline, "SSH Brute Force Simulation", ssh_brute_df)

    # Scenario 2: Port Scan
    port_scan_df = generate_port_scan_data(num_ports_scanned=15, window_seconds=30)
    run_scenario(pipeline, "Port Scan Simulation", port_scan_df)

    # Scenario 3: Normal Traffic
    # Generate a larger set of normal traffic to see if any false positives occur
    # and to provide enough data for sequence-based models if they were active
    normal_traffic_df = generate_normal_traffic_data(num_events=50, duration_minutes=2)
    run_scenario(pipeline, "Normal Traffic Simulation", normal_traffic_df)

    # Scenario 4: (Optional) Test with empty data
    # run_scenario(pipeline, "Empty Data Input", pd.DataFrame())


    logger.info("All test scenarios complete.")
    logger.info("Review the logs above and check your Ganache/blockchain explorer and IPFS (if applicable) for results.")

if __name__ == "__main__":
    # Setup python-dotenv to find .env from the project root where this script is.
    # This is mainly if blockchain_logger or ipfs_uploader are also trying to load .env
    # and their relative paths might be different when called from here.
    # However, blockchain_logger.py already calls load_dotenv().
    # from dotenv import load_dotenv
    # project_root = os.path.dirname(os.path.abspath(__file__))
    # dotenv_path = os.path.join(project_root, '.env')
    # if os.path.exists(dotenv_path):
    #     load_dotenv(dotenv_path)
    #     logger.info(f"Loaded .env from {dotenv_path}")
    # else:
    #     logger.warning(f".env file not found at {dotenv_path}. Ensure environment variables are set.")

    main()
