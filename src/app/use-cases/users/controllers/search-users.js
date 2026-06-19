// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const User = require("../../../models/User");

const searchUsers = async (req, res) => {
  try {
    const q = req.query.q?.trim()
    if (!q) return res.json({ users: [] })

    // ===== FILTRO CONDICIONAL PARA NOVA MENSAGEM =====
    const filter = {
      $or: [
        { username: { $regex: q.replace('@', ''), $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { phone_number: { $regex: q, $options: 'i' } },
      ],
      account_verification_status: 'verified'
    };

    // Se o parâmetro new_message for passado, adiciona o filtro para não retornar o usuário atual
    if (req.query?.type === 'new_message') {
      filter._id = { $ne: req.user.id };
    }
    // ===== FIM DO FILTRO CONDICIONAL =====

    const users = await User.find(filter)
      .select('name bio last_seen is_verified is_online username profile_image url')
      .sort({ is_verified: -1, is_online: -1, name: 1 })
      .limit(20)

    res.json({ users })
  } catch (err) {
    console.error("Erro ao procurar os usuarios:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

module.exports = searchUsers;