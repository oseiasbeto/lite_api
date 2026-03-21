// Controlador para registar o watch de um anúncio
const User = require("../../../models/User");

// Controlador para registar o watch de um anúncio
const recordAdWatch = async (req, res) => {
    try {
        // Configuração do limite diário (podes mover para .env depois)
        const DAILY_AD_LIMIT = 20;
        const REWARD_PER_AD = 50; // em kwanzas

        // Extrai videoId do corpo da requisição
        const { videoId } = req.body;
        
        // Validação básica
        if (!videoId) {
            return res.status(400).json({ msg: 'videoId é obrigatório' });
        }

        // Busca o usuário
        const user = await User.findById(req.user.id);

        // Verifica se o usuário existe
        if (!user) {
            return res.status(404).json({ msg: 'Usuário não encontrado' });
        }

        // === 1. Verificar limite diário ===
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Extrai videoId do corpo da requisição
        const adsWatchedToday = user.watchHistory.filter(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() === today.getTime();
        }).length;

        // Extrai videoId do corpo da requisição
        if (adsWatchedToday >= DAILY_AD_LIMIT) {
            return res.status(403).json({ 
                msg: `Você atingiu o limite diário de ${DAILY_AD_LIMIT} anúncios.`,
                dailyLimit: DAILY_AD_LIMIT,
                adsWatchedToday,
                canWatchMore: false,
                balance: user.balance
            });
        }

        // === 2. Verificação anti-duplicado (mesmo vídeo no mesmo dia) ===
        const alreadyWatchedToday = user.watchHistory.some(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);
            return entry.videoId === videoId && entryDate.getTime() === today.getTime();
        });

        // Extrai videoId do corpo da requisição
        if (alreadyWatchedToday) {
            return res.status(400).json({
                msg: 'Este anúncio já foi recompensado hoje',
                balance: user.balance,
                adsWatchedToday
            });
        }

        // === 3. Tudo ok → creditar recompensa ===
        user.balance += REWARD_PER_AD;

        // Regista o watch
        user.watchHistory.push({
            videoId,
            date: new Date(),
            rewarded: true
        });

        // Salva as alterações
        await user.save();

        // Contagem do mês (opcional - útil para mostrar progresso na app)
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const adsThisMonth = user.watchHistory.filter(entry => {
            return new Date(entry.date) >= startOfMonth;
        }).length;

        // Cálculo dos ganhos do mês
        const earningsThisMonth = adsThisMonth * REWARD_PER_AD;

        // Resposta de sucesso
        res.json({
            msg: `Anúncio registado! +${REWARD_PER_AD} Kz`,
            success: true,
            newBalance: user.balance,
            adsWatchedToday: adsWatchedToday + 1,
            adsRemainingToday: DAILY_AD_LIMIT - (adsWatchedToday + 1),
            dailyLimit: DAILY_AD_LIMIT,
            adsThisMonth,
            earningsThisMonth
        });

    } catch (err) {
        // Log de erro para depuração
        console.error('Erro ao registar anúncio:', err);
        res.status(500).json({ msg: 'Erro no servidor ao registar o anúncio' });
    }
};

// Exporta o controlador
module.exports = recordAdWatch;