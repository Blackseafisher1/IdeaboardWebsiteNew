const db = require('../../config/db.js');
const categoriesService = require('./categoriesService');

async function getMetrics() {
    const newIdeasRows = await db.query(`-- sql -- sql
      SELECT COALESCE(SUM(idea_count), 0) as new_ideas_count 
      FROM monthly_stats 
      WHERE month >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m')
    `);
    const new_ideas_count = newIdeasRows[0]?.new_ideas_count || 0;

    const activeUsersRows = await db.query(`-- sql -- sql
      SELECT COUNT(DISTINCT user_id) as active_users_count
      FROM (
        SELECT user_id FROM ideas WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        UNION SELECT user_id FROM likes WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        UNION SELECT user_id FROM comments WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ) as active_users
    `);
    const active_users_count = activeUsersRows[0]?.active_users_count || 0;

    const activeCategoriesRows = await db.query(`-- sql -- sql
      SELECT COUNT(DISTINCT c.category_id) as active_categories_count
      FROM categories c JOIN ideas i ON c.category_id = i.category_id
    `);
    const active_categories_count = activeCategoriesRows[0]?.active_categories_count || 0;

    return {
        newIdeasCount: Number(new_ideas_count) || 0,
        activeUsersCount: Number(active_users_count) || 0,
        activeCategoriesCount: Number(active_categories_count) || 0
    };
}

async function getTopIdeas(limit = 3) {
    const topIdeas = await db.query(`-- sql -- sql
      
      SELECT i.idea_id, i.title, i.description, i.category_id,
             u.username as author, c.name as category_name,
             i.like_count, i.dislike_count, i.comment_count,
             (i.like_count - i.dislike_count) as engagement_score
      FROM ideas i
      LEFT JOIN users u ON i.user_id = u.user_id
      LEFT JOIN categories c ON i.category_id = c.category_id
      WHERE i.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY engagement_score DESC, like_count DESC
      LIMIT ?
    `, [limit]);

  const result = topIdeas.map(i => ({
        ...i,
        likes_count: Number(i.like_count ?? 0),
        dislikes_count: Number(i.dislike_count ?? 0),
        comments_count: Number(i.comment_count ?? 0),
        tags: []
    }));

    const ideaIds = result.map(i => i.idea_id);
    if (ideaIds.length > 0) {
        const tags = await db.query(`-- sql -- sql
          SELECT itl.idea_id, t.name 
          FROM idea_tag_links itl JOIN idea_tags t ON itl.tag_id = t.tag_id
          WHERE itl.idea_id IN (?)
        `, [ideaIds]);
    const tagsMap = {};
    tags.forEach(t => {
      if (!tagsMap[t.idea_id]) tagsMap[t.idea_id] = [];
      tagsMap[t.idea_id].push(t.name);
    });
    result.forEach(idea => {
      idea.tags = tagsMap[idea.idea_id] || [];
    });
    }

    return result;
}

async function getActiveUsers(limit = 10) {
    const activeUsers = await db.query(`-- sql -- sql
      SELECT u.user_id, u.username,
           (SELECT COUNT(*) FROM ideas WHERE user_id = u.user_id) as ideas_count,
           (SELECT COUNT(*) FROM comments WHERE user_id = u.user_id) as comments_count,
           up.current_points
      FROM users u
        LEFT JOIN user_points up ON u.user_id = up.user_id
        WHERE u.user_id IN (
            SELECT user_id FROM ideas WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            UNION SELECT user_id FROM comments WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        )
        ORDER BY up.current_points DESC
      LIMIT ?
    `, [limit]);
    return activeUsers;
}

module.exports = {
  getMetrics,
  getTopIdeas,
  getActiveUsers,
  getNewIdeasCount,
  getPopularCategories,
  getProjectStats,
  getMonthlyStats,
  getTopUsers,
  getAllCategories,
  getIdeaCardData
};

async function getNewIdeasCount() {
    const result = await db.query(`-- sql -- sql
      SELECT COALESCE(SUM(idea_count), 0) as new_ideas_count
      FROM monthly_stats 
      WHERE month >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 30 DAY), '%Y-%m')
    `);
    return Number(result[0]?.new_ideas_count) || 0;
}

async function getPopularCategories(limit = 5) {
    const popularCategories = await db.query(`-- sql -- sql
      SELECT c.category_id, c.name as category_name, COUNT(i.idea_id) as idea_count,
      ROUND((COUNT(i.idea_id) / (SELECT COUNT(*) FROM ideas WHERE category_id IS NOT NULL)) * 100, 1) as percentage
      FROM categories c LEFT JOIN ideas i ON c.category_id = i.category_id
      GROUP BY c.category_id, c.name ORDER BY idea_count DESC LIMIT ?
    `, [limit]);

  return popularCategories.map(cat => ({
    ...cat,
    idea_count: Number(cat.idea_count) || 0,
    percentage: Number(cat.percentage) || 0
  }));
}

async function getProjectStats() {
    const projectStats = await db.query(`-- sql -- sql
      SELECT status, COUNT(*) as count, ROUND(AVG(progress), 1) as avg_progress
      FROM projects GROUP BY status
    `);

  const totalProjects = (projectStats || []).reduce((s, x) => s + (Number(x.count) || 0), 0) || 0;
  return (projectStats || []).map(p => ({
    ...p,
    count: Number(p.count) || 0,
    avg_progress: Number(p.avg_progress) || 0,
    percentage: totalProjects > 0 ? Number(((Number(p.count) / totalProjects) * 100).toFixed(1)) : 0
  }));
}

async function getMonthlyStats(months = 6) {
    const monthlyStats = await db.query(`-- sql -- sql 
      SELECT month, idea_count, active_users 
      FROM monthly_stats 
      WHERE month >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ? MONTH), '%Y-%m')
      ORDER BY month ASC
    `, [months]);

  return (monthlyStats || []).map(m => ({
    ...m,
    idea_count: Number(m.idea_count) || 0,
    active_users: Number(m.active_users) || 0
  }));
}

async function getTopUsers(limit = 5) {
    const topUsers = await db.query(`-- sql -- sql
      SELECT u.username, COUNT(i.idea_id) as ideas_submitted,
      COALESCE(SUM(i.like_count), 0) as total_likes_received
      FROM users u LEFT JOIN ideas i ON u.user_id = i.user_id
      GROUP BY u.user_id, u.username ORDER BY ideas_submitted DESC, total_likes_received DESC LIMIT ?
    `, [limit]);

  return (topUsers || []).map(tu => ({
    ...tu,
    ideas_submitted: Number(tu.ideas_submitted) || 0,
    total_likes_received: Number(tu.total_likes_received) || 0
  }));
}

async function getAllCategories() {
    return categoriesService.getAll();
}

async function getIdeaCardData(ideaId) {
    const ideaRows = await db.query(`-- sql -- sql
      SELECT 
        i.idea_id,
        i.title,
        i.description,
        i.category_id,
        u.username as author,
        c.name as category_name,
        i.like_count as likes_count,
        i.dislike_count as dislikes_count,
        i.comment_count as comments_count
      FROM ideas i
      LEFT JOIN users u ON i.user_id = u.user_id
      LEFT JOIN categories c ON i.category_id = c.category_id
      WHERE i.idea_id = ?
    `, [ideaId]);

    const idea = Array.isArray(ideaRows) ? ideaRows[0] : ideaRows;
    if (!idea) return null;

    const tagsRows = await db.query(`-- sql 
      SELECT t.name 
      FROM idea_tag_links itl
      JOIN idea_tags t ON itl.tag_id = t.tag_id
      WHERE itl.idea_id = ?
    `, [ideaId]);

  idea.tags = (Array.isArray(tagsRows) ? tagsRows : []).map(t => t.name);
    idea.tag_count = Number(idea.tags?.length || 0);
    idea.file_count = 0;

    const comments = await db.query(`-- sql 
      SELECT c.*, u.username as author
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.idea_id = ?
      ORDER BY c.created_at DESC
    `, [ideaId]);

    return { idea, comments: Array.isArray(comments) ? comments : [] };
}
