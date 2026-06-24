/**
 * @fileoverview Gemeinsame Helfer zum Vereinheitlichen von Rollen- und Rechteprüfungen.
 * Akzeptiert Benutzerobjekte mit `role`, `role_name`, `roleName`, `role_id` oder `roleId`.
 * @module lib/roleHelpers
 */

const ROLE_NAMES_BY_ID = Object.freeze({
  1: 'Admin',
  2: 'Projektleiter',
  3: 'Mitarbeiter'
});

const ROLE_IDS_BY_NAME = Object.freeze({
  admin: 1,
  administrator: 1,
  projektleiter: 2,
  mitarbeiter: 3
});

function normalizeRoleName(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const normalized = trimmed.toLowerCase();
  if (normalized === 'admin' || normalized === 'administrator') return 'Admin';
  if (normalized === 'projektleiter') return 'Projektleiter';
  if (normalized === 'mitarbeiter') return 'Mitarbeiter';

  return trimmed;
}

function toRoleId(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function getRoleName(source) {
  if (!source) return '';

  if (typeof source === 'string' || typeof source === 'number') {
    const roleId = toRoleId(source);
    if (roleId && ROLE_NAMES_BY_ID[roleId]) return ROLE_NAMES_BY_ID[roleId];
    return normalizeRoleName(source);
  }

  const explicitRole = source.role ?? source.roleName ?? source.role_name ?? source.name;
  const normalizedRole = normalizeRoleName(explicitRole);
  if (normalizedRole) return normalizedRole;

  const roleId = toRoleId(source.role_id ?? source.roleId);
  if (roleId && ROLE_NAMES_BY_ID[roleId]) return ROLE_NAMES_BY_ID[roleId];

  return '';
}

function getRoleId(source) {
  if (!source) return null;

  if (typeof source === 'number') {
    return toRoleId(source);
  }

  if (typeof source === 'string') {
    const numericId = toRoleId(source);
    if (numericId) return numericId;
    return ROLE_IDS_BY_NAME[String(source).trim().toLowerCase()] ?? null;
  }

  const explicitRoleId = toRoleId(source.role_id ?? source.roleId);
  if (explicitRoleId) return explicitRoleId;

  const roleName = getRoleName(source);
  return ROLE_IDS_BY_NAME[roleName.toLowerCase()] ?? null;
}

function hasRole(source, expectedRole) {
  return getRoleName(source) === getRoleName(expectedRole);
}

function isAdmin(source) {
  return hasRole(source, 'Admin');
}

function isProjectLead(source) {
  return hasRole(source, 'Projektleiter');
}

function normalizeUser(user) {
  if (!user || typeof user !== 'object') return null;

  const role = getRoleName(user);
  const roleId = getRoleId(user);

  return {
    ...user,
    ...(role ? { role, roleName: role, role_name: role } : {}),
    ...(roleId ? { roleId, role_id: roleId } : {}),
    isAdmin: isAdmin(user),
    isProjectLead: isProjectLead(user)
  };
}

module.exports = {
  ROLE_NAMES_BY_ID,
  getRoleId,
  getRoleName,
  hasRole,
  isAdmin,
  isProjectLead,
  normalizeRoleName,
  normalizeUser
};