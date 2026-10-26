const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');

//Days are Thai days (Asia/Bangkok, +07:00), same as controllers/stats.js
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

//The Thai day [start, end) that contains the given moment, with its YYYY-MM-DD label
const thaiDayOf = (moment) => {
    const shifted = new Date(new Date(moment).getTime() + TZ_OFFSET_MS);
    const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - TZ_OFFSET_MS);
    return { date: shifted.toISOString().slice(0, 10), start, end: new Date(start.getTime() + DAY_MS) };
};

//Parse a YYYY-MM-DD query value into that Thai day, or null if it is not a real date
const parseThaiDay = (value) => {
    if (typeof value !== 'string' || !dateOnly.test(value)) return null;

    const start = new Date(`${value}T00:00:00+07:00`);
    if (isNaN(start.getTime())) return null;

    //Rejects dates that roll over, e.g. 2026-02-30
    const day = thaiDayOf(start);
    return day.date === value ? day : null;
};

//Number of reservations per co-working space on a Thai day, optionally ignoring one reservation
const countReserved = async (spaceIds, day, excludeId) => {
    const match = {
        coworkingSpace: { $in: spaceIds.map(id => new mongoose.Types.ObjectId(id)) },
        reserveDate: { $gte: day.start, $lt: day.end }
    };
    if (excludeId) match._id = { $ne: new mongoose.Types.ObjectId(excludeId) };

    const counts = await Reservation.aggregate([
        { $match: match },
        { $group: { _id: '$coworkingSpace', count: { $sum: 1 } } }
    ]);
    return new Map(counts.map(c => [c._id.toString(), c.count]));
};

//Total rooms minus reserved rooms (null when the space has no totalRooms set yet)
const availableRooms = (space, reservedRooms) =>
    space.totalRooms == null ? null : Math.max(space.totalRooms - reservedRooms, 0);

//Add reservedRooms and availableRooms for a Thai day to plain co-working space objects
const addAvailability = async (spaces, day) => {
    const counts = await countReserved(spaces.map(s => s._id), day);

    return spaces.map(space => {
        const reservedRooms = counts.get(space._id.toString()) || 0;
        return { ...space, reservedRooms, availableRooms: availableRooms(space, reservedRooms) };
    });
};

//Rooms still free in one co-working space on a Thai day
const roomsLeft = async (space, day, excludeId) => {
    const counts = await countReserved([space._id], day, excludeId);
    return availableRooms(space, counts.get(space._id.toString()) || 0);
};

module.exports = { thaiDayOf, parseThaiDay, addAvailability, roomsLeft };
