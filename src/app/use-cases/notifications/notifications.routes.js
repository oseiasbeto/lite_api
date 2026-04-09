const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")

// configurando as rotas
router.get("/", protectedRoute, require("./controllers/get-all-notifications"))
router.put("/mark-as-notification/:id", protectedRoute, require("./controllers/mark-as-read-notification"))

// exportando as rotas
module.exports = router