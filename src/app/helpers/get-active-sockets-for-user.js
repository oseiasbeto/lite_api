async function getActiveSocketsForUser(userId) {
  try {
    const User = require('./User')
    const { getIO } = require('../services/socket')
    const io = getIO()
    
    // Primeiro, busca pelo socket_id salvo no usuário
    const user = await User.findById(userId).select('socket_id')
    const sockets = []
    
    if (user?.socket_id) {
      sockets.push(user.socket_id)
    }
    
    // Também verifica todos sockets conectados
    io.sockets.sockets.forEach((socket, socketId) => {
      if (socket.userId === userId && !sockets.includes(socketId)) {
        sockets.push(socketId)
      }
    })
    
    return sockets
  } catch (error) {
    console.error('Erro ao buscar sockets do usuário:', error)
    return []
  }
}

module.exports = getActiveSocketsForUser