/**
 * @fileoverview Hilfsfunktionen für Chat-UI (Scroll, Rendering, Helpers).
 * @module public/js/chatClient
 */

/**
 * Liefert das Nachrichten-Container-Element zurück.
 * @returns {HTMLElement|null}
 */

function getMessagesContainer() {
    return document.getElementById('messagesContainer');
}

/**
 * Prüft, ob der Scrollbereich nahe am unteren Ende ist.
 * @param {HTMLElement} [el=getMessagesContainer()] - Container-Element.
 * @returns {boolean}
 */
function isNearBottom(el = getMessagesContainer()) {
    if (!el) return false;
    const threshold = 200;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

/**
 * Aktualisiert die `data-last-id` im Container.
 * @param {number} [explicitId] - Optional explizite letzte Nachrichten-ID.
 * @returns {void}
 */
function updateLastMessageId(explicitId) {
    const container = getMessagesContainer();
    if (!container) return;
    let lastId = explicitId || 0;
    if (!lastId) {
        const lastNode = container.querySelector('[data-message-id]:last-of-type');
        if (lastNode) lastId = parseInt(lastNode.dataset.messageId, 10) || 0;
    }
    if (lastId) container.dataset.lastId = String(lastId);
}

/**
 * Entfernt ein leeres Platzhalter-Element `.no-messages` falls vorhanden.
 * @returns {void}
 */
function removeNoMessages() {
    const container = getMessagesContainer();
    if (!container) return;
    const empty = container.querySelector('.no-messages');
    if (empty) empty.remove();
}

/**
 * Scrollt den Nachrichten-Container ans Ende.
 * @param {boolean} [force=false] - Erzwinge Scrollen auch wenn nicht nahe Bottom.
 * @returns {void}
 */
function scrollToBottom(force = false) {
    const container = getMessagesContainer();
    if (!container) return;
    
    const shouldStick = force || isNearBottom(container);
    if (!shouldStick) return;
    /**
     * Verzögertes Scrollen ans Ende: kleine Timeout-Verzögerung, damit DOM-Änderungen abgeschlossen sind.
     * @returns {void}
     */
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 30);
}

/**
 * Bei Laden der Seite: sofort ans Ende scrollen (z. B. beim Öffnen eines Chats).
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
    scrollToBottom(true);
});

/**
 * HTMX `afterSwap`-Handler: reagiert auf Austausch des Nachrichtencontainers und scrollt ggf. nach unten.
 * @param {CustomEvent} event - HTMX-Ereignis mit `detail`-Metadaten.
 * @returns {void}
 */
document.body.addEventListener('htmx:afterSwap', (event) => {
    if (event.detail?.target?.id === 'messagesContainer') {
        const isManualSend = event.detail.requestConfig?.elt?.id === 'messageForm';
        removeNoMessages();
        updateLastMessageId();
        scrollToBottom(!!isManualSend); 
    }
});

// Prevent duplicate messages if SSE already added them
/**
 * HTMX `beforeSwap`-Handler: verhindert, dass HTMX eine Nachricht einfügt, die bereits vorhanden ist.
 * @param {CustomEvent} event - HTMX-Ereignis mit `detail`-Metadaten.
 * @returns {void}
 */
document.body.addEventListener('htmx:beforeSwap', (event) => {
    if (event.detail.target.id === 'messagesContainer' && event.detail.xhr.responseText) {
        const temp = document.createElement('div');
        temp.innerHTML = event.detail.xhr.responseText;
        const newMsg = temp.querySelector('[data-message-id]');
        if (newMsg) {
            const msgId = newMsg.dataset.messageId;
            if (document.querySelector(`[data-message-id="${msgId}"]`)) {
                console.log('HTMX: Message ' + msgId + ' already exists, skipping swap.');
                event.detail.shouldSwap = false;
            }
        }
    }
});

// 3. Fallback: Falls HTMX nach der Anfrage zusätzliche Zeit benötigt
/**
 * HTMX `afterRequest`-Handler als Fallback: stellt sicher, dass neu geladene Nachrichten den UI-Zustand aktualisieren.
 * @param {CustomEvent} event - HTMX-Ereignis.
 * @returns {void}
 */
document.body.addEventListener('htmx:afterRequest', (event) => {
    if (event.detail?.target?.id === 'messagesContainer') {
        removeNoMessages();
        updateLastMessageId();
        scrollToBottom();
    }
});

// Expose helpers for dmLive.js
window.isNearBottom = isNearBottom;
window.updateLastMessageId = updateLastMessageId;
window.scrollToBottom = scrollToBottom;
window.removeNoMessages = removeNoMessages;

// --- Modal & Context Menu Logic ---
let currentEditingId = null;

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('chatEditModal');
  const contextMenu = document.getElementById('chatContextMenu');
  const editField = document.getElementById('chatEditField');
  
  // Close menu and modal on backdrop clicks
  window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
    if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
  });

  // Save/Cancel buttons
  document.getElementById('cancelEditBtn').addEventListener('click', closeModal);
  document.getElementById('saveEditBtn').addEventListener('click', saveEdit);

  // Context Menu Actions
  document.getElementById('ctxEditBtn').addEventListener('click', () => {
    contextMenu.style.display = 'none';
    if (currentEditingId) openEditModal(currentEditingId);
  });
  document.getElementById('ctxDeleteBtn').addEventListener('click', () => {
    contextMenu.style.display = 'none';
    if (currentEditingId) deleteMessage(currentEditingId);
  });
});

/**
 * Öffnet das Bearbeitungs-Modal für eine Nachricht.
 */
function openEditModal(messageId) {
  currentEditingId = messageId;
  const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!msgEl) return;
  const contentEl = msgEl.querySelector('.message-content');
  const modal = document.getElementById('chatEditModal');
  const editField = document.getElementById('chatEditField');
  
  editField.value = contentEl.textContent.trim();
  modal.style.display = 'flex';
  editField.focus();
}

function closeModal() {
  document.getElementById('chatEditModal').style.display = 'none';
  currentEditingId = null;
}

async function saveEdit() {
  const messageId = currentEditingId;
  const newText = document.getElementById('chatEditField').value.trim();
  if (!messageId || !newText) return;

  const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!msgEl) return;
  const contentEl = msgEl.querySelector('.message-content');
  const oldText = contentEl.textContent;

  if (newText === oldText) {
    closeModal();
    return;
  }

  // Optimistic update
  const originalHtml = contentEl.innerHTML;
  contentEl.textContent = newText;
  let marker = msgEl.querySelector('.edited-marker');
  if (!marker) {
    marker = document.createElement('span');
    marker.className = 'edited-marker';
    marker.textContent = '(bearbeitet)';
    msgEl.querySelector('.message-time').prepend(marker);
  }

  closeModal();

  try {
    const isGroup = window.currentConversationId && String(window.currentConversationId).startsWith('group:');
    const endpoint = isGroup ? '/groups/edit' : '/dms/edit';
    const body = isGroup 
        ? { messageId, text: newText, groupId: window.currentConversationId.split(':')[1] }
        : { messageId, text: newText, conversationId: window.currentConversationId };

    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!resp.ok) {
        contentEl.innerHTML = originalHtml;
        alert('Fehler beim Bearbeiten');
    }
  } catch (e) {
    console.error('Edit error', e);
    contentEl.innerHTML = originalHtml;
  }
}

/**
 * Handle right click (context menu), click, or long-press on message
 */
let longPressTimer;
document.addEventListener('contextmenu', (e) => {
  const msgEl = e.target.closest('.message.sent:not(.deleted)');
  if (msgEl) {
    e.preventDefault();
    showContextMenu(e, msgEl.dataset.messageId);
  }
});

document.addEventListener('mousedown', (e) => {
  const msgEl = e.target.closest('.message.sent:not(.deleted)');
  if (msgEl) {
    msgEl.classList.add('long-press-active');
    longPressTimer = setTimeout(() => {
      msgEl.classList.remove('long-press-active');
      showContextMenu(e, msgEl.dataset.messageId);
    }, 500); // 500ms for long press
  }
});

document.addEventListener('mouseup', (e) => {
  clearTimeout(longPressTimer);
  const msgEl = e.target.closest('.message.sent:not(.deleted)');
  if (msgEl) msgEl.classList.remove('long-press-active');
});

document.addEventListener('touchstart', (e) => {
  const msgEl = e.target.closest('.message.sent:not(.deleted)');
  if (msgEl) {
    msgEl.classList.add('long-press-active');
    longPressTimer = setTimeout(() => {
      msgEl.classList.remove('long-press-active');
      showContextMenu(e.changedTouches[0], msgEl.dataset.messageId);
    }, 500);
  }
}, { passive: true });

document.addEventListener('touchend', (e) => {
  clearTimeout(longPressTimer);
  const msgEl = e.target.closest('.message.sent:not(.deleted)');
  if (msgEl) msgEl.classList.remove('long-press-active');
});

function showContextMenu(e, messageId) {
  const menu = document.getElementById('chatContextMenu');
  if (!menu) return;
  currentEditingId = messageId;
  menu.style.display = 'block';
  
  const clientX = e.pageX || (e.touches && e.touches[0].pageX);
  const clientY = e.pageY || (e.touches && e.touches[0].pageY);

  menu.style.left = Math.min(clientX, window.innerWidth - 160) + 'px';
  menu.style.top = Math.min(clientY, window.innerHeight - 100) + 'px';
}

/**
 * Öffnet einen Bearbeitungs-Prompt (Deprecated, now using Modal).
 * @async
 * @param {number|string} messageId - ID der Nachricht.
 * @returns {Promise<void>}
 */
async function openEditMessage(messageId) {
  openEditModal(messageId);
}

/**
 * Löscht eine Nachricht (optimistisch im UI, danach Request).
 * @async
 * @param {number|string} messageId - ID der Nachricht.
 * @returns {Promise<void>}
 */
async function deleteMessage(messageId) {
    const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!msgEl) return;

    // Optimistic update
    const originalContent = msgEl.innerHTML;
    msgEl.classList.add('deleted');
    msgEl.querySelector('.message-content').innerHTML = '<i>Diese Nachricht wurde gelöscht.</i>';
    const actions = msgEl.querySelector('.message-actions');
    if (actions) actions.remove();

    try {
        const isGroup = window.currentConversationId && String(window.currentConversationId).startsWith('group:');
        const endpoint = isGroup ? '/groups/delete' : '/dms/delete';
        const body = isGroup 
            ? { messageId, groupId: window.currentConversationId.split(':')[1] }
            : { messageId, conversationId: window.currentConversationId };

        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            msgEl.innerHTML = originalContent;
            msgEl.classList.remove('deleted');
            alert('Fehler beim Löschen');
        }
    } catch (e) {
        console.error('Delete error', e);
        msgEl.innerHTML = originalContent;
        msgEl.classList.remove('deleted');
    }
}

// Image loading logic
/**
 * Hydratiert Bilder: Ersetzt den Platzhalter durch das eigentliche Bild (data-src -> src).
 * @async
 * @returns {Promise<void>}
 */
async function hydrateImages() {
    const imgs = document.querySelectorAll('img.chat-image:not([data-hydrated])');
    for (const img of imgs) {
        img.setAttribute('data-hydrated', 'true');
        const src = img.getAttribute('data-src');
        if (src) {
            img.src = src;
        }
    }
}

// Watch for new images

const imageObserver = new MutationObserver(() => hydrateImages());

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('messagesContainer');
    if (container) {
        imageObserver.observe(container, { childList: true, subtree: true });
        hydrateImages();
        initPaginationObserver();
    }
});

/**
 * Initialisiert den IntersectionObserver für die Pagination (Load More).
 */
function initPaginationObserver() {
    const container = getMessagesContainer();
    if (!container) return;

    let observer;

    const setupObserver = () => {
        const target = container.querySelector('.load-more-container:not([data-observed])');
        if (!target) return;

        target.setAttribute('data-observed', 'true');

        if (!observer) {
            observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        if (el.classList.contains('load-more-container') && !el.dataset.loading) {
                            console.log('Infinite scroll: triggering load...');
                            el.dataset.loading = "true";
                            const textEl = el.querySelector('.load-more-text');
                            if (textEl) textEl.textContent = "Lade...";
                            htmx.trigger(el, 'load-history');
                            observer.unobserve(el);
                        }
                    }
                });
            }, {
                root: container,
                rootMargin: '150px 0px',
                threshold: 0
            });
        }
        observer.observe(target);
    };

    // Watch for new content (prepended messages + new load-more button)
    const mut = new MutationObserver(setupObserver);
    mut.observe(container, { childList: true });
    
    // Also re-run on HTMX swap just in case
    document.body.addEventListener('htmx:afterSwap', (evt) => {
        if (evt.detail.target.id === 'messagesContainer' || evt.detail.elt.classList.contains('load-more-container')) {
            setupObserver();
        }
    });

    setupObserver();
}

// Preserve scroll position when loading history (prepending content)
document.body.addEventListener('htmx:beforeSwap', (event) => {
    // Check if the swapped element is the load-more button
    const container = getMessagesContainer();
    const isHistoryLoad = event.detail.elt.classList.contains('load-more-container');
    
    if (isHistoryLoad && container) {
        // Save the current scroll position state
        event.detail.prevScrollHeight = container.scrollHeight;
        event.detail.prevScrollTop = container.scrollTop;
    }
});

document.body.addEventListener('htmx:afterSwap', (event) => {
    const container = getMessagesContainer();
    const isHistoryLoad = event.detail.elt.classList.contains('load-more-container');

    if (isHistoryLoad && container && event.detail.prevScrollHeight) {
        // Restore scroll position relative to the bottom content
        const newHeight = container.scrollHeight;
        const diff = newHeight - event.detail.prevScrollHeight;
        container.scrollTop = event.detail.prevScrollTop + diff;
    }
});

window.openEditMessage = openEditMessage;
window.deleteMessage = deleteMessage;

// Render a structured message record into HTML (used when loading from IndexedDB)
/**
 * Escaped HTML-Entities in einem String.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Rendert ein Nachrichten-Objekt als HTML-String (für IndexedDB-Rendering).
 * @param {Object} rec - Nachrichten-Datensatz.
 * @returns {string} HTML-Markup der Nachricht.
 */
function renderMessage(rec) {
    const isGroup = (rec.conversationId || window.currentConversationId || '').startsWith('group:');
    const sentClass = rec.sent ? 'sent' : 'received';
    const deletedClass = rec.is_deleted ? 'deleted' : '';
    const groupClass = isGroup ? 'group-msg' : '';
    const convId = rec.conversationId || window.currentConversationId || '';
    const msgId = rec.messageId || 0;

    let contentHtml = '';
    if (rec.is_deleted) {
        contentHtml = '<div class="message-content deleted-content"><i>Diese Nachricht wurde gelöscht.</i></div>';
    } else if (rec.type === 'file' && rec.file) {
        const f = rec.file;
        const fileBase = isGroup ? '/groups/file' : '/dms/file';
        const cleanConvId = isGroup ? convId.split(':')[1] : convId;

        if (f.isImage) {
            const src = escapeHtml(f.url || (`${fileBase}/${cleanConvId}/` + escapeHtml(f.filename) + '?inline=1'));
            const name = escapeHtml(f.originalName || f.filename || 'file');
            const size = escapeHtml(f.sizeKB || '');
            // Use data-src to prevent browser from pre-loading before hydration
            contentHtml = `\n  <div class="message-content file-row file-row-image">\n    <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-src="${src}" alt="${name}" class="chat-image js-open-image-modal" data-full-src="${src}">\n    <div class="file-text">\n      <a href="${src}" class="file-link js-open-image-modal" data-full-src="${src}">${name}</a>\n      <span class="file-size">(${size} KB)</span>\n    </div>\n  </div>`;
        } else {
            const href = escapeHtml(f.url || (`${fileBase}/${cleanConvId}/` + escapeHtml(f.filename)));
            const name = escapeHtml(f.originalName || f.filename || 'file');
            const size = escapeHtml(f.sizeKB || '');
            contentHtml = `\n  <div class="message-content file-row">\n    <span class="file-icon">Anhang</span>\n    <div class="file-text">\n      <a href="${href}" download="${name}" class="file-link">${name}</a>\n      <span class="file-size">(${size} KB)</span>\n    </div>\n  </div>`;
        }
    } else {
        const text = rec.text != null ? escapeHtml(rec.text) : '';
        contentHtml = `<div class="message-content">${text}</div>`;
    }

    // time and markers
    const timeText = rec.createdAt ? (new Date(rec.createdAt)).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
    const editedMarker = (rec.is_edited && !rec.is_deleted) ? '<span class="edited-marker">(bearbeitet)</span>' : '';
    const readStatus = (!isGroup && rec.sent && rec.is_read) ? '<span class="read-status">Gelesen</span>' : (!isGroup && rec.sent ? '<span class="read-status">Gesendet</span>' : '');
    const senderHtml = (isGroup && !rec.sent && rec.senderName) ? `<span class="message-sender" style="font-size: 0.7rem; opacity: 0.8; margin-left: 5px;">- ${escapeHtml(rec.senderName)}</span>` : '';

    // actions only for sent, not deleted and not a file
    const actionsHtml = (rec.sent && !rec.is_deleted && rec.type !== 'file') ? `\n  <div class="message-actions">\n    <button class="edit-btn" onclick="openEditMessage('${msgId}')">Bearbeiten</button>\n    <button class="delete-btn" onclick="deleteMessage('${msgId}')">Löschen</button>\n  </div>` : '';

    return `<div class="message ${sentClass} ${deletedClass} ${groupClass}" data-message-id="${msgId}" data-conversation-id="${convId}">\n${contentHtml}\n  <div class="message-time">\n    ${timeText} ${editedMarker} ${readStatus} ${senderHtml}\n  </div>${actionsHtml}\n</div>`;
}

window.renderMessage = renderMessage;

function togglePerMessagePolling(paused) {

    document.querySelectorAll('[data-poll="1"]').forEach(el => {
        if (paused) {
            if (el.hasAttribute('hx-trigger')) el.setAttribute('data-prev-trigger', el.getAttribute('hx-trigger'));
            el.removeAttribute('hx-trigger');
        } else {
            
            const prev = el.getAttribute('data-prev-trigger') || 'every 3s';
            el.setAttribute('hx-trigger', prev);
            el.removeAttribute('data-prev-trigger');
        }
    });
}


document.addEventListener('visibilitychange', () => togglePerMessagePolling(document.hidden));

document.addEventListener('DOMContentLoaded', () => {
  if (document.hidden) togglePerMessagePolling(true);
});
