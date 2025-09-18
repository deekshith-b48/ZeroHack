import config # For logger, if needed in the future

# logger = config.get_logger(__name__) # Example if logging is added

# --- Aggregation Configuration ---
# These thresholds and weights would ideally be tuned based on model performance and security policy.

# Threshold for AI model scores to be considered 'significant' for aggregation
AI_SCORE_THRESHOLD_IF = -0.1  # Example: Isolation Forest scores below this are more anomalous
AI_SCORE_THRESHOLD_AE_LSTM = 0.7 # Example: Normalized MSE above this is more anomalous

# Weights for combining scores (example)
WEIGHT_SIGNATURE = 0.6
WEIGHT_ISOLATION_FOREST = 0.2
WEIGHT_BEHAVIORAL_AI = 0.2 # For Autoencoder/LSTM

# Final confidence threshold for verdict
FINAL_VERDICT_THRESHOLD_THREAT = 0.65 # If combined confidence > this, it's a THREAT

class Aggregator:
    def __init__(self):
        # self.logger = logger # If using class-based logging
        pass

    def aggregate_results(self, isolation_forest_result, behavioral_ai_result, signature_findings):
        """
        Aggregates results from different detection layers to produce a final verdict.

        Args:
            isolation_forest_result (dict): Output from IsolationForestDetector.
                Expected: {'verdict': 'normal'/'anomaly', 'score': float, 'explanation': str}
            behavioral_ai_result (dict): Output from AutoencoderDetector or LSTMDETector.
                Expected: {'verdict': 'normal'/'anomaly', 'score': mse_value, 'explanation': str}
            signature_findings (list): List of findings from SignatureEngine.
                Each finding: {'is_match': True, 'confidence': float, 'rule_id': str, 'explanation': str}

        Returns:
            dict: {"final_verdict": "SAFE" | "THREAT",
                   "confidence": 0.0-1.0,
                   "explanation_summary": str,
                   "layer_outputs": list_of_individual_results}
        """

        explanations = []
        layer_outputs = []

        final_confidence = 0.0
        num_threat_signals = 0

        # 1. Process Signature Findings
        # For simplicity, take the highest confidence signature match if any.
        # A more complex system might consider multiple signature matches.
        highest_confidence_signature = None
        if signature_findings:
            for finding in signature_findings:
                if finding['is_match']: # Should always be true if in the list
                    explanations.append(f"Signature Matcher: {finding['explanation']}")
                    layer_outputs.append({
                        "layer": "Signature",
                        "verdict": "threat", # Signature match implies threat
                        "score": finding['confidence'], # Usually 1.0 for signatures
                        "rule_id": finding['rule_id'],
                        "explanation": finding['explanation']
                    })
                    if highest_confidence_signature is None or finding['confidence'] > highest_confidence_signature['confidence']:
                        highest_confidence_signature = finding

        if highest_confidence_signature:
            # If a signature matches with high confidence, it strongly influences the verdict
            # Let's say a signature match itself contributes significantly to the confidence.
            # This could be a direct override or a heavy weight.
            # For now, let's use its confidence directly if it's the strongest signal.
            # final_confidence = max(final_confidence, highest_confidence_signature['confidence'] * WEIGHT_SIGNATURE) # This is one way
            # Simpler: if signature match, it's a high signal
            if highest_confidence_signature['confidence'] >= 0.9: # Strong signature
                 final_confidence += WEIGHT_SIGNATURE * highest_confidence_signature['confidence']
                 num_threat_signals +=1

        # 2. Process Isolation Forest Result
        if isolation_forest_result:
            explanations.append(f"Isolation Forest: {isolation_forest_result['explanation']}")
            layer_outputs.append({
                "layer": "IsolationForest",
                "verdict": isolation_forest_result['verdict'],
                "score": isolation_forest_result['score'],
                "explanation": isolation_forest_result['explanation']
            })
            # Normalize or interpret score: Lower IF scores are more anomalous.
            # This is a simple linear mapping; could be more sophisticated.
            # Assuming scores range roughly from -0.5 (very anomalous) to 0.5 (very normal).
            # Map to 0 (normal) to 1 (anomaly)
            if_threat_likelihood = 0.0
            if isolation_forest_result['verdict'] == 'anomaly':
                 # Example: if score is -0.1, likelihood = (0.0 - (-0.1)) / (0.0 - (-0.5)) = 0.1 / 0.5 = 0.2
                 # if score is -0.4, likelihood = (0.0 - (-0.4)) / 0.5 = 0.4 / 0.5 = 0.8
                 # This needs careful tuning based on typical score distribution.
                 # For now, a simpler approach: if verdict is 'anomaly', assign a fixed contribution.
                 if_threat_likelihood = 0.6 # Default likelihood if 'anomaly'
                 if isolation_forest_result['score'] < AI_SCORE_THRESHOLD_IF: # More anomalous than typical threshold
                     if_threat_likelihood = 0.8
                 num_threat_signals +=1

            final_confidence += WEIGHT_ISOLATION_FOREST * if_threat_likelihood


        # 3. Process Behavioral AI (Autoencoder/LSTM) Result
        if behavioral_ai_result:
            explanations.append(f"Behavioral AI ({behavioral_ai_result.get('model_type', 'AE/LSTM')}): {behavioral_ai_result['explanation']}")
            layer_outputs.append({
                "layer": f"BehavioralAI ({behavioral_ai_result.get('model_type', 'AE/LSTM')})",
                "verdict": behavioral_ai_result['verdict'],
                "score": behavioral_ai_result['score'], # This is MSE
                "explanation": behavioral_ai_result['explanation']
            })
            # Normalize or interpret score: Higher MSE is more anomalous.
            # Needs normalization based on typical MSE range for normal data.
            # Example: if MSE > threshold, it's an anomaly.
            behavioral_threat_likelihood = 0.0
            if behavioral_ai_result['verdict'] == 'anomaly':
                # Assign higher likelihood if score significantly exceeds a typical threshold
                behavioral_threat_likelihood = 0.6 # Default if 'anomaly'
                # This assumes 'score' is MSE. Higher is bad.
                # The threshold needs to be learned from normal data.
                if behavioral_ai_result['score'] > AI_SCORE_THRESHOLD_AE_LSTM: # Example threshold
                    behavioral_threat_likelihood = 0.8
                num_threat_signals +=1

            final_confidence += WEIGHT_BEHAVIORAL_AI * behavioral_threat_likelihood

        # Normalize final_confidence to be between 0 and 1 if sum of weights can exceed 1
        # Current weights sum to 1.0, so direct sum is okay.
        # Cap confidence at 1.0
        final_confidence = min(final_confidence, 1.0)

        # Determine final verdict
        final_verdict = "SAFE"
        # Logic: If a high-confidence signature matched OR combined confidence is high OR multiple AI signals
        if highest_confidence_signature and highest_confidence_signature['confidence'] >= 0.9:
            final_verdict = "THREAT"
            final_confidence = max(final_confidence, 0.9) # Boost confidence for strong signature
        elif final_confidence > FINAL_VERDICT_THRESHOLD_THREAT:
            final_verdict = "THREAT"
        elif num_threat_signals >= 2 and final_verdict == "SAFE": # If multiple weak signals but not enough confidence
            final_verdict = "THREAT" # Promote to threat if multiple layers agree, even if confidence is lower
            final_confidence = max(final_confidence, 0.5) # Assign a moderate confidence


        explanation_summary = "\n".join(explanations) if explanations else "No specific threats or anomalies detected by any layer."
        if final_verdict == "THREAT" and not explanations: # Should not happen if logic is correct
            explanation_summary = "Threat detected based on aggregated scores, but individual explanations were missing."

        return {
            "final_verdict": final_verdict,
            "confidence": round(final_confidence, 2),
            "explanation_summary": explanation_summary,
            "layer_outputs": layer_outputs
        }

# --- Example Usage (for testing this module) ---
if __name__ == '__main__':
    print("Aggregator Module Test")
    aggregator = Aggregator()

    # Test Case 1: Clear Threat (Strong Signature)
    if_res1 = {'verdict': 'normal', 'score': 0.1, 'explanation': 'Traffic appears normal based on statistical profile.'}
    ae_res1 = {'verdict': 'normal', 'score': 0.05, 'model_type': 'Autoencoder', 'explanation': 'Behavioral profile consistent with training data.'}
    sig_res1 = [{'is_match': True, 'confidence': 1.0, 'rule_id': 'SSH_BRUTE_FORCE', 'explanation': 'Multiple failed SSH logins from 1.2.3.4.'}]

    print("\n--- Test Case 1: Clear Threat (Strong Signature) ---")
    final_verdict1 = aggregator.aggregate_results(if_res1, ae_res1, sig_res1)
    print(f"Final Verdict: {final_verdict1['final_verdict']}, Confidence: {final_verdict1['confidence']}")
    print(f"Explanation Summary:\n{final_verdict1['explanation_summary']}")
    # print(f"Layer Outputs: {final_verdict1['layer_outputs']}")


    # Test Case 2: AI-detected Anomaly, No Signature
    if_res2 = {'verdict': 'anomaly', 'score': -0.2, 'explanation': 'Unusual packet size and TTL combination detected.'}
    ae_res2 = {'verdict': 'anomaly', 'score': 0.85, 'model_type': 'Autoencoder', 'explanation': 'High reconstruction error, indicating deviation from normal behavior.'}
    sig_res2 = []

    print("\n--- Test Case 2: AI-detected Anomaly, No Signature ---")
    final_verdict2 = aggregator.aggregate_results(if_res2, ae_res2, sig_res2)
    print(f"Final Verdict: {final_verdict2['final_verdict']}, Confidence: {final_verdict2['confidence']}")
    print(f"Explanation Summary:\n{final_verdict2['explanation_summary']}")

    # Test Case 3: All Clear
    if_res3 = {'verdict': 'normal', 'score': 0.2, 'explanation': 'Normal traffic profile.'}
    ae_res3 = {'verdict': 'normal', 'score': 0.02, 'model_type': 'LSTM', 'explanation': 'Temporal patterns are normal.'}
    sig_res3 = []

    print("\n--- Test Case 3: All Clear ---")
    final_verdict3 = aggregator.aggregate_results(if_res3, ae_res3, sig_res3)
    print(f"Final Verdict: {final_verdict3['final_verdict']}, Confidence: {final_verdict3['confidence']}")
    print(f"Explanation Summary:\n{final_verdict3['explanation_summary']}")

    # Test Case 4: Mixed Signals (One AI anomaly, weak)
    if_res4 = {'verdict': 'anomaly', 'score': -0.05, 'explanation': 'Slightly unusual statistical properties.'} # Weak IF anomaly
    ae_res4 = {'verdict': 'normal', 'score': 0.1, 'model_type': 'Autoencoder', 'explanation': 'Behavior within normal parameters.'}
    sig_res4 = []

    print("\n--- Test Case 4: Mixed Signals (One weak AI anomaly) ---")
    final_verdict4 = aggregator.aggregate_results(if_res4, ae_res4, sig_res4)
    print(f"Final Verdict: {final_verdict4['final_verdict']}, Confidence: {final_verdict4['confidence']}")
    print(f"Explanation Summary:\n{final_verdict4['explanation_summary']}")

    print("\nAggregator Module Test Complete.")
