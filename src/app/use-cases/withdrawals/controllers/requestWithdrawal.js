// Importa o modelo de Usuário
const User = require("../../../models/User");

// Controlador para solicitar um saque
const requestWithdrawal = async (req, res) => {
    const { amount } = req.body; // Valor a ser sacado
    try {
        const user = await User.findById(req.user.id);

        // Verifica se o usuário existe
        if (user.balance < 30000) return res.status(400).json({ msg: 'Balance below minimum (30,000 Kz)' });

        // Verifica se o valor é válido
        if (amount > user.balance || amount < 30000) return res.status(400).json({ msg: 'Invalid amount' });

        // Check if it's end of month (last day)
        const now = new Date();

        // Verifica se é o último dia do mês
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        if (now.getDate() !== lastDayOfMonth) return res.status(400).json({ msg: 'Withdrawals only at end of month' });

        // Processa o saque
        user.balance -= amount;
        
        // Registra o saque no histórico
        user.withdrawals.push({ amount });

        // [TODO] Aqui podes adicionar lógica para processar o saque (ex: integração com sistema de pagamento)

        // Salva as alterações
        await user.save();

        // Retorna a resposta de sucesso
        res.json({ msg: 'Withdrawal requested successfully', newBalance: user.balance });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: "Erro ao buscar saldo" });
    }
};

// Exporta o controlador
module.exports = requestWithdrawal;