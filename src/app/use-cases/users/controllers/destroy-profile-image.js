// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const cloudinary = require('../../../services/cloudinary');

const destroyProfileImage = async (req, res) => {
    try {
        const { public_id } = req.body;

        if (!public_id) {
            return res.status(400).json({
                success: false,
                message: 'public_id é obrigatório'
            });
        }

        // Deletar imagem do Cloudinary
        const result = await cloudinary.uploader.destroy(public_id);

        console.log('Resultado da deleção no Cloudinary:', result);
        if (result.result === 'ok') {
            return res.json({
                success: true,
                message: 'Imagem deletada com sucesso'
            });
        } else if (result.result === 'not found') {
            return res.status(404).json({
                success: false,
                message: 'Imagem não encontrada'
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Erro ao deletar imagem'
            });
        }
    } catch (error) {
        console.error('Erro ao deletar imagem do Cloudinary:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = destroyProfileImage;