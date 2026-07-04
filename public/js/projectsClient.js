document.addEventListener('click', (e) => {
// UI-Interaktionen verarbeiten
// DOM-Zustand verwalten
// Benutzereingaben behandeln
// Daten aktualisieren und anzeigen
  const btn = e.target.closest && e.target.closest('.filter-btn[data-status]');
  if (!btn) return;
  document.querySelectorAll('.filter-btn[data-status]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cur = document.getElementById('currentStatus');
  if (cur) cur.value = btn.dataset.status;
});

function animateProgressBars() {
  document.querySelectorAll('.progress-fill').forEach(bar => {
    const progress = bar.dataset.progress;
    bar.style.width = progress + '%';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  animateProgressBars();
  maybeAutoOpenCreateModalFromQuery();

  function setupUserSearch(inputId, hiddenId, resultsId) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return;

    let timeout;
    input.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      clearTimeout(timeout);

      if (query.length < 2) {
        results.style.display = 'none';
        return;
      }

      timeout = setTimeout(async () => {
        try {
          const res = await fetch(`/projects/contact-search?q=${encodeURIComponent(query)}`);
          const users = await res.json();
          if (users.length > 0) {
            results.innerHTML = users.map(u => `
              <div class="search-result-item" data-id="${u.user_id}" data-name="${u.username}">
                <div class="search-item-info">
                  <span class="search-item-name">${u.username}</span>
                  <span class="search-item-email">${u.email || ''}</span>
                </div>
              </div>
            `).join('');
            results.style.display = 'block';
            results.classList.add('active'); // Added to ensure visibility via projects.css
          } else {
            results.style.display = 'none';
            results.classList.remove('active');
          }
        } catch (err) {
          console.error('Search error:', err);
        }
      }, 300);
    });

    results.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item) {
        if (hidden) hidden.value = item.dataset.id;
        input.value = item.dataset.name;
        results.style.display = 'none';
        results.classList.remove('active');
      }
    });

    document.addEventListener('click', (ev) => {
      if (!ev.target.closest(`#${inputId}`) && !ev.target.closest(`#${resultsId}`)) {
        results.style.display = 'none';
        results.classList.remove('active');
      }
    });
  }

  setupUserSearch('contactSearch', 'contactPersonId', 'contactSearchResults');
  setupUserSearch('editContactSearch', 'editContactPersonId', 'editContactSearchResults');
  setupUserSearch('userSearchInput', null, 'userSearchResults'); // for Team Modal

  const createProjectModal = document.getElementById('createProjectModal');
  const editProjectModal = document.getElementById('editProjectModal');
  const teamModal = document.getElementById('teamModal');

  [createProjectModal, editProjectModal, teamModal].forEach(m => {
    if (m) m.style.overflow = 'visible';
  });

  const teamResults = document.getElementById('userSearchResults');
  if (teamResults) {
    teamResults.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item) selectedUserId = item.dataset.id;
    });
  }
});

document.addEventListener('htmx:afterSwap', (e) => {
  if (e.detail.target.id === 'projectsList' || e.detail.target.closest('#projectsList')) {
    animateProgressBars();
  }
});

const openCreateModalBtns = document.querySelectorAll('#openCreateModal, #openCreateModalEmpty');
const createProjectModal = document.getElementById('createProjectModal');
const editProjectModal = document.getElementById('editProjectModal');
const projectNameInput = document.getElementById('project-name');
const projectDescriptionInput = document.getElementById('project-description');
const convertIdeaIdInput = document.getElementById('convertIdeaId');
const expectedAuthorIdInput = document.getElementById('expectedAuthorId');
const convertIdeaBadge = document.getElementById('convertIdeaBadge');
const contactSearchInput = document.getElementById('contactSearch');
const contactPersonIdInput = document.getElementById('contactPersonId');
const contactSearchResults = document.getElementById('contactSearchResults');

let selectedContactId = null;
let selectedContactResults = [];
let selectedContactResultIndex = -1;

function setSelectedContact(user) {
  if (!user) return;
  selectedContactId = String(user.user_id);
  if (contactPersonIdInput) contactPersonIdInput.value = selectedContactId;
  if (contactSearchInput) contactSearchInput.value = user.username || '';
  if (contactSearchResults) {
    contactSearchResults.style.display = 'none';
    contactSearchResults.innerHTML = '';
  }
  selectedContactResults = [];
  selectedContactResultIndex = -1;
}

function setConvertBadge(convertIdeaId) {
  if (!convertIdeaBadge) return;
  if (convertIdeaId) {
    convertIdeaBadge.textContent = `Vorausgefüllt aus Idee #${convertIdeaId} — überprüfe Daten vor Erstellen`;
    convertIdeaBadge.style.display = 'block';
    return;
  }
  convertIdeaBadge.style.display = 'none';
}

function maybeAutoOpenCreateModalFromQuery() {
  if (!createProjectModal) return;
  const params = new URLSearchParams(window.location.search);
  const convertIdeaId = params.get('convertIdeaId');
  const prefillTitle = params.get('prefillTitle');
  const prefillDesc = params.get('prefillDesc');
  const authorId = params.get('authorId');
  const authorName = params.get('authorName');

  if (!convertIdeaId) return;

  if (projectNameInput && prefillTitle !== null) projectNameInput.value = prefillTitle;
  if (projectDescriptionInput && prefillDesc !== null) projectDescriptionInput.value = prefillDesc;
  if (convertIdeaIdInput) convertIdeaIdInput.value = convertIdeaId;
  if (expectedAuthorIdInput && authorId) expectedAuthorIdInput.value = authorId;
  setConvertBadge(convertIdeaId);

  if (authorId && authorName) {
    setSelectedContact({ user_id: authorId, username: authorName });
  }

  createProjectModal.showModal();
  projectNameInput?.focus();
}

if (createProjectModal) {
    openCreateModalBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (convertIdeaIdInput) convertIdeaIdInput.value = '';
        if (expectedAuthorIdInput) expectedAuthorIdInput.value = '';
        setConvertBadge('');
        createProjectModal.showModal();
        projectNameInput?.focus();
      });
    });
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('edit-project')) {
    const projectId = e.target.dataset.id;
      const projectCard = document.getElementById(`project-${projectId}`);
      
      if (projectCard) {
        const title = projectCard.querySelector('.project-title').textContent;
        const descEl = projectCard.querySelector('.project-desc');
        const description = descEl ? descEl.textContent.trim() : '';
        
        document.getElementById('edit-project-name').value = title;
        document.getElementById('edit-project-desc').value = description === 'Keine Beschreibung verfügbar' ? '' : description;
        
        const status = projectCard.dataset.status || 'Konzeption';
        document.getElementById('edit-project-status').value = status;
        
        const progressFill = projectCard.querySelector('.progress-fill');
        const progress = progressFill ? progressFill.dataset.progress : 0;
        document.getElementById('edit-project-progress').value = String(progress);

        const editContactSearch = document.getElementById('editContactSearch');
        const editContactHidden = document.getElementById('editContactPersonId');
        if (editContactSearch && editContactHidden && projectCard.dataset.contactId) {
            editContactHidden.value = projectCard.dataset.contactId;
            editContactSearch.value = projectCard.dataset.contactName || 'Unbekannter Nutzer';
        }

        document.getElementById('editProjectForm').action = `/projects/${projectId}/edit`;
        
        const deleteBtn = document.getElementById('deleteProjectBtn');
        if (deleteBtn) {
           deleteBtn.onclick = () => {
             if (confirm('Möchten Sie dieses Projekt wirklich löschen?')) {
               htmx.ajax('POST', `/projects/${projectId}/delete`, {
                 target: `#project-${projectId}`,
                 swap: 'outerHTML'
               });
               editProjectModal.close();
             }
           };
        }

        editProjectModal.showModal();
      }
    }
  });


function clearSearch() {
  const searchInput = document.getElementById('projectSearchInput');
  if (searchInput) searchInput.value = '';
  
  const status = document.getElementById('currentStatus')?.value || 'all';
  htmx.ajax('GET', `/projects/fragment?status=${encodeURIComponent(status)}&search=&page=1`, {
    target: '#projectsList', 
    swap: 'innerHTML'
  });
}

const teamModal = document.getElementById('teamModal');
const teamListBody = document.getElementById('teamListBody');
const teamProjectName = document.getElementById('teamProjectName');
const teamManagementSection = document.getElementById('teamManagementSection');
const userSearchInput = document.getElementById('userSearchInput');
const userSearchResults = document.getElementById('userSearchResults');
const addMemberBtn = document.getElementById('addMemberBtn');
const newMemberRole = document.getElementById('newMemberRole');

let currentProjectId = null;
let selectedUserId = null;

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('view-team')) {
    const btn = e.target;
    const projectId = btn.dataset.id;
    const projectName = btn.dataset.name;
    const projectCard = document.getElementById(`project-${projectId}`);

    if (!projectCard) return;

    currentProjectId = projectId;
    if (teamProjectName) teamProjectName.textContent = projectName;
    
    try {
      const teamData = JSON.parse(projectCard.dataset.team || '[]');
      const canManage = projectCard.dataset.canManageTeam === 'true';
      
      renderTeam(teamData, canManage);
      
      if (teamManagementSection) {
        teamManagementSection.style.display = canManage ? 'block' : 'none';
      }
    } catch (err) {
      console.error('Error parsing team data:', err);
    }

    if (teamModal) teamModal.showModal();
  }
});

async function loadTeam(projectId) {
  try {
    const res = await fetch(`/projects/${projectId}/team`);
    const data = await res.json();
    
    const projectCard = document.getElementById(`project-${projectId}`);
    if (projectCard) {
      projectCard.dataset.team = JSON.stringify(data.team);
      projectCard.dataset.canManageTeam = String(data.canManage);
    }

    renderTeam(data.team, data.canManage);
    
    if (teamManagementSection) {
      teamManagementSection.style.display = data.canManage ? 'block' : 'none';
    }
  } catch (err) {
    console.error('Error loading team:', err);
  }
}

function renderTeam(team, canManage) {
  if (!teamListBody) return;
  
  const memberCountBadge = document.getElementById('memberCountBadge');
  if (memberCountBadge) memberCountBadge.textContent = team.length;

  if (team.length === 0) {
    teamListBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-table-state">
           <div class="empty-icon">👥</div>
           <p>Noch keine Teammitglieder vorhanden.</p>
        </td>
      </tr>`;
    return;
  }

  const projectCard = document.getElementById(`project-${currentProjectId}`);
  const contactId = projectCard ? parseInt(projectCard.dataset.contactId) : null;

  teamListBody.innerHTML = team.map(member => {
    const isContact = parseInt(member.user_id) === contactId;
    const canRemove = canManage && member.user_id && !isContact;
    const joinedDate = member.joined_at ? new Date(member.joined_at).toLocaleDateString('de-DE') : 'Unbekannt';

    return `
      <tr class="${isContact ? 'is-contact-row' : ''}">
        <td data-label="Name" class="member-name-column">
          <div class="member-name-cell">
            ${member.user_id ? `
              <a href="/dms/direct/${member.user_id}" class="member-table-link" title="Nachricht an ${member.username} senden">
                ${member.username}
              </a>` : `<span class="member-username-text">${member.username}</span>`}
            ${isContact ? '<span class="contact-label-tag">Admin</span>' : ''}
          </div>
        </td>
        <td data-label="Rolle" class="member-role-column">
          <span class="role-tag role-${(member.role || 'mitglied').toLowerCase()}">${member.role || 'Mitglied'}</span>
        </td>
        <td data-label="Beigetreten" class="member-joined-column text-muted">${joinedDate}</td>
        <td data-label="Aktionen" class="member-actions-column">
          <div class="actions-cell-content">
            ${canRemove ? `
              <button onclick="removeMember(${member.user_id})" class="btn-table-remove" title="Mitglied entfernen">
                ✕ Mitglied entfernen
              </button>
            ` : (isContact ? '<span class="text-muted small">Admin (fest)</span>' : '<span class="text-muted small">Keine Berechtigung</span>')}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

let searchTimeout;
userSearchInput?.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  
  if (query.length < 2) {
    if (userSearchResults) userSearchResults.style.display = 'none';
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`/projects/users/search?q=${encodeURIComponent(query)}`);
      const users = await res.json();
      
      if (userSearchResults) {
        if (users.length > 0) {
          userSearchResults.innerHTML = users.map(u => `
            <div class="search-result-item modern-search-item" data-id="${u.user_id}" data-name="${u.username}">
              <div class="search-item-info">
                <span class="search-item-name">${u.username}</span>
                <span class="search-item-email">${u.email}</span>
              </div>
            </div>
          `).join('');
          userSearchResults.style.display = 'block';
        } else {
          userSearchResults.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  }, 300);
});

userSearchResults?.addEventListener('click', (e) => {
  const item = e.target.closest('.search-result-item');
  if (item) {
    selectedUserId = item.dataset.id;
    if (userSearchInput) userSearchInput.value = item.dataset.name;
    userSearchResults.style.display = 'none';
  }
});

addMemberBtn?.addEventListener('click', async () => {
  if (!selectedUserId || !currentProjectId) {
    alert('Bitte wählen Sie einen Nutzer aus der Liste aus.');
    return;
  }
  
  try {
    const res = await fetch(`/projects/${currentProjectId}/team/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: selectedUserId,
        role: newMemberRole ? newMemberRole.value : 'Mitglied'
      })
    });
    
    if (res.ok) {
      selectedUserId = null;
      if (userSearchInput) userSearchInput.value = '';
      await loadTeam(currentProjectId);
    } else {
      const errorText = await res.text();
      alert('Fehler beim Hinzufügen des Mitglieds: ' + errorText);
    }
  } catch (err) {
    console.error('Add member error:', err);
  }
});

window.removeMember = async (userId) => {
  if (!confirm('Mitglied wirklich aus dem Team entfernen?')) return;
  
  try {
    const res = await fetch(`/projects/${currentProjectId}/team/remove/${userId}`, {
      method: 'POST'
    });
    
    if (res.ok) {
        await loadTeam(currentProjectId);
    } else {
        const errorText = await res.text();
        alert('Fehler beim Entfernen des Mitglieds: ' + errorText);
    }
  } catch (err) {
    console.error('Remove member error:', err);
  }
};

document.addEventListener('click', (e) => {
  if (userSearchResults && !e.target.closest('#userSearchInput') && !e.target.closest('#userSearchResults')) {
    userSearchResults.style.display = 'none';
  }
  if (contactSearchResults && !e.target.closest('#contactSearch') && !e.target.closest('#contactSearchResults')) {
    contactSearchResults.style.display = 'none';
  }
});

(function() {
  const INACTIVITY_TIMEOUT = 120000; // 2 minutes
  let timeoutId = null;
  function setupInactivityStop(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!el.dataset.originalHxTrigger) el.dataset.originalHxTrigger = el.getAttribute('hx-trigger') || '';

    function disablePolling() {
      const orig = el.dataset.originalHxTrigger || '';
      const newTrig = orig.split(',').map(s => s.trim()).filter(t => !t.startsWith('every')).join(', ');
      el.setAttribute('hx-trigger', newTrig || 'load');
      if (window.htmx) htmx.process(el);
    }

    function enablePolling() {
      const orig = el.dataset.originalHxTrigger || '';
      el.setAttribute('hx-trigger', orig);
      if (window.htmx) htmx.process(el);
    }

    function resetTimer() {
      try {
        disablePolling();
        setTimeout(() => { enablePolling(); }, 50);
      } catch (e) {}

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { disablePolling(); }, INACTIVITY_TIMEOUT);
    }

    ['mousemove','keydown','click','touchstart'].forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (timeoutId) clearTimeout(timeoutId); disablePolling(); } else resetTimer(); });
    window.addEventListener('focus', resetTimer);
    document.addEventListener('htmx:afterRequest', resetTimer);

    document.addEventListener('DOMContentLoaded', resetTimer);
  }

  setupInactivityStop('projectsList');
})();


