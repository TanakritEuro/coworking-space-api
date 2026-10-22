const express = require('express');
const { getCoworkingSpaces, getCoworkingSpace, createCoworkingSpace, updateCoworkingSpace, deleteCoworkingSpace } = require('../controllers/coworkingSpaces');

//Include other resource routers
const reservationRouter = require('./reservations');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

//Re-route into other resource routers
router.use('/:coworkingSpaceId/reservations/', reservationRouter);

router.route('/').get(getCoworkingSpaces).post(protect, authorize('admin'), createCoworkingSpace);
router.route('/:id').get(getCoworkingSpace).put(protect, authorize('admin'), updateCoworkingSpace).delete(protect, authorize('admin'), deleteCoworkingSpace);

module.exports = router;

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     CoworkingSpace:
 *       type: object
 *       required:
 *         - name
 *         - address
 *         - tel
 *         - openTime
 *         - closeTime
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the co-working space
 *         name:
 *           type: string
 *           description: Co-working space name
 *         address:
 *           type: string
 *           description: Address of the co-working space
 *         tel:
 *           type: string
 *           description: Telephone number
 *         openTime:
 *           type: string
 *           description: Opening time (HH:mm, 24-hour)
 *         closeTime:
 *           type: string
 *           description: Closing time (HH:mm, 24-hour)
 *       example:
 *         id: 652f1c2e8a1b2c3d4e5f6789
 *         name: The Hive Thonglor
 *         address: 46/9 Sukhumvit 49, Khlong Tan Nuea, Watthana, Bangkok 10110
 *         tel: 02-662-6062
 *         openTime: "08:00"
 *         closeTime: "22:00"
 */

/**
 * @swagger
 * tags:
 *   name: CoworkingSpaces
 *   description: The co-working spaces managing API
 */

/**
 * @swagger
 * /coworkingspaces:
 *   get:
 *     summary: Returns the list of all the co-working spaces
 *     tags: [CoworkingSpaces]
 *     responses:
 *       200:
 *         description: The list of the co-working spaces
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CoworkingSpace'
 */

/**
 * @swagger
 * /coworkingspaces/{id}:
 *   get:
 *     summary: Get the co-working space by id
 *     tags: [CoworkingSpaces]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The co-working space id
 *     responses:
 *       200:
 *         description: The co-working space description by id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CoworkingSpace'
 *       404:
 *         description: The co-working space was not found
 */

/**
 * @swagger
 * /coworkingspaces:
 *   post:
 *     summary: Create a new co-working space (admin only)
 *     tags: [CoworkingSpaces]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CoworkingSpace'
 *     responses:
 *       201:
 *         description: The co-working space was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CoworkingSpace'
 *       400:
 *         description: Invalid data
 */

/**
 * @swagger
 * /coworkingspaces/{id}:
 *   put:
 *     summary: Update the co-working space by the id (admin only)
 *     tags: [CoworkingSpaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The co-working space id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CoworkingSpace'
 *     responses:
 *       200:
 *         description: The co-working space was updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CoworkingSpace'
 *       404:
 *         description: The co-working space was not found
 */

/**
 * @swagger
 * /coworkingspaces/{id}:
 *   delete:
 *     summary: Remove the co-working space by id, together with its reservations (admin only)
 *     tags: [CoworkingSpaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The co-working space id
 *     responses:
 *       200:
 *         description: The co-working space was deleted
 *       404:
 *         description: The co-working space was not found
 */
