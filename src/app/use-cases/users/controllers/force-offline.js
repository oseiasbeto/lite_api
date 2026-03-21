// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const User = require("../../../models/User");


const forceOffline = async (req, res) => {
    try {
        const { id } = req.params;

        console.log("acionou o force")
        // Verifica se o token foi enviado na requisição
        if (!id) {
            return res.status(400).json({ message: "O id e obrigatorio." });
        }

        const user = await User.findOne({ _id: id }).select(
            "socket_id is_online"
        );

        if (!user) {
            return res.status(404).json({ message: "Usuario nao encontrado" });
        } else {
            await user.updateOne({
                $set: {
                    is_online: false,
                    socket_id: null,
                    last_seen: Date.now()
                }
            })

            console.log(user)
            return res.status(200).json({
                user,
                message: "Usuario descativado com sucesso.",
            });
        }
    } catch (err) {
        // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
        console.error("Erro ao desactivar o usuario pelo ID:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = forceOffline;
