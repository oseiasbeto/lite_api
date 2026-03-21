const { sign } = require("jsonwebtoken") ;

const generateAccessToken = (user, expiresIn) => {
    const secreet_key = process.env.JWT_ACCESS_TOKEN_SECRET

    const access_token = sign({
        id: user._id,
        email: user.email,
        name: user.name,
        username: user.username,
    }, secreet_key, {
        expiresIn: expiresIn
    })

    return access_token
}

module.exports = generateAccessToken