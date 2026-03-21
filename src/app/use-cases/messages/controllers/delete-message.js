// Importando modelos necessários
const Message = require('../../../models/Message');
const Conversation = require('../../../models/Conversation');
const { emitToUser } = require("../../../services/socket");

const deleteMessage = async (req, res) => {
    try {
        const { msgId } = req.params;

        const { id: userId } = req.user

        if (!msgId || msgId === undefined) return res.status(400).send({
            message: "Informe o id da mensagem"
        })

        const message = await Message.findById(msgId)
            .populate('sender', 'name username profile_image is_verified activity_status')
            .populate('conversation')

        if (!message) return res.status(404).send({
            message: "Mensagem nao encontrada"
        })

        if (message.sender._id.toString() !== userId.toString()) return res.status(403).send({
            message: "Voce nao tem permissao para fazer esta requesicao."
        })

        message.status = 'is_deleted'
        const conversation = await Conversation.findById(message.conversation)
            .populate({
                path: 'participants',
                populate: {
                    path: 'user',
                    select: 'name is_verified profile_image is_online'
                }
            });

        if (conversation) {
            conversation.unread_count = {}
            conversation.read_by = []

            conversation.last_message = {
                msg_id: message._id,
                sender: userId,
                content: 'Eliminou uma mensagem',
                message_type: 'deleted_message',
                created_at: new Date(),
                updated_at: new Date()
            };
            await conversation.save()
        }

        await message.save()

        conversation.participants.forEach(participant => {
            if (participant?.user?._id.toString() === userId.toString()) return;

            if (participant?.user?.is_online) {
                emitToUser(conversation._id.toString(), 'delete_message', message);
            }
        });

        res.status(200).send({
            message: "Mensagem eliminada com sucesso!"
        })
    } catch (error) {
        // Log de erro para depuração
        console.error("Erro ao eliminar a mensagem:", error);

        // Resposta de erro genérica
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = deleteMessage;