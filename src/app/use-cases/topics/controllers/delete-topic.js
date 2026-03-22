const Topic = require("../../../models/Topic.js");
const Post = require("../../../models/Post.js");

const deleteTopic = async (req, res) => {
    try {
        const { adminKey } = req.body;
        const { id } = req.params

        if (!id || !adminKey) return res.status(400).send()

        const ADMIN_KEY = process.env?.ADMIN_KEY || null
        if (ADMIN_KEY !== adminKey) return res.status(403).send()

        const topic = await Topic.findOne({
            _id: id
        })

        if (!topic) return res.status(404).send()

        await topic.deleteOne()

        await Post.updateMany({
            topics: topic._id
        }, {
            $pull: {
                topics: topic._id
            }
        })

        res.status(200).send()
    } catch (error) {
        console.error("Erro ao excluir topico:", error);
        res.status(500).json({
            success: false,
            error: "Erro interno no servidor",
        });
    }
};

module.exports = deleteTopic;
