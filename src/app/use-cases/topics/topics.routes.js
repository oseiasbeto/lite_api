const express = require("express");
const router = express.Router();

const createTopic = require("./controllers/create-topic")
const getTopics = require("./controllers/get-topics")
const updateTopic = require("./controllers/update-topic")
const deleteTopic = require("./controllers/delete-topic")

// configurando as rotas
router.post("/", createTopic)
router.get("/", getTopics)
router.put("/:id", updateTopic)
router.delete("/:id", deleteTopic)

// exportando as rotas
module.exports = router