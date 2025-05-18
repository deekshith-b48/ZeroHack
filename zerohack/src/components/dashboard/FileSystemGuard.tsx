'use client';

import { useState, useEffect } from 'react';
import { FileText, AlertTriangle, CheckCircle, Search, Filter, RefreshCw } from 'lucide-react';

interface ScanResult {
  id: number;
  filename: string;
  path: string;
  status: 'clean' | 'suspicious' | 'malicious';
  detectionType?: string;
  timestamp: string;
  size: string;
  hash: string;
}

export function FileSystemGuard() {
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [selectedFile, setSelectedFile] = useState<ScanResult | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Simulate loading scan results
    const mockResults: ScanResult[] = [
      {
        id: 1,
        filename: 'document.pdf',
        path: 'C:\\Users\\Documents',
        status: 'clean',
        timestamp: '2023-05-16 14:23:45',
        size: '1.4 MB',
        hash: 'a1b2c3d4e5f6g7h8i9j0',
      },
      {
        id: 2,
        filename: 'invoice.xlsx',
        path: 'C:\\Users\\Downloads',
        status: 'clean',
        timestamp: '2023-05-16 13:12:30',
        size: '245 KB',
        hash: 'k1l2m3n4o5p6q7r8s9t0',
      },
      {
        id: 3,
        filename: 'setup.exe',
        path: 'C:\\Users\\Downloads',
        status: 'suspicious',
        detectionType: 'Unusual entropy pattern',
        timestamp: '2023-05-16 12:45:12',
        size: '4.2 MB',
        hash: 'u1v2w3x4y5z6a7b8c9d0',
      },
      {
        id: 4,
        filename: 'trojan.exe',
        path: 'C:\\Temp',
        status: 'malicious',
        detectionType: 'Trojan.Win32.Generic',
        timestamp: '2023-05-16 11:03:22',
        size: '890 KB',
        hash: 'e1f2g3h4i5j6k7l8m9n0',
      },
      {
        id: 5,
        filename: 'report.docx',
        path: 'C:\\Users\\Documents\\Work',
        status: 'clean',
        timestamp: '2023-05-16 10:34:18',
        size: '1.8 MB',
        hash: 'o1p2q3r4s5t6u7v8w9x0',
      },
    ];

    setScanResults(mockResults);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'clean':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'suspicious':
        return <AlertTriangle size={18} className="text-yellow-500" />;
      case 'malicious':
        return <AlertTriangle size={18} className="text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clean':
        return 'text-green-500';
      case 'suspicious':
        return 'text-yellow-500';
      case 'malicious':
        return 'text-red-500';
      default:
        return '';
    }
  };

  const handleFileClick = (file: ScanResult) => {
    setSelectedFile(file);
  };

  const handleQuarantineFile = () => {
    if (selectedFile) {
      // In a real app, this would call an API to quarantine the file
      alert(`File ${selectedFile.filename} has been quarantined.`);
    }
  };

  const filteredResults = filter === 'all' 
    ? scanResults 
    : scanResults.filter(result => result.status === filter);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">File System Guard</h2>
        <div className="flex space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search files..."
              className="bg-zinc-700 text-white rounded-md py-2 pl-10 pr-4 w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
          </div>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md flex items-center">
            <RefreshCw size={18} className="mr-2" />
            Scan Now
          </button>
        </div>
      </div>

      <div className="flex mb-4 space-x-2">
        <button 
          className={`px-4 py-2 rounded-md ${filter === 'all' ? 'bg-zinc-700' : 'bg-zinc-800 hover:bg-zinc-700'}`}
          onClick={() => setFilter('all')}
        >
          All Files
        </button>
        <button 
          className={`px-4 py-2 rounded-md ${filter === 'clean' ? 'bg-zinc-700' : 'bg-zinc-800 hover:bg-zinc-700'}`}
          onClick={() => setFilter('clean')}
        >
          Clean
        </button>
        <button 
          className={`px-4 py-2 rounded-md ${filter === 'suspicious' ? 'bg-zinc-700' : 'bg-zinc-800 hover:bg-zinc-700'}`}
          onClick={() => setFilter('suspicious')}
        >
          Suspicious
        </button>
        <button 
          className={`px-4 py-2 rounded-md ${filter === 'malicious' ? 'bg-zinc-700' : 'bg-zinc-800 hover:bg-zinc-700'}`}
          onClick={() => setFilter('malicious')}
        >
          Malicious
        </button>
      </div>

      <div className="flex flex-1 space-x-6">
        <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Scan Results
          </div>
          <div className="overflow-auto max-h-[calc(100vh-350px)]">
            <table className="w-full">
              <thead className="bg-zinc-700">
                <tr>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Filename</th>
                  <th className="px-4 py-2 text-left">Path</th>
                  <th className="px-4 py-2 text-left">Size</th>
                  <th className="px-4 py-2 text-left">Scanned</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((file) => (
                  <tr 
                    key={file.id} 
                    className={`border-b border-zinc-700 hover:bg-zinc-700 cursor-pointer ${
                      selectedFile?.id === file.id ? 'bg-zinc-700' : ''
                    }`}
                    onClick={() => handleFileClick(file)}
                  >
                    <td className="px-4 py-3">{getStatusIcon(file.status)}</td>
                    <td className="px-4 py-3">{file.filename}</td>
                    <td className="px-4 py-3 text-zinc-400">{file.path}</td>
                    <td className="px-4 py-3">{file.size}</td>
                    <td className="px-4 py-3 text-zinc-400">{file.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-80 bg-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            File Details
          </div>
          {selectedFile ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-center py-4">
                <div className="w-16 h-16 bg-zinc-700 rounded-lg flex items-center justify-center">
                  <FileText size={32} className="text-zinc-400" />
                </div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Filename</div>
                <div className="font-medium">{selectedFile.filename}</div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Path</div>
                <div className="font-medium text-sm">{selectedFile.path}</div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Size</div>
                <div className="font-medium">{selectedFile.size}</div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">SHA-3 Hash</div>
                <div className="font-medium text-xs font-mono">{selectedFile.hash}</div>
              </div>
              
              <div>
                <div className="text-sm text-zinc-400">Scan Time</div>
                <div className="font-medium">{selectedFile.timestamp}</div>
              </div>
              
              <div className="pt-2">
                <div className="text-sm text-zinc-400 mb-2">Status</div>
                <div className={`px-3 py-2 rounded-md font-medium ${
                  selectedFile.status === 'clean' ? 'bg-green-900 bg-opacity-30 text-green-500' :
                  selectedFile.status === 'suspicious' ? 'bg-yellow-900 bg-opacity-30 text-yellow-500' :
                  'bg-red-900 bg-opacity-30 text-red-500'
                }`}>
                  {selectedFile.status === 'clean' && 'Clean - No threats detected'}
                  {selectedFile.status === 'suspicious' && `Suspicious - ${selectedFile.detectionType}`}
                  {selectedFile.status === 'malicious' && `Malicious - ${selectedFile.detectionType}`}
                </div>
              </div>
              
              {(selectedFile.status === 'suspicious' || selectedFile.status === 'malicious') && (
                <button 
                  className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white py-2 rounded-md"
                  onClick={handleQuarantineFile}
                >
                  Quarantine File
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500">
              <FileText size={40} className="mx-auto mb-4 opacity-50" />
              <p>Select a file to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
