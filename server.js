const express = require('express');
const cors = require('cors');  // ✅ Sirf 1 baar
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const API_BASE = 'http://localhost:4000';
let authToken = null;

const app = express();
const PORT = 4000;

// CORS configuration - Sirf 1 baar!
app.use(cors({
  origin: ['http://localhost:5500', 'https://quizmania-jwt-f.netlify.app'],
  credentials: true
}));

// IMPORTANT: real app me .env se lo
const JWT_SECRET = 'super_secret_key_change_this';

// middlewares
app.use(express.json());

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, name, email }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// public: get all quizzes (basic info)
app.get('/api/quizzes', (req, res) => {
  const safeQuizzes = quizzes.map(q => ({
    id: q.id,
    title: q.title,
    description: q.description,
    questions: q.questionsData.length,
    creatorId: q.creatorId
  }));
  res.json(safeQuizzes);
});

// public: get single quiz with questions
app.get('/api/quizzes/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  res.json(quiz);
});

// protected: create quiz
app.post('/api/quizzes', authMiddleware, (req, res) => {
  const { title, description, questionsData } = req.body;
  if (!title || !questionsData || !Array.isArray(questionsData) || questionsData.length === 0) {
    return res.status(400).json({ message: 'Invalid quiz data' });
  }

  const quiz = {
    id: nextQuizId++,
    title,
    description: description || '',
    creatorId: req.user.userId,
    questionsData
  };

  quizzes.push(quiz);
  res.status(201).json(quiz);
});


// in-memory "database"
let users = [];        // { id, name, email, passwordHash }
let quizzes = [];      // { id, title, description, questionsData, creatorId }
let nextUserId = 1;
let nextQuizId = 1;

// helper: create JWT
function createToken(user) {
  return jwt.sign(
    { userId: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

// REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const existing = users.find(u => u.email === email);
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: nextUserId++, name, email, passwordHash };
    users.push(user);

    const token = createToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('REGISTER error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});




// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = createToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('LOGIN error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



// health check
app.get('/', (req, res) => {
  res.json({ message: 'Quiz API running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
