const generateUsernameByEmail = (email) => {
    const username = email.split("@")[0].replace(/[^a-zA-Z0-9]/g).toLowerCase()
    const sufix = Math.floor(Math.random() * 1000)
    return `${username}${sufix}`
}

module.exports = generateUsernameByEmail