// Importa o modelo de Sessão para realizar operações no banco de dados
const Session = require("../../../models/Session");

const logout = async (req, res) => {
    try {
        const { sessionId } = req.body; // Obtém o ID da sessão a partir dos parâmetros da URL

        // Verifica se o ID foi fornecido na requisição
        if (!sessionId) {  // Condição mais limpa, verificando qualquer valor inválido
            return res.status(400).send({  // Retorna erro 400 para dados inválidos
                message: "Informe o id da sessão."
            });
        }

        // Busca a sessão no banco de dados usando o ID fornecido
        const session = await Session.findOne({
            id: sessionId // Corrigido para _id, pois é o campo correto no MongoDB
        });

        // Verifica se a sessão foi encontrada
        if (!session) {
            return res.status(404).send({  // Status 404 é mais adequado quando o recurso não é encontrado
                message: "Ups! Não achamos nenhuma sessão com este id."
            });
        }

        // Se a sessão foi encontrada, deletamos a sessão
        await session.deleteOne(); // Exclui a sessão do banco de dados

        // Retorna uma resposta de sucesso
        return res.status(200).send({
            message: "Sessão encerrada com sucesso!"
        });
    } catch (err) {
        console.log(err.message);  // Registra o erro no console para depuração

        // Se ocorrer um erro no servidor, retornamos o status 500
        return res.status(500).send({  // Alterei para 500 para indicar erro no servidor
            message: "Erro interno do servidor. Por favor, tente novamente mais tarde."
        });
    }
};

module.exports = logout;
