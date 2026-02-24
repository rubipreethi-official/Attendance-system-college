const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('xlsx');
require('dotenv').config();

const app = express();

// CORS Configuration
const allowedOrigins = [
  'https://attendance-management-system-vcet-m.vercel.app',
  'https://attendance-management-system-vcet-madurai.onrender.com',
  'https://attendance-management-system-z5qd.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://attendance-v875.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (
      origin.includes("vercel.app") ||
      origin.includes("localhost") ||
      origin.includes("onrender.com")
    ) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.Mongo_URI;
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ============= SCHEMAS =============

const attendanceCountSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true, default: Date.now },
  presentCount: { type: Number, required: true, default: 0 },
  absentCount: { type: Number, required: true, default: 0 },
  leaveCount: { type: Number, required: true, default: 0 },
  odCount: { type: Number, required: true, default: 0 },
  lateCount: { type: Number, required: true, default: 0 },
  totalStudents: { type: Number, required: true },
  studentRecords: [{ studentId: String, rollNo: String, name: String, status: String }],
  attendanceData: { type: String, required: true }
}, { timestamps: true });

attendanceCountSchema.index({ 'studentRecords.name': 1 });
attendanceCountSchema.index({ 'studentRecords.rollNo': 1 });

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' }
});

// ── NEW: Section Schema ──
// Stores which sections exist for each year
const sectionSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true,
    enum: ['first-year', 'second-year', 'third-year', 'final-year']
  },
  name: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  }
}, { timestamps: true });

sectionSchema.index({ year: 1, name: 1 }, { unique: true });

// ── NEW: Unified Student Schema (supports all years + sections) ──
// We use one flexible schema so sections work cleanly for every year.
const studentSchema = new mongoose.Schema({
  sNo: { type: Number, required: true },
  year: {
    type: String,
    required: true,
    enum: ['first-year', 'second-year', 'third-year', 'final-year']
  },
  section: { type: String, required: true, uppercase: true, trim: true },
  // first-year uses these field names
  studentName: { type: String },
  rollNumber: { type: String },
  registerNo: { type: String },
  // other years use these field names
  name: { type: String },
  rollNo: { type: String },
  regNo: { type: String },
  department: { type: String, default: 'CSE' },
  createdAt: { type: Date, default: Date.now }
});

studentSchema.index({ year: 1, section: 1, sNo: 1 });

// ── Legacy schemas kept for backward-compat (existing data) ──
const firstYearStudentSchema = new mongoose.Schema({
  sNo: { type: Number, required: true },
  rollNumber: { type: String, required: true, unique: true },
  registerNo: { type: String, required: true },
  studentName: { type: String, required: true },
  year: { type: Number, default: 1 },
  department: { type: String, default: 'CSE' },
  section: { type: String, default: 'E' },
  createdAt: { type: Date, default: Date.now }
});

const secondYearStudentSchema = new mongoose.Schema({
  sNo: { type: Number, required: true },
  rollNo: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  regNo: { type: String },
  year: { type: Number, default: 2 },
  department: { type: String, default: 'CSE' },
  section: { type: String, default: 'C' },
  createdAt: { type: Date, default: Date.now }
});

const ThirdYearStudentSchema = new mongoose.Schema({
  sNo: { type: Number, required: true },
  rollNo: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  regNo: { type: String },
  year: { type: Number, default: 3 },
  department: { type: String, default: 'CSE' },
  section: { type: String, default: 'C' },
  createdAt: { type: Date, default: Date.now }
});

const finalYearStudentSchema = new mongoose.Schema({
  sNo: { type: Number, required: true },
  rollNo: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  regNo: { type: String },
  year: { type: Number, default: 4 },
  department: { type: String, default: 'CSE' },
  section: { type: String, default: 'C' },
  createdAt: { type: Date, default: Date.now }
});

// Models
const AttendanceCount = mongoose.model('AttendanceCount', attendanceCountSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Section = mongoose.model('Section', sectionSchema);
const Student = mongoose.model('Student', studentSchema);

// Legacy models (kept so existing DB collections still work)
const FirstYearStudent = mongoose.model('FirstYearStudent', firstYearStudentSchema);
const SecondYearStudent = mongoose.model('SecondYearStudent', secondYearStudentSchema);
const thirdyear = mongoose.model('thirdyearstudent', ThirdYearStudentSchema);
const finalyear = mongoose.model('finalyearstudent', finalYearStudentSchema);

// ============= MIDDLEWARE =============

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    cb(allowed.includes(file.mimetype) ? null : new Error('Only Excel and CSV files are allowed'), allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ============= AUTHENTICATION =============

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    res.json({ token, username: admin.username, role: admin.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= SECTION ROUTES =============

// GET all sections for a year
app.get('/api/sections/:year', authenticateToken, async (req, res) => {
  try {
    const { year } = req.params;
    const docs = await Section.find({ year }).sort({ name: 1 });
    res.json({ sections: docs.map(d => d.name) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create a new section for a year
app.post('/api/sections/:year', authenticateToken, async (req, res) => {
  try {
    const { year } = req.params;
    const { section } = req.body;

    if (!section || !section.trim()) {
      return res.status(400).json({ error: 'Section name is required' });
    }

    const name = section.trim().toUpperCase();
    const existing = await Section.findOne({ year, name });
    if (existing) {
      return res.status(409).json({ error: `Section "${name}" already exists for ${year}` });
    }

    await Section.create({ year, name });
    res.json({ success: true, section: name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a section (and all its students)
app.delete('/api/sections/:year/:section', authenticateToken, async (req, res) => {
  try {
    const { year, section } = req.params;
    const name = section.toUpperCase();

    await Section.deleteOne({ year, name });
    const result = await Student.deleteMany({ year, section: name });

    res.json({ success: true, deletedStudents: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= SECTION-AWARE STUDENT ROUTES =============

// GET students for a specific year + section
app.get('/api/students/:year/:section', authenticateToken, async (req, res) => {
  try {
    const { year, section } = req.params;
    // Skip if "section" is actually "all" (used by delete-all legacy routes)
    if (section === 'all') return res.status(400).json({ error: 'Invalid section name' });

    const students = await Student.find({
      year,
      section: section.toUpperCase()
    }).sort({ sNo: 1 });

    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST upload Excel for a specific year + section
app.post('/api/students/:year/:section/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { year, section } = req.params;
    const sectionName = section.toUpperCase();

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Ensure the section exists; create it if not
    await Section.findOneAndUpdate(
      { year, name: sectionName },
      { year, name: sectionName },
      { upsert: true, new: true }
    );

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const isFirstYear = year === 'first-year';

    const students = data.map((row, index) => ({
      sNo: row['S. No'] || row.SNo || index + 1,
      year,
      section: sectionName,
      department: 'CSE',
      // first-year field names
      ...(isFirstYear ? {
        studentName: row['Student Name'] || row.studentName || row.Name || '',
        rollNumber: row['Roll Number'] || row.rollNumber || row.RollNo || '',
        registerNo: row['Register No'] || row.registerNo || row.RegNo || '',
      } : {
        name: row.Name || row['Student Name'] || row.name || '',
        rollNo: row.RollNo || row['Roll Number'] || row.rollNo || '',
        regNo: row.RegNo || row['Register No'] || row.regNo || '',
      })
    }));

    // Delete existing students for this year+section only, then insert fresh
    await Student.deleteMany({ year, section: sectionName });
    await Student.insertMany(students);

    res.json({
      message: `Students uploaded to ${year} Section ${sectionName}`,
      count: students.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE all students in a specific year + section
app.delete('/api/students/:year/:section/all', authenticateToken, async (req, res) => {
  try {
    const { year, section } = req.params;
    const sectionName = section.toUpperCase();

    const result = await Student.deleteMany({ year, section: sectionName });
    res.json({
      message: `Deleted all students from ${year} Section ${sectionName}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= LEGACY YEAR-ONLY ROUTES (kept for backward compatibility) =============
// These still use the old per-year collections so existing data isn't lost.

app.get('/api/students/first-year', authenticateToken, async (req, res) => {
  try {
    const students = await FirstYearStudent.find().sort({ sNo: 1 });
    res.json(students);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/students/first-year/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const students = data.map((row, i) => ({
      sNo: row['S. No'] || row.SNo || i + 1,
      rollNumber: row['Roll Number'] || row.rollNumber || '',
      registerNo: row['Register No'] || row.registerNo || '',
      studentName: row['Student Name'] || row.studentName || row.Name || '',
      year: 1, department: 'CSE', section: 'E'
    }));
    await FirstYearStudent.deleteMany({});
    await FirstYearStudent.insertMany(students);
    res.json({ message: 'First Year students uploaded successfully', count: students.length });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/students/first-year/all', authenticateToken, async (req, res) => {
  try {
    const result = await FirstYearStudent.deleteMany({});
    res.json({ message: 'First year students deleted', deletedCount: result.deletedCount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/students/second-year', authenticateToken, async (req, res) => {
  try {
    const students = await SecondYearStudent.find().sort({ sNo: 1 });
    res.json(students);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/students/second-year/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const students = data.map((row, i) => ({
      sNo: row.SNo || row['S. No'] || i + 1,
      rollNo: row.RollNo || row['Roll Number'] || '',
      name: row.Name || row['Student Name'] || '',
      regNo: row.RegNo || row['Register No'] || '',
      year: 2, department: 'CSE', section: 'C'
    }));
    await SecondYearStudent.deleteMany({});
    await SecondYearStudent.insertMany(students);
    res.json({ message: 'Second Year students uploaded successfully', count: students.length });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/students/second-year/all', authenticateToken, async (req, res) => {
  try {
    const result = await SecondYearStudent.deleteMany({});
    res.json({ message: 'Second year students deleted', deletedCount: result.deletedCount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/students/third-year', authenticateToken, async (req, res) => {
  try {
    const students = await thirdyear.find().sort({ sNo: 1 });
    res.json(students);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/students/third-year/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const students = data.map((row, i) => ({
      sNo: row.SNo || row['S. No'] || i + 1,
      rollNo: row.RollNo || row['Roll Number'] || '',
      name: row.Name || row['Student Name'] || '',
      regNo: row.RegNo || row['Register No'] || '',
      year: 3, department: 'CSE', section: 'C'
    }));
    await thirdyear.deleteMany({});
    await thirdyear.insertMany(students);
    res.json({ message: 'Third Year students uploaded successfully', count: students.length });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/students/third-year/all', authenticateToken, async (req, res) => {
  try {
    const result = await thirdyear.deleteMany({});
    res.json({ message: 'Third year students deleted', deletedCount: result.deletedCount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/students/final-year', authenticateToken, async (req, res) => {
  try {
    const students = await finalyear.find().sort({ sNo: 1 });
    res.json(students);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/students/final-year/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const students = data.map((row, i) => ({
      sNo: row.SNo || row['S. No'] || i + 1,
      rollNo: row.RollNo || row['Roll Number'] || '',
      name: row.Name || row['Student Name'] || '',
      regNo: row.RegNo || row['Register No'] || '',
      year: 4, department: 'CSE', section: 'C'
    }));
    await finalyear.deleteMany({});
    await finalyear.insertMany(students);
    res.json({ message: 'Final Year students uploaded successfully', count: students.length });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/students/final-year/all', authenticateToken, async (req, res) => {
  try {
    const result = await finalyear.deleteMany({});
    res.json({ message: 'Final year students deleted', deletedCount: result.deletedCount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============= ATTENDANCE ROUTES =============

app.post('/api/', async (req, res) => {
  try {
    const { presentCount, absentCount, leaveCount, odCount, lateCount, totalStudents, attendanceData, studentRecords } = req.body;
    const record = new AttendanceCount({ presentCount, absentCount, leaveCount, odCount, lateCount, totalStudents, attendanceData, studentRecords });
    const saved = await record.save();
    res.status(201).json(saved);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const records = await AttendanceCount.find(query).sort({ date: -1 }).limit(30);
    res.json(records);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/student', async (req, res) => {
  try {
    const { name, rollNo } = req.query;
    let query = {};
    if (name) query['studentRecords.name'] = { $regex: name, $options: 'i' };
    if (rollNo) query['studentRecords.rollNo'] = rollNo;

    const records = await AttendanceCount.find(query).sort({ date: -1 });
    if (records.length === 0) return res.status(404).json({ message: 'No records found for this student' });

    const studentStats = {
      totalDays: records.length,
      presentDays: 0, absentDays: 0, leaveDays: 0, odDays: 0, lateDays: 0,
      dates: { present: [], absent: [], leave: [], od: [], late: [] }
    };

    records.forEach(record => {
      const sr = record.studentRecords.find(s =>
        (name && s.name.toLowerCase().includes(name.toLowerCase())) ||
        (rollNo && s.rollNo === rollNo)
      );
      if (sr) {
        const date = record.date.toLocaleDateString();
        const map = { Present: ['presentDays', 'present'], Absent: ['absentDays', 'absent'], Leave: ['leaveDays', 'leave'], 'On Duty': ['odDays', 'od'], Late: ['lateDays', 'late'] };
        if (map[sr.status]) {
          studentStats[map[sr.status][0]]++;
          studentStats.dates[map[sr.status][1]].push(date);
        }
      }
    });

    res.json({
      studentInfo: records[0].studentRecords.find(s =>
        (name && s.name.toLowerCase().includes(name.toLowerCase())) || (rollNo && s.rollNo === rollNo)
      ),
      statistics: studentStats
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/stats/summary', async (req, res) => {
  try {
    const stats = await AttendanceCount.aggregate([{
      $group: { _id: null, avgPresent: { $avg: '$presentCount' }, avgAbsent: { $avg: '$absentCount' }, avgLeave: { $avg: '$leaveCount' }, avgOD: { $avg: '$odCount' }, totalDays: { $sum: 1 } }
    }]);
    res.json(stats[0] || {});
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(date.setHours(23, 59, 59, 999));
    const record = await AttendanceCount.findOne({ date: { $gte: start, $lte: end } });
    if (!record) return res.status(404).json({ message: 'No record found for this date' });
    res.json(record);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/:id', async (req, res) => {
  try {
    const record = await AttendanceCount.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ============= INITIALIZE =============

async function initializeDatabase() {
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({ username: 'admin', password: hashedPassword });
      console.log('✅ Initial admin created: username=admin, password=admin123');
    }

    const firstYearCount = await FirstYearStudent.countDocuments();
    const secondYearCount = await SecondYearStudent.countDocuments();
    const sectionCount = await Section.countDocuments();
    const newStudentCount = await Student.countDocuments();

    console.log('📊 Database Status:');
    console.log(`   First Year Students (legacy): ${firstYearCount}`);
    console.log(`   Second Year Students (legacy): ${secondYearCount}`);
    console.log(`   Sections: ${sectionCount}`);
    console.log(`   Section-based Students: ${newStudentCount}`);
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// ============= START SERVER =============
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initializeDatabase();
  console.log('✨ Ready to accept requests!');
});