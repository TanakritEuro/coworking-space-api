const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    reserveDate: {
        type: Date,
        required: [true, 'Please add a reservation date']
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    coworkingSpace: {
        type: mongoose.Schema.ObjectId,
        ref: 'CoworkingSpace',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Reservation', ReservationSchema);
