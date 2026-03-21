// Importando modelos necessários
const Message = require('../../../models/Message');
const Conversation = require('../../../models/Conversation');
const User = require('../../../models/User');
const { emitToUser } = require("../../../services/socket");

const reactMessage = async (req, res) => {
    try {
        const { msgId } = req.params;

        const { id: userId } = req.user
        const { emoji, source } = req.body
        let core = null

        const currentUser = await User.findById(userId)
            .select('name username profile_image is_verified is_online')

        if (!currentUser) return res.status(401).send({
            message: "O corrente usuario nao foi encontrado. Faca o login e tente novamente!"
        })

        if (!msgId) return res.status(400).send({
            message: "Informe o id da mensagem"
        })

        const message = await Message.findById(msgId)
            .populate('sender', 'name username profile_image is_verified is_online')

        const conversation = await Conversation.findById(message.conversation)
            .populate({
                path: 'participants',
                populate: {
                    path: 'user',
                    select: 'name is_verified profile_image is_online'
                }
            });

        if (!message) return res.status(404).send({
            message: "Mensagem nao encontrada"
        })

        if (!conversation) return res.status(500).send({
            message: "Conversa nao encontrada"
        })

        const existingReactionIndex = message.reactions.findIndex(r => r.user.toString() === userId.toString() && r.emoji === emoji)

        if (existingReactionIndex !== -1) {
            message.reactions.splice(existingReactionIndex, 1)
            core = 'remove'
        } else {
            const existingReaction = message.reactions.find(r => r.user.toString() == userId.toString())

            if (existingReaction) {
                existingReaction.emoji = emoji
                core = 'noPush'
            } else {
                message.reactions.push({ user: userId, emoji })
                core = 'push'
            }
        }

        await message.save()

        if (core) {
            conversation.participants.forEach(participant => {
                if (participant?.user?._id.toString() === currentUser?._id.toString()) return;

                if (core === 'remove') {
                    const current = conversation.unread_count.get(participant?.user?._id.toString()) || 0;
                    conversation.unread_count.set(participant?.user?._id.toString(), current > 0 ? current - 1 : 0);
                    conversation.last_message.message_type = 'text'
                } else if (core === 'push') {
                    const current = conversation.unread_count.get(participant?.user?.toString()) || 0;
                    conversation.unread_count.set(participant?.user?._id.toString(), current + 1);
                    conversation.last_message.message_type = 'reaction_message'
                }

                if (participant?.user?.is_online) {
                    emitToUser(participant?.user?._id.toString(), 'react_message', {
                        emoji,
                        conv: conversation,
                        msgId: message._id,
                        sender: currentUser,
                        core,
                        source
                    });
                }
            });

            conversation.read_by = []
            conversation.last_message.msg_id = message._id
            conversation.last_message.sender = message.sender
            conversation.last_message.reaction = `${emoji}`
            conversation.last_message.created_at = new Date()

            await conversation.save()
        }

        res.status(200).send({
            msg: message,
            core,
            message: "Mensagem reagida com sucesso!"
        })
    } catch (error) {
        // Log de erro para depuração
        console.error("Erro ao eliminar a mensagem:", error);

        // Resposta de erro genérica
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = reactMessage;