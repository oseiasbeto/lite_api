// Importando modelos necessários
const Conversation = require('../../../models/Conversation');

// Controlador para obter mensagens de uma conversa específica
const toggleArchiveConversation = async (req, res) => {
    try {
        const { convId } = req.params;

        const { id: userId } = req.user

        // Validação básica
        if (!convId) {
            return res.status(400).json({ message: "ID da conversa é obrigatório." });
        }

        const conv = await Conversation.findById(convId)

        if (!conv) return res.status(404).send({
            message: "Conversa nn encontrada"
        })

        let message
        const index = conv.archived_by.findIndex(u => u.toString() === userId.toString())
        
        if (index !== -1) {
            conv.archived_by.splice(index, 1)
            message = 'Conversa desarquivada com sucesso!'
        } else {
            conv.archived_by.push(userId)
            message = 'Conversa arquivada com sucesso!'
        }

        await conv.save()

        res.status(200).send({
            conv,
            message
        })
    } catch (error) {
        // Log de erro para depuração
        console.error("Erro ao arquivar a conversa:", error);

        // Resposta de erro genérica
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = toggleArchiveConversation;