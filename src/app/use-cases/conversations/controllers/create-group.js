// controllers/conversation/createGroup.js
const Conversation = require('../../../models/Conversation')
const { generateAvatarByName } = require('../../../utils/avatar')

const createGroup = async (req, res) => {
  try {
    const { name, participants } = req.body
    const creatorId = req.user.id

    if (!name || !participants || participants.length < 1) {
      return res.status(400).json({ message: "Nome e participantes obrigatórios" })
    }

    // Adiciona criador automaticamente
    const allParticipants = [...new Set([creatorId, ...participants])]

    const group = await Conversation.create({
      type: 'group',
      name: name.trim(),
      participants: allParticipants,
      creator: creatorId,
      member_count: allParticipants.length,
      avatar: generateAvatarByName(name), // avatar automático
      is_public: false
    })

    await group.populate('participants', 'name profile_image')

    return res.status(201).json({
      message: "Grupo criado com sucesso!",
      conversation: group
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: "Erro ao criar grupo" })
  }
}

module.exports = createGroup