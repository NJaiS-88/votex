const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const registerMeetingSocket = require("./socket/meetingSocket");

dotenv.config();

if (!process.env.MONGODB_URI) {
  console.error("Missing MONGODB_URI in backend/.env");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in backend/.env");
  process.exit(1);
}

connectDB();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

registerMeetingSocket(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
