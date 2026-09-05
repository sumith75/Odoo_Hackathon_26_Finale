import express from 'express';
import { initialUsers } from '../db/seedData.js';

const router = express.Router();

let currentUser = initialUsers[1]; // Default to Sales Rep for immediate interaction

router.post('/login', (req, res) => {
  const { email, role } = req.body;
  
  let user = null;
  if (role) {
    user = initialUsers.find(u => u.role === role);
  } else if (email) {
    user = initialUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  if (!user) {
    user = initialUsers[1]; // Fallback to Sales Rep
  }

  currentUser = user;

  res.json({
    success: true,
    user: currentUser,
    message: `Logged in as ${currentUser.name} (${currentUser.role})`
  });
});

router.get('/me', (req, res) => {
  res.json({
    success: true,
    user: currentUser
  });
});

router.get('/users', (req, res) => {
  res.json({
    success: true,
    users: initialUsers
  });
});

export default router;
