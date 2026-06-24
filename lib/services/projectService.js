/**
 * @fileoverview Projekt-Service: Verwaltung von Projekten, Teams und Synchronisation
 * mit Gruppenchat-Entitäten. Beinhaltet Such- und Paging-Funktionen.
 * JSDoc-Kommentare werden auf Deutsch geführt.
 * @module lib/services/projectService
 */

const db = require('../../config/db.js');

const pointsService = require('./pointsService');
const groupService = require('./groupService');
const adminService = require('./adminService');
const { isAdmin: hasAdminRole, isProjectLead } = require('../roleHelpers');

const ProjectService = {
    // --- Permission Checks ---
    /**
     * Prüft, ob ein Benutzer berechtigt ist, ein Projekt anzulegen.
     * @param {object} user - Nutzerobjekt (`role` erwartet).
     * @returns {boolean} `true` wenn der Nutzer ein Admin ist.
     */
    canUserCreateProject(user) {
        return !!user && (hasAdminRole(user) || isProjectLead(user));
    },

    /**
     * Prüft, ob ein Nutzer ein Projekt bearbeiten darf.
     * Admins dürfen immer, Projektleiter nur für ihre Projekte.
     * @param {object} user
     * @param {object} project
     * @returns {boolean}
     */
    canUserEditProject(user, project) {
        if (hasAdminRole(user)) return true;
        return isProjectLead(user) && project.contact_person_id === user.id;
    },

    /**
     * Prüft Löschrechte für ein Projekt (Admin oder zuständiger Projektleiter).
     * @param {object} user
     * @param {object} project
     * @returns {boolean}
     */
    canUserDeleteProject(user, project) {
        if (hasAdminRole(user)) return true;
        return isProjectLead(user) && project.contact_person_id === user.id;
    },

    /**
     * Prüft, ob ein Nutzer das Projektteam verwalten darf.
     * Admins dürfen immer, der Projekt-Ansprechpartner darf ebenfalls.
     * @param {object} user
     * @param {object} project
     * @returns {boolean}
     */
    canUserManageTeam(user, project) {
        if (hasAdminRole(user)) return true;
        return project.contact_person_id === user.id;
    },

    // --- Data Fetching ---

    async getContactOptions(user) {
        const users = await db.query(`
            SELECT u.user_id, u.username, u.email
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE r.name = 'Projektleiter'
            ORDER BY u.username
        `);

        let adminSelf = null;
        if (hasAdminRole(user)) {
            const adminRows = await db.query(
                'SELECT user_id, username, email FROM users WHERE user_id = ?',
                [user.id]);
            const adminRecord = adminRows[0];
            adminSelf = adminRecord || {
                user_id: user.id,
                username: user.username,
                email: user.email
            };
        }

        const contactOptions = [...users];
        // Falls der Admin selbst als Ansprechpartner in Frage kommt, füge ihn hinzu, falls noch nicht vorhanden
        if (adminSelf && !contactOptions.some(u => u.user_id === adminSelf.user_id)) {
            contactOptions.push(adminSelf);
        }
        return contactOptions;
    },

    async searchContactCandidates(query) {
        const q = String(query || '').trim();
        if (q.length < 2) return [];

        return await db.query(`
            SELECT u.user_id, u.username, u.email, r.name AS role
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.username LIKE ? OR u.email LIKE ?
            ORDER BY
                CASE
                    WHEN r.name = 'Projektleiter' THEN 0
                    WHEN r.name = 'Admin' THEN 1
                    ELSE 2
                END,
                u.username ASC
            LIMIT 20
        `, [`%${q}%`, `%${q}%`]);
    },

    async getProjectsList(user, { page = 1, limit = 8, status = 'all', search = '', userOnly = false }) {
        // Robuste Behandlung mehrfach übergebener Query-Parameter (Arrays) aus Routen
        const statusFilter = Array.isArray(status) ? String(status[status.length - 1]) : String(status);
        const searchQuery = Array.isArray(search) ? String(search[search.length - 1]) : String(search);
        const isUserOnly = userOnly === 'on' || userOnly === 'true' || userOnly === true;

        let sql = `
            SELECT DISTINCT p.*, u.username as contact_person_name, u.email as contact_email, g.id as group_id
            FROM projects p
            LEFT JOIN users u ON p.contact_person_id = u.user_id
            LEFT JOIN group_chats g ON g.project_id = p.project_id
            LEFT JOIN project_teams pt ON pt.project_id = p.project_id
        `;
        const whereParts = [];
        const params = [];

        if (statusFilter !== 'all') {
            whereParts.push('p.status = ?');
            params.push(statusFilter);
        }

        if (isUserOnly && user && user.id) {
            whereParts.push('(p.contact_person_id = ? OR pt.user_id = ?)');
            params.push(user.id, user.id);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.trim();
            whereParts.push('(LOWER(p.name) LIKE CONCAT(\'%\', LOWER(?), \'%\') OR LOWER(u.username) LIKE CONCAT(\'%\', LOWER(?), \'%\') OR bounded_edit_dist(LOWER(p.name), LOWER(?), 4) <= 4 OR bounded_edit_dist(LOWER(u.username), LOWER(?), 4) <= 4)');
            params.push(q, q, q, q);
        }

        if (whereParts.length) sql += ' WHERE ' + whereParts.join(' AND ');
        sql += ` ORDER BY CASE p.status WHEN 'Konzeption' THEN 1 WHEN 'Umsetzung' THEN 2 WHEN 'Abgeschlossen' THEN 3 END, p.created_at DESC`;

        const allProjects = await db.query(sql, params);
        const startIndex = (page - 1) * limit;
    const pageProjects = allProjects.slice(startIndex, startIndex + limit);

    // IDs der Projekte auf der aktuellen Seite extrahieren (für Team-Lookup)
    const projectIds = pageProjects.map(p => p.project_id);
    let teamsMap = {};
        
        if (projectIds.length > 0) {
            const placeholders = projectIds.map(() => '?').join(',');
            const allTeams = await db.query(`
                SELECT pt.project_id, u.user_id, u.username, u.email, pt.role, pt.joined_at
                FROM project_teams pt
                JOIN users u ON pt.user_id = u.user_id
                WHERE pt.project_id IN (${placeholders})
                ORDER BY pt.joined_at ASC
            `, projectIds);
            
            // Gruppiere Team-Mitglieder pro Projekt-ID
            allTeams.forEach(member => {
                if (!teamsMap[member.project_id]) teamsMap[member.project_id] = [];
                teamsMap[member.project_id].push(member);
            });
        }

        // Baue finale Projekt-Objekte mit Berechtigungsflags und zugehörigem Team
        const projects = pageProjects.map(p => ({
            ...p,
            canEdit: this.canUserEditProject(user, p),
            canDelete: this.canUserDeleteProject(user, p),
            canManageTeam: this.canUserManageTeam(user, p),
            team: teamsMap[p.project_id] || []
        }));

        const totalResults = allProjects.length;
        const totalPages = Math.ceil(totalResults / limit);
        const hasNextPage = (startIndex + limit) < totalResults;

        return {
            projects,
            currentStatus: statusFilter,
            currentSearch: searchQuery,
            isUserOnly,
            currentPage: page,
            totalPages,
            totalResults,
            nextPage: hasNextPage ? page + 1 : null,
            hasNextPage
        };
    },

    // --- CRUD Operations ---

    async createProject(user, data, options = {}) {
        if (!this.canUserCreateProject(user)) {
            throw new Error('FORBIDDEN: Nur Admin kann Projekte erstellen');
        }

        const { name, description, status, progress, contact_person_id, convertIdeaId, expected_author_id, autoPromoteContact } = data;

        let finalContactPersonId = contact_person_id && String(contact_person_id).trim() !== '' 
            ? parseInt(contact_person_id) 
            : null;

        // If the creator is a Projektleiter, force the contact person to themselves
        if (isProjectLead(user)) {
            finalContactPersonId = parseInt(user.id);
        }

        const finalConvertIdeaId = convertIdeaId && String(convertIdeaId).trim() !== ''
            ? parseInt(convertIdeaId)
            : null;

        const expectedAuthorId = expected_author_id && String(expected_author_id).trim() !== ''
            ? parseInt(expected_author_id)
            : null;

        const shouldAutoPromoteContact = options.autoPromoteContact === false
            ? false
            : !(String(autoPromoteContact || '').toLowerCase() === 'false' || String(autoPromoteContact || '').toLowerCase() === 'off');

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            let convertIdea = null;
            if (finalConvertIdeaId) {
                const ideaRows = await conn.query(
                    'SELECT idea_id, user_id, status FROM ideas WHERE idea_id = ? FOR UPDATE',
                    [finalConvertIdeaId]
                );
                convertIdea = ideaRows[0];
                if (!convertIdea) {
                    throw new Error('BAD_REQUEST: Idea für Konvertierung nicht gefunden');
                }
                if (expectedAuthorId && Number(convertIdea.user_id) !== Number(expectedAuthorId)) {
                    throw new Error('BAD_REQUEST: Idea-Autor passt nicht zu den Konvertierungsdaten');
                }
                if (String(convertIdea.status || '').toLowerCase() !== 'akzeptiert') {
                    throw new Error('BAD_REQUEST: Nur akzeptierte Ideen können in Projekte umgewandelt werden');
                }
            }

            if (finalContactPersonId) {
                const contactRows = await conn.query(`
                    SELECT r.name as role, u.user_id
                    FROM users u
                    JOIN roles r ON u.role_id = r.role_id
                    WHERE u.user_id = ?
                `, [finalContactPersonId]);
                const contactUser = contactRows[0];
                if (!contactUser) {
                    throw new Error('BAD_REQUEST: Ansprechpartner nicht gefunden');
                }

                if (!isProjectLead(contactUser) && !hasAdminRole(contactUser)) {
                    if (!shouldAutoPromoteContact) {
                        throw new Error('BAD_REQUEST: Ansprechpartner ist kein Projektleiter (Auto-Promote deaktiviert)');
                    }
                    await adminService.promoteToRole(finalContactPersonId, 'Projektleiter', user.id, conn);
                }
            }

            const trimmedName = String(name || '').trim();

            // Case-insensitive uniqueness checks: projects and ideas
            const existingProject = await conn.query(
                'SELECT project_id FROM projects WHERE LOWER(name) = LOWER(?) LIMIT 1',
                [trimmedName]
            );
            if (existingProject && existingProject.length > 0) {
                throw new Error('BAD_REQUEST: Ein Projekt mit diesem Namen existiert bereits');
            }

            // Note: do NOT check ideas for name collisions here — only projects should be unique by name.

            const result = await conn.query(
                'INSERT INTO projects (name, description, status, progress, contact_person_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [
                    trimmedName,
                    description?.trim() || null,
                    status || 'Konzeption',
                    Math.min(100, Math.max(0, progress || 0)),
                    finalContactPersonId
                ]
            );
            const projectId = result.insertId;

            // Legt automatisch den Gruppen-Chat im selben DB-Transaktionskontext an, um FK/Lock-Wartezeiten zu vermeiden
            try {
                // Use the contact person as the group owner when available; otherwise the creating admin remains owner
                const groupOwnerId = finalContactPersonId || user.id;
                const groupId = await groupService.createGroup({
                    name: `Projekt: ${name.trim()}`,
                    ownerUserId: groupOwnerId,
                    projectId: projectId,
                    isPrivate: true
                }, conn);
                // If contact is different from the creating admin and is not the group owner, ensure they are added as admin
                if (finalContactPersonId && finalContactPersonId !== groupOwnerId) {
                    await groupService.addMember(groupId, finalContactPersonId, 'admin', conn);
                }
            } catch (groupErr) {
                console.error('Failed to create project group chat:', groupErr);
                // We don't fail the project creation if the chat fails, but we log it
            }

            if (finalContactPersonId) {
                await pointsService.addPendingDelta({ userId: finalContactPersonId, delta: 10, reason: 'project-created', source: 'projectService', conn });
                // Ansprechpartner automatisch zum Team hinzufügen
                await this._ensureContactInTeam(projectId, finalContactPersonId, conn);
            }

            if (convertIdea) {
                await conn.query(
                    'UPDATE ideas SET status = ?, updated_at = NOW() WHERE idea_id = ?',
                    ['umgesetzt', convertIdea.idea_id]
                );
            }

            await conn.commit();
            return { projectId };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    async updateProject(user, id, data) {
        const { name, description, status, progress, contact_person_id } = data;
        
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            const projectRows = await conn.query('SELECT * FROM projects WHERE project_id = ? FOR UPDATE', [id]);
            const project = projectRows[0];
            
            if (!project) throw new Error('NOT_FOUND: Projekt nicht gefunden');
            if (!this.canUserEditProject(user, project)) throw new Error('FORBIDDEN');
            
            let finalContactPersonId = project.contact_person_id;
            
            if (hasAdminRole(user) && contact_person_id && String(contact_person_id).trim() !== '') {
                const contactRows = await conn.query(`
                    SELECT r.name as role, u.user_id
                    FROM users u 
                    JOIN roles r ON u.role_id = r.role_id 
                    WHERE u.user_id = ?
                `, [contact_person_id]);
                const contactUser = contactRows[0];
                
                const isProjectLeadContact = contactUser && isProjectLead(contactUser);
                const isAdminSelf = contactUser && hasAdminRole(contactUser) && contactUser.user_id === user.id;

                if (!contactUser || (!isProjectLeadContact && !isAdminSelf)) {
                    throw new Error('BAD_REQUEST: Ansprechpartner muss ein Projektleiter oder der aktuelle Admin sein');
                }
                finalContactPersonId = parseInt(contact_person_id);
            }

            if (finalContactPersonId !== project.contact_person_id) {
                if (project.contact_person_id) {
                    await pointsService.addPendingDelta({ userId: project.contact_person_id, delta: -5, reason: 'project-contact-removed', source: 'projectService', conn });
                }
                if (finalContactPersonId) {
                    await pointsService.addPendingDelta({ userId: finalContactPersonId, delta: 10, reason: 'project-contact-added', source: 'projectService', conn });
                }

                // Sync new contact person to group chat as admin
                try {
                    const groupId = await groupService.getGroupIdByProjectId(id);
                    if (groupId && finalContactPersonId) {
                        await groupService.addMember(groupId, finalContactPersonId, 'admin', conn);
                    }
                } catch (e) {
                    console.error('Failed to sync new contact person to group chat:', e);
                }

                // Ansprechpartner automatisch zum Team hinzufügen/aktualisieren
                await this._ensureContactInTeam(id, finalContactPersonId, conn);
            }
            
            await conn.query(
                'UPDATE projects SET name = ?, description = ?, status = ?, progress = ?, contact_person_id = ? WHERE project_id = ?',
                [
                    name.trim(), 
                    description?.trim(), 
                    status, 
                    Math.min(100, Math.max(0, progress || 0)), 
                    finalContactPersonId, 
                    id
                ]
            );
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    async deleteProject(user, id) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            const projectRows = await conn.query('SELECT * FROM projects WHERE project_id = ? FOR UPDATE', [id]);
            const project = projectRows[0];
            
            if (!project) throw new Error('NOT_FOUND: Projekt nicht gefunden');
            if (!this.canUserDeleteProject(user, project)) throw new Error('FORBIDDEN');
            
            await conn.query('DELETE FROM projects WHERE project_id = ?', [id]);

            // Wenn ein zugehöriger Gruppen-Chat existiert, lösche ihn (CASCADE entfernt Mitglieder/Nachrichten)
            try {
                await conn.query('DELETE FROM group_chats WHERE project_id = ?', [id]);
            } catch (e) {
                console.error('Failed to delete associated group chat for project', id, e);
                // Weiterwerfen würde das ganze Projekt-Delete rückgängig machen; wir loggen und fahren fort
            }

            if (project.contact_person_id) {
                const delta = project.status === 'Abgeschlossen' ? 15 : -5;
                await pointsService.addPendingDelta({ userId: project.contact_person_id, delta: delta, reason: 'project-deleted', source: 'projectService', conn });
            }

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    // --- Team Management ---

    /**
     * Stellt sicher, dass der Ansprechpartner im Projektteam ist.
     * @private
     */
    async _ensureContactInTeam(projectId, contactPersonId, conn = db) {
        if (!contactPersonId) return;
        
        // Füge Ansprechpartner als 'Manager' hinzu, falls noch nicht im Team
        await conn.query(`
            INSERT INTO project_teams (project_id, user_id, role, joined_at)
            VALUES (?, ?, 'Manager', NOW())
            ON DUPLICATE KEY UPDATE role = 'Manager'
        `, [projectId, contactPersonId]);

        // Sync zum Gruppenchat (als Admin)
        try {
            const groupId = await groupService.getGroupIdByProjectId(projectId, conn);
            if (groupId) {
                await groupService.addMember(groupId, contactPersonId, 'admin', conn);
            }
        } catch (e) {
            console.error('Failed to sync contact to group chat in _ensureContactInTeam:', e);
        }
    },

    async getProjectTeam(user, projectId) {
        const team = await db.query(`
            SELECT u.user_id, u.username, u.email, pt.role, pt.joined_at
            FROM project_teams pt
            JOIN users u ON pt.user_id = u.user_id
            WHERE pt.project_id = ?
            ORDER BY pt.joined_at ASC
        `, [projectId]);

        const projectRows = await db.query('SELECT contact_person_id FROM projects WHERE project_id = ?', [projectId]);
        const project = projectRows[0];
        if (!project) throw new Error('NOT_FOUND: Projekt nicht gefunden');

        return {
            team,
            canManage: this.canUserManageTeam(user, project)
        };
    },

    async searchUsers(query) {
        const searchStr = (query || '').trim();
        if (!searchStr) return [];

        return await db.query(`
            SELECT user_id, username, email
            FROM users
            WHERE username LIKE ? OR email LIKE ?
            LIMIT 10
        `, [`%${searchStr}%`, `%${searchStr}%`]);
    },

    async addTeamMember(user, projectId, userId, role) {
        const projectRows = await db.query('SELECT contact_person_id FROM projects WHERE project_id = ?', [projectId]);
        const project = projectRows[0];
        if (!project) throw new Error('NOT_FOUND: Projekt nicht gefunden');

        if (!this.canUserManageTeam(user, project)) {
            throw new Error('FORBIDDEN');
        }

        await db.query(`
            INSERT INTO project_teams (project_id, user_id, role)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE role = VALUES(role)
        `, [projectId, userId, role || 'Mitglied']);

        // Sync to group chat
        try {
            const groupId = await groupService.getGroupIdByProjectId(projectId);
            if (groupId) {
                const groupRole = role === 'Leiter' ? 'admin' : 'member';
                await groupService.addMember(groupId, userId, groupRole);
            }
        } catch (e) {
            console.error('Failed to sync team member to group chat:', e);
        }
    },

    async removeTeamMember(user, projectId, userId) {
        const projectRows = await db.query('SELECT contact_person_id FROM projects WHERE project_id = ?', [projectId]);
        const project = projectRows[0];
        if (!project) throw new Error('NOT_FOUND: Projekt nicht gefunden');

        if (project.contact_person_id === userId) {
            throw new Error('FORBIDDEN: Der Ansprechpartner kann nicht aus dem Team entfernt werden');
        }

        if (!this.canUserManageTeam(user, project)) {
            throw new Error('FORBIDDEN');
        }

        await db.query('DELETE FROM project_teams WHERE project_id = ? AND user_id = ?', [projectId, userId]);

        // Sync to group chat
        try {
            const groupId = await groupService.getGroupIdByProjectId(projectId);
            if (groupId) {
                await groupService.removeMember(groupId, userId);
            }
        } catch (e) {
            console.error('Failed to remove team member from group chat:', e);
        }
    },

    async isTeamMember(projectId, userId) {
        const rows = await db.query(
            'SELECT 1 FROM project_teams WHERE project_id = ? AND user_id = ?',
            [projectId, userId]);
        return rows.length > 0;
    },

    async getTeamMemberRole(projectId, userId) {
        const rows = await db.query(
            'SELECT role FROM project_teams WHERE project_id = ? AND user_id = ?',
            [projectId, userId]);
        return rows[0]?.role;
    }
};

module.exports = ProjectService;


