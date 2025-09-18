'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Brain, Database, Bell, Save } from 'lucide-react';

interface SettingsState {
  yaraRules: boolean;
  tensorflowModel: boolean;
  behavioralAI: boolean;
  blockchainLogging: boolean;
  autoQuarantine: boolean;
  notifications: boolean;
  scanInterval: number;
  threatSensitivity: number;
  whitelistedProcesses: string[];
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsState>({
    yaraRules: true,
    tensorflowModel: true,
    behavioralAI: true,
    blockchainLogging: true,
    autoQuarantine: true,
    notifications: true,
    scanInterval: 60,
    threatSensitivity: 75,
    whitelistedProcesses: ['explorer.exe', 'chrome.exe', 'firefox.exe'],
  });
  
  const [newWhitelistItem, setNewWhitelistItem] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  useEffect(() => {
    // In a real app, you would load settings from localStorage or an API
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('zerohack-settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    };
    
    loadSettings();
  }, []);

  useEffect(() => {
    // Track unsaved changes
    const checkUnsavedChanges = () => {
      const savedSettings = localStorage.getItem('zerohack-settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setUnsavedChanges(JSON.stringify(parsedSettings) !== JSON.stringify(settings));
      } else {
        setUnsavedChanges(true);
      }
    };
    
    checkUnsavedChanges();
  }, [settings]);

  const handleToggleChange = (key: keyof SettingsState) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleRangeChange = (key: keyof SettingsState, value: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAddWhitelistItem = () => {
    if (newWhitelistItem && !settings.whitelistedProcesses.includes(newWhitelistItem)) {
      setSettings(prev => ({
        ...prev,
        whitelistedProcesses: [...prev.whitelistedProcesses, newWhitelistItem],
      }));
      setNewWhitelistItem('');
    }
  };

  const handleRemoveWhitelistItem = (item: string) => {
    setSettings(prev => ({
      ...prev,
      whitelistedProcesses: prev.whitelistedProcesses.filter(p => p !== item),
    }));
  };

  const handleSaveSettings = () => {
    // In a real app, you would save settings to localStorage or an API
    localStorage.setItem('zerohack-settings', JSON.stringify(settings));
    setUnsavedChanges(false);
    alert('Settings saved successfully!');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Scan Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center justify-between">
                    <span>Scan Interval (minutes)</span>
                    <span className="text-zinc-400">{settings.scanInterval} min</span>
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="240"
                    step="15"
                    value={settings.scanInterval}
                    onChange={(e) => handleRangeChange('scanInterval', parseInt(e.target.value))}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer mt-2"
                  />
                </div>
                
                <div>
                  <label className="flex items-center justify-between">
                    <span>Threat Sensitivity</span>
                    <span className="text-zinc-400">{settings.threatSensitivity}%</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={settings.threatSensitivity}
                    onChange={(e) => handleRangeChange('threatSensitivity', parseInt(e.target.value))}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer mt-2"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">Notifications</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Enable Notifications</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.notifications}
                      onChange={() => handleToggleChange('notifications')}
                      className="sr-only"
                    />
                    <div className={`block w-14 h-8 rounded-full ${settings.notifications ? 'bg-emerald-600' : 'bg-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.notifications ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">Auto-Response</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Auto-Quarantine Malicious Files</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.autoQuarantine}
                      onChange={() => handleToggleChange('autoQuarantine')}
                      className="sr-only"
                    />
                    <div className={`block w-14 h-8 rounded-full ${settings.autoQuarantine ? 'bg-emerald-600' : 'bg-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.autoQuarantine ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        );
      
      case 'ai-models':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Detection Models</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center">
                    <Shield className="mr-2 text-zinc-400" size={20} />
                    <span>YARA Rules</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.yaraRules}
                      onChange={() => handleToggleChange('yaraRules')}
                      className="sr-only"
                    />
                    <div className={`block w-14 h-8 rounded-full ${settings.yaraRules ? 'bg-emerald-600' : 'bg-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.yaraRules ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center">
                    <Brain className="mr-2 text-zinc-400" size={20} />
                    <span>TensorFlow Heuristic Model</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.tensorflowModel}
                      onChange={() => handleToggleChange('tensorflowModel')}
                      className="sr-only"
                    />
                    <div className={`block w-14 h-8 rounded-full ${settings.tensorflowModel ? 'bg-emerald-600' : 'bg-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.tensorflowModel ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center">
                    <Brain className="mr-2 text-zinc-400" size={20} />
                    <span>Behavioral AI (LSTM)</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.behavioralAI}
                      onChange={() => handleToggleChange('behavioralAI')}
                      className="sr-only"
                    />
                    <div className={`block w-14 h-8 rounded-full ${settings.behavioralAI ? 'bg-emerald-600' : 'bg-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.behavioralAI ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">Blockchain</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center">
                    <Database className="mr-2 text-zinc-400" size={20} />
                    <span>Immutable Logging</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.blockchainLogging}
                      onChange={() => handleToggleChange('blockchainLogging')}
                      className="sr-only"
                    />
                    <div className={`block w-14 h-8 rounded-full ${settings.blockchainLogging ? 'bg-emerald-600' : 'bg-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.blockchainLogging ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        );
      
      case 'whitelist':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Process Whitelist</h3>
              <div className="flex mb-4">
                <input
                  type="text"
                  value={newWhitelistItem}
                  onChange={(e) => setNewWhitelistItem(e.target.value)}
                  placeholder="Enter process name (e.g., notepad.exe)"
                  className="flex-1 bg-zinc-700 text-white rounded-l-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleAddWhitelistItem}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-r-md"
                >
                  Add
                </button>
              </div>
              
              <div className="bg-zinc-700 rounded-md overflow-hidden">
                {settings.whitelistedProcesses.length > 0 ? (
                  <ul className="divide-y divide-zinc-600">
                    {settings.whitelistedProcesses.map((process, index) => (
                      <li key={index} className="flex items-center justify-between px-4 py-3">
                        <span>{process}</span>
                        <button
                          onClick={() => handleRemoveWhitelistItem(process)}
                          className="text-zinc-400 hover:text-red-500"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-zinc-400">
                    No whitelisted processes. Add some above.
                  </div>
                )}
              </div>
              
              <div className="mt-4 text-sm text-zinc-400">
                Whitelisted processes will not be monitored or terminated, even if suspicious behavior is detected.
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <button 
          className={`flex items-center px-4 py-2 rounded-md ${
            unsavedChanges ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-700 cursor-not-allowed'
          } text-white`}
          onClick={handleSaveSettings}
          disabled={!unsavedChanges}
        >
          <Save size={18} className="mr-2" />
          Save Changes
        </button>
      </div>

      <div className="flex flex-1">
        <div className="w-64 bg-zinc-800 rounded-lg overflow-hidden mr-6">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            Settings Categories
          </div>
          <div className="p-2">
            <button
              className={`w-full text-left px-4 py-3 rounded-md ${activeTab === 'general' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
              onClick={() => setActiveTab('general')}
            >
              <div className="flex items-center">
                <SettingsIcon size={18} className="mr-2" />
                General
              </div>
            </button>
            
            <button
              className={`w-full text-left px-4 py-3 rounded-md ${activeTab === 'ai-models' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
              onClick={() => setActiveTab('ai-models')}
            >
              <div className="flex items-center">
                <Brain size={18} className="mr-2" />
                AI Models
              </div>
            </button>
            
            <button
              className={`w-full text-left px-4 py-3 rounded-md ${activeTab === 'whitelist' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
              onClick={() => setActiveTab('whitelist')}
            >
              <div className="flex items-center">
                <Shield size={18} className="mr-2" />
                Whitelist
              </div>
            </button>
          </div>
        </div>

        <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-700 px-4 py-3 font-medium">
            {activeTab === 'general' && 'General Settings'}
            {activeTab === 'ai-models' && 'AI & Detection Models'}
            {activeTab === 'whitelist' && 'Process Whitelist'}
          </div>
          <div className="p-6 overflow-auto max-h-[calc(100vh-250px)]">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
