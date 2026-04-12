// Importando modelos necessários
const Conversation = require('../../../models/Conversation');

// Controlador para obter mensagens de uma conversa específica
const getConversationById = async (req, res) => {
    try {
        const { convId } = req.params;

        const { id: userId } = req.user
        
        // Validação básica
        if (!convId) {
            return res.status(400).json({ message: "ID da conversa é obrigatório." });
        }

        const conv = await Conversation.findById(convId)
            .populate([
                { 
                    path: 'participants', 
                    populate: {
                        path: 'user',
                        select: 'name is_verified profile_image is_online last_seen'
                    }
                },
                {
                    path: 'read_by', 
                    populate: {
                        path: 'user',
                        select: 'name profile_image is_verified is_online'
                    }
                },
                { 
                    path: 'last_message.sender', 
                    select: 'name' 
                },
                { 
                    path: 'creator', 
                    select: 'name' 
                }
            ])

        if (!conv) return res.status(404).send({
            message: "Conversa nn encontrada"
        })

        const otherUser = conv.type === 'direct' ? conv.participants.find(p => p?.user?._id.toString() !== userId) : null
        const unread = false ? conv.unread_count.get(userId.toString()) : 0

        const formatted = {
            _id: conv._id,
            type: conv.type,
            xyz_id: conv.type === 'direct' ? otherUser?.user?._id : undefined,
            name: conv.type === 'direct' ? otherUser?.user?.name || 'Usuário' : conv.name,
            avatar: conv.type === 'direct' ? otherUser?.user?.profile_image : conv.avatar,
            is_online: conv.type === 'direct' ? otherUser?.user?.is_online : false,
            last_seen: conv.type === 'direct' ? otherUser?.user?.last_seen : null,
            is_verified: conv.type === 'direct' ? otherUser?.user?.is_verified : false,
            last_message: conv.last_message ? {
                content: conv.last_message.content || '[Foto]',
                created_at: conv.last_message.created_at
            } : null,
            unread_count: unread,
            read_by: conv.read_by,
            participants: conv.participants,
            archived_by: conv.archived_by,
            deleted_by: conv.deleted_by,
            pinned: conv.pinned,
            muted: !!conv.muted_until
        }
        // Resposta padronizada
        res.status(200).json({
            conversation: formatted
        });

    } catch (error) {
        // Log de erro para depuração
        console.error("Erro ao carregar a conversa:", error);

        // Resposta de erro genérica
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = getConversationById;