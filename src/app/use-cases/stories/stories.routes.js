// modules/stories/routes/storyRoutes.js
const express = require("express");
// Use o mesmo middleware de autenticação que as rotas de mensagens já usam
// (ele precisa preencher req.user.id).
const auth = require("../../middlewares/protected-route")
const ctrl = require("../stories/controllers/storyController");

const router = express.Router();

router.get("/", auth, ctrl.getStoriesFeed);
router.post("/", auth, ctrl.createStory);

// rotas fixas ANTES das rotas com :id
router.get("/me/archive", auth, ctrl.getMyArchive);
router.post("/mute/:userId", auth, ctrl.toggleMuteUser);

router.post("/:id/view", auth, ctrl.markViewed);
router.post("/:id/like", auth, ctrl.toggleLike);
router.post("/:id/reply", auth, ctrl.replyToStory);
router.get("/:id/viewers", auth, ctrl.getViewers);
router.delete("/:id", auth, ctrl.deleteStory);

module.exports = router;