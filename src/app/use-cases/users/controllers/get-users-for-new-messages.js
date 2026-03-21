// src/app/use-cases/users/controllers/get-users-for-new-messages.js
const User = require('../../../models/User');
const Conversation = require('../../../models/Conversation');

const getUsersForNewMessage = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;

    // 1. Usuários com quem já conversei (sempre no topo, sem paginação)
    const directCon = await Conversation.find({
      type: 'direct',
      participants: {
        $elemMatch: {
          user: currentUserId,
          status: 'accepted'
        }
      },
      deleted_by: { $ne: currentUserId },
      archived_by: { $ne: currentUserId }
    })
      .sort({ 'last_message.created_at': -1 })
      .select('participants last_message.created_at')
      .populate({
        path: 'participants',
        match: { user: { $ne: currentUserId }, status: 'accepted' },
        populate: {
          path: 'user',
          select: 'name username is_verified profile_image.url is_online last_seen'
        }
      })
      .lean();

    const chattedUsers = directCon
      .filter(c => c.participants?.[0])
      .map(c => {
        const participant = c.participants.find(p => p.user?._id.toString() !== currentUserId.toString())

        if(participant) {
          return {
            ...participant,
            name: participant?.user?.name,
            profile_image: participant?.user?.profile_image,
            is_verified: participant?.user?.is_verified,
            username: participant?.user?.username,
            is_online: participant?.user?.is_online,
            last_seen: c?.last_message?.created_at,
            source: 'chat'
          }
        } else return
      });
      
    const chattedUserIds = new Set(chattedUsers.map(u => u?.user?._id.toString()));

    // 2. Quantos usuários já foram enviados nas páginas anteriores?
    const alreadySentChatted = Math.min(chattedUsers.length, (page - 1) * limit);
    const remainingChatted = chattedUsers.length - alreadySentChatted;

    // 3. Quantos slots ainda temos nesta página?
    const slotsThisPage = limit - Math.max(0, remainingChatted);

    // 4. Skip correto nos "outros usuários" (pula apenas os que já foram enviados como fallback)
    const fallbackSkip = Math.max(0, (page - 1) * limit - chattedUsers.length);

    // 5. Busca os fallback users (outros usuários)
    const fallbackUsers = slotsThisPage > 0 ? await User.find({
      _id: { $nin: [currentUserId, ...Array.from(chattedUserIds)] },
      is_deleted: { $ne: true },
      account_verification_status: 'verified'
    })
      .sort({ is_online: -1, last_seen: -1, created_at: -1 })
      .skip(fallbackSkip)
      .limit(slotsThisPage)
      .select('name is_verified username profile_image.url is_online last_seen')
      .lean() : [];

    // 6. Monta a lista final desta página
    const usersThisPage = [
      ...chattedUsers.slice(alreadySentChatted, alreadySentChatted + limit),
      ...fallbackUsers
    ];

    // 7. Cálculo correto de total e hasMore
    const totalChatted = chattedUsers.length;
    const totalOthers = await User.countDocuments({
      _id: { $nin: [currentUserId, ...Array.from(chattedUserIds)] },
      is_deleted: { $ne: true },
      account_verification_status: 'verified'
    });

    const total = totalChatted + totalOthers;
    const alreadySentTotal = (page - 1) * limit + usersThisPage.length;
    const hasMore = alreadySentTotal < total;

    res.json({
      success: true,
      users: usersThisPage,
      page,
      limit,
      total,
      hasMore
    });
  } catch (error) {
    console.error('Erro em getUsersForNewMessage:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};

module.exports = getUsersForNewMessage;