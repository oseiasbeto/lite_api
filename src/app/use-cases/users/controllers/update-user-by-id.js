// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const User = require("../../../models/User");


const updateUserById = async (req, res) => {
    try {
        const { id } = req.user;
        const { playerIdOneSignal } = req.body

        
        if (!id) {
            return res.status(400).json({ message: "O id e obrigatorio." });
        }

        const user = await User.findById(id)
        if (!user) {
            return res.status(404).json({ message: "Usuario nao encontrado" });
        } else {           
            user.player_id_onesignal = playerIdOneSignal
            await user.save()

            return res.status(200).json({
                user,
                message: "Usuario actualizado com sucesso.",
            });
        }
    } catch (err) {
        // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
        console.error("Erro ao actualizar o usuario pelo ID:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = updateUserById;
