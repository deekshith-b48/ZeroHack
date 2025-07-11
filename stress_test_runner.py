import asyncio
import httpx
import time
import os
import random
import logging
from typing import List, Dict, Any

# Configure basic logging for the stress tester
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger("stress_test_runner")

try:
    # Assuming mock_data_generator is in test_utils sibling to backend, or adjust path
    from test_utils.mock_data_generator import (
        generate_ssh_brute_force_data,
        generate_port_scan_data,
        generate_normal_traffic_data
    )
except ImportError:
    logger.error("Failed to import mock_data_generator. Ensure it's in test_utils and PYTHONPATH is correct.")
    logger.error("Attempting to use a simplified inline data generator as fallback.")
    # Fallback mock data generator if import fails
    def generate_ssh_brute_force_data(num_attempts=5, **kwargs): # Simplified
        import pandas as pd
        import datetime
        now = pd.Timestamp.now()
        return pd.DataFrame([
            {'timestamp': (now - pd.Timedelta(seconds=s*2)).isoformat(), 'source_ip': '10.0.0.99', 'dest_ip': '10.0.0.1', 'dest_port': 22, 'SomeFeature1': 0.1, 'SomeFeature2': 10}
            for s in range(num_attempts)
        ])
    def generate_port_scan_data(num_ports_scanned=10, **kwargs): # Simplified
        import pandas as pd
        import datetime
        now = pd.Timestamp.now()
        return pd.DataFrame([
            {'timestamp': (now - pd.Timedelta(seconds=s)).isoformat(), 'source_ip': '10.0.0.98', 'dest_ip': '10.0.0.2', 'dest_port': 20+s, 'SomeFeature1': 0.2, 'SomeFeature2': 20}
            for s in range(num_ports_scanned)
        ])
    def generate_normal_traffic_data(num_events=10, **kwargs): # Simplified
        import pandas as pd
        import datetime
        now = pd.Timestamp.now()
        return pd.DataFrame([
            {'timestamp': (now - pd.Timedelta(seconds=s*5)).isoformat(), 'source_ip': f'10.0.1.{s}', 'dest_ip': '10.0.0.3', 'dest_port': 80, 'SomeFeature1': 0.3, 'SomeFeature2': 30}
            for s in range(num_events)
        ])


# --- Configuration ---
API_BASE_URL = os.getenv("ZERO_HACK_API_URL", "http://localhost:8008") # FastAPI server URL
ANALYZE_ENDPOINT = f"{API_BASE_URL}/api/analyze"

NUM_CONCURRENT_REQUESTS = int(os.getenv("STRESS_TEST_CONCURRENCY", "50"))
REQUEST_TIMEOUT_SECONDS = int(os.getenv("STRESS_TEST_TIMEOUT", "120")) # Generous timeout for blockchain interaction

# --- Helper to prepare payload ---
def prepare_payload(scenario_type: str) -> Dict[str, List[Dict[str, Any]]]:
    df = None
    if scenario_type == "ssh_brute_force":
        df = generate_ssh_brute_force_data(num_attempts=random.randint(5,10))
    elif scenario_type == "port_scan":
        df = generate_port_scan_data(num_ports_scanned=random.randint(10,20))
    elif scenario_type == "normal":
        df = generate_normal_traffic_data(num_events=random.randint(5, 20))
    else: # Default to normal
        df = generate_normal_traffic_data(num_events=random.randint(5,15))

    # Convert DataFrame to list of dicts for JSON payload
    return {"events": df.to_dict(orient='records')}


async def send_analysis_request(client: httpx.AsyncClient, request_id: int, scenario_type: str):
    payload = prepare_payload(scenario_type)
    request_start_time = time.perf_counter()
    logger.debug(f"Request {request_id} ({scenario_type}): Sending {len(payload['events'])} events...")

    try:
        response = await client.post(ANALYZE_ENDPOINT, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
        response_time_ms = (time.perf_counter() - request_start_time) * 1000

        if response.status_code == 200:
            logger.debug(f"Request {request_id} ({scenario_type}): Success ({response.status_code}) in {response_time_ms:.2f}ms. Verdict: {response.json().get('final_verdict')}")
            return {"id": request_id, "status": "success", "http_status": response.status_code, "time_ms": response_time_ms, "response_data": response.json()}
        else:
            logger.warning(f"Request {request_id} ({scenario_type}): Failed ({response.status_code}) in {response_time_ms:.2f}ms. Response: {response.text[:200]}")
            return {"id": request_id, "status": "failed_http", "http_status": response.status_code, "time_ms": response_time_ms, "error_detail": response.text[:200]}
    except httpx.TimeoutException:
        response_time_ms = (time.perf_counter() - request_start_time) * 1000
        logger.error(f"Request {request_id} ({scenario_type}): Timeout after {response_time_ms:.2f}ms")
        return {"id": request_id, "status": "timeout", "time_ms": response_time_ms}
    except httpx.RequestError as e:
        response_time_ms = (time.perf_counter() - request_start_time) * 1000
        logger.error(f"Request {request_id} ({scenario_type}): Request error '{e.__class__.__name__}' after {response_time_ms:.2f}ms: {e}")
        return {"id": request_id, "status": "request_error", "error_detail": str(e), "time_ms": response_time_ms}
    except Exception as e:
        response_time_ms = (time.perf_counter() - request_start_time) * 1000
        logger.error(f"Request {request_id} ({scenario_type}): Generic error '{e.__class__.__name__}' after {response_time_ms:.2f}ms: {e}", exc_info=True)
        return {"id": request_id, "status": "generic_error", "error_detail": str(e), "time_ms": response_time_ms}


async def main_stress_test():
    logger.info(f"Starting stress test: {NUM_CONCURRENT_REQUESTS} concurrent requests to {ANALYZE_ENDPOINT}")
    logger.info(f"Individual request timeout set to: {REQUEST_TIMEOUT_SECONDS} seconds.")

    # User reminder
    logger.info("IMPORTANT: Ensure the FastAPI server (`backend/api_server.py`) is running.")
    logger.info("Ensure your Ethereum testnet (Ganache/Hardhat) and IPFS daemon (if testing IPFS) are running and configured via .env.")

    overall_start_time = time.perf_counter()

    # Distribute scenario types among requests
    scenario_types = ["ssh_brute_force", "port_scan", "normal"]
    tasks = []
    async with httpx.AsyncClient() as client:
        for i in range(NUM_CONCURRENT_REQUESTS):
            # Cycle through scenario types, or make it random
            scenario = scenario_types[i % len(scenario_types)]
            # scenario = random.choice(scenario_types) # For more randomness
            tasks.append(send_analysis_request(client, i + 1, scenario))

        results = await asyncio.gather(*tasks, return_exceptions=False) # return_exceptions=False will raise if a task has unhandled exception

    overall_duration_s = time.perf_counter() - overall_start_time

    # --- Analyze Results ---
    success_count = 0
    failed_http_count = 0
    timeout_count = 0
    request_error_count = 0
    generic_error_count = 0

    total_response_time_ms = 0
    valid_response_times = []

    for res in results:
        if res: # Check if res is not None (though gather with return_exceptions=False should prevent None)
            if res["status"] == "success":
                success_count += 1
            elif res["status"] == "failed_http":
                failed_http_count += 1
            elif res["status"] == "timeout":
                timeout_count += 1
            elif res["status"] == "request_error":
                request_error_count +=1
            elif res["status"] == "generic_error":
                generic_error_count +=1

            if "time_ms" in res:
                total_response_time_ms += res["time_ms"]
                if res["status"] == "success": # Only consider successful requests for avg response time calculation
                     valid_response_times.append(res["time_ms"])

    logger.info("\n--- Stress Test Summary ---")
    logger.info(f"Total requests sent: {NUM_CONCURRENT_REQUESTS}")
    logger.info(f"Overall duration: {overall_duration_s:.3f} seconds")
    logger.info(f"Successful requests (HTTP 200): {success_count}")
    logger.info(f"Failed requests (HTTP non-200): {failed_http_count}")
    logger.info(f"Timed out requests: {timeout_count}")
    logger.info(f"Client request errors: {request_error_count}")
    logger.info(f"Other generic errors: {generic_error_count}")

    if valid_response_times:
        avg_response_time_ms = sum(valid_response_times) / len(valid_response_times)
        max_response_time_ms = max(valid_response_times)
        min_response_time_ms = min(valid_response_times)
        logger.info(f"Average response time (for successes): {avg_response_time_ms:.2f} ms")
        logger.info(f"Min response time (for successes): {min_response_time_ms:.2f} ms")
        logger.info(f"Max response time (for successes): {max_response_time_ms:.2f} ms")
    else:
        logger.info("No successful requests to calculate average response time.")

    if success_count > 0 :
        requests_per_second = success_count / overall_duration_s
        logger.info(f"Approx. throughput (successful requests/sec): {requests_per_second:.2f} RPS")

    logger.info("--- End of Stress Test Summary ---")

if __name__ == "__main__":
    asyncio.run(main_stress_test())
