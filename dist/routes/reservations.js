"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
async function checkReservationExists(transactionOrPool, id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = new db_1.sql.Request(transactionOrPool);
    const result = await req
        .input("id", db_1.sql.Int, id)
        .query("SELECT * FROM Reservations WHERE id = @id AND status = 'reserved'");
    return result.recordset.length > 0;
}
async function checkUserExists(transactionOrPool, userId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = new db_1.sql.Request(transactionOrPool);
    const result = await req
        .input("userId", db_1.sql.Int, userId)
        .query("SELECT id FROM Users WHERE id = @userId");
    return result.recordset.length > 0;
}
async function checkSeatExists(transactionOrPool, seatId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = new db_1.sql.Request(transactionOrPool);
    const result = await req
        .input("seatId", db_1.sql.Int, seatId)
        .query("SELECT id FROM Seats WHERE id = @seatId");
    return result.recordset.length > 0;
}
async function checkOverlap(transactionOrPool, seatId, reservedDate, startTime, endTime, excludeId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = new db_1.sql.Request(transactionOrPool);
    req.input("seatId", db_1.sql.Int, seatId);
    req.input("reservedDate", db_1.sql.Date, reservedDate);
    req.input("startTime", db_1.sql.Time, startTime);
    req.input("endTime", db_1.sql.Time, endTime);
    if (excludeId !== undefined) {
        req.input("excludeId", db_1.sql.Int, excludeId);
    }
    const query = `
    SELECT * FROM Reservations WITH (XLOCK, ROWLOCK)
    WHERE seat_id = @seatId
      AND reserved_date = @reservedDate
      AND status = 'reserved'
      AND start_time < @endTime
      AND end_time > @startTime
      ${excludeId !== undefined ? "AND id <> @excludeId" : ""}
  `;
    const result = await req.query(query);
    return result.recordset.length > 0;
}
async function createReservation(transactionOrPool, userId, seatId, reservedDate, startTime, endTime) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = new db_1.sql.Request(transactionOrPool);
    const result = await req
        .input("userId", db_1.sql.Int, userId)
        .input("seatId", db_1.sql.Int, seatId)
        .input("reservedDate", db_1.sql.Date, reservedDate)
        .input("startTime", db_1.sql.Time, startTime)
        .input("endTime", db_1.sql.Time, endTime).query(`
      INSERT INTO Reservations (user_id, seat_id, reserved_date, start_time, end_time, status)
      OUTPUT INSERTED.*
      VALUES (@userId, @seatId, @reservedDate, @startTime, @endTime, 'reserved')
    `);
    return result.recordset[0];
}
async function cancelReservation(transactionOrPool, id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = new db_1.sql.Request(transactionOrPool);
    await req
        .input("id", db_1.sql.Int, id)
        .query(`UPDATE Reservations SET status = 'canceled' WHERE id = @id`);
}
/**
 * GET /api/reservations
 *
 * Returns reservation records with optional filters.
 * Query parameters:
 * - userId (optional): Filter by user ID.
 * - fromDate (optional): Filter reservations from this date (inclusive).
 * - toDate (optional): Filter reservations up to this date (inclusive).
 * - seatId (optional): Filter by seat ID.
 * - status (optional): Filter by reservation status ("reserved" or "canceled").
 * - order (optional, default: false): If true, orders by reserved_date DESC, start_time DESC.
 *
 * usage: type below on browser:
 * /api/reservations?userId=1&fromDate=2025-07-13&status=reserved&order=true
 */
router.get("/", async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const seatId = req.query.seatId ? Number(req.query.seatId) : undefined;
    const status = req.query.status;
    const order = req.query.order === "true";
    try {
        const db = await db_1.pool;
        let sqlQuery = `
      SELECT 
        r.*,
        u.first_name,
        u.last_name,
        s.name AS seat_name
      FROM Reservations r
      JOIN Users u ON r.user_id = u.id
      JOIN Seats s ON r.seat_id = s.id
      WHERE 1=1
    `;
        const request = db.request();
        if (userId) {
            sqlQuery += ` AND r.user_id = @userId`;
            request.input("userId", userId);
        }
        if (fromDate) {
            sqlQuery += ` AND r.reserved_date >= @fromDate`;
            request.input("fromDate", fromDate);
        }
        if (toDate) {
            sqlQuery += ` AND r.reserved_date <= @toDate`;
            request.input("toDate", toDate);
        }
        if (seatId) {
            sqlQuery += ` AND r.seat_id = @seatId`;
            request.input("seatId", seatId);
        }
        if (status) {
            sqlQuery += ` AND r.status = @status`;
            request.input("status", status);
        }
        if (order) {
            sqlQuery += ` ORDER BY r.reserved_date DESC, r.start_time DESC`;
        }
        const result = await request.query(sqlQuery);
        const formatted = result.recordset.map((row) => ({
            reservation_id: row.id,
            user_id: row.user_id,
            first_name: row.first_name,
            last_name: row.last_name,
            seat_id: row.seat_id,
            seat_name: row.seat_name,
            reserved_date: row.reserved_date?.toISOString().substring(0, 10),
            start_time: row.start_time?.toISOString().substring(11, 16),
            end_time: row.end_time?.toISOString().substring(11, 16),
            status: row.status,
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "DB error" });
    }
});
/**
 * DELETE /api/reservations/:id
 *
 * Cancels a reservation by setting its status to "canceled".
 * Path parameter:
 * - id: Reservation ID to cancel.
 *
 * usage: type below on console:
 * fetch(`http://localhost:3000/api/reservations/43`, {
     method: 'DELETE',
   })
   .then((res) => res.json())
   .then((data) => {
     console.log('削除結果:', data);
   })
   .catch((error) => {
     console.error('削除エラー:', error);
   });
 */
router.delete("/:id", async (req, res) => {
    const reservationId = Number(req.params.id);
    if (!reservationId) {
        return res.status(400).json({ error: "Reservation ID required" });
    }
    const db = await db_1.pool;
    const transaction = new db_1.sql.Transaction(db);
    try {
        await transaction.begin();
        const exists = await checkReservationExists(transaction, reservationId);
        if (!exists) {
            await transaction.rollback();
            return res
                .status(404)
                .json({ error: "Reservation not found or already canceled" });
        }
        await cancelReservation(transaction, reservationId);
        await transaction.commit();
        res.status(200).json({ message: "Reservation canceled" });
    }
    catch (err) {
        console.error("Delete error:", err);
        await transaction.rollback();
        res.status(500).json({ error: "Failed to cancel reservation" });
    }
});
/**
 * POST /api/reservations
 *
 * Safely inserts a new reservation with transaction and locking to prevent duplicates.
 * Required fields in body:
 * - userId: number
 * - seatId: number
 * - reservedDate: string ('YYYY-MM-DD')
 * - startTime: string ('HH:mm')
 * - endTime: string ('HH:mm')
 *
 * usage: type below on console:
 * fetch('http://localhost:3000/api/reservations', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userId: 1,
       seatId: 10,
       reservedDate: '2025-07-15',
       startTime: '14:00',
       endTime: '15:00'
     })
   })
   .then(res => res.json())
   .then(console.log)
   .catch(console.error);
 */
router.post("/", async (req, res) => {
    const { userId, seatId, reservedDate, startTime, endTime } = req.body;
    // バリデーション
    if (typeof userId !== "number" ||
        typeof seatId !== "number" ||
        typeof reservedDate !== "string" ||
        typeof startTime !== "string" ||
        typeof endTime !== "string") {
        return res.status(400).json({ error: "Missing or invalid parameters" });
    }
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (typeof userId !== "number" ||
        typeof seatId !== "number" ||
        typeof reservedDate !== "string" ||
        typeof startTime !== "string" ||
        typeof endTime !== "string" ||
        !timeRegex.test(startTime) ||
        !timeRegex.test(endTime)) {
        return res.status(400).json({ error: "Missing or invalid parameters" });
    }
    const toTime = (t) => new Date(`1970-01-01T${t}:00Z`);
    if (toTime(startTime) >= toTime(endTime)) {
        return res
            .status(400)
            .json({ error: "startTime must be earlier than endTime" });
    }
    const parsedStart = toTime(startTime);
    const parsedEnd = toTime(endTime);
    const db = await db_1.pool;
    const transaction = new db_1.sql.Transaction(db);
    try {
        await transaction.begin();
        if (!(await checkUserExists(transaction, userId))) {
            await transaction.rollback();
            return res.status(404).json({ error: "User not found" });
        }
        if (!(await checkSeatExists(transaction, seatId))) {
            await transaction.rollback();
            return res.status(404).json({ error: "Seat not found" });
        }
        if (await checkOverlap(transaction, seatId, reservedDate, parsedStart, parsedEnd)) {
            await transaction.rollback();
            return res
                .status(409)
                .json({ error: "Seat already reserved during that time" });
        }
        const newReservation = await createReservation(transaction, userId, seatId, reservedDate, parsedStart, parsedEnd);
        await transaction.commit();
        res.status(201).json({
            message: "Reservation created",
            reservation: {
                ...newReservation,
                reserved_date: newReservation.reserved_date
                    ?.toISOString()
                    .substring(0, 10),
                start_time: newReservation.start_time?.toISOString().substring(11, 16),
                end_time: newReservation.end_time?.toISOString().substring(11, 16),
            },
        });
    }
    catch (err) {
        console.error("Reservation POST error:", err);
        try {
            await transaction.rollback();
        }
        catch (rollbackErr) {
            console.error("Rollback failed:", rollbackErr);
        }
        res.status(500).json({ error: "Reservation failed" });
    }
});
/**
 * PUT /api/reservations/:id
 *
 * Safely updates an existing reservation by:
 * 1. Cancelling the old reservation
 * 2. Creating a new one in a single transaction
 * Prevents double-booking with proper locking.
 *
 * usage: type below on console:
 * fetch('http://localhost:3000/api/reservations/41', {
   method: 'PUT',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
     userId: 1,
     seatId: 10,
     reservedDate: '2025-07-15',
     startTime: '14:00',
     endTime: '15:00'
   }),
   })
   .then(res => res.json())
   .then(console.log)
   .catch(console.error);
 */
router.put("/:id", async (req, res) => {
    const reservationId = Number(req.params.id);
    const { userId, seatId, reservedDate, startTime, endTime } = req.body;
    // バリデーション
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (typeof userId !== "number" ||
        typeof seatId !== "number" ||
        typeof reservedDate !== "string" ||
        typeof startTime !== "string" ||
        typeof endTime !== "string" ||
        !reservationId ||
        !timeRegex.test(startTime) ||
        !timeRegex.test(endTime)) {
        return res.status(400).json({ error: "Missing or invalid parameters" });
    }
    const toTime = (t) => new Date(`1970-01-01T${t}:00Z`);
    if (toTime(startTime) >= toTime(endTime)) {
        return res
            .status(400)
            .json({ error: "startTime must be earlier than endTime" });
    }
    const parsedStart = toTime(startTime);
    const parsedEnd = toTime(endTime);
    const db = await db_1.pool;
    const transaction = new db_1.sql.Transaction(db);
    try {
        await transaction.begin();
        if (!(await checkReservationExists(transaction, reservationId))) {
            await transaction.rollback();
            return res
                .status(404)
                .json({ error: "Reservation not found or already canceled" });
        }
        if (!(await checkUserExists(transaction, userId))) {
            await transaction.rollback();
            return res.status(404).json({ error: "User not found" });
        }
        if (!(await checkSeatExists(transaction, seatId))) {
            await transaction.rollback();
            return res.status(404).json({ error: "Seat not found" });
        }
        if (await checkOverlap(transaction, seatId, reservedDate, parsedStart, parsedEnd, reservationId)) {
            await transaction.rollback();
            return res
                .status(409)
                .json({ error: "Seat already reserved during that time" });
        }
        await cancelReservation(transaction, reservationId);
        const newReservation = await createReservation(transaction, userId, seatId, reservedDate, parsedStart, parsedEnd);
        await transaction.commit();
        res.status(200).json({
            message: "Reservation updated",
            newReservation: {
                ...newReservation,
                reserved_date: newReservation.reserved_date
                    ?.toISOString()
                    .substring(0, 10),
                start_time: newReservation.start_time?.toISOString().substring(11, 16),
                end_time: newReservation.end_time?.toISOString().substring(11, 16),
            },
        });
    }
    catch (err) {
        console.error("Transaction error during reservation update:", err);
        try {
            await transaction.rollback();
        }
        catch (rollbackErr) {
            console.error("Rollback failed:", rollbackErr);
        }
        res.status(500).json({ error: "Failed to update reservation" });
    }
});
exports.default = router;
