const User = require("../../../models/User");


const subscribeUser = async (req, res) => {
    try {
        const userIdToSubscribe = req.params.user_id;
        const loggedUserId = req.user.id;

        if (!userIdToSubscribe) {
            return res
                .status(400)
                .json({ message: "O id do usuário a seguir é obrigatório." });
        }

        const userToSubscribe = await User.findOne({ _id: userIdToSubscribe }).select(
            "subscriptions subscriptions_count"
        );
        if (!userToSubscribe) {
            return res
                .status(404)
                .json({ message: "Usuário a seguir não encontrado." });
        }

        if (userToSubscribe._id.toString() === loggedUserId.toString()) {
            return res
                .status(400)
                .json({ message: "Você não pode subscrever a si mesmo." });
        }

        const user = await User.findOne({ _id: loggedUserId }).select("subscriptions subscriptions_count");
        if (!user) {
            return res
                .status(400)
                .json({ message: "Houve um erro, tente novamente!" });
        }

        // Verifica se o usuário a seguir já segue o usuário logado
        const hasSubscriber = userToSubscribe.subscriptions.includes(user?._id.toString());

        if (hasSubscriber) {
            userToSubscribe.subscriptions = userToSubscribe.subscriptions.filter(uId => uId.toString() !== user?._id.toString())
            userToSubscribe.subscriptions_count -= 1

            await userToSubscribe.save()

            return res.status(200).json({
                message: "Você deixou de subscrever o usuário com sucesso.",

                profileStatusSubscriptions: {
                    subscriptions: userToSubscribe.subscriptions,
                    subscriptions_count: userToSubscribe.subscriptions_count
                }
            });
        } else {

            userToSubscribe.subscriptions.push(user?._id)
            userToSubscribe.subscriptions_count += 1

            await userToSubscribe.save()
            
            return res.status(200).json({
                message: "Subscricao feita com sucesso.",
                profileStatusSubscriptions: {
                    subscriptions: userToSubscribe.subscriptions,
                    subscriptions_count: userToSubscribe.subscriptions_count
                }
            });
        }
    } catch (err) {
        console.error("Erro ao processar ação de subscrever/remover subscricao:", err);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = subscribeUser;