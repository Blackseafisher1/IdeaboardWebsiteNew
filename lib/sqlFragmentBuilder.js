/**
 * @fileoverview Kleiner SQL-Fragment-Builder zur deterministischen Zusammenstellung von SQL und Parametern.
 * @module lib/sqlFragmentBuilder
 *
 * @example
 * // API usage:
 * const b = create();
 * b.add(sqlFragment, paramsArray);
 * b.addWhere(cond, paramsArray);
 * b.build(); // -> { sql, params }
 * b.buildWithLimitOffset(limit, offset);
 */

/**
 * Erstellt einen neuen Builder zum schrittweisen Aufbau eines SQL-Statements.
 * @returns {Object} Builder-Instanz mit `add`, `addWhere`, `build` und `buildWithLimitOffset`.
 */
function create() {
  const parts = [];
  const whereParts = [];
  const params = [];

  return {
    /**
     * Fügt ein SQL-Fragment und dessen Parameter hinzu.
     * @param {string} fragment - SQL-Fragment.
     * @param {Array<any>} [fragParams=[]] - Parameter für das Fragment.
     * @returns {this}
     */
    add(fragment, fragParams = []) {
      if (fragment && fragment.length) parts.push(fragment);
      if (fragParams && fragParams.length) params.push(...fragParams);
      return this;
    },
    /**
     * Fügt eine WHERE-Bedingung und deren Parameter hinzu.
     * @param {string} cond - WHERE-Bedingung ohne führendes WHERE.
     * @param {Array<any>} [condParams=[]]
     * @returns {this}
     */
    addWhere(cond, condParams = []) {
      if (cond && cond.length) whereParts.push(cond);
      if (condParams && condParams.length) params.push(...condParams);
      return this;
    },
    /**
     * Baut das finale SQL-Fragment zusammen.
    * @returns {Object} Objekt mit `sql` (String) und `params` (Array).
     */
    build() {
      const sql = [];
      if (parts.length) sql.push(parts.join('\n'));
      if (whereParts.length) sql.push('WHERE ' + whereParts.join(' AND '));
      return { sql: sql.join('\n'), params: params.slice() };
    },
    /**
     * Baut das finale SQL-Fragment und hängt LIMIT/OFFSET-Parameter an.
     * @param {number} limit
     * @param {number} offset
    * @returns {Object} Objekt mit `sql` (String) und `params` (Array).
     */
    buildWithLimitOffset(limit, offset) {
      const { sql, params: p } = this.build();
      // Ensure numeric limit/offset
      const l = Number(limit) || 0;
      const o = Number(offset) || 0;
      const finalSql = sql + '\nLIMIT ? OFFSET ?';
      return { sql: finalSql, params: p.concat([l, o]) };
    }
  };
}

module.exports = { create };
