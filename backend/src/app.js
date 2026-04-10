const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ message: "Backend is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.get("/api/meet/health", (_req, res) => {
  res.status(200).json({ message: "Meeting signaling is ready" });
});

module.exports = app;
