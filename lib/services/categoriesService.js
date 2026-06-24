/**
 * @fileoverview Kategorien-Service: Liefert Kategorien aus der Datenbank.
 * @module lib/services/categoriesService
 */
const db = require('../../config/db.js');

/**
 * Liefert alle Kategorien sortiert nach Name.
 * @async
 * @returns {Promise<Array<Object>>} Liste der Kategorien.
 */
async function getAll() {
    return await db.query('SELECT category_id, name FROM categories ORDER BY name');
}

module.exports = {
    getAll
};


