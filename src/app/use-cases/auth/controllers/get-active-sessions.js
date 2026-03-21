// controllers/auth/getActiveSessions.js
const Session = require("../../../models/Session");

const getActiveSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user.id })
      .select("ip_address id user_agent created_at expires_at authentication_method")
      .sort({ created_at: -1 });

    return res.status(200).json({ sessions });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao carregar sessões" });
  }
};

module.exports = getActiveSessions;