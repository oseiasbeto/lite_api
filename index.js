
const { app } = require("./src/app")
const http = require('http');
const { initializeSocket } = require('./src/app/services/socket');
const server = http.createServer(app);

const PORT = process.env.PORT;

// Inicializa o Socket.IO
const io = initializeSocket(server);

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta: ${PORT}`);
});