/**
 * @fileoverview SSE / Live-Update-Handler für Gruppen-Chats.
 * @module public/js/groupLive
 */
(function(){
  const container = document.getElementById('messagesContainer');
  const groupId = window.groupId;
  const conversationId = window.currentConversationId; // e.g. "group:123"
  if (!container || !groupId) return;

  const toggleBtn = document.getElementById('toggleMembersBtn');
  const dropdown = document.getElementById('mobileMembersDropdown');
  if (toggleBtn && dropdown) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
    });
    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
    });
    dropdown.addEventListener('click', (e) => e.stopPropagation());
  }

  let lastId = Number(container.dataset.lastId || 0) || 0;
  let eventSource = null;
  let reconnectTimer = null;
  const statusEl = document.getElementById('connectionStatus');

  /**
   * Setzt Verbindungs-/Präsenz-Statusanzeige.
   * @param {string} text
   * @param {string} [cls]
   * @returns {void}
   */
  const setStatus = (text, cls) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = '';
    if (cls) statusEl.classList.add(cls);
  };

  /**
   * Startet SSE-Verbindung für Gruppen-Updates.
   * @async
   * @returns {Promise<void>}
   */
  const startSSE = async () => {
    if (eventSource) eventSource.close();
    
    const msgNodes = container.querySelectorAll('.message');
    if (msgNodes.length > 0) {
      const lastNode = msgNodes[msgNodes.length - 1];
      const mid = parseInt(lastNode.dataset.messageId, 10);
      if (!isNaN(mid)) lastId = mid;
    }

    const url = `/groups/updates/${groupId}?afterId=${lastId}`;
    eventSource = new EventSource(url);

    const upsertMessageNode = (node) => {
      const mid = parseInt(node.dataset.messageId, 10);
      if (isNaN(mid)) return;

      const existing = container.querySelector(`[data-message-id="${mid}"]`);
      if (existing) {
        existing.replaceWith(node);
        return;
      }

      const ordered = Array.from(container.querySelectorAll('[data-message-id]'));
      const insertBefore = ordered.find((el) => {
        const currentId = parseInt(el.dataset.messageId, 10);
        return !isNaN(currentId) && currentId > mid;
      });

      if (insertBefore) container.insertBefore(node, insertBefore);
      else container.appendChild(node);
    };

  // EventSource: Verbindung geöffnet
  eventSource.onopen = () => setStatus('Verbunden', 'status-online');
  eventSource.onerror = () => {
    setStatus('Verbindung verloren...', 'status-offline');
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      startSSE();
    }, 5000);
  };

  // Nachricht vom Server: neues HTML anhängen oder IDs aktualisieren
  eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.html) {
          const temp = document.createElement('div');
          temp.innerHTML = data.html;
          
          const newNodes = [];
          // Füge neue Nachrichtknoten positionsstabil hinzu oder aktualisiere bestehende
          Array.from(temp.children).forEach(node => {
            const mid = parseInt(node.dataset.messageId, 10);
            if (isNaN(mid)) return;

            upsertMessageNode(node);
            newNodes.push(node);
            if (mid > lastId) lastId = mid;
          });

          if (window.scrollToBottom) window.scrollToBottom();
        }
        if (data.lastId && data.lastId > lastId) lastId = data.lastId;
      } catch (e) {}
    };

  eventSource.addEventListener('marker', (ev) => {
        try {
            const data = JSON.parse(ev.data);
            if (data.type === 'update' && data.messageId && data.html) {
                const old = container.querySelector(`[data-message-id="${data.messageId}"]`);
                if (old) {
                    const temp = document.createElement('div');
                    temp.innerHTML = data.html.trim();
                    
                    const newNode = temp.firstElementChild;
                    if (newNode) {
                        old.replaceWith(newNode);
                    }
                }
            }
        } catch (e) {}
    });

  eventSource.addEventListener('presence', (ev) => {
        try {
            const data = JSON.parse(ev.data);
            
            const onlineIds = data.online || [];
      document.querySelectorAll('.member-item').forEach(el => {
                const uid = parseInt(el.dataset.userId, 10);
                el.classList.toggle('online', onlineIds.includes(uid));
            });
        } catch (e) {}
    });
  };

  startSSE();

  const stopAll = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  window.addEventListener('pagehide', stopAll);
  window.addEventListener('beforeunload', stopAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAll();
    else if (!eventSource) startSSE();
  });

  // Send-Vorgang wird per HTMX gehandhabt; bei Bedarf kann manuell eine SSE-Benachrichtigung ausgelöst werden

  /**
   * Globale API für Gruppen-Live-Funktionen.
   * @readonly
   */
  window.groupLive = { lastId, startSSE };
})();
