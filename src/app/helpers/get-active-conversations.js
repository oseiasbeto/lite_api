const Conversation = require('../models/Conversation');

async function getActiveConversations(userId, limit = 50) {

    return await Conversation.find({
        participants: userId,
        'last_message.content': { $ne: '' }
    })
        .select('_id type name participants')
        .limit(limit) // Limite para não sobrecarregar
        .lean();
}
module.exports = getActiveConversations;