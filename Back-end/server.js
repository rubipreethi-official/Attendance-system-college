const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('xlsx');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance');

// ============= SCHEMAS =============

// Your existing Attendance Schema
const attendanceCountSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    default: Date.now
  },
  presentCount: {
    type: Number,
    required: true,
    default: 0
  },
  absentCount: {
    type: Number,
    required: true,
    default: 0
  },
  leaveCount: {
    type: Number,
    required: true,
    default: 0
  },
  odCount: {
    type: Number,
    required: true,
    default: 0
  },
  lateCount: {
    type: Number,
    required: true,
    default: 0
  },
  totalStudents: {
    type: Number,
    required: true
  },
  studentRecords: [{
    studentId: String,
    rollNo: String,
    name: String,
    status: String
  }],
  attendanceData: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

attendanceCountSchema.index({ 'studentRecords.name': 1 });
attendanceCountSchema.index({ 'studentRecords.rollNo': 1 });

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' }
});

// Student Schema for First Year (25CYSE)
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

// Student Schema for Second Year (24CYSE)
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

// Student Schema for Third Year (23CYSE)
const thirdYearStudentSchema = new mongoose.Schema({
  sNo: { type: Number, required: true },
  rollNo: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  regNo: { type: String },
  year: { type: Number, default: 3 },
  department: { type: String, default: 'CSE' },
  section: { type: String, default: 'A' },
  createdAt: { type: Date, default: Date.now }
});

// Student Schema for Final Year (22CYSE)
const finalYearStudentSchema = new mongoose.Schema({
  sNo: { type: Number, required: true },
  rollNo: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  regNo: { type: String },
  year: { type: Number, default: 4 },
  department: { type: String, default: 'CSE' },
  section: { type: String, default: 'B' },
  createdAt: { type: Date, default: Date.now }
});

const AttendanceCount = mongoose.model('AttendanceCount', attendanceCountSchema);
const Admin = mongoose.model('Admin', adminSchema);
const FirstYearStudent = mongoose.model('FirstYearStudent', firstYearStudentSchema);
const SecondYearStudent = mongoose.model('SecondYearStudent', secondYearStudentSchema);
const ThirdYearStudent = mongoose.model('ThirdYearStudent', thirdYearStudentSchema);
const FinalYearStudent = mongoose.model('FinalYearStudent', finalYearStudentSchema);

// ============= MIDDLEWARE =============

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// File upload configuration
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ============= AUTHENTICATION ROUTES =============

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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



// Get First Year Students
app.get('/api/students/first-year', authenticateToken, async (req, res) => {
  try {
    const students = await FirstYearStudent.find().sort({ sNo: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload First Year Students (Excel/CSV)
app.post('/api/students/first-year/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const students = data.map((row, index) => ({
      sNo: row['S. No'] || row.SNo || index + 1,
      rollNumber: row['Roll Number'] || row.rollNumber || '',
      registerNo: row['Register No'] || row.registerNo || '',
      studentName: row['Student Name'] || row.studentName || row.Name || '',
      year: 1,
      department: 'CSE',
      section: 'E'
    }));

    // Delete existing first year students
    await FirstYearStudent.deleteMany({});
    
    // Insert new students
    await FirstYearStudent.insertMany(students);
    
    res.json({ 
      message: 'First Year students uploaded successfully', 
      count: students.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= SECOND YEAR ENDPOINTS (24CYSE) =============

// Get Second Year Students
app.get('/api/students/second-year', authenticateToken, async (req, res) => {
  try {
    const students = await SecondYearStudent.find().sort({ sNo: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload Second Year Students (Excel/CSV)
app.post('/api/students/second-year/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const students = data.map((row, index) => ({
      sNo: row.SNo || row['S. No'] || index + 1,
      rollNo: row.RollNo || row['Roll Number'] || '',
      name: row.Name || row['Student Name'] || '',
      regNo: row.RegNo || row['Register No'] || '',
      year: 2,
      department: 'CSE',
      section: 'C'
    }));

    // Delete existing second year students
    await SecondYearStudent.deleteMany({});
    
    // Insert new students
    await SecondYearStudent.insertMany(students);
    
    res.json({ 
      message: 'Second Year students uploaded successfully', 
      count: students.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= THIRD YEAR ENDPOINTS (23CYSE) =============

// Get Third Year Students
app.get('/api/students/third-year', authenticateToken, async (req, res) => {
  try {
    const students = await ThirdYearStudent.find().sort({ sNo: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload Third Year Students (Excel/CSV)
app.post('/api/students/third-year/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const students = data.map((row, index) => ({
      sNo: row.SNo || row['S. No'] || index + 1,
      rollNo: row.RollNo || row['Roll Number'] || '',
      name: row.Name || row['Student Name'] || '',
      regNo: row.RegNo || row['Register No'] || '',
      year: 3,
      department: 'CSE',
      section: 'A'
    }));

    // Delete existing third year students
    await ThirdYearStudent.deleteMany({});
    
    // Insert new students
    await ThirdYearStudent.insertMany(students);
    
    res.json({ 
      message: 'Third Year students uploaded successfully', 
      count: students.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Get Final Year Students
app.get('/api/students/final-year', authenticateToken, async (req, res) => {
  try {
    const students = await FinalYearStudent.find().sort({ sNo: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload Final Year Students (Excel/CSV)
app.post('/api/students/final-year/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const students = data.map((row, index) => ({
      sNo: row.SNo || row['S. No'] || index + 1,
      rollNo: row.RollNo || row['Roll Number'] || '',
      name: row.Name || row['Student Name'] || '',
      regNo: row.RegNo || row['Register No'] || '',
      year: 4,
      department: 'CSE',
      section: 'B'
    }));

    // Delete existing final year students
    await FinalYearStudent.deleteMany({});
    
    // Insert new students
    await FinalYearStudent.insertMany(students);
    
    res.json({ 
      message: 'Final Year students uploaded successfully', 
      count: students.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= DELETE STUDENT DATA ENDPOINTS =============

// Delete all students of a specific year
app.delete('/api/students/:year/all', authenticateToken, async (req, res) => {
  try {
    const { year } = req.params;
    
    const models = {
      'first-year': FirstYearStudent,
      'second-year': SecondYearStudent,
      'third-year': ThirdYearStudent,
      'final-year': FinalYearStudent
    };
    
    const Model = models[year];
    if (!Model) {
      return res.status(400).json({ error: 'Invalid year specified' });
    }
    
    const result = await Model.deleteMany({});
    res.json({ 
      message: `All ${year} students deleted successfully`, 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api', async (req, res) => {
  try {
    const {
      presentCount,
      absentCount,
      leaveCount,
      odCount,
      lateCount,
      totalStudents,
      attendanceData,
      studentRecords
    } = req.body;

    const attendance = new AttendanceCount({
      date: new Date(),
      presentCount,
      absentCount,
      leaveCount,
      odCount,
      lateCount,
      totalStudents,
      studentRecords,
      attendanceData
    });

    await attendance.save();
    res.json({ message: 'Attendance saved successfully', data: attendance });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Attendance already saved for today' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get Attendance History
app.get('/api/attendance/history', async (req, res) => {
  try {
    const { startDate, endDate, search } = req.query;
    let query = {};

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (search) {
      query.$or = [
        { 'studentRecords.name': { $regex: search, $options: 'i' } },
        { 'studentRecords.rollNo': { $regex: search, $options: 'i' } }
      ];
    }

    const records = await AttendanceCount.find(query).sort({ date: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Attendance Record
app.delete('/api/attendance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await AttendanceCount.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



async function initializeDatabase() {
  try {
    // Create initial admin if none exists
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('admin200', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword
      });
      
    }

    
    const firstYearCount = await FirstYearStudent.countDocuments();
    const secondYearCount = await SecondYearStudent.countDocuments();
    const thirdYearCount = await ThirdYearStudent.countDocuments();
    const finalYearCount = await FinalYearStudent.countDocuments();

    console.log(`📊 Database Status:`);
    console.log(`   First Year Students: ${firstYearCount}`);
    console.log(`   Second Year Students: ${secondYearCount}`);
    console.log(`   Third Year Students: ${thirdYearCount}`);
    console.log(`   Final Year Students: ${finalYearCount}`);
    
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initializeDatabase();
  console.log('\n📍 Available Endpoints:');
  console.log('   POST   /api/auth/login');
  console.log('   GET    /api/students/first-year');
  console.log('   POST   /api/students/first-year/upload');
  console.log('   GET    /api/students/second-year');
  console.log('   POST   /api/students/second-year/upload');
  console.log('   GET    /api/students/third-year');
  console.log('   POST   /api/students/third-year/upload');
  console.log('   GET    /api/students/final-year');
  console.log('   POST   /api/students/final-year/upload');
  console.log('   DELETE /api/students/:year/all (delete all students of a year)');
  console.log('   POST   /api');
  console.log('   GET    /api/attendance/history');
  console.log('   DELETE /api/attendance/:id');
  console.log('\n✨ Ready to accept requests!\n');
});