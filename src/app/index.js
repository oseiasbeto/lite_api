// Importando as bibliotecas necessárias
require('dotenv').config() // Carrega variáveis de ambiente do arquivo .env
const path = require("path") // Módulo nativo do Node.js para manipulação de caminhos de arquivos/diretórios
const cors = require("cors") // Middleware para habilitar CORS (Cross-Origin Resource Sharing)
const express = require("express") // Framework web para Node.js
const app = express() // Criando uma instância do Express
const bodyParser = require('body-parser') // Middleware para processar dados do corpo da requisição

// Conectando ao banco de dados
const connectDB = require('./config/connect-db'); // Importa a função de conexão com o banco de dados
connectDB(); // Chama a função para estabelecer a conexão

// Configuração dos middlewares
app.use(cors()) // Habilita CORS para permitir requisições de diferentes domínios
app.use(express.json()) // Permite o recebimento de JSON no corpo das requisições
app.use(bodyParser.urlencoded({ extended: true })); // Configura o body-parser para processar dados codificados na URL

// Servindo arquivos estáticos da pasta 'uploads'
app.use("/files", express.static(path.resolve(__dirname, "..", "uploads")))

// Importando as rotas do aplicativo
const auth = require("./use-cases/auth/auth.routes")
const users = require("./use-cases/users/users.routes")
const messages = require("./use-cases/messages/messages.routes")
const notifications = require("./use-cases/notifications/notifications.routes")
const conversations = require("./use-cases/conversations/conversations.routes")
const posts = require("./use-cases/posts/posts.routes")
const comments = require("./use-cases/comments/comments.routes")
const topics = require("./use-cases/topics/topics.routes")

// Registrando as rotas no aplicativo
app.use("/v1/auth", auth) // Rotas de autenticação
app.use("/v1/users", users) // Rotas de usuários
app.use("/v1/messages", messages) // Rotas de mensagens
app.use("/v1/conversations", conversations) // Rotas de conversacao
app.use("/v1/notifications", notifications)
app.use("/v1/posts", posts) // Rotas de posts
app.use("/v1/comments", comments) // Rotas de comentarios
app.use("/v1/topics", topics) 

// Rota de boas-vindas
app.get("/", (req, res) => {
    res.json({
        message: "🚀 Bem-vindo à API da 1kole!", // Mensagem de boas-vindas
        status: "running" // Indica que a API está rodando
    });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack); // Exibe o erro no console para facilitar o debug

    // Retorna uma resposta de erro para o cliente
    res.status(500).json({
        message: 'Ocorreu um erro interno, por favor tente novamente mais tarde.', // Mensagem genérica para o usuário
        error: process.env.NODE_ENV === 'dev' ? err : {} // Exibe detalhes do erro apenas em ambiente de desenvolvimento
    });
});

// Exportando a instância do Express para ser utilizada em outros módulos
module.exports = { app }
