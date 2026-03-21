// controllers/auth/checkEmailController.js
const User = require('../../../models/User');

const checkEmail = async (req, res) => {
  try {
    const { email} = req.body;

    // 1. Validações básicas
    if (!email) {
      return res.status(400).json({ message: 'O e-mail e obrigatório.' });
    }
    // 2. Verifica se e-mail já existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Este e-mail já está em uso.' });
    } else 
    return res.status(200).json();

  } catch (error) {
    console.error('Erro ao checar o e-mail:', error);
    res.status(500).json({ message: 'Erro interno ao checar e-mail.' });
  }
};

module.exports = checkEmail;