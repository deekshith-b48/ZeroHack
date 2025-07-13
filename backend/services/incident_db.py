import sqlite3
import os
import uuid
import datetime
import json # For storing complex data like layer_outputs if needed as TEXT

import config # For logger

logger = config.get_logger(__name__)

# Define the directory and database file path relative to the project root
# Assuming this script is in backend/, so ../logs/
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
DB_PATH = os.path.join(DB_DIR, "local_incidents.sqlite")

def init_db():
    """Initializes the database and creates the incidents table if it doesn't exist."""
    try:
        os.makedirs(DB_DIR, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Create incidents table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                detection_timestamp TEXT NOT NULL,
                source_ip TEXT,
                attack_type TEXT,
                explanation TEXT,
                confidence REAL,
                ipfs_hash TEXT,
                blockchain_tx_hash TEXT,
                layer_outputs_json TEXT,
                full_threat_data_json TEXT
            )
        ''')
        # Added layer_outputs_json to store the list of dicts from aggregator
        # Added full_threat_data_json to store the complete threat_data dict from aggregator

        conn.commit()
        logger.info(f"Database initialized/checked successfully at {DB_PATH}")
    except sqlite3.Error as e:
        logger.error(f"SQLite error during DB initialization: {e}", exc_info=True)
    except Exception as e:
        logger.error(f"Unexpected error during DB initialization: {e}", exc_info=True)
    finally:
        if conn:
            conn.close()

def add_incident(
    incident_id: str,
    detection_timestamp: str, # ISO format string
    source_ip: Optional[str],
    attack_type: Optional[str],
    explanation: Optional[str],
    confidence: Optional[float],
    ipfs_hash: Optional[str] = None,
    blockchain_tx_hash: Optional[str] = None,
    layer_outputs: Optional[list] = None, # List of dicts from aggregator
    full_threat_data: Optional[dict] = None # The complete dict from aggregator
) -> Optional[str]:
    """
    Adds a new incident to the local SQLite database.

    Args:
        incident_id (str): Unique ID for the incident.
        detection_timestamp (str): ISO format timestamp of when the detection occurred.
        source_ip (Optional[str]): Source IP, if applicable.
        attack_type (Optional[str]): Type of attack.
        explanation (Optional[str]): Summary explanation.
        confidence (Optional[float]): Confidence score of the detection.
        ipfs_hash (Optional[str]): IPFS hash of detailed logs, if available.
        blockchain_tx_hash (Optional[str]): Blockchain transaction hash, if available.
        layer_outputs (Optional[list]): Detailed outputs from each detection layer.
        full_threat_data (Optional[dict]): The complete threat data dictionary from the aggregator.

    Returns:
        Optional[str]: The incident_id if successful, else None.
    """
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Serialize complex fields to JSON strings
        layer_outputs_json = json.dumps(layer_outputs) if layer_outputs is not None else None
        full_threat_data_json = json.dumps(full_threat_data) if full_threat_data is not None else None

        cursor.execute('''
            INSERT INTO incidents (
                id, detection_timestamp, source_ip, attack_type, explanation,
                confidence, ipfs_hash, blockchain_tx_hash, layer_outputs_json, full_threat_data_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            incident_id, detection_timestamp, source_ip, attack_type, explanation,
            confidence, ipfs_hash, blockchain_tx_hash, layer_outputs_json, full_threat_data_json
        ))
        conn.commit()
        logger.info(f"Incident {incident_id} added to local database.")
        return incident_id
    except sqlite3.Error as e:
        logger.error(f"SQLite error adding incident {incident_id}: {e}", exc_info=True)
        return None
    except Exception as e:
        logger.error(f"Unexpected error adding incident {incident_id}: {e}", exc_info=True)
        return None
    finally:
        if conn:
            conn.close()

# --- Functions for fetching incidents (can be expanded later for analytics) ---
def get_incident_by_id(incident_id: str) -> Optional[dict]:
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row # Access columns by name
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        row = cursor.fetchone()
        if row:
            incident = dict(row)
            # Deserialize JSON fields
            if incident.get('layer_outputs_json'):
                incident['layer_outputs'] = json.loads(incident['layer_outputs_json'])
            if incident.get('full_threat_data_json'):
                incident['full_threat_data'] = json.loads(incident['full_threat_data_json'])
            return incident
        return None
    except sqlite3.Error as e:
        logger.error(f"SQLite error fetching incident {incident_id}: {e}", exc_info=True)
        return None
    finally:
        if conn:
            conn.close()

def get_recent_incidents(limit: int = 100) -> List[dict]:
    conn = None
    incidents_list = []
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        # Order by detection_timestamp descending to get recent ones
        cursor.execute("SELECT * FROM incidents ORDER BY detection_timestamp DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        for row in rows:
            incident = dict(row)
            if incident.get('layer_outputs_json'):
                incident['layer_outputs'] = json.loads(incident['layer_outputs_json'])
            # For a list view, maybe don't load full_threat_data_json unless needed
            # if incident.get('full_threat_data_json'):
            #     incident['full_threat_data'] = json.loads(incident['full_threat_data_json'])
            incidents_list.append(incident)
        return incidents_list
    except sqlite3.Error as e:
        logger.error(f"SQLite error fetching recent incidents: {e}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()

def get_incidents_by_ip(ip_address: str, limit: int = 10) -> List[dict]:
    """Fetches the most recent incidents for a specific IP address."""
    conn = None
    incidents_list = []
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        query = """
            SELECT * FROM incidents
            WHERE source_ip = ?
            ORDER BY detection_timestamp DESC
            LIMIT ?
        """
        cursor.execute(query, (ip_address, limit))
        rows = cursor.fetchall()
        for row in rows:
            incident = dict(row)
            if incident.get('layer_outputs_json'):
                incident['layer_outputs'] = json.loads(incident['layer_outputs_json'])
            incidents_list.append(incident)
        return incidents_list
    except sqlite3.Error as e:
        logger.error(f"SQLite error fetching incidents for IP {ip_address}: {e}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()


# Initialize the database and table when this module is first imported or run.
# This ensures the DB exists before other parts of the application try to use it.

# --- Analytics Functions ---

def get_threats_over_time(period: str = "day", limit: int = 30) -> List[Dict[str, Any]]:
    """
    Aggregates incident counts by time periods.
    Supported periods: 'hour', 'day', 'week', 'month'.
    """
    conn = None
    results = []
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Choose date formatting string based on period
        if period == "hour":
            # Groups by YYYY-MM-DD HH:00:00
            date_format_str = "%Y-%m-%d %H:00:00"
        elif period == "week":
            # Groups by Year and Week Number (ISO week date)
            # SQLite's strftime '%W' gives week of year (Sun-Sat), '%Y' gives year.
            # For ISO week (Mon-Sun), '%G-W%V' is better but might need custom handling or date library.
            # Simpler: group by start of the week (Monday). strftime('%w') is day of week (0=Sun, 1=Mon,...6=Sat)
            # To get Monday as start of week: date(detection_timestamp, '-' || (strftime('%w', detection_timestamp) - 1) || ' days')
            # For simplicity, let's use '%Y-%W' (Year-WeekNumber) which is common though week start might vary by locale/SQLite version.
            # A more robust way involves date arithmetic to find start of ISO week.
            # For now, using a simpler grouping for demonstration.
            date_format_str = "%Y-%W" # Year-WeekNumber (locale dependent start of week)
        elif period == "month":
            date_format_str = "%Y-%m-01" # Group by start of month
        elif period == "day": # Default
            date_format_str = "%Y-%m-%d"
        else:
            logger.warning(f"Unsupported period '{period}' for threats_over_time. Defaulting to 'day'.")
            date_format_str = "%Y-%m-%d"

        # Ensure detection_timestamp is correctly handled as TEXT ISO8601 format for strftime
        query = f"""
            SELECT
                strftime('{date_format_str}', detection_timestamp) as period_start,
                COUNT(id) as incident_count
            FROM incidents
            GROUP BY period_start
            ORDER BY period_start DESC
            LIMIT ?
        """
        cursor.execute(query, (limit,))
        rows = cursor.fetchall()
        for row in rows:
            results.append({"period_start": row[0], "count": row[1]})

        # Reverse to have chronological order for charts
        results.reverse()
        return results

    except sqlite3.Error as e:
        logger.error(f"SQLite error in get_threats_over_time (period: {period}): {e}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()

def get_attack_type_distribution() -> List[Dict[str, Any]]:
    """Counts occurrences of each attack_type."""
    conn = None
    results = []
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        query = """
            SELECT
                attack_type,
                COUNT(id) as incident_count
            FROM incidents
            WHERE attack_type IS NOT NULL AND attack_type != ''
            GROUP BY attack_type
            ORDER BY incident_count DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        for row in rows:
            results.append({"attack_type": row[0], "count": row[1]})
        return results
    except sqlite3.Error as e:
        logger.error(f"SQLite error in get_attack_type_distribution: {e}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()

def get_top_offending_ips(limit: int = 10) -> List[Dict[str, Any]]:
    """Counts incidents per source_ip and returns the top N."""
    conn = None
    results = []
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        query = """
            SELECT
                source_ip,
                COUNT(id) as incident_count
            FROM incidents
            WHERE source_ip IS NOT NULL AND source_ip != '' AND source_ip != 'N/A'
            GROUP BY source_ip
            ORDER BY incident_count DESC
            LIMIT ?
        """
        cursor.execute(query, (limit,))
        rows = cursor.fetchall()
        for row in rows:
            results.append({"source_ip": row[0], "count": row[1]})
        return results
    except sqlite3.Error as e:
        logger.error(f"SQLite error in get_top_offending_ips: {e}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    logger.info("Initializing and testing incident_db.py...")
    init_db() # Ensure table exists

    # Test adding an incident
    test_id = f"test_{uuid.uuid4().hex[:8]}"
    ts = datetime.datetime.now().isoformat()

    mock_layer_outputs = [
        {"layer": "Signature", "verdict": "threat", "rule_id": "TEST_RULE"},
        {"layer": "IsolationForest", "verdict": "anomaly", "score": -0.2}
    ]
    mock_full_threat_data = {
        "final_verdict": "THREAT", "confidence": 0.88,
        "explanation_summary": "Test threat with multiple signals.",
        "layer_outputs": mock_layer_outputs
    }

    added_id = add_incident(
        incident_id=test_id,
        detection_timestamp=ts,
        source_ip="127.0.0.1",
        attack_type="TEST_ATTACK",
        explanation="A test incident for the local DB.",
        confidence=0.99,
        ipfs_hash="QmTestHashForDB",
        blockchain_tx_hash="0xTestTxHashForDB",
        layer_outputs=mock_layer_outputs,
        full_threat_data=mock_full_threat_data
    )

    if added_id:
        logger.info(f"Test incident added with ID: {added_id}")
        retrieved_incident = get_incident_by_id(added_id)
        if retrieved_incident:
            logger.info(f"Retrieved test incident: {retrieved_incident['id']}, Attack: {retrieved_incident['attack_type']}")
            assert retrieved_incident['layer_outputs'][0]['rule_id'] == "TEST_RULE"
            logger.info("Test incident data seems correct.")
        else:
            logger.error("Failed to retrieve the test incident.")
    else:
        logger.error("Failed to add test incident.")

    logger.info("\nFetching recent incidents:")
    recent = get_recent_incidents(5)
    for inc in recent:
        logger.info(f"  ID: {inc['id']}, Type: {inc['attack_type']}, Time: {inc['detection_timestamp']}")

    logger.info("incident_db.py test complete.")
else:
    # Ensure DB is initialized if module is imported elsewhere
    init_db()
