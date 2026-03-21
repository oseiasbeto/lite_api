// Importa o modelo User para interagir com o banco de dados
const User = require('../../../models/User');
const moment = require('moment');
const bcrypt = require('bcryptjs');

const resetPassword = async (req, res) => {
    try {

        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ message: "O e-mail, codigo, e a nova senha são obrigatórios." });
        }

        const user = await User.findOne({ email: email, reset_password_code: code });
        
        // Verifica se o usuário existe e se o token é válido
        if (!user) {
            return res.status(400).json({ message: "Algo deu errado." });
        }

        // Gera um salt para a criptografia da nova senha
        const salt = await bcrypt.genSalt(10);
        // Criptografa a nova senha do usuário
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Atualiza a senha do usuário no banco de dados
        user.password = hashedPassword;
        user.reset_password_code = undefined;
        
        // Salva as alterações no banco de dados
        await user.save();

        // Retorna uma resposta de sucesso
        return res.status(200).json({message: "Senha redefinida com sucesso." });
    } catch (error) {
        // Captura erros e retorna uma resposta de erro interno do servidor
        console.log("Erro ao redefinir a senha: "+error.message)
        return res.status(500).json({ message: "Erro ao redefinir a senha" });
    }
};

// Exporta a função para ser utilizada em outras partes do sistema
module.exports = resetPassword;
