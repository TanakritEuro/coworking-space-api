const CoworkingSpace = require('../models/CoworkingSpace');
const Reservation = require('../models/Reservation');
const { parseThaiDay, addAvailability } = require('../utils/availability');

const DEFAULT_RADIUS_KM = 5;

const round2 = (n) => Math.round(n * 100) / 100;

//Query value to a number, or NaN when it is missing or not numeric
const toNumber = (value) => (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;

//Read ?date=YYYY-MM-DD. Returns { day } (day is null when no date was given) or { error }
const readDate = (query) => {
    if (query.date === undefined) return { day: null };
    const day = parseThaiDay(query.date);
    return day ? { day } : { error: 'date must be a valid date in YYYY-MM-DD format' };
};

//Mongoose validation/cast messages, e.g. "Latitude must be between -90 and 90"
const validationMessage = (err) => {
    if (err.errors) return Object.values(err.errors).map(e => e.message).join(', ');
    if (err.name === 'CastError') return err.message;
};

//@desc     Get all co-working spaces
//@route    GET /api/v1/coworkingspaces?date=YYYY-MM-DD
//@access   Public
exports.getCoworkingSpaces = async (req, res, next) => {
    try {
        let query;

        //Optional date: adds reservedRooms and availableRooms for that day
        const { day, error } = readDate(req.query);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        //Copy req.query
        const reqQuery = { ...req.query };

        //Fields to exclude
        const removeFields = ['select', 'sort', 'page', 'limit', 'date'];

        //Loop over remove fields and delete them from reqQuery
        removeFields.forEach(param => delete reqQuery[param]);

        //Create query string
        let queryStr = JSON.stringify(reqQuery);

        //Create operators ($gt, $gte, etc)
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

        //Finding resource (reservations are not populated: this route is public and reservations are confidential)
        query = CoworkingSpace.find(JSON.parse(queryStr));

        //Select Fields
        if (req.query.select) {
            let fields = req.query.select.split(',').join(' ');
            //Availability needs totalRooms
            if (day) fields += ' totalRooms';
            query = query.select(fields);
        }

        //Sort
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt');
        }

        //Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = await CoworkingSpace.countDocuments();

        query = query.skip(startIndex).limit(limit);

        //Executing query
        let coworkingSpaces = await query;

        if (day) {
            coworkingSpaces = await addAvailability(coworkingSpaces.map(s => s.toJSON()), day);
        }

        //Pagination result
        const pagination = {};

        if (endIndex < total) {
            pagination.next = {
                page: page + 1,
                limit
            };
        }

        if (startIndex > 0) {
            pagination.prev = {
                page: page - 1,
                limit
            };
        }

        res.status(200).json({ success: true, count: coworkingSpaces.length, pagination, data: coworkingSpaces });
    } catch (err) {
        res.status(400).json({ success: false });
    }
};

//@desc     Get co-working spaces within a radius of a location, nearest first
//@route    GET /api/v1/coworkingspaces/nearby?lat=&lng=&radius=&date=YYYY-MM-DD
//@access   Public
exports.getNearbyCoworkingSpaces = async (req, res, next) => {
    try {
        const lat = toNumber(req.query.lat);
        const lng = toNumber(req.query.lng);
        const radius = req.query.radius === undefined ? DEFAULT_RADIUS_KM : toNumber(req.query.radius);

        if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) {
            return res.status(400).json({ success: false, message: 'Please provide lat (-90 to 90) and lng (-180 to 180)' });
        }
        if (!(radius > 0)) {
            return res.status(400).json({ success: false, message: 'radius must be a positive number of kilometres' });
        }

        const { day, error } = readDate(req.query);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        //$geoNear sorts by distance (metres) and drops spaces outside maxDistance
        const results = await CoworkingSpace.aggregate([
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [lng, lat] },
                    key: 'location',
                    distanceField: 'distance',
                    maxDistance: radius * 1000,
                    spherical: true
                }
            }
        ]);

        //Same shape as the other endpoints, plus the distance in km
        let coworkingSpaces = results.map(({ distance, ...space }) => ({
            ...CoworkingSpace.hydrate(space).toJSON(),
            distanceKm: round2(distance / 1000)
        }));

        if (day) {
            coworkingSpaces = await addAvailability(coworkingSpaces, day);
        }

        res.status(200).json({ success: true, count: coworkingSpaces.length, data: coworkingSpaces });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Cannot search nearby co-working spaces' });
    }
};

//@desc     Get single co-working space
//@route    GET /api/v1/coworkingspaces/:id?date=YYYY-MM-DD
//@access   Public
exports.getCoworkingSpace = async (req, res, next) => {
    try {
        const { day, error } = readDate(req.query);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const coworkingSpace = await CoworkingSpace.findById(req.params.id);

        if (!coworkingSpace) {
            return res.status(404).json({ success: false, message: `Co-working space not found with id of ${req.params.id}` });
        }

        if (day) {
            const [withRooms] = await addAvailability([coworkingSpace.toJSON()], day);
            return res.status(200).json({ success: true, data: withRooms });
        }

        res.status(200).json({success: true, data: coworkingSpace});
    } catch (err) {
        res.status(400).json({success: false});
    }
};

//@desc     Create new co-working space
//@route    POST /api/v1/coworkingspaces
//@access   Private (admin)
exports.createCoworkingSpace = async (req, res, next) => {
    try {
        const coworkingSpace = await CoworkingSpace.create(req.body);
        res.status(201).json({
            success: true,
            data: coworkingSpace
        });
    } catch (err) {
        res.status(400).json({ success: false, message: validationMessage(err) });
    }
};

//@desc     Update co-working space
//@route    PUT /api/v1/coworkingspaces/:id
//@access   Private (admin)
exports.updateCoworkingSpace = async (req, res, next) => {
    try {
        const coworkingSpace = await CoworkingSpace.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!coworkingSpace) {
            return res.status(404).json({ success: false, message: `Co-working space not found with id of ${req.params.id}` });
        }

        res.status(200).json({success: true, data: coworkingSpace});
    } catch (err) {
        res.status(400).json({ success: false, message: validationMessage(err) });
    }
};

//@desc     Delete co-working space
//@route    DELETE /api/v1/coworkingspaces/:id
//@access   Private (admin)
exports.deleteCoworkingSpace = async (req, res, next) => {
    try {
        const coworkingSpace = await CoworkingSpace.findById(req.params.id);

        if (!coworkingSpace) {
            return res.status(404).json({ success: false, message: `Co-working space not found with id of ${req.params.id}` });
        }

        //Cascading delete: remove all reservations tied to this co-working space
        await Reservation.deleteMany({ coworkingSpace: req.params.id });
        await CoworkingSpace.deleteOne({ _id: req.params.id });

        res.status(200).json({success: true, data: {}});
    } catch (err) {
        res.status(400).json({success: false});
    }
};
