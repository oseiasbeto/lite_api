const mongoose = require("mongoose");
const {randomUUID} = require("crypto")

// Definindo o schema da sessão de usuário
const session = new mongoose.Schema(
    {
        // ID da sessão, gerado automaticamente com base no timestamp atual
        id: {
            type: String,
            default: () => randomUUID(), // O ID é baseado no timestamp para garantir unicidade
        },

        // Token gerado para a sessão, geralmente utilizado para autenticação
        token: {
            type: String,
            required: true, // O token é obrigatório para a sessão
        },

        // Informações criptográficas para proteger os dados da sessão
        crypto: {
            // Vetor de inicialização (IV) usado para criptografar os dados
            iv: {
                type: String,
                default: null, // Inicialmente sem valor, mas pode ser preenchido com dados criptografados
            },
            // Chave secreta usada para criptografar os dados
            key: {
                type: String,
                default: null, // Inicialmente sem valor, mas pode ser preenchido conforme necessário
            },
        },

        // Status da sessão, que pode ser 'a' (ativa) ou 'd' (desativada)
        status: {
            type: String,
            enum: ["active", "inactive"], // Enum para garantir que só valores válidos sejam aceitos
            default: "active", // A sessão começa como ativa
        },

        // ID do usuário associado a essa sessão
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Referência ao modelo de 'User' (usuário), para associar a sessão ao usuário específico
            required: true, // O ID do usuário é obrigatório para vincular a sessão ao usuário
        },

        // Data de expiração da sessão, útil para expirar automaticamente a sessão após um tempo
        expires_at: {
            type: Date, // A data de expiração é armazenada como um objeto de data
            required: true, // A data de expiração é obrigatória
        },

        // Agente do usuário (informações sobre o navegador ou dispositivo que está sendo usado)
        user_agent: {
            type: String,
            required: true, // O agente do usuário é obrigatório para registrar o navegador ou dispositivo usado
        },

        // Endereço IP do usuário que iniciou a sessão
        ip_address: {
            type: String,
            required: true, // O endereço IP é obrigatório para identificar a origem da sessão
        },

        // A data e hora da última vez que a sessão foi acessada
        last_accessed: {
            type: Date,
            default: Date.now(), // A data é atualizada automaticamente com o momento atual
        },

        // Impressão digital única do dispositivo, útil para rastrear o mesmo dispositivo em acessos diferentes
        device_finger_print: {
            type: String, // Uma string única gerada a partir de vários parâmetros do dispositivo
        },

        // Método de autenticação utilizado para criar a sessão, por exemplo: "google", "email", "sms", etc.
        authentication_method: {
            type: String,
            default: "email", // O método padrão é "email", mas pode ser alterado para outros métodos, como redes sociais
        },
    },
    {
        timestamps: true, // Adiciona os campos 'createdAt' e 'updatedAt' automaticamente ao documento
    }
);

// Exporta o modelo para uso em outras partes da aplicação
module.exports = mongoose.model("Session", session);
