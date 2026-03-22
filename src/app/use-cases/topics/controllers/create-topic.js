const Topic = require("../../../models/Topic.js");

const createTopic = async (req, res) => {
  try {
    const { 
      name, 
      adminKey
    } = req.body;

    if (!name || !adminKey) return res.status(400).send()

    const ADMIN_KEY = process.env?.ADMIN_KEY || null

    if (ADMIN_KEY !== adminKey) return res.status(403).send()

    const existingTopic = await Topic.findOne({
        name
    })

    if (existingTopic) return res.status(400).send({
        message: "Ja existe um topico com este nome"
    })

    const newTopic = await Topic.create({
        name
    })

    if (newTopic) return res.status(201).send({
        message: "Topico criado com sucesso.",
        topic: newTopic
    })
  } catch (error) {
    console.error("Erro ao criar topico:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
    });
  }
};

module.exports = createTopic;
