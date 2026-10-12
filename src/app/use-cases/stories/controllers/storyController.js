// modules/stories/controllers/storyController.js
const mongoose = require("mongoose");
const Story = require("../../../models/Story");
const StoryView = require("../../../models/Storyview");
const User = require("../../../models/User");
const Conversation = require("../../../models/Conversation");
const { emitToUser } = require("../../../services/socket");
// Ajuste o caminho conforme a sua estrutura. Reaproveitamos o sendMessage para
// que a resposta ao story use o mesmo fluxo (unread, socket, push agrupado).
const sendMessage = require("../../messages/controllers/send-message");

const AUTHOR_SELECT = "name username profile_image is_verified";
const MAX_ACTIVE_STORIES = 30;
const MAX_VIDEO_SECONDS = 60;
const FEED_LIMIT = 60;
const VIEWERS_PAGE_SIZE = 30;

const toId = (v) => (v ? v.toString() : "");
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/* ----------------------------- helpers ----------------------------- */

// Regra de visibilidade (o autor sempre vê o próprio story)
// friends = o autor também segue quem está vendo (seguimento mútuo, já que
// o feed só traz autores que o espectador segue)
const canSee = (privacy, author, viewerId) => {
  if (privacy === "everyone") return true;
  if (privacy === "only_me") return false;
  return (author.following || []).some((id) => toId(id) === viewerId);
};

const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  username: u.username,
  profile_image: u.profile_image,
  is_verified: u.is_verified,
});

const serializeStory = (s, { isMe, view }) => ({
  _id: s._id,
  media_type: s.media_type,
  media: s.media,
  text_content: s.text_content,
  background: s.background,
  caption: s.caption,
  privacy: s.privacy,
  allow_replies: s.allow_replies,
  created_at: s.created_at,
  expires_at: s.expires_at,
  viewed: isMe || !!view,
  liked: !!view?.liked,
  // contadores só para o dono
  ...(isMe && {
    views_count: s.views_count,
    likes_count: s.likes_count,
    replies_count: s.replies_count,
  }),
});

// Carrega o story garantindo expiração, bloqueio e privacidade
const loadViewableStory = async (storyId, viewerId) => {
  if (!isValidId(storyId)) return null;

  const story = await Story.findOne({
    _id: storyId,
    is_deleted: false,
    expires_at: { $gt: new Date() },
  });
  if (!story) return null;

  const author = await User.findById(story.author)
    .select(`${AUTHOR_SELECT} following blocked_users is_deleted`)
    .lean();
  if (!author || author.is_deleted) return null;

  if (toId(story.author) === viewerId) return { story, author, isOwner: true };

  const blockedMe = (author.blocked_users || []).some((id) => toId(id) === viewerId);
  if (blockedMe || !canSee(story.privacy, author, viewerId)) return null;

  return { story, author, isOwner: false };
};

// Quem deve receber eventos em tempo real sobre os stories deste autor
const notifyAudience = async (authorId, privacy, event, payload) => {
  try {
    if (privacy === "only_me") return;

    const author = await User.findById(authorId).select("followers following").lean();
    if (!author) return;

    let audience = (author.followers || []).map(toId);
    if (privacy === "friends") {
      const following = new Set((author.following || []).map(toId));
      audience = audience.filter((id) => following.has(id));
    }
    audience.forEach((id) => emitToUser(id, event, payload));
  } catch (err) {
    console.error(`[stories] falha ao notificar audiência (${event}):`, err.message);
  }
};

/* ------------------------------ feed ------------------------------- */

// GET /stories
const getStoriesFeed = async (req, res) => {
  try {
    const me = toId(req.user.id);

    const meDoc = await User.findById(me).select("following blocked_users muted_stories").lean();
    if (!meDoc) return res.status(404).json({ message: "Usuário não encontrado" });

    const blocked = new Set((meDoc.blocked_users || []).map(toId));
    const muted = new Set((meDoc.muted_stories || []).map(toId));

    const followingIds = (meDoc.following || [])
      .map(toId)
      .filter((id) => !blocked.has(id) && !muted.has(id));

    const stories = await Story.find({
      author: { $in: [me, ...followingIds] },
      is_deleted: false,
      expires_at: { $gt: new Date() },
    })
      .sort({ created_at: 1 })
      .limit(1000)
      .lean();

    if (!stories.length) return res.json({ items: [] });

    const authorIds = [...new Set(stories.map((s) => toId(s.author)))];
    const authors = await User.find({ _id: { $in: authorIds }, is_deleted: { $ne: true } })
      .select(`${AUTHOR_SELECT} following blocked_users`)
      .lean();
    const authorMap = new Map(authors.map((a) => [toId(a._id), a]));

    const views = await StoryView.find({ viewer: me, story: { $in: stories.map((s) => s._id) } })
      .select("story liked")
      .lean();
    const viewMap = new Map(views.map((v) => [toId(v.story), v]));

    const groups = new Map();

    for (const s of stories) {
      const authorId = toId(s.author);
      const author = authorMap.get(authorId);
      if (!author) continue;

      const isMe = authorId === me;
      if (!isMe) {
        if ((author.blocked_users || []).some((id) => toId(id) === me)) continue;
        if (!canSee(s.privacy, author, me)) continue;
      }

      if (!groups.has(authorId)) {
        groups.set(authorId, { user: publicUser(author), is_me: isMe, stories: [], latest_at: s.created_at });
      }
      const group = groups.get(authorId);
      group.stories.push(serializeStory(s, { isMe, view: viewMap.get(toId(s._id)) }));
      group.latest_at = s.created_at; // ordenado asc, então o último é o mais recente
    }

    const items = [...groups.values()].map((g) => ({
      ...g,
      has_unseen: g.stories.some((s) => !s.viewed),
    }));

    // eu primeiro → não vistos → mais recentes
    items.sort((a, b) => {
      if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
      if (a.has_unseen !== b.has_unseen) return a.has_unseen ? -1 : 1;
      return new Date(b.latest_at) - new Date(a.latest_at);
    });

    res.json({ items: items.slice(0, FEED_LIMIT + 1) });
  } catch (error) {
    console.error("Erro ao carregar stories:", error);
    res.status(500).json({ message: "Erro interno", error: error.message });
  }
};

/* ----------------------------- criar ------------------------------- */

// POST /stories
const createStory = async (req, res) => {
  try {
    const me = toId(req.user.id);
    const { media_type, media, text_content, background, caption, privacy, allow_replies } = req.body;

    if (!["photo", "video", "text"].includes(media_type)) {
      return res.status(400).json({ message: "Tipo de story inválido" });
    }

    if (media_type === "text") {
      if (!text_content?.trim()) return res.status(400).json({ message: "Escreva algo para o seu story" });
    } else {
      if (!media?.url) return res.status(400).json({ message: "A mídia é obrigatória" });
      if (media_type === "video" && Number(media.duration) > MAX_VIDEO_SECONDS + 1) {
        return res.status(400).json({ message: `O vídeo deve ter até ${MAX_VIDEO_SECONDS} segundos` });
      }
    }

    const activeCount = await Story.countDocuments({
      author: me,
      is_deleted: false,
      expires_at: { $gt: new Date() },
    });
    if (activeCount >= MAX_ACTIVE_STORIES) {
      return res.status(429).json({ message: "Limite de stories ativos atingido" });
    }

    const story = await Story.create({
      author: me,
      media_type,
      ...(media_type !== "text" && {
        media: {
          url: media.url,
          public_id: media.public_id,
          thumb: media.thumb,
          duration: Math.min(Number(media.duration) || 0, MAX_VIDEO_SECONDS),
          width: media.width,
          height: media.height,
          size: media.size,
        },
        caption: caption?.trim().slice(0, 200) || "",
      }),
      ...(media_type === "text" && {
        text_content: text_content.trim().slice(0, 300),
        background: Story.BACKGROUNDS.includes(background) ? background : "sunset",
      }),
      privacy: ["everyone", "friends", "only_me"].includes(privacy) ? privacy : "everyone",
      allow_replies: allow_replies !== false,
    });

    res.status(201).json({
      message: "Story publicado",
      data: serializeStory(story.toObject(), { isMe: true, view: null }),
    });

    // Fan-out em tempo real (não bloqueia a resposta)
    notifyAudience(me, story.privacy, "new_story", { author_id: me, story_id: toId(story._id) });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Erro ao criar story:", error);
    res.status(500).json({ message: "Erro interno", error: error.message });
  }
};

/* ---------------------------- visualizar --------------------------- */

// POST /stories/:id/view
const markViewed = async (req, res) => {
  try {
    const me = toId(req.user.id);
    const ctx = await loadViewableStory(req.params.id, me);
    if (!ctx) return res.status(404).json({ message: "Story não encontrado" });
    if (ctx.isOwner) return res.json({ ok: true });

    try {
      const result = await StoryView.updateOne(
        { story: ctx.story._id, viewer: me },
        { $setOnInsert: { author: ctx.story.author, liked: false, viewed_at: new Date() } },
        { upsert: true }
      );

      if (result.upsertedCount) {
        const updated = await Story.findByIdAndUpdate(
          ctx.story._id,
          { $inc: { views_count: 1 } },
          { new: true }
        ).select("views_count");

        emitToUser(toId(ctx.story.author), "story_viewed", {
          story_id: toId(ctx.story._id),
          views_count: updated?.views_count ?? 0,
        });
      }
    } catch (err) {
      if (err.code !== 11000) throw err; // corrida entre duas requisições: ignora
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao marcar story como visto:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};

/* ------------------------------ curtir ----------------------------- */

// POST /stories/:id/like  (alterna)
const toggleLike = async (req, res) => {
  try {
    const me = toId(req.user.id);
    const ctx = await loadViewableStory(req.params.id, me);
    if (!ctx) return res.status(404).json({ message: "Story não encontrado" });
    if (ctx.isOwner) return res.status(400).json({ message: "Você não pode curtir o próprio story" });

    const existing = await StoryView.findOne({ story: ctx.story._id, viewer: me });
    let liked;

    if (!existing) {
      await StoryView.create({ story: ctx.story._id, viewer: me, author: ctx.story.author, liked: true });
      await Story.updateOne({ _id: ctx.story._id }, { $inc: { views_count: 1, likes_count: 1 } });
      liked = true;
    } else {
      liked = !existing.liked;
      existing.liked = liked;
      await existing.save();
      await Story.updateOne({ _id: ctx.story._id }, { $inc: { likes_count: liked ? 1 : -1 } });
    }

    const updated = await Story.findById(ctx.story._id).select("likes_count views_count").lean();

    if (liked) {
      emitToUser(toId(ctx.story.author), "story_liked", {
        story_id: toId(ctx.story._id),
        likes_count: updated?.likes_count ?? 0,
        views_count: updated?.views_count ?? 0,
        user: { _id: me },
      });
    }

    res.json({ liked, likes_count: updated?.likes_count ?? 0 });
  } catch (error) {
    console.error("Erro ao curtir story:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};

/* ------------------------------ responder -------------------------- */

// POST /stories/:id/reply  { content }
// Vira uma mensagem direta com contexto do story (message_type: 'story_reply')
const replyToStory = async (req, res) => {
  try {
    const me = toId(req.user.id);
    const content = req.body.content?.toString().trim();

    if (!content) return res.status(400).json({ message: "A resposta não pode estar vazia" });

    const ctx = await loadViewableStory(req.params.id, me);
    if (!ctx) return res.status(404).json({ message: "Story não encontrado" });
    if (ctx.isOwner) return res.status(400).json({ message: "Você não pode responder o próprio story" });
    if (!ctx.story.allow_replies) return res.status(403).json({ message: "Respostas desativadas neste story" });

    const meOid = new mongoose.Types.ObjectId(me);
    const authorOid = new mongoose.Types.ObjectId(toId(ctx.story.author));

    // ASSUNÇÃO: participants = [{ user: ObjectId }, ...] (como no seu messageController)
    let conversation = await Conversation.findOne({
      type: "direct",
      participants: { $size: 2 },
      "participants.user": { $all: [meOid, authorOid] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [{ user: meOid }, { user: authorOid }],
      });
    }

    await Story.updateOne({ _id: ctx.story._id }, { $inc: { replies_count: 1 } });

    // Delega para o fluxo normal de mensagens
    req.body = {
      convId: toId(conversation._id),
      content: content.slice(0, 1000),
      source: "active",
      message_type: "story_reply",
      story_id: toId(ctx.story._id),
    };
    return sendMessage(req, res);
  } catch (error) {
    console.error("Erro ao responder story:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};

/* --------------------- visualizações (só o autor) ------------------ */

// GET /stories/:id/viewers?page=1
const getViewers = async (req, res) => {
  try {
    const me = toId(req.user.id);
    const { id } = req.params;
    if (!isValidId(id)) return res.status(404).json({ message: "Story não encontrado" });

    const story = await Story.findOne({ _id: id, author: me, is_deleted: false })
      .select("views_count likes_count")
      .lean();
    if (!story) return res.status(404).json({ message: "Story não encontrado" });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const [rows, total] = await Promise.all([
      StoryView.find({ story: id })
        .sort({ viewed_at: -1 })
        .skip((page - 1) * VIEWERS_PAGE_SIZE)
        .limit(VIEWERS_PAGE_SIZE)
        .populate("viewer", AUTHOR_SELECT)
        .lean(),
      StoryView.countDocuments({ story: id }),
    ]);

    res.json({
      items: rows
        .filter((r) => r.viewer)
        .map((r) => ({ user: r.viewer, liked: r.liked, viewed_at: r.viewed_at })),
      views_count: story.views_count,
      likes_count: story.likes_count,
      pagination: { page, total, hasMore: page * VIEWERS_PAGE_SIZE < total },
    });
  } catch (error) {
    console.error("Erro ao listar visualizações:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};

/* ------------------------------ excluir ---------------------------- */

// DELETE /stories/:id
const deleteStory = async (req, res) => {
  try {
    const me = toId(req.user.id);
    const { id } = req.params;
    if (!isValidId(id)) return res.status(404).json({ message: "Story não encontrado" });

    const story = await Story.findOneAndUpdate(
      { _id: id, author: me, is_deleted: false },
      { $set: { is_deleted: true } },
      { new: true }
    );
    if (!story) return res.status(404).json({ message: "Story não encontrado" });

    res.json({ message: "Story excluído" });

    notifyAudience(me, story.privacy, "story_deleted", { author_id: me, story_id: toId(story._id) });
  } catch (error) {
    console.error("Erro ao excluir story:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};

/* ------------------------------ arquivo ---------------------------- */

// GET /stories/me/archive?page=1&limit=24
const getMyArchive = async (req, res) => {
  try {
    const me = toId(req.user.id);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, parseInt(req.query.limit, 10) || 24);

    const [items, total] = await Promise.all([
      Story.find({ author: me, is_deleted: false })
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Story.countDocuments({ author: me, is_deleted: false }),
    ]);

    res.json({
      items: items.map((s) => ({
        ...serializeStory(s, { isMe: true, view: null }),
        expired: new Date(s.expires_at) <= new Date(),
      })),
      pagination: { page, total, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Erro ao carregar arquivo de stories:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};

/* ------------------------------ silenciar -------------------------- */

// POST /stories/mute/:userId  (alterna)
const toggleMuteUser = async (req, res) => {
  try {
    const me = toId(req.user.id);
    const { userId } = req.params;

    if (!isValidId(userId) || userId === me) {
      return res.status(400).json({ message: "Usuário inválido" });
    }

    const already = await User.exists({ _id: me, muted_stories: userId });
    await User.updateOne(
      { _id: me },
      already ? { $pull: { muted_stories: userId } } : { $addToSet: { muted_stories: userId } }
    );

    res.json({ muted: !already });
  } catch (error) {
    console.error("Erro ao silenciar stories:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};

module.exports = {
  getStoriesFeed,
  createStory,
  markViewed,
  toggleLike,
  replyToStory,
  getViewers,
  deleteStory,
  getMyArchive,
  toggleMuteUser,
};