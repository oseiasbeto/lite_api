// controllers/auth/terminateAllSessions.js
const Session = require("../../../models/Session");

const terminateAllSessions = async (req, res) => {
  try {
    const currentSessionId = req.headers["x-session-id"];
    await Session.deleteMany({
      user: req.user.id,
      _id: { $ne: currentSessionId }
    });

    return res.status(200).json({ message: "Todas as outras sessões foram encerradas" });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao encerrar sessões" });
  }
};

module.exports = terminateAllSessions;