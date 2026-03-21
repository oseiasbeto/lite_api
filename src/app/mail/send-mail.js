const nodemailer = require("nodemailer");
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp-relay.sendinblue.com", // SMTP do Brevo
    port: Number(process.env.MAIL_PORT) || 587, // Convertendo para número
    secure: Number(process.env.MAIL_PORT) === 465, // SSL para porta 465, TLS para 587
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
    tls: {
        rejectUnauthorized: true, // Maior segurança
    },
});

// Função para ler e compilar templates dinamicamente
async function loadTemplate(templateName, data) {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
    const templateFile = fs.readFileSync(templatePath, 'utf-8');
    const compiledTemplate = handlebars.compile(templateFile);
    return compiledTemplate(data);
}

// Função principal para envio de emails
async function sendMail(to, templateName, subject, data) {
    try {
        const html = await loadTemplate(templateName, data);

        console.log(`📤 Enviando email para ${to}...`);
        const info = await transporter.sendMail({
            from: 'PapoRápido <geral@paporápido.com>',
            to,
            subject,
            html,
        });

        console.log(`✅ Email enviado com sucesso! ID: ${info.messageId}`);
    } catch (err) {
        console.log("Erro ao enviar o E-mail: ", err.message);
    }
}

module.exports = sendMail