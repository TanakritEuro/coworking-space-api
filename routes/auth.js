const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, getMe, logout, forgotPassword, resetPassword } = require('../controllers/auth');

const router = express.Router();

const { protect } = require('../middleware/auth');

//Stricter limit than the global one so the reset email cannot be used to spam an inbox
const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many password reset requests, please try again later' }
});

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', logout);
router.post('/forgotpassword', forgotPasswordLimiter, forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Password reset
 */

/**
 * @swagger
 * /auth/forgotpassword:
 *   post:
 *     summary: Request a password reset link by email (link is valid for 15 minutes and works once)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user1@seed.test
 *     responses:
 *       200:
 *         description: Same response whether or not the email is registered
 *       400:
 *         description: Email missing
 *       429:
 *         description: Too many requests
 */

/**
 * @swagger
 * /auth/resetpassword/{resettoken}:
 *   put:
 *     summary: Set a new password using the token from the reset email
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: resettoken
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset; the token can no longer be used
 *       400:
 *         description: Invalid, expired or already used token, or invalid password
 */
