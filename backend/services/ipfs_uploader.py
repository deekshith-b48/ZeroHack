import os
import json
import ipfshttpclient # Ensure this is in requirements.txt

import config # For logger and potentially IPFS API URL from config

logger = config.get_logger(__name__)

# Get IPFS API URL from environment variable, with a common default
IPFS_API_URL = os.getenv("ZERO_HACK_IPFS_API_URL", "/ip4/127.0.0.1/tcp/5001")
# Note: For Dockerized environments or remote IPFS nodes, this URL might be different,
# e.g., /dns/ipfs-node.example.com/tcp/5001/http or just the multiaddr.
# The ipfshttpclient.connect() call often handles parsing this.

def upload_incident_details_to_ipfs(incident_details_dict: dict, filename_suggestion: str = "incident_details.json"):
    """
    Uploads a dictionary of incident details (serialized as JSON) to IPFS.

    Args:
        incident_details_dict (dict): The Python dictionary containing incident details.
        filename_suggestion (str): A suggested filename for the content on IPFS (mostly for metadata).

    Returns:
        str: The IPFS hash (CID) of the uploaded content if successful, otherwise None.
    """
    if not isinstance(incident_details_dict, dict):
        logger.error("IPFS Uploader: `incident_details_dict` must be a dictionary.")
        return None

    try:
        # Serialize the dictionary to a JSON string
        json_content = json.dumps(incident_details_dict, indent=2)
    except TypeError as e:
        logger.error(f"IPFS Uploader: Failed to serialize incident details to JSON: {e}")
        return None

    client = None
    try:
        logger.info(f"IPFS Uploader: Attempting to connect to IPFS daemon at {IPFS_API_URL}...")
        # The `connect=True` parameter explicitly tries to connect and raises an error if it fails.
        # The address format should be a multiaddr.
        client = ipfshttpclient.connect(addr=IPFS_API_URL, session=True) # session=True can improve performance for multiple calls

        # Check connection (optional, as connect() should raise error if daemon not reachable)
        # try:
        #     client.id() # A simple call to check if connection is working
        #     logger.info("IPFS Uploader: Successfully connected to IPFS daemon.")
        # except Exception as conn_err:
        #     logger.error(f"IPFS Uploader: Failed to verify connection to IPFS daemon at {IPFS_API_URL}. Error: {conn_err}")
        #     if client: client.close()
        #     return None

        # Add the JSON string content to IPFS.
        # Using add_str which is simpler than add_bytes or writing to a temp file for strings.
        # The 'wrap_with_directory' and 'pin' options can be useful.
        # Pinning ensures the data is kept by your local node until explicitly unpinned.
        # For this use case, we'll add the string directly.
        # The result is a dictionary (or list of dicts if multiple files). We expect one.

        # Using add_str for direct string upload
        # For metadata like filename, it's better to wrap in a directory or use MFS if more complex structure needed.
        # For a single JSON string, add_str is fine. The "name" is not directly stored with raw content this way.
        # If filename is important, consider client.add(io.BytesIO(json_content.encode()), name=filename_suggestion)

        # Using add_json (if available and suitable - it adds Python dicts directly)
        # result = client.add_json(incident_details_dict) # This directly takes a dict

        # Let's stick to add_str for explicit JSON string control
        result = client.add_str(json_content, pin=True) # Pinning is usually desired

        ipfs_hash = result # For add_str, result is the CID string. For add_json, it's a dict {'Hash': cid}
        # If using add_json, it would be: ipfs_hash = result['Hash']

        logger.info(f"IPFS Uploader: Successfully uploaded incident details. IPFS Hash (CID): {ipfs_hash}")
        return ipfs_hash

    except ipfshttpclient.exceptions.ConnectionError as e:
        logger.error(f"IPFS Uploader: Could not connect to IPFS daemon at {IPFS_API_URL}. Is it running? Error: {e}")
        return None
    except Exception as e:
        logger.error(f"IPFS Uploader: An unexpected error occurred during IPFS upload: {e}", exc_info=True)
        return None
    finally:
        if client:
            try:
                client.close() # Close the session
            except Exception as e_close:
                logger.error(f"IPFS Uploader: Error closing IPFS client session: {e_close}")


if __name__ == '__main__':
    logger.info("Testing IPFS Uploader Module...")
    # User must have IPFS daemon running at IPFS_API_URL (e.g., default /ip4/127.0.0.1/tcp/5001)
    # and environment variable ZERO_HACK_IPFS_API_URL set if different from default.

    # Example incident data
    sample_incident = {
        "timestamp": datetime.datetime.now().isoformat(),
        "source_ip": "192.168.1.123",
        "attack_type": "PORT_SCAN_SIMULATED",
        "severity": "High",
        "details": {
            "ports_targeted": [22, 80, 443, 3306, 5900, 8080],
            "packets_sent": 150,
            "duration_seconds": 30
        },
        "raw_log_snippet": "Sample raw log line related to the incident..."
    }

    print(f"Attempting to upload sample incident to IPFS via {IPFS_API_URL}...")
    cid = upload_incident_details_to_ipfs(sample_incident)

    if cid:
        print(f"Successfully uploaded. CID: {cid}")
        print(f"You can try to view it via a public gateway: https://ipfs.io/ipfs/{cid}")
        print(f"Or using IPFS Desktop or `ipfs cat {cid}` if your daemon is running.")
    else:
        print("Upload failed. Check IPFS daemon status and API URL configuration.")
        print(f"Ensure ZERO_HACK_IPFS_API_URL is set if your daemon isn't at the default multiaddress.")

    # Test with non-dict input
    print("\nTesting with invalid input type:")
    cid_invalid = upload_incident_details_to_ipfs("just a string")
    if cid_invalid is None:
        print("Correctly handled invalid input type.")
    else:
        print(f"Error: Handled invalid input type incorrectly, got CID: {cid_invalid}")

    logger.info("IPFS Uploader Module Test Complete.")
