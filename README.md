# seat reservation system

## necessary environment

- Node.js
- npm
- SQL Server
- any browser

## how to build
1. add .env file
```.env
DB_USER=sa
DB_PASSWORD=your_password
DB_SERVER=localhost
DB_NAME=SeatReservationDB
```
2. create tables on your SQL Server using all the files located in the SQL folder
3.  type cmd
```bash
npm install package.json --save
npm run start
```

# for developer:
```bash
npm install package.json --save
npm run build
npm run start
```
## how to debug
1. open browser
   ```
   localhost:3000
   ```
### get reservations
- type on browser
  - e.g.:
    ```
    localhost:3000/api/reservations?userId=1&fromDate=2025-07-13&status=reserved&order=true
    ```
  |attribute|description|
  |--|--|
  |userId (optional)|Filter by user ID|
  |fromDate (optional)|Filter reservations from this date (inclusive)|
  |toDate (optional)|Filter reservations up to this date (inclusive)|
  |seatId (optional)|Filter by seat ID|
  |status (optional)|Filter by reservation status ("reserved" or "canceled")|
  |order (optional, default: false)|If true, orders by reserved_date DESC, start_time DESC|
### delete reservation
- type on console
   - e.g.:
     ```console
     fetch(`http://localhost:3000/api/reservations/43`, {
       method: 'DELETE',
     })
     .then((res) => res.json())
     .then((data) => {
       console.log('削除結果:', data);
     })
     .catch((error) => {
       console.error('削除エラー:', error);
     });
     ```
### create new reservation
- type on console
   - e.g.:
     ```console
     fetch('http://localhost:3000/api/reservations', {
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
     ```
### edit reservation
- type on console
   - e.g.:
     ```console
     fetch('http://localhost:3000/api/reservations/41', {
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
     ```
     
