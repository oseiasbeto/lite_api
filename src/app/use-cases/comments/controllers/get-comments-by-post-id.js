const Comment = require("../../../models/Comment");
const Post = require("../../../models/Post");
const mongoose = require("mongoose")

const getCommentsByPostId = async (req, res) => {
    try {
        const postId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const hasTotal = parseInt(req.query.total) || 0;
        const sortBy = req.query.sortBy || 'recents';

        let sort;
        switch (sortBy) {
            case 'recents':
                sort = { created_at: -1 };
                break;
            case 'relevants':
                sort = { upvotes_count: -1 };
                break
        }

        const post = await Post.findOne({
            _id: postId
        })

        if (!post) return res.status(400).send({
            message: "Algo deu errado!"
        })

        const match = { post: mongoose.Types.ObjectId(postId), parent: null }

        const comments = await Comment.aggregate([
            {
                $match: match
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
                    as: 'author'
                }
            },
            {
                $unwind: '$author'
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    upvotes: 1,
                    upvotes_count: 1,
                    downvotes: 1,
                    post: 1,
                    downvotes_count: 1,
                    replies_count: 1,
                    created_at: 1,
                    author: {
                        _id: 1,
                        name: 1,
                        username: 1,
                        profile_image: 1
                    },
                    reply_to: 1,
                    replies: {
                        $map: {
                            input: '$replies',
                            as: 'reply',
                            in: {
                                _id: '$$reply._id',
                                content: '$$reply.content',
                                parent: '$$reply.parent',
                                upvotes: '$$reply.upvotes',
                                post: '$$reply.post',
                                upvotes_count: '$$reply.upvotes_count',
                                downvotes: '$$reply.downvotes',
                                downvotes_count: '$$reply.downvotes_count',
                                replies_count: '$$reply.replies_count',
                                created_at: '$$reply.created_at',
                                reply_to: '$$reply.reply_to',
                                author: '$$reply.author',
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

        let totalComments;

        if (!hasTotal) {
            totalComments = await Comment.countDocuments(match);
        } else {
            totalComments = hasTotal;
        }

        const totalPages = Math.ceil(totalComments / limit);

        res.json({
            comments,
            pagination: {
                page,
                limit,
                totalPages,
                hasMore: page < totalPages,
                totalComments
            }
        });
    } catch (error) {

        console.error(error)
        res.status(500).json({ message: 'Erro ao carregar comentários' });
    }
};

module.exports = getCommentsByPostId;
