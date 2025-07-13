'use client';

import { useState, useEffect } from 'react';
import { Database, Clock, FileText, CheckCircle, AlertTriangle, Search, 
         Link, Hash, FileCode, Shield, Server, Activity, HardDrive, 
         Lock, Globe, Upload, Download, Box, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BlockchainRecord {
  id: number;
  timestamp: string;
  alertHash: string;
  process: string;
  user: string;
  status: 'verified' | 'pending' | 'tampered';
  blockHeight: number;
  txHash?: string;
  ipfsCid?: string;
  threatType?: string;
  confirmations?: number;
  merkleProof?: {
    siblingHashes: string[];
    path: number[];
    verified: boolean;
  };
  forensicEvidence?: {
    type: 'memory_dump' | 'pcap' | 'registry' | 'logs';
    size: string;
    timestamp: string;
    ipfsStatus: 'stored' | 'pending' | 'failed';
  }[];
  channelId?: string;
}

export function BlockchainForensics() {
  const [records, setRecords] = useState<BlockchainRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<BlockchainRecord | null>(null);
  const [merkleRoot, setMerkleRoot] = useState('f8d7e6c5b4a3928170615243');
  const [hyperledgerStatus, setHyperledgerStatus] = useState({
    network: 'running',
    peers: 4,
    orderers: 3,
    channels: 2,
    chaincodeVersions: ['forensic-cc-1.2', 'evidence-cc-1.0', 'auth-cc-2.1'],
    tps: 500,
    latestBlock: 16429781,
    consensusType: 'Raft'
  });
  const [ipfsStatus, setIpfsStatus] = useState({
    connected: true,
    storedItems: 238,
    pinned: 147,
    nodeId: 'QmYHNcgmW63UbcCrP7urPZu6BXxZjzy8xvzCTUggfMpmWu',
    peerCount: 8,
    bandwidth: {
      in: '1.2 MB/s',
      out: '0.8 MB/s'
    },
    replicationFactor: 3
  });
  const [showMerkleProof, setShowMerkleProof] = useState(false);
  const [showIPFSDetails, setShowIPFSDetails] = useState(false);

  useEffect(() => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8008';
    const INCIDENTS_ENDPOINT = `${API_BASE_URL}/api/incidents`;

    const fetchBlockchainRecords = async () => {
      try {
        const response = await fetch(INCIDENTS_ENDPOINT);
        if (!response.ok) {
          throw new Error("Failed to fetch blockchain records");
        }
        const data = await response.json();

        // Map the API response to the component's BlockchainRecord interface
        const mappedRecords = data.map((inc: any, index: number): BlockchainRecord => ({
          id: index + 1,
          timestamp: new Date(inc.timestamp).toLocaleString(),
          alertHash: inc.txHash.substring(0, 32) + '...', // Use txHash as a base for alertHash
          process: inc.attackType, // Use attackType as process for now
          user: inc.sourceIP, // Use sourceIP as user
          status: 'verified', // Assume verified for now
          blockHeight: inc.blockNumber,
          txHash: inc.txHash,
          ipfsCid: inc.ipfsHash,
          threatType: inc.attackType,
          confirmations: 12, // Placeholder
          channelId: 'main-forensic-channel', // Placeholder
          // Merkle proof and forensic evidence would need to be enriched by another service
          // or attached to the IPFS log.
          merkleProof: {
            siblingHashes: ['a1b2c3...'],
            path: [1,0],
            verified: true
          },
          forensicEvidence: inc.ipfsHash ? [{
            type: 'logs',
            size: 'N/A',
            timestamp: new Date(inc.timestamp).toLocaleString(),
            ipfsStatus: 'stored'
          }] : []
        }));

        setRecords(mappedRecords);
      } catch (error) {
        console.error("Error fetching blockchain forensics:", error);
        // Keep mock data on error for demo purposes, or set an error state
      }
    };

    fetchBlockchainRecords();

    // The original mock data can be removed or kept as a fallback.
    // For now, I'll keep it so the component still displays something if the API call fails.
    const mockRecords: BlockchainRecord[] = [
      {
        id: 1,
        timestamp: '2023-05-16 14:23:45',
        alertHash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
        process: 'explorer.exe',
        user: 'SYSTEM',
        status: 'verified',
        blockHeight: 16429781,
        txHash: '0x73ebc8b5d13e3e30e87d87c72f849c7e94822ffdd67477988482bd2162495860',
        ipfsCid: 'QmRCFhCGbMZFaRbS2A4Zcymvu8KKVGNJD5XGkbiBEAEB5n',
        threatType: 'Memory Injection',
        confirmations: 24,
        channelId: 'forensic-channel',
        merkleProof: {
          siblingHashes: ['a1b2c3...', 'd4e5f6...', 'g7h8i9...'],
          path: [1, 0, 1],
          verified: true
        },
        forensicEvidence: [
          {
            type: 'memory_dump',
            size: '24.5 MB',
            timestamp: '2023-05-16 14:23:50',
            ipfsStatus: 'stored'
          },
          {
            type: 'pcap',
            size: '3.2 MB',
            timestamp: '2023-05-16 14:24:10',
            ipfsStatus: 'stored'
          }
        ]
      },
      {
        id: 2,
        timestamp: '2023-05-16 13:12:30',
        alertHash: 'q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
        process: 'svchost.exe',
        user: 'SYSTEM',
        status: 'verified',
        blockHeight: 16429780,
        txHash: '0x41adc87b93e49a6abce795fb9583be54e9328175134ae619c4998a91983cea76',
        ipfsCid: 'QmVSFGCyBKMVHhJqUMTDwHRLbwYKJG6D6xKrTqNxhuKZe4',
        threatType: 'Suspicious Connection',
        confirmations: 35,
        channelId: 'forensic-channel',
        merkleProof: {
          siblingHashes: ['a9b8c7...', 'd6e5f4...', 'g3h2i1...'],
          path: [0, 1, 0],
          verified: true
        },
        forensicEvidence: [
          {
            type: 'pcap',
            size: '1.8 MB',
            timestamp: '2023-05-16 13:12:35',
            ipfsStatus: 'stored'
          }
        ]
      },
      {
        id: 3,
        timestamp: '2023-05-16 12:45:12',
        alertHash: 'g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8',
        process: 'malware.exe',
        user: 'User',
        status: 'verified',
        blockHeight: 16429775,
        txHash: '0x67f8d92451c3e76a781ab1a349c7b7d7328af1b5ae89e329245d86ebc2b093d2',
        ipfsCid: 'QmT8jYMfyvKfSzzH38GVcJ5UjMHWxu6qgZy1eHHRWbGZ5n',
        threatType: 'Ransomware',
        confirmations: 40,
        channelId: 'sensitive-channel',
        merkleProof: {
          siblingHashes: ['j9k8l7...', 'm6n5o4...', 'p3q2r1...'],
          path: [1, 1, 0],
          verified: true
        },
        forensicEvidence: [
          {
            type: 'memory_dump',
            size: '32.1 MB',
            timestamp: '2023-05-16 12:45:20',
            ipfsStatus: 'stored'
          },
          {
            type: 'registry',
            size: '1.4 MB',
            timestamp: '2023-05-16 12:45:25',
            ipfsStatus: 'stored'
          },
          {
            type: 'logs',
            size: '0.8 MB',
            timestamp: '2023-05-16 12:45:30',
            ipfsStatus: 'stored'
          }
        ]
      },
      {
        id: 4,
        timestamp: '2023-05-16 11:03:22',
        alertHash: 'w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4',
        process: 'suspicious_process.exe',
        user: 'User',
        status: 'pending',
        blockHeight: 16429770,
        txHash: '0x0fc8e723d51437e2b6aa47a98b8ce5e3c1d4e86f67488c75524b5a98c7632456',
        ipfsCid: 'QmZsYL2WxgZEFe2KqeN3E5JxTMQARQYbYxUzV9LnCVmgab',
        threatType: 'Data Exfiltration',
        confirmations: 2,
        channelId: 'forensic-channel',
        forensicEvidence: [
          {
            type: 'pcap',
            size: '5.6 MB',
            timestamp: '2023-05-16 11:03:30',
            ipfsStatus: 'pending'
          }
        ]
      },
      {
        id: 5,
        timestamp: '2023-05-16 10:34:18',
        alertHash: 'm5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0',
        process: 'modified_log.exe',
        user: 'Admin',
        status: 'tampered',
        blockHeight: 16429760,
        txHash: '0x23f147adef749c8523b674a7d8f284e5b73f8756ac3782954a72c7f37baf52a1',
        ipfsCid: 'QmUCrP6zF6KFJxDcUgZCJFQUMTFrU6KgBi64EmRFrpZTna',
        threatType: 'Log Tampering',
        confirmations: 50,
        channelId: 'forensic-channel',
        merkleProof: {
          siblingHashes: ['s9t8u7...', 'v6w5x4...', 'y3z2a1...'],
          path: [0, 0, 1],
          verified: false
        },
        forensicEvidence: [
          {
            type: 'logs',
            size: '1.2 MB',
            timestamp: '2023-05-16 10:34:25',
            ipfsStatus: 'stored'
          }
        ]
      },
    ];

    setRecords(mockRecords);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'pending':
        return <Clock size={18} className="text-yellow-500" />;
      case 'tampered':
        return <AlertTriangle size={18} className="text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'tampered':
        return 'text-red-500';
      default:
        return '';
    }
  };

  const handleRecordClick = (record: BlockchainRecord) => {
    setSelectedRecord(record);
  };

  const handleVerifyAll = () => {
    // In a real app, this would trigger a blockchain verification process
    alert('Verification process started. This may take a few minutes.');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <Database className="mr-2 text-emerald-500" size={24} />
            Hyperledger Blockchain Forensics
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Immutable threat logging with permissioned network and IPFS integration</p>
        </div>
        <div className="flex space-x-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by hash, txid, or process..."
              className="bg-zinc-800 text-white rounded-md py-2 pl-10 pr-4 w-72 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-zinc-700"
            />
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
          </div>
          <button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md flex items-center"
            onClick={handleVerifyAll}
          >
            <Shield className="mr-2" size={16} />
            Verify All Records
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-zinc-400">Hyperledger Fabric</div>
            <Shield size={16} className="text-emerald-500" />
          </div>
          <div className="flex items-center mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
            <div className="font-medium">Active Network</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <div>Peers: {hyperledgerStatus.peers}</div>
            <div>Orderers: {hyperledgerStatus.orderers}</div>
            <div>Channels: {hyperledgerStatus.channels}</div>
            <div>TPS: {hyperledgerStatus.tps}</div>
          </div>
        </div>
        
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-zinc-400">Current Merkle Root</div>
            <Hash size={16} className="text-emerald-500" />
          </div>
          <div className="font-mono text-xs mt-1 bg-zinc-900 p-2 rounded overflow-x-auto">
            0x{merkleRoot}ae42b798c354ea42d790
          </div>
          <div className="text-xs text-zinc-500 mt-1 text-right">
            Block #{hyperledgerStatus.latestBlock}
          </div>
        </div>
        
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-zinc-400">IPFS Storage</div>
            <HardDrive size={16} className="text-emerald-500" />
          </div>
          <div className="flex items-center mt-1">
            <div className={`w-2 h-2 rounded-full ${ipfsStatus.connected ? 'bg-emerald-500' : 'bg-red-500'} mr-2`}></div>
            <div className="font-medium">{ipfsStatus.connected ? 'Connected' : 'Disconnected'}</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <div>Memory Dumps: {Math.floor(ipfsStatus.storedItems * 0.4)}</div>
            <div>PCAPs: {Math.floor(ipfsStatus.storedItems * 0.6)}</div>
            <div>CID References: {ipfsStatus.pinned}</div>
            <div>Replication: {ipfsStatus.replicationFactor}x</div>
          </div>
        </div>
        
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-zinc-400">Chaincode</div>
            <FileCode size={16} className="text-emerald-500" />
          </div>
          <div className="font-medium mb-1 text-sm">Active Smart Contracts:</div>
          <div className="space-y-1">
            {hyperledgerStatus.chaincodeVersions.map((version, idx) => (
              <div key={idx} className="text-xs bg-zinc-900 px-2 py-1 rounded flex justify-between">
                <span>{version}</span>
                <span className="text-emerald-500">Active</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-800 p-4 rounded-lg mb-6 border border-zinc-700 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold flex items-center">
            <Activity className="mr-2 text-emerald-500" size={18} />
            Transaction Activity
          </h3>
        </div>
        
        <div className="h-16 flex items-end">
          {/* Mock transaction activity graph */}
          {Array.from({ length: 50 }).map((_, i) => {
            const height = 20 + Math.random() * 80;
            return (
              <motion.div 
                key={i} 
                className="flex-1"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: `${height}%` }}
                transition={{ delay: i * 0.02 }}
              >
                <div 
                  className="bg-emerald-500 mx-0.5 rounded-t-sm opacity-50 hover:opacity-100 transition-opacity"
                  style={{ height: '100%' }}
                ></div>
              </motion.div>
            );
          })}
        </div>
        
        <div className="flex justify-between text-xs text-zinc-500 mt-2">
          <span>May 10</span>
          <span>May 12</span>
          <span>May 14</span>
          <span>May 16</span>
          <span>Today</span>
        </div>
      </div>

      <div className="flex flex-1 space-x-6">
        <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 shadow-lg">
          <div className="bg-zinc-700 px-4 py-3 font-medium flex justify-between items-center">
            <div className="flex items-center">
              <Database size={16} className="mr-2 text-emerald-500" />
              Immutable Log Records
            </div>
            <div className="text-xs text-zinc-400">
              <span className="font-semibold text-emerald-500">{records.length}</span> records stored on-chain
            </div>
          </div>
          <div className="overflow-auto max-h-[calc(100vh-480px)]">
            <table className="w-full">
              <thead className="bg-zinc-700">
                <tr>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Timestamp</th>
                  <th className="px-4 py-2 text-left">Process</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Block Height</th>
                  <th className="px-4 py-2 text-left">Confirmations</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <motion.tr 
                    key={record.id} 
                    className={`border-b border-zinc-700 hover:bg-zinc-700 cursor-pointer ${
                      selectedRecord?.id === record.id ? 'bg-zinc-700' : ''
                    }`}
                    onClick={() => handleRecordClick(record)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: record.id * 0.1 }}
                  >
                    <td className="px-4 py-3">{getStatusIcon(record.status)}</td>
                    <td className="px-4 py-3">{record.timestamp}</td>
                    <td className="px-4 py-3">{record.process}</td>
                    <td className="px-4 py-3">{record.user}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono">{record.blockHeight}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={record.status === 'pending' ? 'text-yellow-500' : 'text-emerald-500'}>
                        {record.confirmations || (record.status === 'pending' ? '1' : Math.floor(Math.random() * 50) + 15)}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-80 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 shadow-lg">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Record Details
          </div>
          {selectedRecord ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center space-x-2">
                {getStatusIcon(selectedRecord.status)}
                <div className={`font-medium ${getStatusColor(selectedRecord.status)}`}>
                  {selectedRecord.status.charAt(0).toUpperCase() + selectedRecord.status.slice(1)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-zinc-400">Timestamp</div>
                  <div className="font-medium">{selectedRecord.timestamp}</div>
                </div>
                
                <div>
                  <div className="text-sm text-zinc-400">Threat Type</div>
                  <div className="font-medium">{selectedRecord.threatType || 'Unknown'}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-zinc-400">Process</div>
                  <div className="font-medium">{selectedRecord.process}</div>
                </div>
                
                <div>
                  <div className="text-sm text-zinc-400">User</div>
                  <div className="font-medium">{selectedRecord.user}</div>
                </div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Channel ID</div>
                <div className="font-medium flex items-center">
                  <Lock size={14} className="mr-1 text-emerald-500" />
                  {selectedRecord.channelId || 'main-channel'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-zinc-400">Block Height</div>
                  <div className="font-medium">{selectedRecord.blockHeight}</div>
                </div>
                
                <div>
                  <div className="text-sm text-zinc-400">Confirmations</div>
                  <div className="font-medium">{selectedRecord.confirmations || 0}</div>
                </div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Transaction Hash</div>
                <div className="font-mono text-xs bg-zinc-700 p-2 rounded mt-1 break-all">
                  {selectedRecord.txHash || 'Pending...'}
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-zinc-400">Merkle Proof</div>
                  <button 
                    className="text-xs text-emerald-500 hover:underline"
                    onClick={() => setShowMerkleProof(!showMerkleProof)}
                  >
                    {showMerkleProof ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>
                
                {showMerkleProof && selectedRecord.merkleProof && (
                  <div className="bg-zinc-700 p-2 rounded mt-1">
                    <div className="flex items-center mb-1">
                      <div className={`w-2 h-2 rounded-full mr-2 ${selectedRecord.merkleProof.verified ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <div className={selectedRecord.merkleProof.verified ? 'text-emerald-500' : 'text-red-500'}>
                        {selectedRecord.merkleProof.verified ? 'Verification Successful' : 'Verification Failed'}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400">Sibling Hashes:</div>
                    {selectedRecord.merkleProof.siblingHashes.map((hash, idx) => (
                      <div key={idx} className="text-xs font-mono text-zinc-300 truncate">{hash}</div>
                    ))}
                    <div className="text-xs text-zinc-400 mt-1">Path: {selectedRecord.merkleProof.path.join(', ')}</div>
                  </div>
                )}
                
                {!selectedRecord.merkleProof && (
                  <div className="text-xs italic text-zinc-500 mt-1">Merkle proof not available for pending records</div>
                )}
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-zinc-400">IPFS Evidence</div>
                  <button 
                    className="text-xs text-emerald-500 hover:underline"
                    onClick={() => setShowIPFSDetails(!showIPFSDetails)}
                    disabled={!selectedRecord.forensicEvidence}
                  >
                    {showIPFSDetails ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>
                
                {showIPFSDetails && selectedRecord.forensicEvidence && (
                  <div className="bg-zinc-700 p-2 rounded mt-1 space-y-2">
                    {selectedRecord.forensicEvidence.map((evidence, idx) => (
                      <div key={idx} className="flex justify-between items-center p-1 border-b border-zinc-600 last:border-0">
                        <div>
                          <div className="text-xs">{evidence.type.replace('_', ' ')}</div>
                          <div className="text-xs text-zinc-400">{evidence.size} • {evidence.timestamp}</div>
                        </div>
                        <div className="flex items-center">
                          <div className={`text-xs ${evidence.ipfsStatus === 'stored' ? 'text-emerald-500' : evidence.ipfsStatus === 'pending' ? 'text-yellow-500' : 'text-red-500'}`}>
                            {evidence.ipfsStatus}
                          </div>
                          <Download size={14} className="ml-2 text-emerald-500 cursor-pointer" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {(!selectedRecord.forensicEvidence || selectedRecord.forensicEvidence.length === 0) && (
                  <div className="text-xs italic text-zinc-500 mt-1">No IPFS evidence available for this record</div>
                )}
              </div>
              
              <div className="pt-4 flex space-x-2">
                <button className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-md text-sm">
                  View in Explorer
                </button>
                
                <button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-md flex items-center justify-center text-sm">
                  <Fingerprint size={14} className="mr-1" />
                  Verify Integrity
                </button>
              </div>
              
              {selectedRecord.status === 'tampered' && (
                <div className="mt-2 p-3 bg-red-900 bg-opacity-30 text-red-500 rounded-md text-sm">
                  Warning: This record shows signs of tampering. The Merkle proof validation has failed, indicating possible unauthorized modification.
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500">
              <Database size={40} className="mx-auto mb-4 opacity-50" />
              <p>Select a record to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
