// controllers/messageController.js
const Message = require('../../../models/Message');
const Conversation = require('../../../models/Conversation')
const { emitToUser } = require("../../../services/socket");
const sendPushNotification = require("../../../services/send-push-notification");

const sendMessage = async (req, res) => {
  try {
    const { convId, content, source, message_type = 'text', reply_to, file_url, file_thumb, file_duration, file_size } = req.body;
    const senderId = req.user.id;

    // 1. Busca a conversa + participantes com socket_id
    const conversation = await Conversation.findById(convId)
      .populate({
        path: 'participants',
        populate: {
          path: 'user',
          select: 'name is_verified profile_image socket_id is_online last_seen'
        }
      });

    if (!conversation) {
      return res.status(404).json({ message: "Conversa não encontrada" });
    }

    // Verifica se o usuário está na conversa
    const senderInConversation = conversation.participants.some(
      p => p?.user?._id.toString() === senderId.toString()
    );

    if (!senderInConversation) {
      return res.status(403).json({ message: "Você não faz parte desta conversa" });
    }

    const isFirstMessage = conversation?.last_message?.content === '' ? true : false

    const otherParticipant = isFirstMessage ? conversation.participants.find(p => p?.user?._id.toString() === senderId)
      : conversation.participants.find(p => p?.user?._id.toString() !== senderId.toString())
      
    let originalMessageReplyTo = null

    if (reply_to) {
      originalMessageReplyTo = await Message.findById(reply_to)
        .populate('sender', 'name username profile_image is_verified activity_status')
    }

    // 2. Cria a mensagem (agora com conversation!)
    const message = await Message.create({
      conversation: convId,
      sender: senderId,
      content,
      message_type,
      file_url,
      file_thumb,
      file_duration,
      file_size,
      ...(originalMessageReplyTo && {
        reply_to: originalMessageReplyTo?._id
      })
    });

    let populatedMessage;
    if (message) {
      populatedMessage = await Message.findById(message._id)
        .populate({
          path: 'sender',
          select: 'name username profile_image.url is_online is_verified'
        })
        .populate({
          path: "reactions",
          populate: {
            path: "user",
            select: 'name username profile_image is_verified is_online'
          }
        })
    } else populatedMessage = null


    // 3. Atualiza last_message da conversa
    const previewText = content ? content
      : message_type === 'photo' ? '📷 Foto'
        : message_type === 'video' ? '🎥 Vídeo'
          : message_type === 'voice' ? '🎤 Mensagem de voz'
            : message_type === 'sticker' ? '🎭 Sticker' : '[Mídia]';

    conversation.last_message = {
      msg_id: message._id,
      sender: senderId,
      content: previewText,
      message_type,
      created_at: message.created_at
    };


    const messageToSend = {
      _id: populatedMessage._id,
      conversation: {
        _id: conversation._id,
        type: conversation.type,
        name: conversation.type === 'direct' ? otherParticipant?.user?.name || 'Usuário' : conversation.name,
        avatar: conversation.type === 'direct' ? otherParticipant?.user?.profile_image?.url : conversation.avatar,
        is_online: conversation.type === 'direct' ? otherParticipant?.user?.is_online : false,
        last_seen: conversation.type === 'direct' ? otherParticipant?.user?.last_seen : null,
        last_message: conversation.last_message ? {
          content: conversation.last_message.content || '[Foto]',
          created_at: conversation.last_message.created_at
        } : null,
        participants: conversation.participants || [],
        read_by: conversation.read_by || [],
        archived_by: conversation.archived_by || [],
        deleted_by: conversation.deleted_by || [],
        pinned: conversation.pinned,
        muted: !!conversation.muted_until
      },
      sender: {
        _id: populatedMessage?.sender?._id,
        name: populatedMessage?.sender?.name,
        username: populatedMessage?.sender?.username,
        profile_image: populatedMessage?.sender?.profile_image,
        is_verified: populatedMessage?.sender?.is_verified,
        is_online: populatedMessage?.sender?.is_online
      },
      source,
      content: populatedMessage.content,
      status: populatedMessage.status,
      deleted_for: populatedMessage.deleted_for,
      message_type: populatedMessage.message_type,
      reactions: populatedMessage.reactions,
      file_url: populatedMessage.file_url,
      file_thumb: populatedMessage.file_thumb,
      file_duration: populatedMessage.file_duration,
      created_at: populatedMessage.created_at,
      reply_to: originalMessageReplyTo ? originalMessageReplyTo : null
    };

    conversation.participants.forEach(participant => {
      if (participant?.user?._id.toString() === senderId.toString()) return;

      const current = conversation.unread_count.get(participant?.user?._id.toString()) || 0;
      conversation.unread_count.set(participant?.user?._id.toString(), current + 1);

      if (participant?.user?.is_online) {
        emitToUser(participant?.user?._id.toString(), 'new_message', messageToSend)
      }
    });

    conversation.unread_count.set(senderId, 0);

    conversation.read_by = []

    await conversation.save();


    console.log(senderId)
    return res.status(201).json({
      message: "Mensagem enviada com sucesso",
      data: {
        ...messageToSend
      }
    });

  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return res.status(500).json({ message: "Erro interno", error: error.message });
  }
};

module.exports = sendMessage;