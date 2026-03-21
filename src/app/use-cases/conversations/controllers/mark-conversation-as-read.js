// Importando modelos necessários
const Conversation = require('../../../models/Conversation');
const Message = require('../../../models/Message');
const User = require('../../../models/User');
const { emitToUser } = require("../../../services/socket");

// Controlador para obter mensagens de uma conversa específica
const markConversationAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { convId } = req.params; // ou req.body

        const { source } = req.body

        const conversation = await Conversation.findById(convId)
            .populate({
                path: 'participants',
                populate: {
                    path: 'user',
                    select: 'name is_verified profile_image is_online last_seen'
                }
            })

        if (!conversation) {
            return res.status(404).json({ message: "Conversa não encontrada" });
        }

        const ignoreTypes = ['deleted_message']

        if (ignoreTypes.includes(conversation?.last_message?.message_type)) {
            return res.status(200).json();
        }

        const currentUser = await User.findById(userId)
            .select("name profile_image is_verified is_online")

        if (!currentUser) return res.status(401).send({
            message: "Faz o login e tente novamente!"
        })


        // Verifica se o usuário está na conversa
        const isParticipant = conversation.participants.some(
            p => p?.user?._id.toString() === userId
        );

        if (!isParticipant) {
            return res.status(403).json({ message: "Você não pertence a esta conversa" });
        }

        // Remove ou zera o contador de não lidos desse usuário
        const current = conversation.unread_count.get(userId) || 0;
        if (current > 0) {
            conversation.unread_count.set(userId, 0); // ou .set(userId, 0)
        }

        const currentUserAsReaded = conversation.read_by.find(i => i?.user.toString() === userId.toString())

        if (!currentUserAsReaded && conversation?.last_message?.message_type !== 'reaction_message') {
            const payload = {
                user: userId,
                read_at: new Date()
            }

            conversation.read_by.push(payload)

            conversation.participants.forEach(participant => {
                if (participant?.user?._id.toString() === userId.toString()) return;

                if (participant?.user?.is_online) {
                    emitToUser(participant?.user?._id.toString(), 'conversation_as_read', {
                        user: {
                            _id: currentUser?._id,
                            name: currentUser?.name,
                            profile_image: currentUser?.profile_image,
                            is_verified: currentUser?.is_verified,
                            is_online: currentUser?.is_online
                        },
                        source,
                        read_at: payload?.read_at || new Date(),
                        conv: conversation
                    })
                }
            });
        }

        await conversation.save();

        return res.json({
            success: true,
            message: "Conversa marcada como lida",
            unread_count: 0
        });

    } catch (error) {
        console.error("Erro ao marcar como lido:", error);
        res.status(500).json({ message: "Erro interno" });
    }
};

module.exports = markConversationAsRead;