const { createDecipheriv } = require("crypto")

const decryptRefreshToken = (data) => {
    const algorithm = "aes-256-cbc"
    const token = data.encryptedRefreshToken

    const key = data.key
    const iv = data.iv

    const decipher = createDecipheriv(algorithm, Buffer.from(key, "hex"), Buffer.from(iv, "hex"))
    let decipherUpdate = decipher.update(Buffer.from(token, "hex"))

    const decryptedRefreshToken = Buffer.concat([decipherUpdate, decipher.final()]).toString()

    if (decryptedRefreshToken) return decryptedRefreshToken
    else throw new Error("something wrong.");
}

module.exports = decryptRefreshToken