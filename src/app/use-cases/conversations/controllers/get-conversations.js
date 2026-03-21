const Conversation = require('../../../models/Conversation');

const getConversations = async (req, res) => {
    try {
        const { id: userId } = req.user;

        // Paginação
        const page = parseInt(req.query.page) || 1;

        // Itens por página
        const limit = parseInt(req.query.limit) || 10;

        const status = req.query.status || 'active';

        // Cálculo do skip
        const skip = (page - 1) * limit;

        // Total de itens (para load incremental)
        const totalItems = parseInt(req.query.total) || 0;

        let query = {}

        if (status) {
            if (status === 'active') {
                query.archived_by = { $ne: userId }
                query.deleted_by = { $ne: userId }
                query.participants = { $elemMatch: { user: userId, status: 'accepted' } }
            } else if (status === 'archived') {
                query.archived_by = userId
            } else if (status === 'pending') {
                query.participants = { $elemMatch: { user: userId, status: 'pending' } }
            } else if (status === 'deleted') {
                query.deleted_by = userId
            }
        }

        // Busca mensagens com paginação
        const conversations = await Conversation.find({
            ...query,
            "last_message.content": { $ne: '' }
        })
            .sort({ "last_message.created_at": -1 })
            .skip(skip) // pular o número de itens já carregados
            .limit(limit) // limitar ao número por página   
            .sort({ pinned: -1, 'last_message.created_at': -1 })
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

        // Formata pra ficar lindo no frontend
        const formatted = conversations.map(conv => {
            const otherParticipant = conv.participants.find(p => p?.user?._id.toString() !== userId)
            // Aqui funciona porque não usamos .lean()
            let unread = 0;
            if (conv.unread_count instanceof Map) {
                unread = conv.unread_count.get(userId.toString()) || 0;
            } else {
                // Caso tenha usado .lean(), fallback seguro:
                unread = (conv.unread_count && conv.unread_count[userId.toString()]) || 0;
            }

            return {
                _id: conv._id,
                type: conv.type,
                xyz_id: conv.type === 'direct' ? otherParticipant?.user?._id : undefined,
                name: conv.type === 'direct' ? otherParticipant?.user?.name || 'Usuário' : conv.name,
                avatar: conv.type === 'direct' ? otherParticipant?.user?.profile_image?.url : conv.avatar,
                is_online: conv.type === 'direct' ? otherParticipant?.user?.is_online : false,
                last_seen: conv.type === 'direct' ? otherParticipant?.user?.last_seen : null,
                is_verified: conv.type === 'direct' ? otherParticipant?.user?.is_verified : false,
                last_message: conv.last_message ? {
                    ...(conv.type !== 'group' && {
                        sender: {
                            _id: conv.last_message?.sender?._id,
                            name: conv.last_message?.sender?.name,
                            profile_image: conv.last_message?.sender?.profile_image,
                        }
                    }),
                    msg_id: conv.last_message.msg_id,
                    content: conv.last_message.content || '[Foto]',
                    message_type: conv.last_message.message_type || 'text',
                    reaction: conv.last_message.reaction,
                    created_at: conv.last_message.created_at
                } : null,

                participants: conv.participants || [],
                read_by: conv.read_by || [],
                archived_by: conv.archived_by || [],
                deleted_by: conv.deleted_by || [],
                created_at: conv.created_at,
                updated_at: conv.updated_at,
                unread_count: unread,
                pinned: conv.pinned,
                muted: !!conv.muted_until
            }
        })

        // Contar total de mensagens na conversa (apenas se não for load incremental)
        let total;

        // Contagem total do filtro
        if (!totalItems) {
            // Contagem total do filtro
            total = await Conversation.countDocuments({
                ...query,
                "last_message.content": { $ne: '' }
            });
        } else {
            // Usar total fornecido na requisição
            total = totalItems;
        }

        // Calcular total de páginas
        const totalPages = Math.ceil(total / limit);

        // Resposta padronizada
        res.status(200).json({
            conversations: formatted, // lista de conversas
            page, // página atual
            totalPages, // total de páginas
            total, // total de conversas
            source: status,
            hasMore: page < totalPages, // indica se há mais páginas
        });
    } catch (error) {
        // Log de erro para depuração
        console.error("Erro ao buscar conversas:", error);

        // Resposta de erro genérica
        res.status(500).json({ message: "Erro interno no servidor.", error: error.message });
    }
};

module.exports = getConversations;