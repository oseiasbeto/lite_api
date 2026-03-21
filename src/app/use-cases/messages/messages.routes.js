const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

// importando os controllers
const getMessages = require("./controllers/get-messages")
const sendMessage = require("./controllers/send-message")
const deleteMessageForMe = require("./controllers/delete-message-for-me")
const deleteMessage = require("./controllers/delete-message")
const reactMessage = require("./controllers/react-message")

// configurando as rotas
router.post("/new-message", protectedRoute, sendMessage)
router.get("/:convId", protectedRoute, getMessages)
router.delete("/for-me/:msgId", protectedRoute, deleteMessageForMe)
router.delete("/:msgId", protectedRoute, deleteMessage)
router.put("/react/:msgId", protectedRoute, reactMessage)

// exportando as rotas
module.exports = router