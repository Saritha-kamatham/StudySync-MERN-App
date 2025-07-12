const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  room: { type: String, required: true },
  user: { type: String, required: true },
  userId: { type: String },  // ID of the user (from JWT or socket.id)
  text: { type: String, required: true },
  isAuthenticated: { type: Boolean, default: false }, // Whether the message is from an authenticated user
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
