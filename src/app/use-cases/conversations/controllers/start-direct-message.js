// controllers/conversation/startDirectMessage.js
const Conversation = require('../../../models/Conversation')
const User = require('../../../models/User')
const mongoose = require("mongoose")
const ensureUsersInConversationRoom = require("../../../helpers/ensure-usersIn-conversation-room")

const startDirectMessage = async (req, res) => {
  try {
    const { userId: otherUserId } = req.body // ID do outro usuário
    const currentUserId = req.user.id // ID do usuário atual (autenticado)  

    // Validação básica
    if (!otherUserId || otherUserId === currentUserId.toString()) {
      return res.status(400).json({ message: "Usuário inválido" })
    }

    const currentUser = await User.findById(currentUserId).select("socket_id is_online")
    if (!currentUser) return res.status(401).json({ message: "Usuario nao encontrado." })

    // Busca ou cria a conversa direta
    let conversation = await Conversation.findOne({
      type: 'direct',
      $and: [
        {
          participants: {
            $elemMatch: {
              user: currentUserId,
              status: 'accepted'
            }
          }
        },
        {
          participants: {
            $elemMatch: {
              user: otherUserId,
              status: 'accepted'
            }
          }
        }
      ]
    })
      .populate([
        {
          path: 'participants',
          populate: {
            path: 'user',
            select: 'name profile_image is_online last_seen socket_id username'
          }
        },
        { path: 'last_message.sender', select: 'name' }
      ])

    // 2. Se não existe, cria nova conversa
    if (!conversation) {


      conversation = await Conversation.create({
        type: 'direct',
        participants: [
          {
            user: currentUserId,
            role: 'admin',
            status: 'accepted'
          },
          {
            user: otherUserId,
            role: 'admin',
            status: 'accepted' // [TODO] verificar se o usuario tem um setting de pedido de mensagens activo
          },
        ],
        member_count: 2,
        last_message: {
          sender: currentUserId,
          content: "",
          message_type: "system",
          created_at: Date.now()
        }
      })

      // Popula dados
      conversation = await Conversation.findById(conversation._id)
        .populate([
          {
            path: 'participants',
            populate: {
              path: 'user',
              select: 'name profile_image is_online last_seen socket_id username'
            }
          },
          { path: 'last_message.sender', select: 'name' }
        ])

      console.log(`Nova conversa criada: entre ${currentUserId} e ${otherUserId}`)
    }

    // 6. Formata resposta
    const participant = conversation?.participants?.find(p => p?.user?._id.toString() !== currentUserId.toString()) || null

    const formattedConversation = {
      _id: conversation?._id,
      type: conversation?.type,
      name: participant?.user?.name || participant?.user?.username,
      username: participant?.user?.username || participant?.user?.name,
      avatar: participant?.user?.profile_image?.url,
      is_online: participant?.user?.is_online || false,
      last_seen: participant?.user?.last_seen || null,
      socket_id: participant?.user?.socket_id || null,
      last_message: conversation?.last_message ? {
        content: conversation?.last_message?.content,
        message_type: conversation?.last_message?.message_type,
        created_at: conversation?.last_message?.created_at
      } : null,
      unread_count: conversation?.unread_count?.get?.(currentUserId.toString()) || 0,
      pinned: conversation?.pinned || false,
      muted: !!conversation?.muted_until,
      participants: conversation?.participants
    }

    // Se já existe, garante que ambos estão na sala
    await ensureUsersInConversationRoom(conversation?._id, currentUserId)
    await ensureUsersInConversationRoom(conversation?._id, otherUserId)

    return res.status(200).json({
      message: conversation?.createdAt ? "Conversa iniciada" : "Conversa encontrada",
      conversation: formattedConversation,
      is_new: !conversation?.created_at
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: "Erro ao iniciar conversa" })
  }
}

module.exports = startDirectMessage