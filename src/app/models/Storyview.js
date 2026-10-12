// models/StoryView.js
// Uma linha por (story, viewer). Guarda visualização e curtida.
// Fica em coleção separada para não inflar o documento do Story.
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ARCHIVE_SECONDS = 8 * 24 * 60 * 60; // limpa um pouco depois dos stories

const storyViewSchema = new Schema({
  story: { type: Schema.Types.ObjectId, ref: "Story", required: true },
  viewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  liked: { type: Boolean, default: false },
  viewed_at: { type: Date, default: Date.now },
});

storyViewSchema.index({ story: 1, viewer: 1 }, { unique: true });
storyViewSchema.index({ story: 1, viewed_at: -1 }); // lista de visualizações do autor
storyViewSchema.index({ viewer: 1, story: 1 });
storyViewSchema.index({ viewed_at: 1 }, { expireAfterSeconds: ARCHIVE_SECONDS });

module.exports = mongoose.model("StoryView", storyViewSchema);