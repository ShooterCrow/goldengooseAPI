const express = require("express");
const router = express.Router();
const { signup, login, refresh, logout } = require("../controllers/authController");

// @route   POST /api/auth/signup
// @desc    Register a new user
router.post("/signup", signup);

// @route   POST /api/auth/login
// @desc    Login and get access token
router.post("/login", login);

// @route   GET /api/auth/refresh
// @desc    Refresh access token using refresh token cookie
router.get("/refresh", refresh);

// @route   POST /api/auth/logout
// @desc    Logout user (clear refresh token cookie)
router.post("/logout", logout);

module.exports = router;
