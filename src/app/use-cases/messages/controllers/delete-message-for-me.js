// Importando modelos necessários
const Message = require('../../../models/Message');

const deleteMessageForMe = async (req, res) => {
    try {
        const { msgId } = req.params;

        const { id: userId } = req.user

        if (!msgId) return res.status(400).send({
            message: "Informe o id da mensagem"
        })

        const message = await Message.findById(msgId)

        if(!message) return res.status(404).send({
            message: "Mensagem nao encontrada"
        })

        if(!message.deleted_for.includes(userId)) {
            message.deleted_for.push(userId)
            await message.save()
        }

        res.status(200).send({
            message: "Operacao feita com sucesso!"
        })
    } catch (error) {
        // Log de erro para depuração
        console.error("Erro ao eliminar a mensagem para mim:", error);

        // Resposta de erro genérica
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = deleteMessageForMe;