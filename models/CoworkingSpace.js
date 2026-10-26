const mongoose = require('mongoose');

//Time in 24-hour HH:mm format, e.g. 08:00, 22:30
const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

const CoworkingSpaceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        unique: true,
        trim: true,
        maxlength: [50, 'Name can not be more than 50 characters']
    },
    address: {
        type: String,
        required: [true, 'Please add an address']
    },
    tel: {
        type: String,
        required: [true, 'Please add a telephone number']
    },
    openTime: {
        type: String,
        required: [true, 'Please add an open time'],
        match: [timeFormat, 'Open time must be in HH:mm format']
    },
    closeTime: {
        type: String,
        required: [true, 'Please add a close time'],
        match: [timeFormat, 'Close time must be in HH:mm format']
    },
    latitude: {
        type: Number,
        required: [true, 'Please add a latitude'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
        type: Number,
        required: [true, 'Please add a longitude'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
    },
    //GeoJSON point built from latitude/longitude, used by the nearby search (not set by clients)
    location: {
        type: {
            type: String,
            enum: ['Point']
        },
        coordinates: {
            type: [Number],
            default: undefined
        }
    },
    totalRooms: {
        type: Number,
        required: [true, 'Please add the total number of rooms'],
        min: [1, 'Total rooms must be at least 1'],
        validate: {
            validator: Number.isInteger,
            message: 'Total rooms must be a whole number'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

CoworkingSpaceSchema.index({ location: '2dsphere' });

//Turn a latitude/longitude value into a number, or NaN when it is missing or not numeric
const toCoordinate = (value) => (value === undefined || value === null || value === '') ? NaN : Number(value);

const toPoint = (latitude, longitude) => {
    const lat = toCoordinate(latitude);
    const lng = toCoordinate(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { type: 'Point', coordinates: [lng, lat] } : undefined;
};

//Keep location in sync on create/save
CoworkingSpaceSchema.pre('validate', function() {
    this.location = toPoint(this.latitude, this.longitude);
});

//Keep location in sync on findByIdAndUpdate (document hooks do not run there)
CoworkingSpaceSchema.pre('findOneAndUpdate', async function() {
    const update = this.getUpdate();
    const set = update.$set || update;

    //Clients cannot set location directly
    delete update.location;
    delete set.location;

    if (set.latitude === undefined && set.longitude === undefined) return;

    //Only one of the two may be sent: take the other one from the stored document
    const current = await this.model.findOne(this.getQuery()).select('latitude longitude').lean();
    if (!current) return;

    const location = toPoint(
        set.latitude !== undefined ? set.latitude : current.latitude,
        set.longitude !== undefined ? set.longitude : current.longitude
    );
    if (location) set.location = location;
});

//Reverse populate with virtuals
CoworkingSpaceSchema.virtual('reservations', {
    ref: 'Reservation',
    localField: '_id',
    foreignField: 'coworkingSpace',
    justOne: false
});

module.exports = mongoose.model('CoworkingSpace', CoworkingSpaceSchema);
