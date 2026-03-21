const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

const getUserById = require("./controllers/get-user-by-id")
const forceOffline = require("./controllers/force-offline")
const searchUsers = require("./controllers/search-users")
const getUsersForNewMessage = require("./controllers/get-users-for-new-messages")
const updateUserById = require("./controllers/update-user-by-id")

// configurando as rotas
router.get("/new-message", protectedRoute, getUsersForNewMessage)
router.get("/search", protectedRoute, searchUsers)
router.get("/:id", protectedRoute, getUserById)
router.post("/force-offline/:id", protectedRoute, forceOffline)
router.put("/", protectedRoute, updateUserById)

// exportando as rotas
module.exports = router