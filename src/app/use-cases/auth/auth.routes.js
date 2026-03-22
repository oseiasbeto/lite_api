const express = require("express");
const router = express.Router();

// importando os middlewares
const protectedRoute = require("../../middlewares/protected-route")
//const validObjectId = require("../../middlewares/validObjectId")

// importando os controllers
const getActiveSessions = require("./controllers/get-active-sessions")
const refreshAccessToken = require("./controllers/refresh-access-token")
const login = require("./controllers/login")
const register = require("./controllers/register")
const completeRegistration = require("./controllers/complete-registration")
const verifyEmail = require("./controllers/verify-email")
const verifyResetPasswordCode = require("./controllers/verify-reset-password-code")
const forgotPassword = require("./controllers/forgot-password")
const resetPassword = require("./controllers/reset-password")
const logout = require("./controllers/logout")
const terminateAllSessions = require("./controllers/terminate-all-sessions")

// configurando as rotas
router.post("/login", login)
router.post("/register", register)
router.put("/register/complete", completeRegistration)
router.post("/verify-email", verifyEmail)
router.post("/forgot-password", forgotPassword)
router.post("/verify-reset-password-code", verifyResetPasswordCode)
router.put("/reset-password", resetPassword)
router.get("/sessions", getActiveSessions)
router.post("/sessions/refresh-access-token", refreshAccessToken)
router.delete("/sessions/terminate-all", terminateAllSessions)
router.delete("/sessions/logout", logout)


// exportando as rotas
module.exports = router