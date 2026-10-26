//Test data for local testing.  node scripts/seed.js         -> insert (re-running resets the seed data)
//                              node scripts/seed.js --undo  -> remove everything this script added
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

const User = require('../models/User');
const CoworkingSpace = require('../models/CoworkingSpace');
const Reservation = require('../models/Reservation');

const PASSWORD = '123456';

const users = [
    { name: 'Seed Admin', tel: '0800000000', email: 'admin@seed.test', role: 'admin' },
    { name: 'Seed User One', tel: '0811111111', email: 'user1@seed.test' },
    { name: 'Seed User Two', tel: '0822222222', email: 'user2@seed.test' },
    { name: 'Seed User Three', tel: '0833333333', email: 'user3@seed.test' }
];

//From Chula Engineering (13.7367, 100.5331): Quiet Corner ~0.4 km, WeWork ~3 km, KX ~3.7 km, Hive ~5.1 km
const spaces = [
    { name: 'The Hive Thonglor', address: '46/9 Sukhumvit 49, Khlong Tan Nuea, Bangkok', tel: '026626062', openTime: '08:00', closeTime: '22:00', latitude: 13.7317, longitude: 100.5797, totalRooms: 6, weight: 5 },
    { name: 'WeWork Asoke', address: '159 Sukhumvit 21, Watthana, Bangkok', tel: '027777777', openTime: '07:00', closeTime: '23:00', latitude: 13.7376, longitude: 100.5604, totalRooms: 5, weight: 3 },
    { name: 'KX Knowledge Exchange', address: '110/1 Krung Thonburi Rd, Khlong San, Bangkok', tel: '028888888', openTime: '09:00', closeTime: '20:00', latitude: 13.7210, longitude: 100.5027, totalRooms: 3, weight: 2 },
    { name: 'Quiet Corner Chula', address: '254 Phayathai Rd, Pathum Wan, Bangkok', tel: '029999999', openTime: '08:30', closeTime: '18:00', latitude: 13.7387, longitude: 100.5300, totalRooms: 2, weight: 0 }
];

//Every room of this space is reserved on this day, to demo the "no room available" rejection
const FULL_SPACE = 'KX Knowledge Exchange';
const FULL_DAY = { year: 2026, month: 11, day: 25 };

//Hours people tend to book, repeated so 10:00 and 14:00 become the peaks
const hours = [9, 10, 10, 10, 10, 11, 13, 14, 14, 14, 15, 16];

//Deterministic pseudo-random so every run gives the same data
let seed = 42;
const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const undo = async () => {
    const seededUsers = await User.find({ email: { $in: users.map(u => u.email) } });
    const seededSpaces = await CoworkingSpace.find({ name: { $in: spaces.map(s => s.name) } });
    const userIds = seededUsers.map(u => u._id);
    const spaceIds = seededSpaces.map(s => s._id);

    const r = await Reservation.deleteMany({ $or: [{ user: { $in: userIds } }, { coworkingSpace: { $in: spaceIds } }] });
    await User.deleteMany({ _id: { $in: userIds } });
    await CoworkingSpace.deleteMany({ _id: { $in: spaceIds } });
    console.log(`Removed ${seededUsers.length} users, ${seededSpaces.length} spaces, ${r.deletedCount} reservations`);
};

const insert = async () => {
    await undo();

    const createdUsers = [];
    for (const u of users) {
        createdUsers.push(await User.create({ ...u, password: PASSWORD }));
    }
    const createdSpaces = await CoworkingSpace.create(spaces.map(({ weight, ...s }) => s));

    //Pool of spaces repeated by weight: Hive most booked, Quiet Corner never booked
    const pool = createdSpaces.flatMap((space, i) => Array(spaces[i].weight).fill(space));

    const reservations = [];
    //Reservations per space per (Thai) day, so no day gets more reservations than the space has rooms
    const booked = new Map();
    const bookedKey = (space, year, month, day) => `${space._id}|${year}-${month}-${day}`;
    const isFull = (space, year, month, day) => (booked.get(bookedKey(space, year, month, day)) || 0) >= space.totalRooms;
    const book = (space, user, date, year, month, day) => {
        const key = bookedKey(space, year, month, day);
        booked.set(key, (booked.get(key) || 0) + 1);
        reservations.push({ reserveDate: date, user, coworkingSpace: space._id });
    };

    //Mostly November 2026, plus a few in October and December to test month grouping
    const addReservation = (year, month, day) => {
        const date = new Date(Date.UTC(year, month - 1, day, pick(hours) - 7, rand() < 0.5 ? 0 : 30));
        const user = pick(createdUsers)._id;
        let space = pick(pool);
        while (isFull(space, year, month, day)) space = pick(pool);
        book(space, user, date, year, month, day);
    };
    for (let i = 0; i < 40; i++) addReservation(2026, 11, 1 + Math.floor(rand() * 30));
    for (let i = 0; i < 6; i++) addReservation(2026, 10, 20 + Math.floor(rand() * 11));
    for (let i = 0; i < 6; i++) addReservation(2026, 12, 1 + Math.floor(rand() * 20));

    //Fill the remaining rooms of FULL_SPACE on FULL_DAY (10:00, 11:00, ... Thai time)
    const fullSpace = createdSpaces.find(s => s.name === FULL_SPACE);
    const { year, month, day } = FULL_DAY;
    for (let i = 0; !isFull(fullSpace, year, month, day); i++) {
        const date = new Date(Date.UTC(year, month - 1, day, 10 + i - 7));
        book(fullSpace, createdUsers[1 + (i % 3)]._id, date, year, month, day);
    }

    await Reservation.insertMany(reservations);

    console.log(`Inserted ${createdUsers.length} users, ${createdSpaces.length} spaces, ${reservations.length} reservations`);
    console.log(`Logins (password ${PASSWORD}): ${users.map(u => u.email).join(', ')}`);
    console.log(`Fully booked: ${FULL_SPACE} on ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
};

(async () => {
    try {
        mongoose.set('strictQuery', true);
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${mongoose.connection.host}`);

        if (process.argv.includes('--undo')) await undo();
        else await insert();
    } catch (err) {
        console.log(`Error: ${err.message}`);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();
