const express = require('express');
const { getReservationStats } = require('../controllers/stats');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.get('/reservations', protect, authorize('admin'), getReservationStats);

module.exports = router;

/**
 * @swagger
 * /stats/reservations:
 *   get:
 *     summary: Get reservation statistics for a date range (admin only)
 *     description: Returns the most-booked spaces, peak hour and day, utilisation rate per space (share of days in the range on which the space was booked) and reservations per day or month. Times are bucketed in Asia/Bangkok.
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           example: "2026-11-01"
 *         description: Start date (YYYY-MM-DD), default is 30 days ago
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           example: "2026-11-30"
 *         description: End date (YYYY-MM-DD, inclusive), default is now
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, month]
 *         description: Grouping of the reservations-per-period list (default day)
 *       - in: query
 *         name: top
 *         schema:
 *           type: integer
 *         description: How many most-booked spaces to return (default 5)
 *     responses:
 *       200:
 *         description: The reservation statistics
 *       400:
 *         description: Invalid date range or groupBy
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 */
