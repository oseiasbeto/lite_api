const { verify } = require("jsonwebtoken");

const decodeTokem = (token, secreetKey) => {
    try {
        const decoded = verify(token, secreetKey);
        return decoded;
    } catch (error) {
        // Retorna null em vez de lançar exceção
        return null;
    }
}

module.exports = decodeTokem;