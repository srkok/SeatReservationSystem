IF NOT EXISTS (
    SELECT name FROM sys.databases WHERE name = N'SeatReservationDB'
)
BEGIN
    CREATE DATABASE SeatReservationDB;
END;
GO
USE SeatReservationDB;
GO
