import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../styles/starry-background.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [selectedYear, setSelectedYear] = useState<'first-year' | 'second-year' | 'third-year' | 'final-year'>('second-year');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ text: 'Please select a file first', type: 'error' });
      return;
    }

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('adminToken');
      
      // Debug logs
      console.log('Uploading to:', `${API_URL}/api/students/${selectedYear}/upload`);
      console.log('File name:', file.name);
      console.log('File size:', file.size);
      console.log('Token:', token ? 'Present' : 'MISSING');
      
      const response = await fetch(`${API_URL}/api/students/${selectedYear}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      console.log('Upload response status:', response.status);
      
      const data = await response.json();
      console.log('Upload response data:', data);

      if (response.ok) {
        const yearLabels = {
          'first-year': 'First Year (25CYSE)',
          'second-year': 'Second Year (24CYSE)',
          'third-year': 'Third Year (23CYSE)',
          'final-year': 'Final Year (22CYSE)'
        };
        setMessage({ 
          text: `✓ Success! ${data.count} students uploaded for ${yearLabels[selectedYear]}`, 
          type: 'success' 
        });
        setFile(null);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ text: data.error || 'Upload failed', type: 'error' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ text: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteStudents = async () => {
    if (!window.confirm(`Are you sure you want to delete all ${selectedYear} students? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('adminToken');
      
      console.log('Deleting students for:', selectedYear);
      
      const response = await fetch(`${API_URL}/api/students/${selectedYear}/all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Delete response status:', response.status);
      
      const data = await response.json();
      console.log('Delete response data:', data);

      if (response.ok) {
        const yearLabels = {
          'first-year': 'First Year (25CYSE)',
          'second-year': 'Second Year (24CYSE)',
          'third-year': 'Third Year (23CYSE)',
          'final-year': 'Final Year (22CYSE)'
        };
        setMessage({ 
          text: `✓ Deleted! ${data.deletedCount} ${yearLabels[selectedYear]} students removed`, 
          type: 'success' 
        });
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ text: data.error || 'Delete failed', type: 'error' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setMessage({ text: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('isAuthenticated');
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-[#020208] bg-mesh p-6 relative overflow-hidden starry-background">
      <div className="stars"></div>
      <div className="stars2"></div>
      <div className="stars3"></div>
      <div className="stars4"></div>

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
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
          >
            <h1 className="text-4xl font-bold mb-4 text-white text-center">
              Admin Panel
            </h1>
            <p className="text-lg text-white/70 text-center mb-8">
              Upload student data for First Year or Second Year
            </p>

           
         
            {/* Year Selector */}
            <div className="mb-6">
              <label className="block text-white mb-3 font-medium">Select Year:</label>
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedYear('first-year')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                    selectedYear === 'first-year'
                      ? 'bg-gradient-to-r from-blue-900/80 to-cyan-900/80 text-white border-2 border-blue-400'
                      : 'bg-[#0a0b1a] text-white/70 border border-[#1a1b3a] hover:bg-[#0f1225]'
                  }`}
                >
                  🎓 I Year (25CYSE)
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedYear('second-year')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                    selectedYear === 'second-year'
                      ? 'bg-gradient-to-r from-blue-900/80 to-cyan-900/80 text-white border-2 border-blue-400'
                      : 'bg-[#0a0b1a] text-white/70 border border-[#1a1b3a] hover:bg-[#0f1225]'
                  }`}
                >
                  📚 II Year (24CYSE)
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedYear('third-year')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                    selectedYear === 'third-year'
                      ? 'bg-gradient-to-r from-blue-900/80 to-cyan-900/80 text-white border-2 border-blue-400'
                      : 'bg-[#0a0b1a] text-white/70 border border-[#1a1b3a] hover:bg-[#0f1225]'
                  }`}
                >
                  👨‍🎓 III Year (23CYSE)
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedYear('final-year')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                    selectedYear === 'final-year'
                      ? 'bg-gradient-to-r from-blue-900/80 to-cyan-900/80 text-white border-2 border-blue-400'
                      : 'bg-[#0a0b1a] text-white/70 border border-[#1a1b3a] hover:bg-[#0f1225]'
                  }`}
                >
                  🎉 IV Year (22CYSE)
                </motion.button>
              </div>
            </div>

            {/* File Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 mb-6 ${
                dragActive
                  ? 'border-indigo-400 bg-indigo-900/20'
                  : 'border-[#1a1b3a] bg-[#0a0b1a]'
              }`}
            >
              <input
                type="file"
                id="file-upload"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <label htmlFor="file-upload" className="cursor-pointer">
                {file ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-white font-medium text-lg mb-2">{file.name}</p>
                    <p className="text-white/70 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                    <p className="text-white/50 text-sm mt-2">Click to change file</p>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-white text-lg mb-2">Drag and drop your file here</p>
                    <p className="text-white/70 mb-4">or</p>
                    <span className="px-6 py-2 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 text-white rounded-lg border border-indigo-800/30">
                      Browse Files
                    </span>
                    <p className="text-white/50 text-sm mt-4">Supports: .xlsx, .xls, .csv (Max 5MB)</p>
                  </div>
                )}
              </label>
            </div>

            {/* Upload Button */}
            {file && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-4 bg-gradient-to-r from-violet-900/80 to-pink-900/80 hover:from-violet-800/90 hover:to-pink-800/90 
                text-white rounded-lg font-medium transition-all duration-200 border border-violet-800/30 text-lg"
              >
                {uploading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  `Upload Students`
                )}
              </motion.button>
            )}

            {/* Delete Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDeleteStudents}
              disabled={deleting}
              className="w-full mt-3 py-3 bg-gradient-to-r from-rose-900/80 to-red-900/80 hover:from-rose-800/90 hover:to-red-800/90 
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
                `🗑️ Delete All ${selectedYear === 'first-year' ? 'I Year' : selectedYear === 'second-year' ? 'II Year' : selectedYear === 'third-year' ? 'III Year' : 'IV Year'} Students`
              )}
            </motion.button>

            {/* Message Display */}
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-6 p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-900/30 border border-rose-500/50 text-rose-300'
                }`}
              >
                <div className="flex items-center">
                  {message.type === 'success' ? (
                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="font-medium">{message.text}</span>
                </div>
              </motion.div>
            )}

              
              
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AdminPanel;