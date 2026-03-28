const express = require('express');
const bcrypt = require('bcryptjs');

const { query } = require('../config/db');
const { signUserToken, verifyUserToken } = require('../middleware/auth');

const router = express.Router();
const allowedRoles = ['volunteer', 'ngo', 'admin'];
const saltRounds = 12;

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const incomingRole = req.body.role || 'volunteer';
    let role = String(incomingRole).toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Missing required fields: name, email, and password are required',
      });
    }

    if (role === 'ngo') role = 'organizer'; // Map 'ngo' to DB enum 'organizer'

    // Fix allowed roles array locally since we overwrote the top constant logic contextually
    if (!['volunteer', 'organizer', 'admin'].includes(role)) {
      return res.status(400).json({
        message: "Invalid role. Allowed roles: 'volunteer', 'organizer', 'admin'",
      });
    }

    const existingUser = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);

    const nameParts = String(name).trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const insertedUser = await query(
      `
        INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, first_name || ' ' || COALESCE(last_name, '') AS name, email, role
      `,
      [firstName, lastName, email, phone || null, passwordHash, role]
    );

    const user = insertedUser.rows[0];
    const token = signUserToken({ userId: user.id, email: user.email, role: user.role });

    return res.status(201).json({
      message: 'User registered',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    const userResult = await query(
      "SELECT id, first_name || ' ' || COALESCE(last_name, '') AS name, email, password_hash, role FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signUserToken({ userId: user.id, email: user.email, role: user.role });

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.get('/me', verifyUserToken, async (req, res) => {
  try {
    const userResult = await query(
      `
        SELECT id, first_name || ' ' || COALESCE(last_name, '') AS name, email, phone, role, created_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(userResult.rows[0]);
  } catch (error) {
    console.error("GET /me Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;
