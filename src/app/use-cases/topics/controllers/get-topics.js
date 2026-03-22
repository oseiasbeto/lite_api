const Topic = require("../../../models/Topic.js");

const getTopics = async (req, res) => {
  try {
    const topics = await Topic.find()
    .select("-updated_at -created_at -__v")

    res.status(200).send({
        topics
    })
  } catch (error) {
    console.error("Erro ao criar topico:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
    });
  }
};

module.exports = getTopics;
