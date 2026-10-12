const Conversation = require('../../../models/Conversation');
const User = require('../../../models/User');

const VALID_STATUS = ['active', 'archived', 'pending', 'deleted'];
const VALID_FILTERS = ['all', 'unread', 'groups'];
const MAX_LIMIT = 50;
const MAX_SEARCH_LENGTH = 50;
const HAS_MESSAGE = { $ne: '' };

// Evita que o texto digitado vire regex (injeção / ReDoS)
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Filtro por status da conversa (aba)
const buildStatusQuery = (status, userId) => {
    switch (status) {
        case 'active':
            return {
                archived_by: { $ne: userId },
                deleted_by: { $ne: userId },
                participants: { $elemMatch: { user: userId, status: 'accepted' } }
            };
        case 'archived':
            return { archived_by: userId, 'participants.user': userId };
        case 'pending':
            return { participants: { $elemMatch: { user: userId, status: 'pending' } } };
        case 'deleted':
            return { deleted_by: userId, 'participants.user': userId };
        default:
            return {};
    }
};

// Chips da tela de Mensagens: Todas | Não lidas | Grupos
const buildFilterQuery = (filter, userId) => {
    if (filter === 'unread') {
        // unread_count é um Map<userId, número>; no Mongo vira o caminho unread_count.<userId>
        return { [`unread_count.${userId}`]: { $gt: 0 } };
    }
    if (filter === 'groups') {
        return { type: { $in: ['group', 'channel'] } };
    }
    return {};
};

// Busca:
//  - grupos/canais: pelo nome da conversa
//  - conversas diretas: pelo name/username do OUTRO participante
// A busca em User fica restrita a quem o usuário já conversa, então a regex
// nunca varre a coleção inteira de usuários.
const buildSearchClauses = async (baseQuery, userId, term, filter) => {
    const regex = new RegExp(escapeRegex(term), 'i');
    const clauses = [];

    if (filter !== 'groups') {
        const directs = await Conversation.find({ ...baseQuery, type: 'direct' })
            .select('participants.user')
            .lean();

        const otherIds = new Set();
        directs.forEach((conv) => {
            conv.participants.forEach((p) => {
                const id = p.user?.toString();
                if (id && id !== userId) otherIds.add(id);
            });
        });

        if (otherIds.size) {
            const matchedUsers = await User.find({
                _id: { $in: [...otherIds] },
                $or: [{ name: regex }, { username: regex }]
            })
                .select('_id')
                .lean();

            if (matchedUsers.length) {
                clauses.push({
                    type: 'direct',
                    participants: { $elemMatch: { user: { $in: matchedUsers.map((u) => u._id) } } }
                });
            }
        }
    }

    clauses.push({ type: { $in: ['group', 'channel'] }, name: regex });

    return clauses;
};

const getConversations = async (req, res) => {
    try {
        const userId = req.user.id.toString();

        // Paginação
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        // Aba (status) e filtros da tela
        const status = req.query.status || 'active';
        const filter = req.query.filter || 'all';
        const term = (req.query.q || '').toString().trim().slice(0, MAX_SEARCH_LENGTH);

        // Valores desconhecidos de status antes caíam em query = {} e devolviam
        // conversas de qualquer usuário. Agora são rejeitados.
        if (!VALID_STATUS.includes(status)) {
            return res.status(400).json({ message: "Status inválido." });
        }
        if (!VALID_FILTERS.includes(filter)) {
            return res.status(400).json({ message: "Filtro inválido." });
        }

        const isFiltered = filter !== 'all' || !!term;

        // Total vindo do cliente (load incremental) só vale sem filtro/busca:
        // com filtro o total muda, então sempre recontamos.
        const totalItems = isFiltered ? 0 : (parseInt(req.query.total, 10) || 0);

        const statusQuery = buildStatusQuery(status, userId);

        const query = {
            ...statusQuery,
            ...buildFilterQuery(filter, userId),
            "last_message.content": HAS_MESSAGE
        };

        if (term) {
            query.$or = await buildSearchClauses(query, userId, term, filter);
        }

        const [conversations, total, unreadConversations] = await Promise.all([
            Conversation.find(query)
                // _id garante ordem estável entre páginas quando as datas empatam
                .sort({ "last_message.created_at": -1, _id: -1 })
                .skip(skip)
                .limit(limit)
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
                ]),

            totalItems || Conversation.countDocuments(query),

            // Badge do chip "Não lidas": total de conversas não lidas da aba ativa,
            // independente do filtro/busca atual. Só calculado na 1ª página.
            page === 1 && status === 'active'
                ? Conversation.countDocuments({
                    ...statusQuery,
                    "last_message.content": HAS_MESSAGE,
                    [`unread_count.${userId}`]: { $gt: 0 }
                })
                : undefined
        ]);

        // Formata pra ficar lindo no frontend
        const formatted = conversations.map(conv => {
            const otherParticipant = conv.participants.find(p => p?.user?._id.toString() !== userId)
            // Aqui funciona porque não usamos .lean()
            let unread = 0;
            if (conv.unread_count instanceof Map) {
                unread = conv.unread_count.get(userId) || 0;
            } else {
                // Caso tenha usado .lean(), fallback seguro:
                unread = (conv.unread_count && conv.unread_count[userId]) || 0;
            }

            return {
                _id: conv._id,
                type: conv.type,
                xyz_id: conv.type === 'direct' ? otherParticipant?.user?._id : undefined,
                name: conv.type === 'direct' ? otherParticipant?.user?.name || 'Usuário' : conv.name,
                avatar: conv.type === 'direct' ? otherParticipant?.user?.profile_image : conv.avatar,
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

        // Calcular total de páginas
        const totalPages = Math.ceil(total / limit);

        // Resposta padronizada
        res.status(200).json({
            conversations: formatted, // lista de conversas
            page, // página atual
            totalPages, // total de páginas
            total, // total de conversas (já considerando filtro/busca)
            source: status,
            filter, // filtro aplicado
            q: term || undefined, // busca aplicada
            unread_conversations: unreadConversations, // só na 1ª página da aba ativa
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