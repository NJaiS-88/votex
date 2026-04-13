const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Meeting = require("../models/Meeting");
const generateToken = require("../utils/generateToken");

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide all fields" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Signup successful",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || "",
        theme: user.theme || "dark",
        colorScheme: user.colorScheme || "indigo",
      },
    });
  } catch (error) {
    if (error.message?.includes("secretOrPrivateKey")) {
      return res.status(500).json({
        message: "Server auth config error: JWT_SECRET is missing",
      });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide all fields" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.status(200).json({
      message: "Login successful",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || "",
        theme: user.theme || "dark",
        colorScheme: user.colorScheme || "indigo",
      },
    });
  } catch (error) {
    if (error.message?.includes("secretOrPrivateKey")) {
      return res.status(500).json({
        message: "Server auth config error: JWT_SECRET is missing",
      });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

const updateMe = async (req, res) => {
  try {
    const { name, avatarUrl, theme, colorScheme } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    req.user.name = name.trim();
    req.user.avatarUrl = (avatarUrl || "").trim();
    if (theme === "light" || theme === "dark") {
      req.user.theme = theme;
    }
    if (["indigo", "teal", "slate", "rose"].includes(colorScheme)) {
      req.user.colorScheme = colorScheme;
    }
    await req.user.save();
    return res.status(200).json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatarUrl: req.user.avatarUrl || "",
        theme: req.user.theme || "dark",
        colorScheme: req.user.colorScheme || "indigo",
      },
    });
  } catch {
    return res.status(500).json({ message: "Could not update profile" });
  }
};

const resetMyData = async (req, res) => {
  try {
    const userId = String(req.user._id);
    await Meeting.deleteMany({ "host.userId": userId });
    await Meeting.updateMany(
      { "host.userId": { $ne: userId } },
      {
        $pull: {
          participantHistory: { userId },
          chatMessages: { senderId: userId },
          reactions: { senderId: userId },
        },
      }
    );

    req.user.avatarUrl = "";
    req.user.theme = "dark";
    req.user.colorScheme = "indigo";
    req.user.name = req.user.email.split("@")[0];
    await req.user.save();

    return res.status(200).json({
      message: "Your data has been reset",
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatarUrl: "",
        theme: "dark",
        colorScheme: "indigo",
      },
    });
  } catch {
    return res.status(500).json({ message: "Could not reset data" });
  }
};

module.exports = { signup, login, getMe, updateMe, resetMyData };
