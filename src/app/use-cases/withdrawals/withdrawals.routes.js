const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")
//const validObjectId = require("../../middlewares/validObjectId")

// importando os controllers
const getBalance = require("./controllers/getBalance")
const requestWithdrawal = require("./controllers/requestWithdrawal")

// configurando as rotas
router.get("/balance", protectedRoute, getBalance)
router.post("/request-withdrawal", protectedRoute, requestWithdrawal)

// exportando as rotas
module.exports = router