const Reservation = require('../models/Reservation');
const CoworkingSpace = require('../models/CoworkingSpace');

//Fields of the co-working space shown inside each reservation
const spaceFields = {
    path: 'coworkingSpace',
    select: 'name address tel openTime closeTime'
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
