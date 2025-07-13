import express from "express";
import reservationsRouter from "./routes/reservations";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/api/reservations", reservationsRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
