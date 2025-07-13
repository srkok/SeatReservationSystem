-- データベース作成＆選択
IF NOT EXISTS (
    SELECT name FROM sys.databases WHERE name = N'SeatReservationDB'
)
BEGIN
    CREATE DATABASE SeatReservationDB;
END;
GO
USE SeatReservationDB;
GO

-- Seats テーブル作成
IF NOT EXISTS (
    SELECT * FROM sysobjects WHERE name = 'Seats' AND xtype = 'U'
)
BEGIN
    CREATE TABLE Seats (
        id INT PRIMARY KEY IDENTITY(1,1),
        name NVARCHAR(50) NOT NULL
    );
END;
GO

-- ダミー座席 6行×7列 = 42席（A1〜F7）
IF NOT EXISTS (SELECT * FROM Seats)
BEGIN
    DECLARE @row CHAR(1), @col INT;
    SET @row = 'A';

    WHILE @row <= 'F'
    BEGIN
        SET @col = 1;
        WHILE @col <= 7
        BEGIN
            INSERT INTO Seats (name)
            VALUES (CONCAT(@row, '-', CAST(@col AS NVARCHAR(2))));
            SET @col += 1;
        END
        SET @row = CHAR(ASCII(@row) + 1);
    END
END;
GO
