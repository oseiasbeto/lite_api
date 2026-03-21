// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const User = require("../../../models/User");

const searchUsers = async (req, res) => {
  try {
    const q = req.query.q?.trim()
    if (!q) return res.json({ users: [] })

    const users = await User.find({
      $or: [
        { username: { $regex: q.replace('@', ''), $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { phone_number: { $regex: q, $options: 'i' } },
      ],
      _id: { $ne: req.user.id },
      account_verification_status: 'verified'
    })
      .select('name bio last_seen is_verified is_online username profile_image url')
      .limit(20)

    res.json({ users })
  } catch (err) {
    console.error("Erro ao procurar os usuarios:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

module.exports = searchUsers;
