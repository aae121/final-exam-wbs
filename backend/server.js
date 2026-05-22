const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'db.json');

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { courses: [], registrations: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/courses', (req, res) => {
  const db = readDB();
  res.json(db.courses);
});

app.get('/api/registrations', (req, res) => {
  const db = readDB();
  res.json(db.registrations);
});

// Simple in-memory token store for sessions (admin and users)
const tokens = new Map() // token -> { username, role, exp }

function requireAuth(req, res, next){
  const auth = req.headers['authorization'] || ''
  const m = auth.match(/^Bearer (.+)$/)
  if(!m) return res.status(401).json({ error: 'Unauthorized' })
  const token = m[1]
  const rec = tokens.get(token)
  if(!rec) return res.status(401).json({ error: 'Unauthorized' })
  if(rec.exp < Date.now()){ tokens.delete(token); return res.status(401).json({ error: 'Expired' }) }
  req.user = rec.username
  req.role = rec.role
  next()
}

function requireAdmin(req, res, next){
  if(req.role === 'admin') return next()
  return res.status(403).json({ error: 'Forbidden' })
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {}
  const db = readDB()
  const user = (db.admins || []).find(a => a.username === username && a.password === password)
  if(!user) return res.status(401).json({ error: 'Invalid credentials' })
  const token = require('crypto').randomBytes(24).toString('hex')
  const exp = Date.now() + 1000 * 60 * 60 * 12 // 12 hours
  tokens.set(token, { username, role: 'admin', exp })
  res.json({ token, expiresAt: new Date(exp).toISOString() })
})

app.get('/api/admin/registrations', requireAuth, requireAdmin, (req, res) => {
  const db = readDB();
  res.json(db.registrations);
})

// User account endpoints
app.post('/api/users/register', (req, res) => {
  const { username, password, name, email, studentId } = req.body || {}
  if(!username || !password || !name || !email || !studentId) return res.status(400).json({ error: 'Missing fields' })
  const db = readDB()
  if((db.users || []).some(u => u.username === username || u.studentId === studentId)) return res.status(409).json({ error: 'User exists' })
  const user = { username, password, role: 'user', name, email, studentId }
  db.users = db.users || []
  db.users.push(user)
  writeDB(db)
  res.json({ success: true, user: { username, name, email, studentId } })
})

app.post('/api/users/login', (req, res) => {
  const { username, password } = req.body || {}
  const db = readDB()
  const user = (db.users || []).find(u => u.username === username && u.password === password)
  if(!user) return res.status(401).json({ error: 'Invalid credentials' })
  const token = require('crypto').randomBytes(24).toString('hex')
  const exp = Date.now() + 1000 * 60 * 60 * 12
  tokens.set(token, { username: user.username, role: user.role || 'user', exp })
  res.json({ token, user: { username: user.username, name: user.name, email: user.email, studentId: user.studentId }, expiresAt: new Date(exp).toISOString() })
})

app.get('/api/me', requireAuth, (req, res) => {
  const db = readDB()
  const u = (db.users || []).find(x => x.username === req.user) || (db.admins || []).find(x => x.username === req.user)
  if(!u) return res.status(404).json({ error: 'Not found' })
  const out = { username: u.username, name: u.name, email: u.email, studentId: u.studentId, role: u.role || (db.admins.some(a=>a.username===u.username)?'admin':'user') }
  res.json(out)
})

app.post('/api/register', requireAuth, (req, res) => {
  const { name: bodyName, email: bodyEmail, studentId: bodyStudentId, course, year, agree } = req.body;
  const db = readDB();
  // use authenticated user info when available
  const user = (db.users || []).find(u => u.username === req.user) || (db.admins || []).find(u => u.username === req.user)
  const name = bodyName || (user && user.name)
  const email = bodyEmail || (user && user.email)
  const studentId = bodyStudentId || (user && user.studentId) || ''
  if (!name || !email || !course) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const entry = {
    id: Date.now().toString(),
    name,
    email,
    studentId,
    course,
    year: year || '',
    agree: !!agree,
    createdAt: new Date().toISOString(),
    createdBy: req.user
  };
  db.registrations.push(entry);
  writeDB(db);
  res.json({ success: true, entry });
});

app.delete('/api/registrations/:id', (req, res) => {
  const id = req.params.id
  // allow admin delete only
  const auth = req.headers['authorization'] || ''
  if(!auth.match(/^Bearer /)) return res.status(401).json({ error: 'Unauthorized' })
  const m = auth.match(/^Bearer (.+)$/)
  const token = m[1]
  const rec = tokens.get(token)
  if(!rec || rec.exp < Date.now()) return res.status(401).json({ error: 'Unauthorized' })
  const db = readDB()
  const before = db.registrations.length
  db.registrations = db.registrations.filter(r => r.id !== id)
  if (db.registrations.length === before) return res.status(404).json({ error: 'Not found' })
  writeDB(db)
  res.json({ success: true })
})

// Admin: manage courses
app.post('/api/admin/courses', requireAuth, requireAdmin, (req, res) => {
  const { id, title } = req.body || {}
  if(!id || !title) return res.status(400).json({ error: 'Missing' })
  const db = readDB()
  db.courses.push({ id, title })
  writeDB(db)
  res.json({ success: true })
})

app.delete('/api/admin/courses/:id', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id
  const db = readDB()
  const before = db.courses.length
  db.courses = db.courses.filter(c => c.id !== id)
  if(db.courses.length === before) return res.status(404).json({ error: 'Not found' })
  writeDB(db)
  res.json({ success: true })
})

// Serve built frontend if present
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
