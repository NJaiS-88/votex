const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatarUrl: {
      type: String,
      default: "",
      trim: true,
    },
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "dark",
    },
    colorScheme: {
      type: String,
      enum: ["indigo", "teal", "slate", "rose"],
      default: "indigo",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
