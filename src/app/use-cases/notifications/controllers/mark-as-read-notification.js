const Notifications = require("../../../models/Notification");

const markAsReadNotification = async (req, res) => {
  try {
    const id = req.params.id;

    // Encontra a notificação pelo ID e pelo destinatário (usuário logado)
    const notification = await Notifications.findOne({  _id: id, recipient: req.user.id });

    // Se a notificação não for encontrada, retorna 404
    if (!notification) {
      return res.status(404).json({ message: "Notificação não encontrada." });
    }

    // Marca a notificação como lida
    notification.read = true;

    // Salva a notificação atualizada no banco de dados
    await notification.save();  

    // Retorna uma resposta de sucesso
    res.status(200).json({
        message: "Notificação marcada como lida com sucesso.",
    });
  } catch (err) {
    console.error("Erro ao marcar notificação como lida:", err);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = markAsReadNotification;
