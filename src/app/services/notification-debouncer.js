// services/notificationDebouncer.js

/**
 * Agrupa notificações push por destinatário para evitar spam quando
 * várias mensagens chegam em sequência rápida.
 *
 * Estrutura do cache (em memória):
 * pendingByUser = Map<userId, {
 *     timer:      Timeout,
 *     playerId:   string,
 *     userId:     string,
 *     sendFn:     Function,
 *     extraData:  Object,          // campos estáveis de basePushData (ex: source)
 *     convs: Map<convId, {
 *         convId, senderName, count,
 *         lastMessagePreview, lastConvTitle,
 *         isGroup, lastMessageAt
 *     }>
 * }>
 *
 * NOTA: Em produção com múltiplas instâncias/processos, substitua este
 * Map em memória por Redis (ex: usando chaves com TTL e um job/worker
 * para disparar o envio, ou um sorted set + cron de poucos segundos).
 */

const DEBOUNCE_MS = 4000;

const pendingByUser = new Map();

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

const buildGroupedPushPayload = (entry) => {
  const { playerId, userId, extraData } = entry;
  const convList = Array.from(entry.convs.values());

  // Ordena pela mensagem mais recente para que o "firstSender" seja o mais atual
  convList.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  const totalMessages = convList.reduce((sum, c) => sum + c.count, 0);
  const distinctConvs = convList.length;

  let title;
  let message;

  if (distinctConvs === 1) {
    const conv = convList[0];
    title = conv.lastConvTitle;

    if (conv.count === 1) {
      message = conv.lastMessagePreview;
    } else {
      // FIX: ramos do ternário eram idênticos; agora diferenciam grupo de direto
      message = conv.isGroup
        ? `${conv.senderName} enviou ${conv.count} mensagens em ${conv.lastConvTitle}`
        : `${conv.senderName} enviou ${conv.count} mensagens`;
    }
  } else {
    const firstSender = convList[0].senderName;
    title   = 'Novas mensagens';
    message = `${firstSender} e mais ${distinctConvs - 1} pessoa${distinctConvs - 1 > 1 ? 's' : ''} enviaram-te mensagens`;
  }

  return {
    playerId,
    userId,
    ...extraData,             // largeIcon e outros campos estáveis
    title,
    message,
    data: {
      ...(extraData.data || {}),
      convId: distinctConvs === 1 ? convList[0].convId : null,
      groupedCount: totalMessages
    }
  };
};

/**
 * Cria (ou reinicia) o timer de disparo para um utilizador.
 * Sempre usa um closure fresco sobre `entry`, evitando capturar
 * basePushData de uma iteração anterior.
 */
const _armTimer = (userId, entry) => {
  if (entry.timer) clearTimeout(entry.timer);

  entry.timer = setTimeout(async () => {
    // Lê o estado atual do Map — reflete qualquer cancelamento parcial
    // ocorrido após o timer ter sido armado.
    const snapshot = pendingByUser.get(userId);
    pendingByUser.delete(userId);

    if (!snapshot || snapshot.convs.size === 0) return;

    const payload = buildGroupedPushPayload(snapshot);

    try {
      await snapshot.sendFn(payload);
    } catch (err) {
      console.error(`Falha ao enviar push agrupado para ${userId}:`, err.message);
      // Log detalhado para diagnóstico — sem retry (evita duplicate push)
      const total = Array.from(snapshot.convs.values())
        .reduce((s, c) => s + c.count, 0);
      console.error(`Mensagens não entregues para ${userId}: ${total} em ${snapshot.convs.size} conversa(s)`);
    }
  }, DEBOUNCE_MS);
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Agenda (ou atualiza) o envio agrupado de push para um utilizador.
 *
 * @param {Object}   params
 * @param {string}   params.userId
 * @param {string}   params.convId
 * @param {string}   params.convTitle        - título a mostrar (nome do remetente ou do grupo)
 * @param {string}   params.senderName
 * @param {string}   params.messagePreview   - texto da última mensagem
 * @param {boolean}  params.isGroup
 * @param {Object}   params.basePushData     - { playerId, userId, largeIcon?, data }
 * @param {Function} params.sendFn           - função real que envia o push
 */
const scheduleGroupedPush = ({
  userId,
  convId,
  convTitle,
  senderName,
  messagePreview,
  isGroup,
  basePushData,
  sendFn
}) => {
  let entry = pendingByUser.get(userId);

  if (!entry) {
    // FIX: playerId, sendFn e campos estáveis ficam na entrada, não no closure
    const { playerId, userId: uid, ...rest } = basePushData;
    entry = {
      timer:     null,
      playerId,
      userId:    uid,
      sendFn,
      extraData: rest,       // largeIcon, data.source, etc.
      convs:     new Map()
    };
    pendingByUser.set(userId, entry);
  }

  // Atualiza/cria os dados da conversa específica
  const existingConv = entry.convs.get(convId);
  entry.convs.set(convId, {
    convId,
    senderName,
    isGroup,
    lastConvTitle:       convTitle,
    lastMessagePreview:  messagePreview,
    lastMessageAt:       Date.now(),           // usado para ordenar remetentes
    count:               (existingConv?.count || 0) + 1
  });

  // FIX: timer sempre recriado via _armTimer — closure aponta para `entry`,
  // nunca para basePushData de uma iteração específica
  _armTimer(userId, entry);
};

/**
 * Cancela notificações pendentes de um utilizador para uma conversa
 * (ex: utilizador entra online ou marca conversa como lida antes do disparo).
 *
 * @param {string}      userId
 * @param {string|null} convId  - null cancela todas as conversas do utilizador
 */
const cancelPending = (userId, convId = null) => {
  const entry = pendingByUser.get(userId);
  if (!entry) return;

  if (!convId) {
    clearTimeout(entry.timer);
    pendingByUser.delete(userId);
    return;
  }

  entry.convs.delete(convId);

  if (entry.convs.size === 0) {
    clearTimeout(entry.timer);
    pendingByUser.delete(userId);
  } else {
    // FIX: reinicia o timer com closure fresco para que o próximo disparo
    // não inclua a conversa recém-cancelada
    _armTimer(userId, entry);
  }
};

module.exports = {
  scheduleGroupedPush,
  cancelPending
};