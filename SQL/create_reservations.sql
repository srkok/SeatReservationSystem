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

-- Reservations テーブル作成（status制約追加）
IF NOT EXISTS (
    SELECT * FROM sysobjects WHERE name = 'Reservations' AND xtype = 'U'
)
BEGIN
    CREATE TABLE Reservations (
        id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT NOT NULL,
        seat_id INT NOT NULL,
        reserved_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status NVARCHAR(20) NOT NULL CHECK (status IN ('reserved', 'canceled')),
        created_at DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (user_id) REFERENCES Users(id),
        FOREIGN KEY (seat_id) REFERENCES Seats(id)
    );
END;
GO

-- ダミー予約データ：07/01〜07/30、毎日1〜2件、時間帯ランダム（09:00〜18:00）、重複なし
IF NOT EXISTS (SELECT * FROM Reservations)
BEGIN
    DECLARE @date DATE = '2025-07-01';
    DECLARE @end DATE = '2025-07-30';
    DECLARE @user INT;
    DECLARE @seat INT;
    DECLARE @startSlot INT; -- 時間スロット（9〜17）
    DECLARE @i INT;
    DECLARE @start TIME;
    DECLARE @endTime TIME;
    DECLARE @randBase INT;

    WHILE @date <= @end
    BEGIN
        -- 毎日 1〜2 件予約する
        SET @randBase = ABS(CHECKSUM(NEWID()));
        SET @i = 1;

        WHILE @i <= (CASE WHEN @randBase % 2 = 0 THEN 1 ELSE 2 END)
        BEGIN
            SET @user = (ABS(CHECKSUM(NEWID())) % 5) + 1;
            SET @seat = (ABS(CHECKSUM(NEWID())) % 42) + 1;
            SET @startSlot = (ABS(CHECKSUM(NEWID())) % 9) + 9;  -- 9〜17

            SET @start = CAST(@startSlot AS VARCHAR) + ':00';
            SET @endTime = CAST(@startSlot + 1 AS VARCHAR) + ':00';

            IF NOT EXISTS (
                SELECT * FROM Reservations
                WHERE reserved_date = @date
                  AND seat_id = @seat
                  AND (
                      (start_time < @endTime AND end_time > @start)
                  )
            )
            BEGIN
                INSERT INTO Reservations (user_id, seat_id, reserved_date, start_time, end_time, status)
                VALUES (@user, @seat, @date, @start, @endTime, 'reserved');
            END

            SET @i += 1;
        END

        SET @date = DATEADD(DAY, 1, @date);
    END
END;
GO
