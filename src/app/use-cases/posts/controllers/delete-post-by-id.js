const Post = require("../../../models/Post");
const Media = require("../../../models/Media");
const axios = require('axios');
const CryptoJS = require('crypto-js');

// Configurações do Cloudinary (coloque no arquivo .env)
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

/**
 * Função para deletar mídia do Cloudinary
 * @param {string} publicId - ID público da mídia no Cloudinary
 * @param {string} resourceType - Tipo de recurso (image, video, raw)
 * @returns {Promise<boolean>} - Retorna true se deletado com sucesso
 */
const deleteMediaFromCloudinary = async (publicId, resourceType = 'image') => {
    if (!publicId) return false;
    
    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const signatureString = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
        const signature = CryptoJS.SHA1(signatureString).toString();
        
        const response = await axios.post(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`,
            { 
                public_id: publicId, 
                api_key: API_KEY, 
                timestamp, 
                signature 
            }
        );
        
        // Verifica se a exclusão foi bem-sucedida
        if (response.data.result === 'ok') {
            console.log(`Mídia ${publicId} deletada do Cloudinary com sucesso`);
            return true;
        } else {
            console.warn(`Falha ao deletar mídia ${publicId}:`, response.data);
            return false;
        }
    } catch (err) {
        console.error(`Erro ao excluir mídia ${publicId} do Cloudinary:`, err?.response?.data || err.message);
        return false;
    }
};

/**
 * Função para extrair public_id e resource_type da URL ou do objeto media
 * @param {Object} media - Objeto da mídia
 * @returns {Object} - { publicId, resourceType }
 */
const extractMediaInfo = (media) => {
    let publicId = null;
    let resourceType = 'image';
    
    if (media.public_id) {
        publicId = media.public_id;
    } else if (media.url) {
        // Tenta extrair o public_id da URL
        const urlParts = media.url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const publicIdWithExtension = fileName.split('.')[0];
        publicId = publicIdWithExtension;
    }
    
    if (media.resource_type) {
        resourceType = media.resource_type;
    } else if (media.type) {
        resourceType = media.type;
    } else if (media.url) {
        // Determina o resource_type pela extensão
        const extension = media.url.split('.').pop().toLowerCase();
        if (['mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv', 'webm'].includes(extension)) {
            resourceType = 'video';
        } else if (['gif'].includes(extension)) {
            resourceType = 'image';
        }
    }
    
    return { publicId, resourceType };
};

/**
 * Deleta uma postagem e suas mídias associadas
 */
const deletePostById = async (req, res) => {
    try {
        const { id } = req.params;

        // Verifica se o ID foi fornecido
        if (!id) {
            return res.status(400).json({ message: "O ID é obrigatório." });
        }

        // Busca a postagem
        const post = await Post.findOne({ _id: id });

        if (!post) {
            return res.status(404).json({ message: "Postagem não encontrada" });
        }

        let mediaDeletionResults = [];
        
        // Se a postagem tem mídias associadas
        if (post?.media && post.media.length > 0) {
            console.log(`Deletando ${post.media.length} mídia(s) associada(s) à postagem...`);
            
            // Array para armazenar as promessas de exclusão
            const deletionPromises = [];
            
            for (const mediaId of post.media) {
                try {
                    // Busca a mídia no banco de dados
                    const media = await Media.findOne({ _id: mediaId });
                    
                    if (media) {
                        console.log(`Processando mídia ${mediaId}:`, media);
                        
                        // Extrai informações para deletar do Cloudinary
                        const { publicId, resourceType } = extractMediaInfo(media);
                        
                        if (publicId) {
                            // Adiciona a promessa de exclusão
                            deletionPromises.push(
                                deleteMediaFromCloudinary(publicId, resourceType)
                                    .then((deleted) => {
                                        if (deleted) {
                                            // Se deletou do Cloudinary, deleta do banco
                                            return Media.deleteOne({ _id: mediaId });
                                        }
                                        return null;
                                    })
                                    .catch(err => {
                                        console.error(`Erro ao processar mídia ${mediaId}:`, err);
                                        return null;
                                    })
                            );
                        } else {
                            console.warn(`Mídia ${mediaId} não tem public_id, deletando apenas do banco...`);
                            deletionPromises.push(Media.deleteOne({ _id: mediaId }));
                        }
                    } else {
                        console.warn(`Mídia ${mediaId} não encontrada no banco de dados`);
                    }
                } catch (err) {
                    console.error(`Erro ao processar mídia ${mediaId}:`, err);
                    mediaDeletionResults.push({ mediaId, error: err.message });
                }
            }
            
            // Aguarda todas as exclusões
            if (deletionPromises.length > 0) {
                mediaDeletionResults = await Promise.allSettled(deletionPromises);
                console.log('Resultados das exclusões:', mediaDeletionResults);
            }
        }

        // Deleta a postagem
        await post.deleteOne();
        console.log(`Postagem ${id} deletada com sucesso`);

        // Retorna resposta de sucesso
        return res.status(200).json({
            success: true,
            message: "Postagem deletada com sucesso.",
            mediaDeleted: mediaDeletionResults,
            postId: id
        });
        
    } catch (err) {
        console.error("Erro ao deletar postagem:", err);
        return res.status(500).json({ 
            success: false,
            message: "Erro interno no servidor" 
        });
    }
};

module.exports = deletePostById;