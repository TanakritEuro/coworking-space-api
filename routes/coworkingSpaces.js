const express = require('express');
const { getCoworkingSpaces, getNearbyCoworkingSpaces, getCoworkingSpace, createCoworkingSpace, updateCoworkingSpace, deleteCoworkingSpace } = require('../controllers/coworkingSpaces');

//Include other resource routers
const reservationRouter = require('./reservations');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

//Re-route into other resource routers
router.use('/:coworkingSpaceId/reservations/', reservationRouter);

router.route('/').get(getCoworkingSpaces).post(protect, authorize('admin'), createCoworkingSpace);
//Must come before /:id, otherwise "nearby" is taken as an id
router.route('/nearby').get(getNearbyCoworkingSpaces);
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
 *         - latitude
 *         - longitude
 *         - totalRooms
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
 *         latitude:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *           description: Latitude of the co-working space
 *         longitude:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *           description: Longitude of the co-working space
 *         totalRooms:
 *           type: integer
 *           minimum: 1
 *           description: Total number of rooms (set by the admin)
 *         location:
 *           type: object
 *           readOnly: true
 *           description: GeoJSON point built from latitude/longitude (coordinates are [longitude, latitude]); cannot be set directly
 *           properties:
 *             type:
 *               type: string
 *               example: Point
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *       example:
 *         id: 652f1c2e8a1b2c3d4e5f6789
 *         name: The Hive Thonglor
 *         address: 46/9 Sukhumvit 49, Khlong Tan Nuea, Watthana, Bangkok 10110
 *         tel: 02-662-6062
 *         openTime: "08:00"
 *         closeTime: "22:00"
 *         latitude: 13.7317
 *         longitude: 100.5797
 *         totalRooms: 6
 *     CoworkingSpaceAvailability:
 *       allOf:
 *         - $ref: '#/components/schemas/CoworkingSpace'
 *         - type: object
 *           properties:
 *             reservedRooms:
 *               type: integer
 *               description: Reservations at this space on the requested date (only when date is given)
 *             availableRooms:
 *               type: integer
 *               nullable: true
 *               description: totalRooms minus reservedRooms, never below 0 (only when date is given; null if totalRooms is not set)
 *     NearbyCoworkingSpace:
 *       allOf:
 *         - $ref: '#/components/schemas/CoworkingSpaceAvailability'
 *         - type: object
 *           properties:
 *             distanceKm:
 *               type: number
 *               description: Distance from the given location in km, rounded to 2 decimals
 *               example: 1.42
 *   parameters:
 *     availabilityDate:
 *       in: query
 *       name: date
 *       schema:
 *         type: string
 *         format: date
 *         example: "2026-11-25"
 *       required: false
 *       description: A day in Thai time (YYYY-MM-DD). When given, each space also gets reservedRooms and availableRooms for that day
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
 *     parameters:
 *       - $ref: '#/components/parameters/availabilityDate'
 *     responses:
 *       200:
 *         description: The list of the co-working spaces
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CoworkingSpaceAvailability'
 *       400:
 *         description: Invalid date
 */

/**
 * @swagger
 * /coworkingspaces/nearby:
 *   get:
 *     summary: Find co-working spaces within a radius of a location, nearest first
 *     tags: [CoworkingSpaces]
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *           example: 13.7367
 *         required: true
 *         description: Your latitude
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *           example: 100.5331
 *         required: true
 *         description: Your longitude
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 5
 *         required: false
 *         description: Search radius in kilometres (must be greater than 0)
 *       - $ref: '#/components/parameters/availabilityDate'
 *     responses:
 *       200:
 *         description: Co-working spaces within the radius, sorted by distanceKm (nearest first), with count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NearbyCoworkingSpace'
 *       400:
 *         description: Missing or invalid lat, lng, radius or date
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
 *       - $ref: '#/components/parameters/availabilityDate'
 *     responses:
 *       200:
 *         description: The co-working space description by id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CoworkingSpaceAvailability'
 *       400:
 *         description: Invalid date
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
 *         description: Invalid data (e.g. missing or out-of-range latitude/longitude, totalRooms not a whole number >= 1)
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
 *       400:
 *         description: Invalid data (e.g. latitude/longitude out of range, totalRooms not a whole number >= 1)
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
