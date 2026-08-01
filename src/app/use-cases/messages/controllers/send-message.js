// controllers/messageController.js
const Message = require('../../../models/Message');
const Conversation = require('../../../models/Conversation')
const User = require('../../../models/User')
const { emitToUser } = require("../../../services/socket");
const sendPushNotification = require("../../../services/send-push-notification");
const { scheduleGroupedPush } = require("../../../services/notification-debouncer");

const MAX_VOICE_DURATION = 60; // segundos

const buildMessagePreview = (senderName, message_type, content) => {
  switch (message_type) {
    case 'photo':
      return `${senderName} enviou uma foto`;
    case 'video':
      return `${senderName} enviou um vídeo`;
    case 'voice':
      return `${senderName} enviou uma mensagem de voz`;
    case 'sticker':
      return `${senderName} enviou um sticker`;
    default:
      return content?.length > 100 ? `${content.substring(0, 100)}…` : (content || `${senderName} enviou uma mensagem`);
  }
};

const sendMessage = async (req, res) => {
  try {
    const { convId, content, source, message_type = 'text', reply_to, file_url, file_thumb, file_duration, file_size, file_width, file_height } = req.body;
    const senderId = req.user.id;

    console.log(req.body)

    if (message_type === 'voice') {
      if (!file_url) {
        return res.status(400).json({ message: "URL do áudio é obrigatória" });
      }
    }

    const conversation = await Conversation.findById(convId)
      .populate({
        path: 'participants',
        populate: {
          path: 'user',
          select: 'name is_verified profile_image socket_id is_online last_seen player_id_onesignal notification_settings'
        }
      });

    if (!conversation) {
      return res.status(404).json({ message: "Conversa não encontrada" });
    }

    const senderInConversation = conversation.participants.some(
      p => p?.user?._id.toString() === senderId.toString()
    );

    if (!senderInConversation) {
      return res.status(403).json({ message: "Você não faz parte desta conversa" });
    }

    // --- CORREÇÃO: Seleciona o outro participante de forma direta e segura ---
    // Para conversas diretas, sempre será o participante que não é o remetente.
    // Para grupos, essa variável não é usada para nome/avatar (usa os dados do grupo).
    const otherParticipant = conversation.participants.find(
      p => p?.user?._id.toString() !== senderId.toString()
    );
    // --- FIM DA CORREÇÃO ---

    let originalMessageReplyTo = null;

    if (reply_to) {
      originalMessageReplyTo = await Message.findById(reply_to)
        .populate('sender', 'name username profile_image is_verified activity_status');
    }

    const message = await Message.create({
      conversation: convId,
      sender: senderId,
      content,
      message_type,
      file_url,
      file_thumb,
      file_duration,
      file_width, 
      file_height,
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
          select: 'name username profile_image is_online is_verified'
        })
        .populate({
          path: "reactions",
          populate: {
            path: "user",
            select: 'name username profile_image is_verified is_online'
          }
        });
    } else populatedMessage = null;

    const previewText = content ? content
      : message_type === 'photo' ? 'Foto'
        : message_type === 'video' ? 'Vídeo'
          : message_type === 'voice' ? 'Mensagem de voz'
          : message_type === 'gif' ? 'GIF'
            : message_type === 'sticker' ? '🎭 Sticker' : '[Mídia]';

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

    updateData.$set[`unread_count.${senderId}`] = 0;

    const participantsToNotify = [];

    conversation.participants.forEach(participant => {
      const userId = participant?.user?._id.toString();
      if (userId === senderId.toString()) return;

      participantsToNotify.push({
        userId,
        user: participant.user,
        isOnline: participant?.user?.is_online || false
      });

      updateData.$inc = updateData.$inc || {};
      updateData.$inc[`unread_count.${userId}`] = 1;
    });

    const updatedConversation = await Conversation.findOneAndUpdate(
      { _id: convId },
      updateData,
      { new: true, runValidators: true }
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
      file_height: populatedMessage.file_height,
      file_width: populatedMessage.file_width,
      created_at: populatedMessage.created_at,
      reply_to: originalMessageReplyTo ? originalMessageReplyTo : null
    };

    // 7. Notifica os participantes
    const notificationPromises = [];

    const senderName = populatedMessage?.sender?.name || 'Alguém';
    const messagePreview = buildMessagePreview(senderName, message_type, populatedMessage.content);
    const isGroupConversation = updatedConversation.type !== 'direct';
    const convTitle = isGroupConversation
      ? (updatedConversation.name || 'Grupo')
      : senderName;

    for (const participant of participantsToNotify) {
      notificationPromises.push(
        User.updateOne(
          { _id: participant.userId },
          { $inc: { unread_messages_count: 1 } }
        )
      );

      if (participant.isOnline) {
        emitToUser(participant.userId, 'new_message', messageToSend);
        continue;
      }

      const notificationsEnabled = participant.user?.notification_settings?.messages !== false;
      const hasPushToken = !!participant.user?.player_id_onesignal;

      if (notificationsEnabled && hasPushToken) {

        const basePushData = {
          playerId: participant.user.player_id_onesignal.toString(),
          userId: participant.userId,
          ...(populatedMessage?.sender?.profile_image?.thumbnails?.push_notification && {
            largeIcon: populatedMessage?.sender?.profile_image?.thumbnails?.push_notification
          }),
          data: {
            type: 'new_message',
            source
          }
        };

        // Em vez de enviar direto, agenda no debouncer —
        // ele decide sozinho se manda já, agrupado, ou espera mais um pouco
        scheduleGroupedPush({
          userId: participant.userId,
          convId: updatedConversation._id.toString(),
          convTitle,
          senderName,
          messagePreview,
          isGroup: isGroupConversation,
          basePushData,
          sendFn: sendPushNotification
        });
      }
    }

    res.status(201).json({
      message: "Mensagem enviada com sucesso",
      data: messageToSend
    });

    await Promise.all(notificationPromises);

  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return res.status(500).json({ message: "Erro interno", error: error.message });
  }
};

module.exports = sendMessage;