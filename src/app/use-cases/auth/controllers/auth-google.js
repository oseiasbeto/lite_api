// controllers/auth/loginController.js
const bcrypt = require('bcryptjs');
const User = require('../../../models/User'); // ajuste o caminho
const Session = require('../../../models/Session');
const moment = require('moment');

const generateAccessToken = require('../../../utils/generate-access-token');
const generateRefreshToken = require('../../../utils/generate-refresh-token');
const encryptRefreshToken = require('../../../utils/encrypt-refresh-token');

const authGoogle = async (req, res) => {
  try {
    console.log(req.body);

    res.status(200).json({
      success: true,
      message: 'Login bem-sucedido.',  
    })

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor.'
    });
  }
};

module.exports = authGoogle;