/**
 * @fileoverview SSE / Live-Update-Handler für Direktnachrichten (DMs).
 *
 * Stellt eine EventSource-Verbindung her, verarbeitet eingehende Events (neue Nachrichten,
 * Marker-Updates, Presence) und synchronisiert mit lokalem IndexedDB-Cache.
 * @module public/js/dmLive
 */
(() => {
  const container = document.getElementById('messagesContainer');
  const conversationId = window.currentConversationId;
  if (!container || !conversationId) return;

  let lastId = Number(container.dataset.lastId || 0) || 0;
  let eventSource = null;
  let pollTimeout = null;
  const statusEl = document.getElementById('connectionStatus');

  const clearStatusClasses = () => {
    if (!statusEl) return;
    statusEl.classList.remove('status-online','status-offline','status-polling','status-error');
  };

  /**
   * Setzt eine kurze Statusmeldung (z. B. Online/Offline/Polling) und passt CSS-Klassen an.
   * @param {string} text - Anzuzeigender Text.
   * @param {string} [cls] - Optionaler CSS-Klassenname für den Status.
   * @returns {void}
   */
  const setStatus = (text, cls) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    clearStatusClasses();
    if (cls) statusEl.classList.add(cls);
/**
 * Setzt eine kurze Statusmeldung (z.B. Online/Offline).
 * @param {string} text
 * @param {string} [cls]
 * @returns {void}
 */
  };

  /**
   * Fügt HTML-Nachrichten in den Container ein.
   * @param {string} html - HTML-Markup mit Nachrichten.
   * @returns {void}
   */
  const appendMessages = (html) => {
    if (!html) return;
    if (window.removeNoMessages) window.removeNoMessages(); 
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const upsertMessageNode = (node) => {
      const msgId = parseInt(node.dataset.messageId, 10);
      if (Number.isNaN(msgId)) return;

      const existing = container.querySelector(`[data-message-id="${msgId}"]`);
      if (existing) {
        existing.replaceWith(node);
        return;
      }

      const ordered = Array.from(container.querySelectorAll('[data-message-id]'));
      const insertBefore = ordered.find((el) => {
        const currentId = parseInt(el.dataset.messageId, 10);
        return !Number.isNaN(currentId) && currentId > msgId;
      });

      if (insertBefore) container.insertBefore(node, insertBefore);
      else container.appendChild(node);
    };

    const stickToBottom = window.isNearBottom ? window.isNearBottom(container) : true;
    
    // Hänge neue Nachrichtknoten an oder aktualisiere bestehende
    Array.from(temp.children).forEach((node) => {
      const msgId = parseInt(node.dataset.messageId, 10);
      if (Number.isNaN(msgId)) return;

      upsertMessageNode(node);
      if (msgId > lastId) lastId = msgId;
    });

    if (window.updateLastMessageId) window.updateLastMessageId(lastId);
    if (stickToBottom && window.scrollToBottom) window.scrollToBottom(true);
  };

  /**
   * Startet die SSE-Verbindung für Direktnachrichten.
   * @async
   * @returns {Promise<void>}
   */
  const startSSE = async () => {
    if (eventSource) eventSource.close();
    console.log('Attempting SSE connection for DM...');
    
    const msgNodes = container.querySelectorAll('.message');
    if (msgNodes.length > 0) {
      const lastNode = msgNodes[msgNodes.length - 1];
      const mid = parseInt(lastNode.dataset.messageId, 10);
      if (!isNaN(mid)) lastId = mid;
    }

    const url = `/dms/chat-updates/${conversationId}?afterId=${encodeURIComponent(lastId)}`;
    eventSource = new EventSource(url);

    // EventSource: Verbindung geöffnet
    eventSource.onopen = () => setStatus('Online', 'status-online');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.html) {
          const temp = document.createElement('div');
          temp.innerHTML = data.html;
          const stickToBottom = window.isNearBottom ? window.isNearBottom(container) : true;

          const upsertMessageNode = (node) => {
            const msgId = parseInt(node.dataset.messageId, 10);
            if (Number.isNaN(msgId)) return;

            const existing = container.querySelector(`[data-message-id="${msgId}"]`);
            if (existing) {
              existing.replaceWith(node);
            } else {
              const ordered = Array.from(container.querySelectorAll('[data-message-id]'));
              const insertBefore = ordered.find((el) => {
                const currentId = parseInt(el.dataset.messageId, 10);
                return !Number.isNaN(currentId) && currentId > msgId;
              });
              if (insertBefore) container.insertBefore(node, insertBefore);
              else container.appendChild(node);
            }
            if (msgId > lastId) lastId = msgId;
          };

          Array.from(temp.children).forEach((node) => upsertMessageNode(node));
          
          if (window.updateLastMessageId) window.updateLastMessageId(lastId);
          if (stickToBottom && window.scrollToBottom) window.scrollToBottom(true);
        }

        if (typeof data.lastId === 'number' && data.lastId > lastId) {
          lastId = data.lastId;
          if (window.updateLastMessageId) window.updateLastMessageId(lastId);
        }
        if (data.lastReadId) {
          updateReadStatus(data.lastReadId);
        }
      } catch (e) { console.error('SSE onmessage error', e); }
    };

  eventSource.addEventListener('marker', (ev) => {
        try {
            const data = JSON.parse(ev.data);
            if (data.type === 'update' && data.messageId && data.html) {
                const oldMsg = container.querySelector(`[data-message-id="${data.messageId}"]`);
                if (oldMsg) {
                    const temp = document.createElement('div');
                    temp.innerHTML = data.html.trim();
                    
                    const newMsg = temp.firstElementChild;
                    if (newMsg) {
                        oldMsg.replaceWith(newMsg);
                    }
                }
            }
        } catch (e) {
            console.error('Error handling marker event', e);
        }
    });

  eventSource.addEventListener('presence', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        const online = Array.isArray(data.online) ? data.online.map(Number) : [];
        const otherId = Number(window.otherUserId);
        const isOnline = online.includes(otherId);
        if (isOnline) setStatus('Online', 'status-online'); else setStatus('Offline', 'status-offline');
      } catch (e) {
        console.error('Error parsing presence event', e);
      }
    });

    // Fehler-Handler: bei Fehlern Verbindung schließen und erneut versuchen
    eventSource.onerror = () => {
      setStatus('Verbindung verloren...', 'status-offline');
      if (eventSource) eventSource.close();
      eventSource = null;
      setTimeout(startSSE, 5000);
    };
  };

  /**
   * Aktualisiert die Lesestatusanzeige für Nachrichten bis `lastReadId`.
   * @param {number} lastReadId
   * @returns {void}
   */
  const updateReadStatus = (lastReadId) => {
    console.log('Updating read status up to ID:', lastReadId);
    
    const messages = container.querySelectorAll('.message.sent');
  // Aktualisiert die „Gelesen“-Anzeige für Nachrichten bis `lastReadId`.
  messages.forEach(msg => {
      const msgId = parseInt(msg.dataset.messageId, 10);
      if (msgId <= lastReadId) {
        const statusEl = msg.querySelector('.read-status');
        if (statusEl && statusEl.textContent === 'Gesendet') {
          statusEl.textContent = 'Gelesen';
          statusEl.classList.add('read');
          statusEl.removeAttribute('hx-get');
          statusEl.removeAttribute('hx-trigger');
        }
      }
    });
  };

  /**
   * Schließt alle laufenden Verbindungen und räumt auf.
   * @returns {void}
   */
  const stopAll = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  window.addEventListener('pagehide', stopAll);
  window.addEventListener('beforeunload', stopAll);
  // Sichtbarkeitswechsel: bei Tab-Hiding Verbindungen schließen, beim Sichtbarwerden neu starten
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAll();
    else if (!eventSource) startSSE();
  });

  // Kleiner Send-Beacon beim Verlassen, um den Server sofort zu benachrichtigen (reduziert Cloudflare-Tunnel-Verzögerung)
  /**
   * Sendet beim Verlassen der Seite ein kurzes Beacon an den Server.
   * @returns {void}
   */
  function sendLeaveBeacon() {
    try {
      if (!conversationId) return;
      const payload = JSON.stringify({ conversationId: conversationId });
      if (navigator.sendBeacon) {
        
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/dms/leave', blob);
      } else {
        // Fallback: keepalive-Fetch (unterstützt in modernen Browsern)
        fetch('/dms/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
      }
    } catch (e) { /* ignorieren */ }
  }


  window.addEventListener('pagehide', () => { sendLeaveBeacon(); stopAll(); });

  window.addEventListener('beforeunload', () => { sendLeaveBeacon(); stopAll(); });

  startSSE();
})();
