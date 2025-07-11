'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Clock, ExternalLink, Info } from 'lucide-react'; // Added Info for no incidents case

// Define an interface for the incident data structure based on API response
interface Incident {
  txHash: string;
  blockNumber: number;
  reporter: string;
  sourceIP: string;
  timestamp: string;
  attackType: string;
  explanation: string;
  ipfsHash?: string | null;
}

// Configuration for API endpoint and refresh interval
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008'; // FastAPI backend
const INCIDENTS_ENDPOINT = `${API_BASE_URL}/api/incidents`;
const REFRESH_INTERVAL_MS = 30000; // 30 seconds

const IncidentsPage = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchIncidents = async () => {
    // For the initial load, don't clear incidents immediately, only if successful
    // For subsequent loads (refresh), it's okay to set isLoading true
    if(incidents.length > 0) setIsLoading(true);

    setError(null);
    try {
      const response = await fetch(INCIDENTS_ENDPOINT);
      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
        } catch (jsonError) {
            // If response is not JSON, use the status text
            errorDetail = response.statusText || errorDetail;
        }
        throw new Error(errorDetail);
      }
      const data: Incident[] = await response.json();
      setIncidents(data);
      setLastUpdated(new Date());
    } catch (e: any) {
      console.error("Failed to fetch incidents:", e);
      setError(e.message || "Failed to load incidents. Ensure the backend API is running and accessible.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents(); // Initial fetch

    const intervalId = setInterval(fetchIncidents, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []);

  // Function to get a link to a generic block explorer (user can adapt URL)
  const getBlockExplorerLink = (txHash: string) => {
    // This is a generic placeholder. For specific networks like Sepolia:
    // return `https://sepolia.etherscan.io/tx/${txHash}`;
    return `https://etherscan.io/tx/${txHash}`; // Defaulting to mainnet Etherscan for placeholder
  };

  // Function to get a link to a public IPFS gateway
  const getIpfsGatewayLink = (ipfsCid: string) => {
    return `https://ipfs.io/ipfs/${ipfsCid}`;
  };

  return (
    <div className="container mx-auto p-4 md:p-8 bg-zinc-900 min-h-screen text-zinc-100">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-emerald-400 flex items-center">
          <ShieldAlert size={40} className="mr-3" />
          Cybersecurity Incident Log
        </h1>
        <p className="text-zinc-400 mt-2">
          Real-time feed of security incidents logged on the blockchain.
          {lastUpdated && (
            <span className="block text-xs mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
              <button
                onClick={() => { setIsLoading(true); fetchIncidents(); }}
                disabled={isLoading}
                className="ml-2 text-emerald-500 hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                (Refresh Now)
              </button>
            </span>
          )}
        </p>
      </header>

      {isLoading && incidents.length === 0 && ( // Show loading only on initial load
        <div className="text-center py-10">
          <p className="text-xl text-zinc-300">Loading incidents...</p>
          {/* Basic spinner */}
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mt-2"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-md relative mb-6" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline ml-1">{error}</span>
        </div>
      )}

      {!isLoading && !error && incidents.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-zinc-700 rounded-lg bg-zinc-800/30">
          <Info size={48} className="mx-auto text-zinc-500 mb-4" />
          <p className="text-xl text-zinc-400">No Incidents Logged Yet</p>
          <p className="text-zinc-500 mt-1">The system is monitoring for threats. New incidents will appear here once detected and logged to the blockchain.</p>
        </div>
      )}

      {incidents.length > 0 && (
        <div className="overflow-x-auto bg-zinc-800 shadow-2xl rounded-lg border border-zinc-700">
          <table className="min-w-full table-fixed">
            <thead className="bg-zinc-700/50">
              <tr>
                <th className="px-4 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-emerald-300 uppercase tracking-wider w-1/6">Timestamp</th>
                <th className="px-4 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-emerald-300 uppercase tracking-wider w-1/6">Attack Type</th>
                <th className="px-4 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-emerald-300 uppercase tracking-wider w-1/6">Source IP</th>
                <th className="px-4 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-emerald-300 uppercase tracking-wider w-2/6">Explanation</th>
                {/* <th className="px-6 py-3 text-left text-xs font-medium text-emerald-300 uppercase tracking-wider">Reporter</th> */}
                <th className="px-4 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-emerald-300 uppercase tracking-wider w-1/6">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {incidents.map((incident, index) => (
                <tr key={incident.txHash || index} className="hover:bg-zinc-700/30 transition-colors duration-150">
                  <td className="px-4 py-3 md:px-6 md:py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm">
                      <Clock size={14} className="mr-2 text-zinc-400 flex-shrink-0" />
                      <div>
                        <div>{new Date(incident.timestamp).toLocaleDateString()}</div>
                        <div className="text-xs text-zinc-500">{new Date(incident.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 md:px-6 md:py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-800/70 text-red-100 border border-red-700">
                      {incident.attackType}
                    </span>
                  </td>
                  <td className="px-4 py-3 md:px-6 md:py-4 whitespace-nowrap font-mono text-sm">{incident.sourceIP}</td>
                  <td className="px-4 py-3 md:px-6 md:py-4 text-sm text-zinc-300 truncate" title={incident.explanation}>{incident.explanation}</td>
                  {/* <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-zinc-400" title={incident.reporter}>
                    {incident.reporter.substring(0, 6)}...{incident.reporter.substring(incident.reporter.length - 4)}
                  </td> */}
                  <td className="px-4 py-3 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      {incident.txHash && (
                       <a
                        href={getBlockExplorerLink(incident.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-500 hover:text-emerald-400 flex items-center"
                        title="View transaction on blockchain explorer"
                      >
                        <ExternalLink size={14} className="mr-1" /> Tx
                      </a>
                      )}
                      {incident.ipfsHash && (
                        <a
                          href={getIpfsGatewayLink(incident.ipfsHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-500 hover:text-sky-400 flex items-center"
                          title="View details on IPFS"
                        >
                          <ExternalLink size={14} className="mr-1" /> IPFS
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
       <footer className="mt-8 text-center text-xs text-zinc-500">
        <p>ZeroHack Incident Monitoring Dashboard</p>
        <p>API Endpoint: {INCIDENTS_ENDPOINT} (Refreshes every {REFRESH_INTERVAL_MS / 1000}s)</p>
      </footer>
    </div>
  );
};

export default IncidentsPage;
