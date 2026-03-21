// Importa getIO aqui para evitar dependências circulares
const { getIO } = require('../services/socket')
// Para cada userId, força o join na sala da conversa
const User = require('../models/User')


async function ensureUsersInConversationRoom(conversationId, userId) {
    try {
        // Pega instância do Socket.io
        const io = getIO()

        // Busca usuário para pegar socket_id atual
        const user = await User.findById(userId).select('socket_id')

        // Se tiver socket_id, força o join na sala
        if (user?.socket_id) {

            // Pega o socket pela ID
            const socket = io.sockets.sockets.get(user.socket_id)

            // Se o socket existir e não estiver na sala, faz o join
            if (socket && !socket.rooms.has(conversationId.toString())) {

                socket.join(conversationId.toString())

                // Log para debug
                console.log(`Usuário ${userId} na conversa ${conversationId}`)
            }
        }
    } catch (error) {
        console.error('Erro ao garantir usuários na sala:', error)
    }
}

module.exports = ensureUsersInConversationRoom  