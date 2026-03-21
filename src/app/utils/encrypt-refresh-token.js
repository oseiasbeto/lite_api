const { randomBytes, createCipheriv } = require("crypto")

const encryptRefreshToken = (refreshToken) => {
    // crie um algorítimo de criptografia baseado no modelo RSA
    const algorithm = "aes-256-cbc";

    // crie as chaves
    const key = randomBytes(32).toString("hex");
    const iv = randomBytes(16).toString("hex");

    // crie uma cífra hexadecimal desta criptografia.
    let cipher = createCipheriv(algorithm, Buffer.from(key, "hex"), Buffer.from(iv, "hex"))

    // actualiza a cífra gerada com o refresh token.
    let update_cipher = cipher.update(refreshToken);

    // encripta o refresh token com a cífra actualizada.
    let encrypted_refresh_token = Buffer.concat([update_cipher, cipher.final()]).toString("hex")

    return {
        key,
        iv,
        encrypted_refresh_token
    }
}

module.exports = encryptRefreshToken