// Importa o módulo `dotenv` e carrega as variáveis de ambiente do arquivo `.env`.
require("dotenv").config();

// Importa a biblioteca `jsonwebtoken` para manipulação de tokens JWT.
const jwt = require("jsonwebtoken");

// Define um middleware chamado `protectedRoute` para proteger rotas que exigem autenticação.
const protectedRoute = (req, res, next) => {
    // Obtém o cabeçalho `Authorization` da requisição. Esse cabeçalho deve conter o token JWT.
    const authHeader = req.headers.authorization;

    // Verifica se o cabeçalho de autorização foi enviado na requisição.
    if (!authHeader)
        return res.status(401).send({ message: "Informe o seu token de acesso." }); // Retorna erro 401 caso o token esteja ausente.

    // Divide o conteúdo do cabeçalho `Authorization` em um array separando pelo espaço.
    // O formato esperado é "Bearer <token>", então esperamos um array com dois elementos.
    const parts = authHeader.split(" ");

    // Verifica se o array resultante contém exatamente dois elementos.
    if (parts.length !== 2)
        return res.status(401).send({ message: "Token inválido." }); // Retorna erro 401 se o token estiver mal formatado.

    // Desestrutura o array `parts`, armazenando o primeiro elemento como `schema` ("Bearer") 
    // e o segundo como `token` (o próprio JWT).
    const [schema, token] = parts;

    // Verifica se o primeiro elemento (schema) é exatamente "Bearer", ignorando maiúsculas e minúsculas.
    if (!/^Bearer$/i.test(schema))
        return res.status(401).send({ message: "Token mal formatado." }); // Retorna erro 401 se o esquema não for "Bearer".

    // Usa a função `verify()` da biblioteca `jsonwebtoken` para validar o token JWT.
    jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET, (err, decoded) => {
        // Se houver um erro ao validar o token (expirado ou inválido), retorna erro 401.
        if (err) return res.status(401).send({ message: "Token inválido." });

        // Se o token for válido, armazena os dados decodificados (payload do JWT) no objeto `req.user`.
        req.user = decoded;

        // Chama `next()` para continuar a execução da requisição e passar para o próximo middleware ou rota.
        return next();
    });
};

// Exporta o middleware `protectedRoute` para que ele possa ser utilizado em outras partes do código.
module.exports = protectedRoute;
