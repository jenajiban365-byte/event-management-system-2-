/**
 * EventHub Campus Chat — extras (star, pin, unread filter, quick replies,
 * copy, link previews, forward, mute duration). Local-first where API lacks support.
 */
(function (global) {
  'use strict';

  const KEYS = {
    stars: 'eh_chat_stars',
    pins: 'eh_chat_pins',
    muteUntil: 'eh_chat_mute_until'
  };

  function readMap(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function writeMap(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (_) {}
  }

  /* ---- Stars (per message id) ---- */
  function isStarred(messageId) {
    return !!readMap(KEYS.stars)[String(messageId)];
  }
  function toggleStar(messageId) {
    const m = readMap(KEYS.stars);
    const id = String(messageId);
    if (m[id]) delete m[id];
    else m[id] = Date.now();
    writeMap(KEYS.stars, m);
    return !!m[id];
  }
  function starredIds() {
    return Object.keys(readMap(KEYS.stars));
  }

  /* ---- Pins (per conversation id) ---- */
  function isPinned(convId) {
    return !!readMap(KEYS.pins)[String(convId)];
  }
  function togglePin(convId) {
    const m = readMap(KEYS.pins);
    const id = String(convId);
    if (m[id]) delete m[id];
    else m[id] = Date.now();
    writeMap(KEYS.pins, m);
    return !!m[id];
  }
  function sortWithPins(list) {
    return list.slice().sort((a, b) => {
      const pa = isPinned(a._id || a.id) ? 1 : 0;
      const pb = isPinned(b._id || b.id) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
      return tb - ta;
    });
  }

  /* ---- Mute until (duration) ---- */
  function muteUntil(convId) {
    const t = readMap(KEYS.muteUntil)[String(convId)];
    return t ? Number(t) : 0;
  }
  function setMuteUntil(convId, msFromNow) {
    const m = readMap(KEYS.muteUntil);
    const id = String(convId);
    if (!msFromNow) delete m[id];
    else m[id] = Date.now() + msFromNow;
    writeMap(KEYS.muteUntil, m);
  }
  function isMutedNow(convId, serverMuted) {
    if (serverMuted) return true;
    const until = muteUntil(convId);
    if (!until) return false;
    if (Date.now() > until) {
      setMuteUntil(convId, 0);
      return false;
    }
    return true;
  }

  /* ---- Link preview from plain URL in text ---- */
  function linkPreviewHtml(text) {
    if (!text) return '';
    const m = String(text).match(/https?:\/\/[^\s<]+/i);
    if (!m) return '';
    let url = m[0].replace(/[.,);]+$/, '');
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (_) {}
    const safe = url.replace(/"/g, '&quot;');
    return `<a class="ehc-link-card" href="${safe}" target="_blank" rel="noopener noreferrer">
      <span class="ehc-link-card-icon">🔗</span>
      <span class="ehc-link-card-body"><b>${host}</b><small>${safe.length > 64 ? safe.slice(0, 64) + '…' : safe}</small></span>
      <span class="ehc-link-card-go">↗</span>
    </a>`;
  }

  /* ---- Quick campus replies ---- */
  const QUICK_REPLIES = [
    'On the way 🚶',
    'Library?',
    'See you at the event',
    'Running late 5 min',
    'Got it ✓',
    'Where are you?',
    'Can we meet after class?',
    'Thanks!'
  ];

  function quickRepliesHtml() {
    return `<div class="ehc-quick-replies" id="ehcQuickReplies" role="list">
      ${QUICK_REPLIES.map(t => `<button type="button" class="ehc-quick-reply" data-quick="${t.replace(/"/g, '&quot;')}">${t}</button>`).join('')}
    </div>`;
  }

  /* ---- Copy ---- */
  async function copyText(text) {
    const t = String(text || '');
    if (!t) return false;
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  /* ---- Seen label ---- */
  function seenLabel(readAt) {
    if (!readAt) return '';
    try {
      const d = new Date(readAt);
      if (isNaN(d.getTime())) return '';
      return 'Seen ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  global.EHChatExtras = {
    isStarred,
    toggleStar,
    starredIds,
    isPinned,
    togglePin,
    sortWithPins,
    muteUntil,
    setMuteUntil,
    isMutedNow,
    linkPreviewHtml,
    QUICK_REPLIES,
    quickRepliesHtml,
    copyText,
    seenLabel
  };
})(window);
