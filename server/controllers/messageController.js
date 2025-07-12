const Message = require('../models/Message');

// Save a new message
async function saveMessage({ room, user, userId, text, isAuthenticated }) {
  const msg = new Message({ 
    room, 
    user, 
    userId: userId || null,
    text,
    isAuthenticated: isAuthenticated || false
  });
  await msg.save();
  return msg;
}

// Get message history for a room
async function getRoomMessages(room) {
  try {
    // Log the query we're about to execute
    console.log(`Retrieving messages for room "${room}"`);
    
    // Limit to last 50 messages, sorted oldest to newest
    const messages = await Message.find({ room }).sort({ createdAt: 1 }).limit(50).lean();
    
    console.log(`Retrieved ${messages.length} messages for room "${room}"`);
    if (messages.length > 0) {
      console.log(`First message: "${messages[0].text.substring(0, 20)}...", Last message: "${messages[messages.length-1].text.substring(0, 20)}..."`);
    }
    
    return messages;
  } catch (err) {
    console.error(`Error retrieving messages for room "${room}":`, err);
    return []; // Return empty array instead of failing
  }
}

module.exports = { saveMessage, getRoomMessages };
