// controllers/messageController.js
const Message = require('../../../models/Message');
const Conversation = require('../../../models/Conversation')
const User = require('../../../models/User')
const { emitToUser } = require("../../../services/socket");
const sendPushNotification = require("../../../services/send-push-notification");

const MAX_VOICE_DURATION = 60; // segundos

const sendMessage = async (req, res) => {
  try {
    const { convId, content, source, message_type = 'text', reply_to, file_url, file_thumb, file_duration, file_size } = req.body;
    const senderId = req.user.id;

    // Validação simples pra voz (não interfere no resto)
    if (message_type === 'voice') {
      if (!file_url) {
        return res.status(400).json({ message: "URL do áudio é obrigatória" });
      }
      if (file_duration && file_duration > MAX_VOICE_DURATION) {
        return res.status(400).json({ message: "Áudio excede o limite de 1 minuto" });
      }
    }

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

    const isFirstMessage = conversation?.last_message?.content === '' ? true : false;

    const otherParticipant = isFirstMessage ? conversation.participants.find(p => p?.user?._id.toString() === senderId)
      : conversation.participants.find(p => p?.user?._id.toString() !== senderId.toString());

    let originalMessageReplyTo = null;

    if (reply_to) {
      originalMessageReplyTo = await Message.findById(reply_to)
        .populate('sender', 'name username profile_image is_verified activity_status');
    }

    // 2. Cria a mensagem
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
        });
    } else populatedMessage = null;

    // 3. Prepara o preview da mensagem
    const previewText = content ? content
      : message_type === 'photo' ? '📷 Foto'
        : message_type === 'video' ? '🎥 Vídeo'
          : message_type === 'voice' ? '🎤 Mensagem de voz'
            : message_type === 'sticker' ? '🎭 Sticker' : '[Mídia]';

    // 4. Prepara o objeto de atualização atômica
    const updateData = {
      $set: {
        'last_message': {
          msg_id: message._id,
          sender: senderId,
          content: previewText,
          message_type,
          created_at: message.created_at
        },
        'read_by': []
      }
    };

    // Adiciona o unread_count do sender como 0
    updateData.$set[`unread_count.${senderId}`] = 0;

    // Prepara os incrementos para os outros participantes
    const participantsToNotify = [];
    const participantsToUpdate = [];

    conversation.participants.forEach(participant => {
      const userId = participant?.user?._id.toString();
      if (userId === senderId.toString()) return;

      participantsToUpdate.push(userId);
      participantsToNotify.push({
        userId,
        user: participant.user,
        isOnline: participant?.user?.is_online || false
      });

      // Incrementa unread_count para este participante
      updateData.$inc = updateData.$inc || {};
      updateData.$inc[`unread_count.${userId}`] = 1;
    });

    // 5. Atualiza a conversa atomicamente
    const updatedConversation = await Conversation.findOneAndUpdate(
      { _id: convId },
      updateData,
      { 
        new: true, // Retorna o documento atualizado
        runValidators: true
      }
    ).populate({
      path: 'participants',
      populate: {
        path: 'user',
        select: 'name is_verified profile_image socket_id is_online last_seen'
      }
    });

    if (!updatedConversation) {
      return res.status(404).json({ message: "Conversa não encontrada ao atualizar" });
    }

    // 6. Prepara a mensagem para enviar aos clientes
    const messageToSend = {
      _id: populatedMessage._id,
      conversation: {
        _id: updatedConversation._id,
        type: updatedConversation.type,
        name: updatedConversation.type === 'direct' ? otherParticipant?.user?.name || 'Usuário' : updatedConversation.name,
        avatar: updatedConversation.type === 'direct' ? otherParticipant?.user?.profile_image?.url : updatedConversation.avatar,
        is_online: updatedConversation.type === 'direct' ? otherParticipant?.user?.is_online : false,
        last_seen: updatedConversation.type === 'direct' ? otherParticipant?.user?.last_seen : null,
        last_message: updatedConversation.last_message ? {
          content: updatedConversation.last_message.content || '[Foto]',
          created_at: updatedConversation.last_message.created_at
        } : null,
        participants: updatedConversation.participants || [],
        read_by: updatedConversation.read_by || [],
        archived_by: updatedConversation.archived_by || [],
        deleted_by: updatedConversation.deleted_by || [],
        pinned: updatedConversation.pinned,
        muted: !!updatedConversation.muted_until
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

    // 7. Notifica os participantes e atualiza contadores de forma assíncrona
    const notificationPromises = [];

    for (const participant of participantsToNotify) {
      // Atualiza o contador de mensagens não lidas do usuário
      notificationPromises.push(
        User.updateOne(
          { _id: participant.userId },
          { $inc: { unread_messages_count: 1 } }
        )
      );

      // Envia a mensagem em tempo real se estiver online
      if (participant.isOnline) {
        emitToUser(participant.userId, 'new_message', messageToSend);
      } else {
        // Envia push notification (se implementado)
        // await sendPushNotification(participant.userId, messageToSend);
        // [TODO] Implementar push notification
      }
    }

    // Aguarda todas as atualizações de contador (não bloqueia a resposta)
    await Promise.all(notificationPromises);

    return res.status(201).json({
      message: "Mensagem enviada com sucesso",
      data: messageToSend
    });

  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return res.status(500).json({ message: "Erro interno", error: error.message });
  }
};

module.exports = sendMessage;