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

-- Users テーブル作成（first_name, last_name, email, password, role付き）
IF NOT EXISTS (
    SELECT * FROM sysobjects WHERE name = 'Users' AND xtype = 'U'
)
BEGIN
    CREATE TABLE Users (
        id INT PRIMARY KEY IDENTITY(1,1),
        last_name NVARCHAR(50) NOT NULL,
        first_name NVARCHAR(50) NOT NULL,
        email NVARCHAR(100) UNIQUE NOT NULL,
        password NVARCHAR(100) NOT NULL,
        role NVARCHAR(50) NOT NULL CHECK (role IN ('admin', 'back_office', 'user'))
    );
END;
GO

-- ダミーユーザー 5人（各ロールを割当）
IF NOT EXISTS (SELECT * FROM Users)
BEGIN
    INSERT INTO Users (last_name, first_name, email, password, role) VALUES
    (N'田中', N'太郎', 'tanaka@example.com', 'pass123', 'admin'),
    (N'佐藤', N'花子', 'sato@example.com', 'pass456', 'user'),
    (N'鈴木', N'一郎', 'suzuki@example.com', 'pass789', 'user'),
    (N'高橋', N'美咲', 'takahashi@example.com', 'pass111', 'back_office'),
    (N'伊藤', N'健太', 'ito@example.com', 'pass222', 'user');
END;
GO
