const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

// importando os controllers
const getConversations = require("./controllers/get-conversations")
const getConversationById = require("./controllers/get-conversation-by-id")
const startDirectMessage = require("./controllers/start-direct-message")
const markConversationAsRead = require("./controllers/mark-conversation-as-read")
const toggleArchiveConversation = require("./controllers/toggle-archive-conversation")

// configurando as rotas
router.get("/", protectedRoute, getConversations)
router.get("/:convId", protectedRoute, getConversationById)
router.post("/direct", protectedRoute, startDirectMessage)
router.post("/:convId/mark-as-read", protectedRoute, markConversationAsRead)
router.put("/:convId/archive", protectedRoute, toggleArchiveConversation)

// exportando as rotas
module.exports = router