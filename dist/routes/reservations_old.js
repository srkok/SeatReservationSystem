"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
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
        // クエリごとにRequestを新規作成
        const checkReq = new db_1.sql.Request(transaction);
        const existing = await checkReq
            .input("id", reservationId)
            .query(`SELECT * FROM Reservations WHERE id = @id AND status = 'reserved'`);
        if (existing.recordset.length === 0) {
            await transaction.rollback();
            return res
                .status(404)
                .json({ error: "Reservation not found or already canceled" });
        }
        const updateReq = new db_1.sql.Request(transaction);
        await updateReq
            .input("id", reservationId)
            .query(`UPDATE Reservations SET status = 'canceled' WHERE id = @id`);
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
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ error: "Time must be in HH:mm format" });
    }
    const toTime = (t) => new Date(`1970-01-01T${t}:00Z`);
    if (toTime(startTime) >= toTime(endTime)) {
        return res
            .status(400)
            .json({ error: "startTime must be earlier than endTime" });
    }
    const parsedStart = new Date(`1970-01-01T${startTime}:00Z`);
    const parsedEnd = new Date(`1970-01-01T${endTime}:00Z`);
    const db = await db_1.pool;
    const transaction = new db_1.sql.Transaction(db);
    try {
        await transaction.begin();
        // 1. ユーザ存在確認
        const userReq = new db_1.sql.Request(transaction);
        const userCheck = await userReq
            .input("userId", db_1.sql.Int, userId)
            .query("SELECT id FROM Users WHERE id = @userId");
        if (userCheck.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ error: "User not found" });
        }
        // 2. 座席存在確認
        const seatReq = new db_1.sql.Request(transaction);
        const seatCheck = await seatReq
            .input("seatId", db_1.sql.Int, seatId)
            .query("SELECT id FROM Seats WHERE id = @seatId");
        if (seatCheck.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ error: "Seat not found" });
        }
        // 3. 重複予約チェック（排他ロック）
        const checkReq = new db_1.sql.Request(transaction);
        const overlap = await checkReq
            .input("seatId", db_1.sql.Int, seatId)
            .input("reservedDate", db_1.sql.Date, reservedDate)
            .input("startTime", db_1.sql.Time, parsedStart)
            .input("endTime", db_1.sql.Time, parsedEnd).query(`
        SELECT * FROM Reservations WITH (XLOCK, ROWLOCK)
        WHERE seat_id = @seatId
          AND reserved_date = @reservedDate
          AND status = 'reserved'
          AND start_time < @endTime
          AND end_time > @startTime
      `);
        if (overlap.recordset.length > 0) {
            await transaction.rollback();
            return res
                .status(409)
                .json({ error: "Seat already reserved during that time" });
        }
        // 4. 新規予約挿入
        const insertReq = new db_1.sql.Request(transaction);
        const insert = await insertReq
            .input("userId", db_1.sql.Int, userId)
            .input("seatId", db_1.sql.Int, seatId)
            .input("reservedDate", db_1.sql.Date, reservedDate)
            .input("startTime", db_1.sql.Time, parsedStart)
            .input("endTime", db_1.sql.Time, parsedEnd).query(`
        INSERT INTO Reservations (user_id, seat_id, reserved_date, start_time, end_time, status)
        OUTPUT INSERTED.*
        VALUES (@userId, @seatId, @reservedDate, @startTime, @endTime, 'reserved')
      `);
        await transaction.commit();
        const newRow = insert.recordset[0];
        res.status(201).json({
            message: "Reservation created",
            reservation: {
                ...newRow,
                reserved_date: newRow.reserved_date?.toISOString().substring(0, 10),
                start_time: newRow.start_time?.toISOString().substring(11, 16),
                end_time: newRow.end_time?.toISOString().substring(11, 16),
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
    if (typeof userId !== "number" ||
        typeof seatId !== "number" ||
        typeof reservedDate !== "string" ||
        typeof startTime !== "string" ||
        typeof endTime !== "string" ||
        !reservationId) {
        return res.status(400).json({ error: "Missing or invalid parameters" });
    }
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ error: "Time must be in HH:mm format" });
    }
    const toTime = (t) => new Date(`1970-01-01T${t}:00Z`);
    if (toTime(startTime) >= toTime(endTime)) {
        return res
            .status(400)
            .json({ error: "startTime must be earlier than endTime" });
    }
    const db = await db_1.pool;
    const transaction = new db_1.sql.Transaction(db);
    try {
        await transaction.begin();
        // 予約存在確認用Request
        const checkReq = new db_1.sql.Request(transaction);
        const existing = await checkReq
            .input("id", reservationId)
            .query(`SELECT * FROM Reservations WHERE id = @id AND status = 'reserved'`);
        if (existing.recordset.length === 0) {
            await transaction.rollback();
            return res
                .status(404)
                .json({ error: "Reservation not found or already canceled" });
        }
        // ユーザ・座席存在確認用Request
        const userCheckReq = new db_1.sql.Request(transaction);
        const userCheck = await userCheckReq
            .input("userId", userId)
            .query(`SELECT id FROM Users WHERE id = @userId`);
        const seatCheckReq = new db_1.sql.Request(transaction);
        const seatCheck = await seatCheckReq
            .input("seatId", seatId)
            .query(`SELECT id FROM Seats WHERE id = @seatId`);
        if (userCheck.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ error: "User not found" });
        }
        if (seatCheck.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ error: "Seat not found" });
        }
        // 重複予約チェック用Request
        const overlapReq = new db_1.sql.Request(transaction);
        const overlapResult = await overlapReq
            .input("seatId", seatId)
            .input("reservedDate", reservedDate)
            .input("startTime", startTime)
            .input("endTime", endTime)
            .input("excludeId", reservationId).query(`
        SELECT *
        FROM Reservations WITH (XLOCK, ROWLOCK)
        WHERE seat_id = @seatId
          AND reserved_date = @reservedDate
          AND status = 'reserved'
          AND id <> @excludeId
          AND (
            start_time < @endTime AND end_time > @startTime
          )
      `);
        if (overlapResult.recordset.length > 0) {
            await transaction.rollback();
            return res
                .status(409)
                .json({ error: "Seat already reserved during that time" });
        }
        // 元予約キャンセル用Request
        const cancelReq = new db_1.sql.Request(transaction);
        await cancelReq.input("id", reservationId).query(`
      UPDATE Reservations SET status = 'canceled' WHERE id = @id
    `);
        // 新規予約挿入用Request
        const insertReq = new db_1.sql.Request(transaction);
        const insertResult = await insertReq
            .input("userId", userId)
            .input("seatId", seatId)
            .input("reservedDate", reservedDate)
            .input("startTime", startTime)
            .input("endTime", endTime).query(`
        INSERT INTO Reservations (user_id, seat_id, reserved_date, start_time, end_time, status)
        OUTPUT INSERTED.*
        VALUES (@userId, @seatId, @reservedDate, @startTime, @endTime, 'reserved')
      `);
        await transaction.commit();
        const newRow = insertResult.recordset[0];
        const formatted = {
            ...newRow,
            reserved_date: newRow.reserved_date?.toISOString().substring(0, 10),
            start_time: newRow.start_time?.toISOString().substring(11, 16),
            end_time: newRow.end_time?.toISOString().substring(11, 16),
        };
        res
            .status(200)
            .json({ message: "Reservation updated", newReservation: formatted });
    }
    catch (err) {
        console.error("Transaction error during reservation update:", err);
        await transaction.rollback();
        res.status(500).json({ error: "Failed to update reservation" });
    }
});
exports.default = router;
