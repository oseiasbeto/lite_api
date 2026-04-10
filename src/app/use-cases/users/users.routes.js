const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

// configurando as rotas
router.get("/new-message", protectedRoute, require("./controllers/get-users-for-new-messages"))
router.get("/search", protectedRoute, require("./controllers/search-users"))
router.put("/:user_id/follow", protectedRoute, require("./controllers/follow-user"))
router.put("/:user_id/subscribe", protectedRoute, require("./controllers/subscribe-user"))
router.get("/:id", protectedRoute, require("./controllers/get-user-by-id"))
router.post("/force-offline/:id", protectedRoute, require("./controllers/force-offline"))
router.put("/", protectedRoute, require("./controllers/update-user-by-id"))
router.put("/unread-messages-count", protectedRoute, require("./controllers/update-unread-messages-count"))
router.put("/unread-notifications-count", protectedRoute, require("./controllers/update-unread-notifications-count"))

// exportando as rotas
module.exports = router