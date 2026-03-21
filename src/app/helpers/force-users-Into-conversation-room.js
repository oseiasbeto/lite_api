async function forceUsersIntoConversationRoom(conversationId, userIds) {
    try {
        // Importa getIO aqui para evitar dependências circulares
        const { getIO } = require('../services/socket')
        const User = require('../models/User')

        // Pega instância do Socket.io
        const io = getIO()

        for (const userId of userIds) {
            // Busca usuário para pegar socket_id atual
            const user = await User.findById(userId).select('socket_id')

            if (user?.socket_id) {
                const socket = io.sockets.sockets.get(user.socket_id)
                if (socket) {

                    // Entra na sala
                    socket.join(conversationId.toString())
                    console.log(`✅ Usuário ${userId} entrou na sala ${conversationId}`)

                    // Emite evento confirmando
                    socket.emit('conversation_auto_joined', {
                        conversationId: conversationId.toString(),
                        timestamp: new Date()
                    })
                }
            }
        }


        /* 
        // Adiciona à cache de salas ativas
        const { conversationCache } = require('../../../services/socket')
        conversationCache.set(conversationId.toString(), {
          participants: userIds,
          lastActivity: new Date()
        })
        */
    } catch (error) {
        console.error('Erro ao forçar usuários na sala:', error)
        throw error
    }
}

module.exports = forceUsersIntoConversationRoom