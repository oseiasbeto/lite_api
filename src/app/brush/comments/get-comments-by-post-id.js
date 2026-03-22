const Comment = require("../../models/Comment");
const mongoose = require("mongoose")

const getCommentsByPostId = async (req, res) => {
    try {
        const postId = req.params.postId;
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        const sortBy = req.query.sortBy || 'recents';
        
        let sort;
        switch (sortBy) {
            case 'recents':
                sort = { created_at: -1 };
                break;
            case 'relevant':
                sort = { 'likes_count': -1 };
                break;
            case 'mostLiked':
                sort = { 'likes_count': -1 };
                break;
            default:
                sort = { created_at: -1 };
                break;
        }



        const comments = await Comment.aggregate([
            {
                $match: { post: mongoose.Types.ObjectId(postId), parent: null }
            },
            {
                $lookup: {
                    from: 'comments',
                    localField: '_id',
                    foreignField: 'parent',
                    as: 'replies'
                }
            },
            {
                $addFields: {
                    replies: { $slice: ['$replies', 3] }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    likes: 1,
                    likes_count: 1,
                    dislikes: 1,
                    dislikes_count: 1,
                    replies_count: 1,
                    created_at: 1,
                    user: {
                        _id: 1,
                        name: 1,
                        profile_image: 1
                    },
                    replies: {
                        $map: {
                            input: '$replies',
                            as: 'reply',
                            in: {
                                _id: '$$reply._id',
                                content: '$$reply.content',
                                likes: '$$reply.likes',
                                likes_count: '$$reply.likes_count',
                                dislikes: '$$reply.dislikes',
                                dislikes_count: '$$reply.dislikes_count',
                                replies_count: '$$reply.replies_count',
                                created_at: '$$reply.created_at',
                                author: {
                                    $let: {
                                        vars: {
                                            user: {
                                                $arrayElemAt: [
                                                    {
                                                        $filter: {
                                                            input: 'users',
                                                            cond: { $eq: ['$$this._id', '$$reply.author'] }
                                                        }
                                                    },
                                                    0
                                                ]
                                            }
                                        },
                                        in: {
                                            _id: '$$user._id',
                                            name: '$$user.name',
                                            profile_image: '$$user.profile_image'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                $sort: sort
            },
            {
                $skip: (page - 1) * limit
            },
            {
                $limit: limit
            }
        ]);

        const totalComments = await Comment.countDocuments({ postId: mongoose.Types.ObjectId(postId), parent: null });
        const totalPages = Math.ceil(totalComments / limit);

        res.json({
            comments,
            pagination: {
                page,
                limit,
                totalPages,
                totalComments
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao carregar comentários' });
    }
};

module.exports = getCommentsByPostId;
