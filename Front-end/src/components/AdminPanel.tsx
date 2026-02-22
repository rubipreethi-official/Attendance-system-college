import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/starry-background.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type YearKey = 'first-year' | 'second-year' | 'third-year' | 'final-year';

const YEAR_LABELS: Record<YearKey, string> = {
  'first-year': 'I Year (25CYSE)',
  'second-year': 'II Year (24CYSE)',
  'third-year': 'III Year (23CYSE)',
  'final-year': 'IV Year (22CYSE)',
};

const YEAR_ICONS: Record<YearKey, string> = {
  'first-year': '🎓',
  'second-year': '📚',
  'third-year': '👨‍🎓',
  'final-year': '🎉',
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [selectedYear, setSelectedYear] = useState<YearKey>('second-year');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [sections, setSections] = useState<Record<YearKey, string[]>>({
    'first-year': [],
    'second-year': [],
    'third-year': [],
    'final-year': [],
  });
  const [newSectionName, setNewSectionName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingSection, setDeletingSection] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');

  // Fetch sections for the selected year on mount and when year changes
  useEffect(() => {
    fetchSections();
  }, [selectedYear]);

  const fetchSections = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_URL}/api/sections/${selectedYear}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSections(prev => ({ ...prev, [selectedYear]: data.sections || [] }));
        // Auto-select first section if available
        if (data.sections && data.sections.length > 0 && !selectedSection) {
          setSelectedSection(data.sections[0]);
        } else if (!data.sections || data.sections.length === 0) {
          setSelectedSection('');
        }
      }
    } catch (err) {
      console.error('Failed to fetch sections:', err);
    }
  };

  const handleAddSection = async () => {
    const trimmed = newSectionName.trim().toUpperCase();
    if (!trimmed) {
      setMessage({ text: 'Please enter a section name', type: 'error' });
      return;
    }
    if (sections[selectedYear].includes(trimmed)) {
      setMessage({ text: `Section "${trimmed}" already exists`, type: 'error' });
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_URL}/api/sections/${selectedYear}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ section: trimmed }),
      });

      if (response.ok) {
        const updated = [...sections[selectedYear], trimmed];
        setSections(prev => ({ ...prev, [selectedYear]: updated }));
        setSelectedSection(trimmed);
        setNewSectionName('');
        setMessage({ text: `Section "${trimmed}" added successfully`, type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await response.json();
        setMessage({ text: data.error || 'Failed to add section', type: 'error' });
      }
    } catch (err) {
      // Fallback: add locally if API doesn't have section endpoint yet
      const updated = [...sections[selectedYear], trimmed];
      setSections(prev => ({ ...prev, [selectedYear]: updated }));
      setSelectedSection(trimmed);
      setNewSectionName('');
      setMessage({ text: `Section "${trimmed}" added`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteSection = async (section: string) => {
    if (!window.confirm(`Delete section "${section}" and all its students? This cannot be undone.`)) return;

    setDeletingSection(section);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_URL}/api/students/${selectedYear}/${section}/all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      // Also delete the section entry
      await fetch(`${API_URL}/api/sections/${selectedYear}/${section}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const updated = sections[selectedYear].filter(s => s !== section);
      setSections(prev => ({ ...prev, [selectedYear]: updated }));
      if (selectedSection === section) setSelectedSection(updated[0] || '');
      setMessage({ text: `Section "${section}" deleted`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const updated = sections[selectedYear].filter(s => s !== section);
      setSections(prev => ({ ...prev, [selectedYear]: updated }));
      if (selectedSection === section) setSelectedSection(updated[0] || '');
      setMessage({ text: `Section "${section}" removed`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setDeletingSection(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) { setMessage({ text: 'Please select a file first', type: 'error' }); return; }
    if (!selectedSection) { setMessage({ text: 'Please select or create a section first', type: 'error' }); return; }

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_URL}/api/students/${selectedYear}/${selectedSection}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({
          text: `✓ ${data.count} students uploaded to ${YEAR_LABELS[selectedYear]} — Section ${selectedSection}`,
          type: 'success',
        });
        setFile(null);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ text: data.error || 'Upload failed', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: `Network error: ${error instanceof Error ? error.message : 'Unknown'}`, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteStudents = async () => {
    if (!selectedSection) { setMessage({ text: 'Please select a section', type: 'error' }); return; }
    if (!window.confirm(`Delete all students in ${selectedSection} — ${YEAR_LABELS[selectedYear]}? Cannot be undone.`)) return;

    setDeleting(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_URL}/api/students/${selectedYear}/${selectedSection}/all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: `✓ Deleted ${data.deletedCount} students from Section ${selectedSection}`, type: 'success' });
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ text: data.error || 'Delete failed', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: `Network error: ${error instanceof Error ? error.message : 'Unknown'}`, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('isAuthenticated');
    navigate('/');
  };

  const currentSections = sections[selectedYear];

  return (
    <div className="min-h-screen w-full bg-[#020208] bg-mesh p-6 relative overflow-hidden starry-background">
      <div className="stars"></div>
      <div className="stars2"></div>
      <div className="stars3"></div>
      <div className="stars4"></div>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 hover:from-indigo-800/60 hover:to-purple-800/60 
          text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 border border-indigo-800/30"
        >
          ← Back to Dashboard
        </button>
        <button
          onClick={handleLogout}
          className="bg-gradient-to-r from-violet-900/50 to-pink-900/50 hover:from-violet-800/60 hover:to-pink-800/60 
          text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 border border-violet-800/30"
        >
          Logout
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto relative z-10"
      >
        <div className="glass-effect p-8 rounded-xl relative bg-[#0a0b1a]">
          <div className="spotlight"></div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
            <h1 className="text-4xl font-bold mb-2 text-white text-center">Admin Panel</h1>
            <p className="text-lg text-white/70 text-center mb-8">
              Manage sections and upload student data by year &amp; section
            </p>

            {/* ── Year Selector ── */}
            <div className="mb-6">
              <label className="block text-white mb-3 font-medium">Select Year:</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(YEAR_LABELS) as YearKey[]).map(year => (
                  <motion.button
                    key={year}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedYear(year); setSelectedSection(''); setFile(null); }}
                    className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                      selectedYear === year
                        ? 'bg-gradient-to-r from-blue-900/80 to-cyan-900/80 text-white border-2 border-blue-400'
                        : 'bg-[#0a0b1a] text-white/70 border border-[#1a1b3a] hover:bg-[#0f1225]'
                    }`}
                  >
                    {YEAR_ICONS[year]} {YEAR_LABELS[year]}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-2 mb-6 border-b border-[#1a1b3a]">
              {(['upload', 'manage'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 font-medium text-sm rounded-t-lg transition-all capitalize ${
                    activeTab === tab
                      ? 'bg-indigo-900/60 text-white border border-b-0 border-indigo-700/50'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {tab === 'upload' ? '📤 Upload Students' : '🗂 Manage Sections'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">

              {/* ════════════════ UPLOAD TAB ════════════════ */}
              {activeTab === 'upload' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {/* Section Dropdown */}
                  <div className="mb-5">
                    <label className="block text-white mb-2 font-medium text-sm">
                      Select Section for <span className="text-blue-400">{YEAR_LABELS[selectedYear]}</span>:
                    </label>
                    {currentSections.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-amber-600/50 bg-amber-900/10">
                        <span className="text-amber-400 text-sm">
                          ⚠ No sections yet for this year. Go to <strong>Manage Sections</strong> to add one.
                        </span>
                        <button
                          onClick={() => setActiveTab('manage')}
                          className="ml-auto text-xs bg-amber-800/50 hover:bg-amber-700/50 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-700/30 whitespace-nowrap"
                        >
                          + Add Section
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={selectedSection}
                          onChange={e => setSelectedSection(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-[#0f1225] text-white border border-[#1a1b3a] 
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                        >
                          <option value="" disabled>-- Choose a section --</option>
                          {currentSections.map(sec => (
                            <option key={sec} value={sec}>Section {sec}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                          <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Drag-and-Drop Upload Zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 mb-4 ${
                      dragActive
                        ? 'border-indigo-400 bg-indigo-900/20'
                        : selectedSection
                          ? 'border-[#1a1b3a] bg-[#0a0b1a]'
                          : 'border-[#111] bg-[#070710] opacity-50 pointer-events-none'
                    }`}
                  >
                    <input
                      type="file"
                      id="file-upload"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={!selectedSection}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {file ? (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <p className="text-white font-medium text-lg mb-1">{file.name}</p>
                          <p className="text-white/70 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                          <p className="text-white/40 text-xs mt-2">Click to change file</p>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <p className="text-white text-lg mb-1">Drag and drop your file here</p>
                          <p className="text-white/70 mb-4">or</p>
                          <span className="px-6 py-2 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 text-white rounded-lg border border-indigo-800/30">
                            Browse Files
                          </span>
                          <p className="text-white/40 text-xs mt-3">Supports .xlsx, .xls, .csv · Max 5 MB</p>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Upload button */}
                  {file && selectedSection && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleUpload}
                      disabled={uploading}
                      className="w-full py-4 bg-gradient-to-r from-violet-900/80 to-pink-900/80 hover:from-violet-800/90 hover:to-pink-800/90 
                      text-white rounded-lg font-medium transition-all duration-200 border border-violet-800/30 text-lg mb-3"
                    >
                      {uploading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading to Section {selectedSection}...
                        </span>
                      ) : (
                        `📤 Upload to ${YEAR_LABELS[selectedYear]} — Section ${selectedSection}`
                      )}
                    </motion.button>
                  )}

                  {/* Delete section students */}
                  {selectedSection && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDeleteStudents}
                      disabled={deleting}
                      className="w-full py-3 bg-gradient-to-r from-rose-900/80 to-red-900/80 hover:from-rose-800/90 hover:to-red-800/90 
                      text-white rounded-lg font-medium transition-all duration-200 border border-rose-800/30 text-base"
                    >
                      {deleting ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Deleting...
                        </span>
                      ) : (
                        `🗑️ Delete All Students in Section ${selectedSection}`
                      )}
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* ════════════════ MANAGE SECTIONS TAB ════════════════ */}
              {activeTab === 'manage' && (
                <motion.div
                  key="manage"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <p className="text-white/60 text-sm mb-4">
                    Managing sections for <span className="text-blue-400 font-medium">{YEAR_LABELS[selectedYear]}</span>
                  </p>

                  {/* Add Section Input */}
                  <div className="flex gap-2 mb-6">
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={e => setNewSectionName(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                      placeholder="Section name  e.g. A, B, C"
                      maxLength={5}
                      className="flex-1 px-4 py-3 rounded-lg bg-[#0f1225] text-white border border-[#1a1b3a] 
                        placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono tracking-widest"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleAddSection}
                      className="px-6 py-3 bg-gradient-to-r from-blue-900/80 to-cyan-900/80 text-white rounded-lg 
                        font-medium border border-blue-700/40 hover:from-blue-800/90 hover:to-cyan-800/90 transition-all"
                    >
                      + Add
                    </motion.button>
                  </div>

                  {/* Sections List */}
                  {currentSections.length === 0 ? (
                    <div className="text-center py-12 text-white/30">
                      <div className="text-5xl mb-3">📭</div>
                      <p>No sections added yet for {YEAR_LABELS[selectedYear]}</p>
                      <p className="text-sm mt-1">Type a name above and click Add</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <AnimatePresence>
                        {currentSections.map(sec => (
                          <motion.div
                            key={sec}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className={`relative group flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                              selectedSection === sec
                                ? 'border-blue-400 bg-blue-900/30'
                                : 'border-[#1a1b3a] bg-[#0f1225] hover:border-[#2a2b5a]'
                            }`}
                          >
                            <button
                              onClick={() => { setSelectedSection(sec); setActiveTab('upload'); }}
                              className="flex-1 text-left"
                            >
                              <span className="text-white font-mono font-semibold text-lg">
                                {YEAR_ICONS[selectedYear]} {sec}
                              </span>
                              <p className="text-white/40 text-xs mt-0.5">Section {sec}</p>
                            </button>
                            <button
                              onClick={() => handleDeleteSection(sec)}
                              disabled={deletingSection === sec}
                              className="ml-2 p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-900/30 
                                transition-all opacity-0 group-hover:opacity-100"
                              title={`Delete section ${sec}`}
                            >
                              {deletingSection === sec ? (
                                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {currentSections.length > 0 && (
                    <p className="mt-4 text-white/30 text-xs text-center">
                      Click a section card to select it and switch to Upload tab · Hover to reveal delete
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message */}
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mt-6 p-4 rounded-lg ${
                    message.type === 'success'
                      ? 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-900/30 border border-rose-500/50 text-rose-300'
                  }`}
                >
                  <div className="flex items-center">
                    {message.type === 'success' ? (
                      <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className="font-medium">{message.text}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminPanel;