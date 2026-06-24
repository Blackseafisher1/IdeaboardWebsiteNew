/**
 * @fileoverview Gemeinsame Typdefinitionen für das Projekt (Deutsch).
 * @module lib/types
 */

/**
 * @typedef {Object} User
 * @property {number} id - Eindeutige Benutzer-ID.
 * @property {string} username - Benutzername.
 * @property {string} email - E-Mail-Adresse des Benutzers.
 * @property {string} role - Rolle des Benutzers (z. B. "admin", "user").
 */

/**
 * @typedef {Object} Idea
 * @property {number} idea_id - Eindeutige Idee-ID.
 * @property {string} title - Titel der Idee.
 * @property {string} description - Beschreibung der Idee.
 * @property {number} user_id - ID des Autors der Idee.
 * @property {string} author - Anzeigename des Autors.
 * @property {number} like_count - Anzahl Likes.
 * @property {number} dislike_count - Anzahl Dislikes.
 * @property {number} comment_count - Anzahl Kommentare.
 * @property {Array<string>} tags - Schlagworte zu der Idee.
 */

/**
 * @typedef {Object} Message
 * @property {number} message_id - Eindeutige Nachrichten-ID.
 * @property {number} conversation_id - ID der Unterhaltung.
 * @property {number} sender_id - ID des Absenders.
 * @property {string} sender_name - Anzeigename des Absenders.
 * @property {string} text - Nachrichteninhalt.
 * @property {boolean} is_edited - Ob die Nachricht bearbeitet wurde.
 * @property {boolean} is_deleted - Ob die Nachricht gelöscht wurde.
 * @property {string} created_at - Erstellungszeitpunkt (ISO-String).
 */

/**
 * @typedef {Object} Conversation
 * @property {number} conversation_id - Eindeutige Unterhaltungs-ID.
 * @property {number} other_user_id - ID des anderen Teilnehmers.
 * @property {string} other_username - Benutzername des anderen Teilnehmers.
 * @property {string} last_message - Inhalt der letzten Nachricht.
 * @property {number} unread_count - Anzahl ungelesener Nachrichten.
 */

module.exports = {};
