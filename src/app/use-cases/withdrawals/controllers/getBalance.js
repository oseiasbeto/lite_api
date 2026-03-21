// Importa o modelo de Usuário
const User = require("../../../models/User");

// Controlador para obter o saldo do usuário
const getBalance = async (req, res) => {
    try {
        // Busca o usuário pelo ID e retorna o saldo
        const user = await User.findById(req.user.id).select('balance');

        // Verifica se o usuário existe
        if (!user) {
            return res.status(404).json({ msg: "Usuário não encontrado" });
        }

        // Retorna o saldo do usuário
        res.json({ balance: user.balance });
        
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: "Erro ao buscar saldo" });
    }
};

// Exporta o controlador
module.exports = getBalance;