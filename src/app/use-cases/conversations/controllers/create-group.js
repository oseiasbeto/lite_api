const mongoose = require('mongoose');
const Conversation = require('../../../models/Conversation');
const User = require('../../../models/User');

const MAX_MEMBERS = 50;        // total, incluindo quem cria (mantenha igual ao front)
const MIN_OTHER_MEMBERS = 2;   // além de quem cria
const MAX_NAME_LENGTH = 50;

// Nome padrão quando não é informado: "Ana, Bruno e mais 2"
const buildDefaultName = (names) => {
    const shown = names.slice(0, 2);
    const rest = names.length - shown.length;
    const label = rest > 0 ? `${shown.join(', ')} e mais ${rest}` : shown.join(' e ');
    return label.slice(0, MAX_NAME_LENGTH);
};

const createGroup = async (req, res) => {
    try {
        const userId = req.user.id.toString();

        const name = String(req.body?.name || '').trim().slice(0, MAX_NAME_LENGTH);
        const rawMembers = Array.isArray(req.body?.members) ? req.body.members : [];

        // Sem duplicados e sem o próprio criador
        const memberIds = [...new Set(rawMembers.map((id) => String(id)))].filter((id) => id !== userId);

        if (!memberIds.every((id) => mongoose.isValidObjectId(id))) {
            return res.status(400).json({ message: "Lista de membros inválida." });
        }
        if (memberIds.length < MIN_OTHER_MEMBERS) {
            return res.status(400).json({ message: `Adicione pelo menos ${MIN_OTHER_MEMBERS} pessoas ao grupo.` });
        }
        if (memberIds.length + 1 > MAX_MEMBERS) {
            return res.status(400).json({ message: `Um grupo pode ter no máximo ${MAX_MEMBERS} membros.` });
        }

        // Todos precisam existir (criador incluído, para o nome padrão)
        const users = await User.find({ _id: { $in: [userId, ...memberIds] } })
            .select('name')
            .lean();
        const byId = new Map(users.map((u) => [u._id.toString(), u]));

        if (!byId.has(userId) || memberIds.some((id) => !byId.has(id))) {
            return res.status(400).json({ message: "Um ou mais usuários não existem." });
        }

        const finalName = name || buildDefaultName(
            [userId, ...memberIds].map((id) => byId.get(id)?.name || 'Usuário')
        );

        const now = new Date();

        // content '' mantém o grupo fora da lista (HAS_MESSAGE em getConversations)
        // até a 1ª mensagem — igual a uma conversa direta nova.
        const created = await Conversation.create({
            type: 'group',
            name: finalName,
            creator: userId,
            participants: [userId, ...memberIds].map((id) => ({ user: id, status: 'accepted' })),
            last_message: { content: '', message_type: 'text', created_at: now }
        });

        const conv = await Conversation.findById(created._id).populate([
            {
                path: 'participants',
                populate: {
                    path: 'user',
                    select: 'name is_verified profile_image is_online last_seen'
                }
            },
            { path: 'creator', select: 'name' }
        ]);

        // Mesmo formato dos itens de getConversations
        res.status(201).json({
            conversation: {
                _id: conv._id,
                type: conv.type,
                name: conv.name,
                avatar: conv.avatar,
                is_online: false,
                last_seen: null,
                is_verified: false,
                last_message: {
                    content: '',
                    message_type: 'text',
                    created_at: now
                },
                creator: conv.creator,
                participants: conv.participants || [],
                members_count: (conv.participants || []).length,
                read_by: [],
                archived_by: [],
                deleted_by: [],
                created_at: conv.created_at,
                updated_at: conv.updated_at,
                unread_count: 0,
                pinned: false,
                muted: false
            }
        });
    } catch (error) {
        console.error("Erro ao criar grupo:", error);
        res.status(500).json({ message: "Erro interno no servidor.", error: error.message });
    }
};

module.exports = createGroup;