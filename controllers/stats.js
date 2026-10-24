const Reservation = require('../models/Reservation');
const CoworkingSpace = require('../models/CoworkingSpace');

//Statistics are bucketed in Thai local time so "peak hour" and "per day" match what users see
const TIMEZONE = 'Asia/Bangkok';
const TZ_OFFSET = '+07:00';
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

//Parse a query value to a Date. A plain YYYY-MM-DD means the start of that day in Thai time
const parseDate = (value) => {
    const date = dateOnly.test(value) ? new Date(`${value}T00:00:00${TZ_OFFSET}`) : new Date(value);
    return isNaN(date.getTime()) ? null : date;
};

const round2 = (n) => Math.round(n * 100) / 100;

//@desc     Get reservation statistics for a date range
//@route    GET /api/v1/stats/reservations?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|month&top=5
//@access   Private (admin)
exports.getReservationStats = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const groupBy = req.query.groupBy || 'day';
        const top = parseInt(req.query.top, 10) || 5;

        if (!['day', 'month'].includes(groupBy)) {
            return res.status(400).json({ success: false, message: 'groupBy must be either day or month' });
        }

        //Default range: the last 30 days. A date-only "to" includes that whole day
        let start = from ? parseDate(from) : new Date(Date.now() - 30 * DAY_MS);
        let end = to ? parseDate(to) : new Date();

        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'from and to must be valid dates (YYYY-MM-DD)' });
        }
        if (to && dateOnly.test(to)) {
            end = new Date(end.getTime() + DAY_MS);
        }
        if (start >= end) {
            return res.status(400).json({ success: false, message: 'from must be earlier than to' });
        }

        const totalDays = Math.max(1, Math.ceil((end - start) / DAY_MS));
        const periodFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
        const dayKey = { $dateToString: { format: '%Y-%m-%d', date: '$reserveDate', timezone: TIMEZONE } };

        const [result] = await Reservation.aggregate([
            { $match: { reserveDate: { $gte: start, $lt: end } } },
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    byHour: [
                        { $group: { _id: { $hour: { date: '$reserveDate', timezone: TIMEZONE } }, count: { $sum: 1 } } }
                    ],
                    byDayOfWeek: [
                        { $group: { _id: { $dayOfWeek: { date: '$reserveDate', timezone: TIMEZONE } }, count: { $sum: 1 } } }
                    ],
                    //Per space: how many reservations, and on how many distinct days it was booked
                    bySpace: [
                        { $group: { _id: { space: '$coworkingSpace', day: dayKey }, count: { $sum: 1 } } },
                        { $group: { _id: '$_id.space', reservations: { $sum: '$count' }, bookedDays: { $sum: 1 } } }
                    ],
                    timeline: [
                        {
                            $group: {
                                _id: { $dateToString: { format: periodFormat, date: '$reserveDate', timezone: TIMEZONE } },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ]
                }
            }
        ]);

        const total = result.total.length ? result.total[0].count : 0;

        //Hours 0-23 and days of week, zero-filled so the distribution is complete
        const hourCounts = new Map(result.byHour.map(h => [h._id, h.count]));
        const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, reservations: hourCounts.get(hour) || 0 }));

        //MongoDB $dayOfWeek: 1 = Sunday ... 7 = Saturday
        const dayCounts = new Map(result.byDayOfWeek.map(d => [d._id, d.count]));
        const byDayOfWeek = DAY_NAMES.map((day, i) => ({ day, reservations: dayCounts.get(i + 1) || 0 }));

        const peak = (items, label) => {
            const best = items.reduce((a, b) => (b.reservations > a.reservations ? b : a), items[0]);
            return best.reservations > 0 ? best[label] : null;
        };

        //Include spaces with no reservations in the range (rate 0)
        const spaces = await CoworkingSpace.find().select('name');
        const spaceStats = new Map(result.bySpace.map(s => [s._id.toString(), s]));

        const perSpace = spaces.map(space => {
            const s = spaceStats.get(space._id.toString());
            const reservations = s ? s.reservations : 0;
            const bookedDays = s ? s.bookedDays : 0;
            return {
                space: { _id: space._id, name: space.name },
                reservations,
                bookedDays,
                utilisationRate: round2((Math.min(bookedDays, totalDays) / totalDays) * 100)
            };
        });

        const mostBookedSpaces = [...perSpace]
            .filter(s => s.reservations > 0)
            .sort((a, b) => b.reservations - a.reservations)
            .slice(0, top)
            .map(({ space, reservations }) => ({ space, reservations }));

        res.status(200).json({
            success: true,
            data: {
                range: { from: start, to: end, totalDays, timezone: TIMEZONE },
                totalReservations: total,
                mostBookedSpaces,
                peakHour: peak(byHour, 'hour'),
                peakDay: peak(byDayOfWeek, 'day'),
                byHour,
                byDayOfWeek,
                utilisation: perSpace.sort((a, b) => b.utilisationRate - a.utilisationRate),
                reservationsPer: { groupBy, data: result.timeline.map(t => ({ period: t._id, reservations: t.count })) }
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot get reservation statistics' });
    }
};
