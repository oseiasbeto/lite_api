// Importa a classe Server do socket.io para criar um servidor WebSocket
const { Server } = require('socket.io');

const moment = require("moment")

// Importa o módulo jsonwebtoken para verificar tokens JWT
const jwt = require('jsonwebtoken');

// Importa o modelo de usuário do banco de dados (Mongoose)
const User = require('../models/User');

let io;

// Função para inicializar o servidor WebSocket
const initializeSocket = (server) => {
    // Cria uma instância do servidor WebSocket e o associa ao servidor HTTP
    io = new Server(server, {
        cors: {
            origin: ['http://192.168.1.129:8080', 'https://www.1kole.com', 'https://1kole.com', 'http://localhost:8080', 'https://mekieapp-app.vercel.app/'], // Permite conexões apenas do frontend rodando em localhost:8080
            methods: ['GET', 'POST'],        // Permite apenas os métodos GET e POST nas requisições WebSocket
            credentials: true                // Permite envio de cookies e credenciais junto à requisição
        }
    });

    // Middleware de autenticação para validar o token JWT antes de permitir a conexão
    io.use((socket, next) => {
        const token = socket.handshake.auth.token; // Obtém o token enviado pelo handshake do socket
        if (token) {
            // Verifica a validade do token utilizando a chave secreta
            jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) return next(new Error('Autenticação inválida')); // Se o token for inválido, rejeita a conexão
                socket.userId = decoded.id; // Se o token for válido, armazena o ID do usuário no socket
                next(); // Prossegue com a conexão
            });
        } else {
            next(new Error('Token não fornecido')); // Rejeita a conexão caso o token não seja enviado
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.userId;
        socket.join(userId)

        console.log('Usuário conectado:', userId, socket.id);

        let offlineTimer; // ← agora está fora do escopo

        // Função para agendar a verificação de offline
        const scheduleOfflineCheck = () => {
            clearTimeout(offlineTimer);
            offlineTimer = setTimeout(async () => {
                const user = await User.findById(userId);
                if (!user) return;

                const secondsSinceLastSeen = (Date.now() - new Date(user.last_seen)) / 1000;
                if (secondsSinceLastSeen > 25) {
                    await User.findByIdAndUpdate(userId, {
                        is_online: false,
                        socket_id: null,
                        last_seen: new Date()
                    });
                    console.log(`Usuário ${userId} marcado como offline`);
                    socket.broadcast.emit('user_offline', userId);

                    clearTimeout(offlineTimer);
                }
            }, 30_000);
        };

        // Marca o usuário como online ao conectar
        try {
            await User.findByIdAndUpdate(userId, {
                is_online: true,
                socket_id: socket.id,
                last_seen: new Date()
            });

            socket.broadcast.emit('user_online', userId);

            // Agenda o primeiro timer
            scheduleOfflineCheck();

            // A cada heartbeat → atualiza last_seen e REAGENDA o timer
            socket.on('heartbeat', () => {
                console.log("Ping de", userId);
                User.updateOne({ _id: userId }, { last_seen: new Date() }).catch(() => { });
                scheduleOfflineCheck(); // ← ESSA LINHA É A CHAVE
            });

            // Quando usuário começa a digitar
            socket.on('typing_start', async ({conv, reciverId, source}) => {

                console.log(`Usuário ${userId} começou a digitar na conversa ${conv?._id}`);

                socket.to(reciverId?.toString()).emit('user_typing_start', {
                    userId: userId,
                    conv: conv,
                    isTyping: true,
                    source
                });

                console.log(`Emitindo typing_start para conversa ${conv?._id}`);
            });

            // Quando usuário para de digitar
            socket.on('typing_stop', async ({conv, reciverId, source}) => {

                console.log(`Usuário ${userId} parou de digitar na conversa ${conv?._id}`);

                socket.to(reciverId?.toString()).emit('user_typing_stop', {
                    userId: userId,
                    conv: conv,
                    isTyping: true,
                    source
                });

                console.log(`Emitindo typing_stop para conversa ${conv?._id}`);
            });

            socket.on('disconnect', () => {
                console.log("Usuário desconectado:", userId)
            });

        } catch (err) {
            console.error('Erro na conexão socket:', err);
            socket.disconnect();
        }
    });

    return io; // Retorna a instância do servidor WebSocket para ser usada em outras partes do sistema
};

// Função para acessar a instância io em outros módulos
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO não inicializado!');
    }
    return io;
};

// Função auxiliar para emitir para uma sala (útil para outros controllers)
const emitToRoom = (roomId, event, data) => {
    if (io) {
        io.to(roomId).emit(event, data);
    }
};

// Função auxiliar para emitir para um usuário específico (para compatibilidade)
const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(userId).emit(event, data);
    }
};

// Exporta a função initializeSocket para ser utilizada em outros arquivos do projeto
module.exports = { initializeSocket, getIO, emitToRoom, emitToUser };
