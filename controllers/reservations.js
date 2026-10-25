const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');
const CoworkingSpace = require('../models/CoworkingSpace');
const { thaiDayOf, roomsLeft } = require('../utils/availability');

//Fields of the co-working space shown inside each reservation
const spaceFields = {
    path: 'coworkingSpace',
    select: 'name address tel openTime closeTime'
};

//Reservation date from the request body, or null if missing/invalid
const parseReserveDate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
};

//Error message when every room of the space is already reserved on that Thai day, otherwise null
const noRoomMessage = async (coworkingSpace, reserveDate, excludeId) => {
    const day = thaiDayOf(reserveDate);
    const left = await roomsLeft(coworkingSpace, day, excludeId);

    //null = space has no totalRooms set yet, so there is no limit to check
    if (left === null || left > 0) return null;
    return `No rooms available at ${coworkingSpace.name} on ${day.date}: all ${coworkingSpace.totalRooms} rooms are already reserved`;
};

//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@route    GET /api/v1/coworkingspaces/:coworkingSpaceId/reservations
//@access   Private (users see only their own, admin sees all)
exports.getReservations = async (req, res, next) => {
    const filter = {};

    //General users can see only their own reservations
    if (req.user.role !== 'admin') {
        filter.user = req.user.id;
    }

    //Optionally narrow down to one co-working space
    if (req.params.coworkingSpaceId) {
        filter.coworkingSpace = req.params.coworkingSpaceId;
    }

    try {
        const reservations = await Reservation.find(filter).populate(spaceFields);

        res.status(200).json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot find Reservation' });
    }
};

//@desc     Get single reservation
//@route    GET /api/v1/reservations/:id
//@access   Private (owner or admin)
exports.getReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate(spaceFields);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
        }

        //Keep reservations confidential: only the owner or an admin may view it
        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to view this reservation` });
        }

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot find Reservation' });
    }
};

//@desc     Add reservation
//@route    POST /api/v1/coworkingspaces/:coworkingSpaceId/reservations
//@access   Private
exports.addReservation = async (req, res, next) => {
    try {
        req.body.coworkingSpace = req.params.coworkingSpaceId;

        const coworkingSpace = await CoworkingSpace.findById(req.params.coworkingSpaceId);

        if (!coworkingSpace) {
            return res.status(404).json({ success: false, message: `No co-working space with the id of ${req.params.coworkingSpaceId}` });
        }

        //add user Id to req.body
        req.body.user = req.user.id;

        //Check for existing reservations
        const existedReservations = await Reservation.find({ user: req.user.id });

        //If the user is not an admin, they can only reserve up to 3 rooms
        if (existedReservations.length >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: `The user with ID ${req.user.id} has already made 3 reservations` });
        }

        const reserveDate = parseReserveDate(req.body.reserveDate);
        if (!reserveDate) {
            return res.status(400).json({ success: false, message: 'Please add a valid reservation date' });
        }

        //A room must be free on that day (applies to admins too)
        const noRoom = await noRoomMessage(coworkingSpace, reserveDate);
        if (noRoom) {
            return res.status(400).json({ success: false, message: noRoom });
        }

        const reservation = await Reservation.create(req.body);

        res.status(201).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot create Reservation' });
    }
};

//@desc     Update reservation
//@route    PUT /api/v1/reservations/:id
//@access   Private (owner or admin)
exports.updateReservation = async (req, res, next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
        }

        //Make sure user is the reservation owner
        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to update this reservation` });
        }

        //A reservation cannot be handed over to another user
        delete req.body.user;

        //Moving to another day or space: the target space must exist and have a free room
        if (req.body.reserveDate !== undefined || req.body.coworkingSpace !== undefined) {
            const reserveDate = req.body.reserveDate !== undefined ? parseReserveDate(req.body.reserveDate) : reservation.reserveDate;
            if (!reserveDate) {
                return res.status(400).json({ success: false, message: 'Please add a valid reservation date' });
            }

            const spaceId = req.body.coworkingSpace !== undefined ? req.body.coworkingSpace : reservation.coworkingSpace;
            if (!mongoose.isValidObjectId(spaceId)) {
                return res.status(400).json({ success: false, message: `Invalid co-working space id ${spaceId}` });
            }

            const coworkingSpace = await CoworkingSpace.findById(spaceId);
            if (!coworkingSpace) {
                return res.status(404).json({ success: false, message: `No co-working space with the id of ${spaceId}` });
            }

            //The reservation being edited does not count against itself
            const noRoom = await noRoomMessage(coworkingSpace, reserveDate, reservation._id);
            if (noRoom) {
                return res.status(400).json({ success: false, message: noRoom });
            }
        }

        reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot update Reservation' });
    }
};

//@desc     Delete reservation
//@route    DELETE /api/v1/reservations/:id
//@access   Private (owner or admin)
exports.deleteReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
        }

        //Make sure user is the reservation owner
        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to delete this reservation` });
        }

        await reservation.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot delete Reservation' });
    }
};
