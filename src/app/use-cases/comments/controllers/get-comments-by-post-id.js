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
        const sortCommentId = req.query.sortCommentId || null; // ID do comentário prioritário

        let sort;
        switch (sortBy) {
            case 'recents':
                sort = { created_at: -1 };
                break;
            case 'relevants':
                sort = { created_at: -1 };
                break
        }

        const post = await Post.findOne({
            _id: postId
        })

        if (!post) return res.status(400).send({
            message: "Algo deu errado!"
        })

        const match = { post: mongoose.Types.ObjectId(postId), parent: null }

        // Buscar comentários com agregação
        let comments = await Comment.aggregate([
            {
                $match: match
            },
            {
                $lookup: {
                    from: 'comments',
                    let: { commentId: '$_id' },
                    pipeline: [
                        { 
                            $match: { 
                                $expr: { $eq: ['$parent', '$$commentId'] } 
                            } 
                        },
                        { $limit: 3 },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'author',
                                foreignField: '_id',
                                as: 'author'
                            }
                        },
                        {
                            $unwind: {
                                path: '$author',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                content: 1,
                                parent: 1,
                                upvotes: 1,
                                upvotes_count: 1,
                                downvotes: 1,
                                downvotes_count: 1,
                                replies_count: 1,
                                created_at: 1,
                                reply_to: 1,
                                author: {
                                    $cond: {
                                        if: { $ifNull: ['$author', false] },
                                        then: {
                                            _id: '$author._id',
                                            name: '$author.name',
                                            username: '$author.username',
                                            profile_image: '$author.profile_image'
                                        },
                                        else: null
                                    }
                                }
                            }
                        }
                    ],
                    as: 'replies'
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
                $unwind: {
                    path: '$author',
                    preserveNullAndEmptyArrays: true
                }
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
                    reply_to: 1,
                    author: {
                        $cond: {
                            if: { $ifNull: ['$author', false] },
                            then: {
                                _id: '$author._id',
                                name: '$author.name',
                                username: '$author.username',
                                profile_image: '$author.profile_image'
                            },
                            else: null
                        }
                    },
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
                                author: '$$reply.author'
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    replies: {
                        $filter: {
                            input: '$replies',
                            as: 'reply',
                            cond: { $ne: ['$$reply.author', null] }
                        }
                    }
                }
            }
        ]);

        // 🔥 LÓGICA DE ORDENAÇÃO PRIORITÁRIA 🔥
        if (sortCommentId && mongoose.Types.ObjectId.isValid(sortCommentId)) {
            const targetCommentId = mongoose.Types.ObjectId(sortCommentId);
            
            // Encontra o comentário prioritário
            const priorityComment = comments.find(
                comment => comment._id.toString() === targetCommentId.toString()
            );
            
            if (priorityComment) {
                // Remove o comentário prioritário da lista
                comments = comments.filter(
                    comment => comment._id.toString() !== targetCommentId.toString()
                );
                
                // Ordena os comentários restantes pelo critério padrão
                comments.sort((a, b) => {
                    if (sortBy === 'recents') {
                        return new Date(b.created_at) - new Date(a.created_at);
                    } else if (sortBy === 'relevants') {
                        // Para relevantes, você pode usar outros critérios como upvotes
                        return (b.upvotes_count || 0) - (a.upvotes_count || 0);
                    }
                    return 0;
                });
                
                // Coloca o comentário prioritário no início
                comments = [priorityComment, ...comments];
            }
        } else {
            // Se não houver sortCommentId, aplica a ordenação padrão
            if (sortBy === 'recents') {
                comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            } else if (sortBy === 'relevants') {
                comments.sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0));
            }
        }

        // Aplicar paginação APÓS a ordenação
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedComments = comments.slice(startIndex, endIndex);

        let totalComments;

        if (!hasTotal) {
            totalComments = await Comment.countDocuments(match);
        } else {
            totalComments = hasTotal;
        }

        const totalPages = Math.ceil(totalComments / limit);

        res.json({
            comments: paginatedComments,
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