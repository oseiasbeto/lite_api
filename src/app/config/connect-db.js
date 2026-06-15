require("dotenv").config()
const mongoose = require('mongoose')

const connect = async () => {
    const appEnv = process.env.NODE_ENV
    const StringConnection = appEnv == 'prod' ? process.env.MONGO_ATLAS : appEnv == 'lan' ? process.env.MONGO_LAN : process.env.MONGO_lOCAL
    const connection = await mongoose.connect(StringConnection, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true
    });
    console.log(`MongoDB conectado: ${connection.connection.host}`)
}

module.exports = connect