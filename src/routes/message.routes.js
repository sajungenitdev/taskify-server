// routes/message.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const {
  sendMessage,
  getChannelMessages,
  editMessage,
  deleteMessage,
  addReaction,
  markMessagesAsRead,
  pinMessage,
} = require("../controllers/message.controller");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get("/channel/:channelId", getChannelMessages);
router.post("/channel/:channelId", sendMessage);
router.post("/channel/:channelId/read", markMessagesAsRead);
router.put("/:id", editMessage);
router.delete("/:id", deleteMessage);
router.post("/:id/reaction", addReaction);
router.post("/:id/pin", pinMessage);

module.exports = router;