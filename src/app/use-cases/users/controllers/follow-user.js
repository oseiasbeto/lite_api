const User = require("../../../models/User");
const Notification = require("../../../models/Notification");
const { getIO } = require("../../../services/socket");

const followUser = async (req, res) => {
    try {
        const userIdToFollow = req.params.user_id;
        const loggedUserId = req.user.id;

        if (!userIdToFollow) {
            return res
                .status(400)
                .json({ message: "O id do usuário a seguir é obrigatório." });
        }

        const userToFollow = await User.findOne({ _id: userIdToFollow }).select(
            "username privacy_settings activity_status following followers following_count followers_count"
        );
        if (!userToFollow) {
            return res
                .status(404)
                .json({ message: "Usuário a seguir não encontrado." });
        }

        if (userToFollow._id.toString() === loggedUserId.toString()) {
            return res
                .status(400)
                .json({ message: "Você não pode seguir a si mesmo." });
        }

        const user = await User.findOne({ _id: loggedUserId }).select("following following_count followers followers_count");
        if (!user) {
            return res
                .status(400)
                .json({ message: "Houve um erro, tente novamente!" });
        }

        // Verifica se o usuário a seguir já segue o usuário logado
        const hasFollowed = user.following.includes(userToFollow._id.toString());

        if (hasFollowed) {

            user.following = user.following.filter(uId => uId.toString() !== userToFollow._id.toString())
            user.following_count -= 1

            userToFollow.followers = userToFollow.followers.filter(uId => uId.toString() !== loggedUserId?.toString())
            userToFollow.followers_count -= 1

            await user.save()
            await userToFollow.save()

            return res.status(200).json({
                message: "Você deixou de seguir o usuário com sucesso.",
                userStatusFollow: {
                    following: user.following,
                    following_count: user.following_count,
                    followers: user.followers,
                    followers_count: user.followers_count
                },
                profileStatusFollow: {
                    following: userToFollow.following,
                    following_count: userToFollow.following_count,
                    followers: userToFollow.followers,
                    followers_count: userToFollow.followers_count
                }
            });
        } else {
            // Follow
            const status = "active";

            user.following.push(userToFollow._id)
            user.following_count += 1

            await user.save()

            userToFollow.followers.push(loggedUserId)
            userToFollow.followers_count += 1


            await userToFollow.save()
            const isFollowBack = user.followers.includes(userToFollow._id.toString());

            return res.status(200).json({
                message: isFollowBack
                    ? "Você seguiu o usuário de volta com sucesso."
                    : "Você começou a seguir o usuário com sucesso.",
                userStatusFollow: {
                    following: user.following,
                    following_count: user.following_count,
                    followers: user.followers,
                    followers_count: user.followers_count
                },
                profileStatusFollow: {
                    following: userToFollow.following,
                    following_count: userToFollow.following_count,
                    followers: userToFollow.followers,
                    followers_count: userToFollow.followers_count
                }
            });
        }
    } catch (err) {
        console.error("Erro ao processar ação de seguir/deixar de seguir:", err);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};

module.exports = followUser;