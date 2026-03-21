// Importando modelos necessários
const Message = require('../../../models/Message');

// Controlador para obter mensagens de uma conversa específica
const getMessages = async (req, res) => {
  try {
    // ID do usuário autenticado
    const { id: userId } = req.user;

    // ID da conversa
    const { convId } = req.params;

    // Paginação
    const page = parseInt(req.query.page) || 1;

    // Itens por página
    const limit = parseInt(req.query.limit) || 10;

    // Cálculo do skip
    const skip = (page - 1) * limit;

    // Total de itens (para load incremental)
    const totalItems = parseInt(req.query.total) || 0;

    // Indica se é load incremental
    const isLoad = (req.query.is_load && req.query.is_load === "true") || false;

    // Validação básica
    if (!convId) {
      return res.status(400).json({ message: "ID da conversa é obrigatório." });
    }

    // Filtro para mensagens da conversa
    const filter = { conversation: convId };

    // Busca mensagens com paginação
    const messages = await Message.find(filter)
      .sort({ created_at: -1 }) // mais recentes primeiro
      .skip(skip) // pular o número de itens já carregados
      .limit(limit) // limitar ao número por página
      .populate('sender', 'name username profile_image is_verified is_online') // popular dados do remetente
      .populate({
        path: "reply_to",
        populate: {
          path: "sender",
          select: 'name username profile_image is_verified is_online'
        }
      })
      .populate({
        path: "reactions",
        populate: {
          path: "user",
          select: 'name username profile_image is_verified is_online'
        }
      })
      .lean(); // Performance: evita overhead do Mongoose


    // Marcar como lidas
    await Message.updateMany(
      // Mensagens na conversa não enviadas pelo usuário autenticado e que ele ainda não leu
      { conversation: convId, sender: { $ne: userId }, 'read_by.user': { $ne: userId } },

      // Adicionar o usuário ao array read_by
      { $push: { read_by: { user: userId, read_at: new Date() } } }
    );

    // Atualizar unreadCount
    /* 
  await UserConversation.findOneAndUpdate(
    // Documento do usuário e conversa
    { user: userId, conversation: convId },

    // Resetar contador de não lidas
    { unread_count: 0, last_read_at: new Date() }
  );*/

    // Contar total de mensagens na conversa (apenas se não for load incremental)
    let total;

    // Contagem total do filtro
    if (!isLoad) {
      total = await Message.countDocuments(filter);
    } else {
      // Usar total fornecido na requisição
      total = totalItems;
    }

    // Calcular total de páginas
    const totalPages = Math.ceil(total / limit);

    // Resposta padronizada
    res.status(200).json({
      messages: messages.reverse(), // mais antiga primeiro
      page, // página atual
      totalPages, // total de páginas 
      total, // total de mensagens
      hasMore: page < totalPages, // indica se há mais páginas
    });

  } catch (error) {
    // Log de erro para depuração
    console.error("Erro ao carregar mensagens:", error);

    // Resposta de erro genérica
    res.status(500).json({ message: "Erro interno no servidor." });
  }
};

module.exports = getMessages;