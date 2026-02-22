import * as React from "react";
import { useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "../styles/starry-background.css";

interface Student {
  SNo: string;
  Name: string;
  RollNo: string;
  RegNo: string;
}

type YearKey = 'first-year' | 'second-year' | 'third-year' | 'final-year';

const API_URL = import.meta.env.VITE_API_URL;

const YEAR_LABELS: Record<YearKey, string> = {
  'first-year': 'I Year',
  'second-year': 'II Year',
  'third-year': 'III Year',
  'final-year': 'IV Year',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendance, setAttendance] = useState<{ [key: string]: string }>({});
  const [date, setDate] = useState("");
  const [selectedYear, setSelectedYear] = useState<YearKey>('second-year');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [sections, setSections] = useState<string[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
    color?: string;
  } | null>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 30, stiffness: 200 };
  const spotlightX = useSpring(mouseX, springConfig);
  const spotlightY = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  // ── Fetch sections whenever year changes ──
  useEffect(() => {
    setSelectedSection('');
    setSections([]);
    setStudents([]);
    fetchSections(selectedYear);
  }, [selectedYear]);

  // ── Fetch students whenever section changes ──
  useEffect(() => {
    if (selectedSection) fetchStudents();
    else setStudents([]);
  }, [selectedSection]);

  const fetchSections = async (year: YearKey) => {
    setSectionsLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_URL}/api/sections/${year}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const secs: string[] = data.sections || [];
        setSections(secs);
        if (secs.length > 0) setSelectedSection(secs[0]);
      } else {
        setSections([]);
      }
    } catch (err) {
      console.error('Failed to fetch sections:', err);
      setSections([]);
    } finally {
      setSectionsLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!selectedSection) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');

      if (!token) throw new Error('No authentication token. Please login again.');
      if (!API_URL) throw new Error('API URL not configured.');

      const url = `${API_URL}/api/students/${selectedYear}/${selectedSection}`;
      console.log('Fetching students from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch students (${response.status})`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`No students found in Section ${selectedSection}. Upload data from Admin Panel.`);
      }

      const formattedData = data.map((student: any) => ({
        SNo: student.sNo.toString(),
        Name: selectedYear === 'first-year' ? student.studentName : student.name,
        RollNo: selectedYear === 'first-year' ? student.rollNumber : student.rollNo,
        RegNo: selectedYear === 'first-year' ? student.registerNo : (student.regNo || ''),
      }));

      setStudents(formattedData);

      const initialAttendance: { [key: string]: string } = {};
      formattedData.forEach((s: any) => { initialAttendance[s.SNo] = 'Present'; });
      setAttendance(initialAttendance);
      setDate(new Date().toLocaleDateString('en-GB'));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error loading students:', msg);
      showNotification(msg, 'error');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/');
  };

  const handleAttendanceChange = (sno: string, status: string) => {
    const student = students.find((s) => s.SNo === sno);
    if (!student) return;
    setAttendance(prev => ({ ...prev, [sno]: status }));

    const statusMessages: Record<string, string> = {
      'Present': 'is now marked Present',
      'Absent': 'is marked Absent',
      'Leave': 'is on Leave',
      'On Duty': 'is on On Duty',
      'Late': 'is marked Late',
    };
    const statusColors: Record<string, string> = {
      'Present': 'emerald', 'Absent': 'rose', 'Leave': 'amber', 'On Duty': 'violet', 'Late': 'orange',
    };
    showNotification(`${student.Name} ${statusMessages[status]}`, 'success', statusColors[status]);
  };

  const totalStudents = students.length;
  const presentCount = Object.values(attendance).filter(a => a === 'Present' || a === 'Late' || a === 'On Duty').length;
  const leaveCount = Object.values(attendance).filter(a => a === 'Leave').length;
  const odCount = Object.values(attendance).filter(a => a === 'On Duty').length;
  const lateCount = Object.values(attendance).filter(a => a === 'Late').length;
  const absentCount = Object.values(attendance).filter(a => a === 'Absent').length;

  const getList = (status: string) =>
    students.filter(s => attendance[s.SNo] === status).map(s => `(${s.RollNo}) ${s.Name}`).join('\n') || 'NIL';

  const attendanceSummary = `DATE : ${date}
SECTION : ${selectedSection ? `Section ${selectedSection}` : '-'}
PRESENT: ${presentCount}/${totalStudents}
LEAVE: ${leaveCount}
ON DUTY: ${odCount}
LATE: ${lateCount}
ABSENT: ${absentCount}

LEAVE
${getList('Leave')}

ON DUTY
${getList('On Duty')}

LATE
${getList('Late')}

ABSENT
${getList('Absent')}

Have a Very Nice Day`;

  const showNotification = (message: string, type: 'success' | 'error', color?: string) => {
    setNotification({ message, type, color });
    setTimeout(() => setNotification(null), 4000);
  };

  const saveToDatabase = async () => {
    try {
      const studentRecords = students.map(student => ({
        studentId: student.SNo,
        rollNo: student.RollNo,
        name: student.Name,
        status: attendance[student.SNo],
      }));

      const response = await fetch(`${API_URL}/api`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presentCount, absentCount, leaveCount, odCount, lateCount, totalStudents,
          attendanceData: attendanceSummary, studentRecords,
          year: selectedYear, section: selectedSection,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      showNotification('Data saved successfully!', 'success');
    } catch {
      showNotification('Failed to save data. Please try again.', 'error');
    }
  };

  const shareOnWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(attendanceSummary)}`, '_blank');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(attendanceSummary)
      .then(() => showNotification('Summary copied to clipboard!', 'success'))
      .catch(() => showNotification('Failed to copy. Please try again.', 'error'));
  };

  const filteredStudents = students.filter(s =>
    s.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.RollNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.3 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, x: -100 },
    visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 100, damping: 12 } },
  };
  const tableRowVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    transition: { type: 'spring', stiffness: 100, damping: 12 },
  };

  return (
    <div
      className="min-h-screen w-full bg-[#020208] bg-mesh p-6 relative overflow-hidden starry-background"
      onMouseMove={handleMouseMove}
    >
      <div className="stars"></div>
      <div className="stars2"></div>
      <div className="stars3"></div>
      <div className="stars4"></div>

      {/* ── Header ── */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        {/* Year Selector */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(YEAR_LABELS) as YearKey[]).map(year => (
            <motion.button
              key={year}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap text-sm ${
                selectedYear === year
                  ? 'bg-gradient-to-r from-blue-900/80 to-cyan-900/80 text-white border-2 border-blue-400'
                  : 'bg-[#0a0b1a] text-white/70 border border-[#1a1b3a] hover:bg-[#0f1225]'
              }`}
            >
              {year === 'first-year' ? '🎓' : year === 'second-year' ? '📚' : year === 'third-year' ? '👨‍🎓' : '🎉'} {YEAR_LABELS[year]}
            </motion.button>
          ))}
        </div>

        {/* Admin + Logout */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="bg-gradient-to-r from-violet-900/50 to-pink-900/50 hover:from-violet-800/60 hover:to-pink-800/60 
            text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 border border-violet-800/30"
          >
            Admin
          </button>
          <button
            onClick={handleLogout}
            className="bg-gradient-to-r from-violet-900/50 to-pink-900/50 hover:from-violet-800/60 hover:to-pink-800/60 
            text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 border border-violet-800/30"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── Section Selector ── */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="glass-effect px-4 py-3 rounded-xl bg-[#0a0b1a] flex flex-wrap items-center gap-3">
            <span className="text-white/60 text-sm font-medium whitespace-nowrap">
              {YEAR_LABELS[selectedYear]} — Section:
            </span>

            {sectionsLoading ? (
              <span className="text-white/40 text-sm flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Loading sections...
              </span>
            ) : sections.length === 0 ? (
              <span className="text-amber-400/70 text-sm">
                No sections available — go to{' '}
                <button onClick={() => navigate('/admin')} className="underline text-amber-400 hover:text-amber-300">
                  Admin Panel
                </button>{' '}
                to add sections.
              </span>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {sections.map(sec => (
                  <motion.button
                    key={sec}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedSection(sec)}
                    className={`px-4 py-1.5 rounded-full text-sm font-mono font-semibold transition-all duration-200 border ${
                      selectedSection === sec
                        ? 'bg-gradient-to-r from-indigo-600/70 to-purple-600/70 text-white border-indigo-400/60'
                        : 'bg-[#0f1225] text-white/60 border-[#1a1b3a] hover:text-white hover:border-[#2a2b5a]'
                    }`}
                  >
                    {sec}
                  </motion.button>
                ))}
              </div>
            )}

            {/* Live student count badge */}
            {selectedSection && students.length > 0 && (
              <span className="ml-auto text-xs text-white/40 whitespace-nowrap">
                {students.length} students
              </span>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Spotlight effect */}
      <motion.div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(600px circle at var(--x) var(--y), rgba(139,92,246,0.15), transparent 40%)', x: spotlightX, y: spotlightY }}
        animate={{ '--x': spotlightX, '--y': spotlightY } as any}
      />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="max-w-7xl mx-auto relative z-10"
      >
        {/* Title */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-2 text-white">
            Attendance Management
          </h1>
          <p className="text-lg text-white/70">
            {selectedSection
              ? `${YEAR_LABELS[selectedYear]} · Section ${selectedSection}`
              : `Select a section to begin`}
          </p>
        </motion.div>

        {/* Search */}
        <motion.div variants={itemVariants} className="mb-6">
          <div className="glass-effect p-4 rounded-xl bg-[#0a0b1a]">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by name or roll number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-[#0a0b1a] text-white rounded-lg 
                  placeholder-indigo-300/50 focus:outline-none focus:ring-1 focus:ring-[#1a1b3a]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/70 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm text-white/70 bg-[#0a0b1a] px-3 py-1 rounded-md inline-block">
                Found: {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </motion.div>

        {/* Table */}
        <motion.div variants={itemVariants} className="rounded-xl overflow-hidden">
          <div className="glass-effect rounded-xl overflow-hidden bg-[#0a0b1a]">
            {/* Loading / empty states */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/40">
                <svg className="animate-spin w-10 h-10 mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Loading students…
              </div>
            ) : !selectedSection ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/30">
                <div className="text-5xl mb-3">👆</div>
                <p>Select a section above to view students</p>
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/30">
                <div className="text-5xl mb-3">📭</div>
                <p>No students in Section {selectedSection}</p>
                <p className="text-sm mt-1">Upload student data from the Admin Panel</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="min-w-full divide-y divide-[#1a1b3a]">
                  <thead className="bg-[#0a0b1a] sticky top-0 z-50">
                    <tr className="border-b border-[#1a1b3a]">
                      <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider w-[30px] sm:w-[60px] sticky left-0 bg-[#0a0b1a] z-20">S No</th>
                      <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider w-[calc(25vw-30px)] sm:w-[180px] sticky left-[30px] sm:left-[60px] bg-[#0a0b1a] z-20">Student Name</th>
                      <th className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider min-w-[100px]">Roll No</th>
                      {['Present', 'Absent', 'Leave', 'On Duty', 'Late'].map(h => (
                        <th key={h} className="px-2 sm:px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider min-w-[120px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1b3a] bg-[#0a0b1a]">
                    {filteredStudents.map((student, index) => (
                      <motion.tr
                        key={student.SNo}
                        variants={tableRowVariants}
                        custom={index}
                        className="hover:bg-[#0f1225] transition-colors"
                      >
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-white sticky left-0 bg-[#0a0b1a]/95 z-10">{student.SNo}</td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-white sticky left-[30px] sm:left-[60px] bg-[#0a0b1a]/95 z-10">{student.Name}</td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-white">{student.RollNo}</td>
                        {['Present', 'Absent', 'Leave', 'On Duty', 'Late'].map(status => (
                          <td key={status} className="px-2 sm:px-6 py-4 whitespace-nowrap min-w-[120px]">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleAttendanceChange(student.SNo, status)}
                              className={`px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                                attendance[student.SNo] === status
                                  ? status === 'Present' ? 'status-present'
                                    : status === 'Absent' ? 'status-absent'
                                    : status === 'Leave' ? 'status-leave'
                                    : status === 'On Duty' ? 'status-od'
                                    : 'status-late'
                                  : 'attendance-button-unselected'
                              }`}
                            >
                              {status}
                            </motion.button>
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>

        {/* Summary */}
        {students.length > 0 && (
          <motion.div variants={itemVariants} className="mt-8">
            <div className="glass-effect p-6 rounded-xl bg-[#0a0b1a]">
              <h2 className="text-2xl font-bold mb-4 text-white">Attendance Summary</h2>
              <pre className="bg-[#0a0b1a] p-4 rounded-lg font-mono text-sm text-white/90 overflow-x-auto">
                {attendanceSummary}
              </pre>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Copy Summary', onClick: copyToClipboard, className: 'bg-gradient-to-r from-indigo-900/50 to-purple-900/50 hover:from-indigo-800/60 hover:to-purple-800/60 border-indigo-800/30' },
                  { label: 'Save to Database', onClick: saveToDatabase, className: 'bg-gradient-to-r from-blue-900/50 to-cyan-900/50 hover:from-blue-800/60 hover:to-cyan-800/60 border-blue-800/30' },
                  { label: 'Share on WhatsApp', onClick: shareOnWhatsApp, className: 'bg-gradient-to-r from-emerald-900/50 to-green-900/50 hover:from-emerald-800/60 hover:to-green-800/60 border-emerald-800/30' },
                  { label: 'View History', onClick: () => navigate('/login/history'), className: 'bg-gradient-to-r from-violet-900/50 to-pink-900/50 hover:from-violet-800/60 hover:to-pink-800/60 border-violet-800/30' },
                ].map(({ label, onClick, className }) => (
                  <motion.button
                    key={label}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClick}
                    className={`${className} text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 border w-full`}
                  >
                    {label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
            >
              <div className="glass-effect px-6 py-4 rounded-xl shadow-2xl backdrop-blur-xl min-w-[300px] bg-[#0a0b1a]">
                <div className="flex items-center gap-3">
                  {notification.type === 'success' ? (
                    <div className={`w-10 h-10 rounded-full ${notification.color ? `bg-${notification.color}-500/30` : 'bg-emerald-500/30'} flex items-center justify-center`}>
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360, transition: { duration: 0.5 } }} className="w-6 h-6 text-white">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-rose-500/30 flex items-center justify-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 text-white">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </motion.div>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-white">Status Updated…</span>
                    <span className="text-base text-white font-medium">{notification.message}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Dashboard;