/**
 * @fileoverview Dashboard-Routen und Widget-Endpoints (Partials) für das Admin-Dashboard.
 * Liefert Metriken, Top-Ideen, Charts und Idea-Card-Partial.
 * @module routes/dashboard
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../lib/asyncHandler');
const dashboardService = require('../lib/services/dashboardService');
const { isLoggedIn } = require('./middleware');

// Schütze alle Dashboard-Routen (Nur angemeldete Nutzer)
router.use(isLoggedIn);

/**
 * GET /dashboard
 * Zeigt die Hauptansicht des Dashboards an.
 * @name GET /
 * @function
 * @inner
 */
router.get('/', asyncHandler(async (req, res) => {
  res.render('dashboard/dashboard', {
    title: 'Dashboard - Übersicht',
    user: req.session.user
  });
}));

/**
 * GET /dashboard/widgets/metrics
 * Liefert das Widget für Metriken (neue Ideen, aktive Nutzer).
 * @name GET /widgets/metrics
 * @function
 * @inner
 */
router.get('/widgets/metrics', asyncHandler(async (req, res) => {
  const stats = await dashboardService.getMetrics();
  res.render('dashboard/partials/metrics', { stats });
}));

/**
 * GET /dashboard/widgets/new-ideas-number
 * Liefert nur die Anzahl der neuen Ideen als Reintext.
 * @name GET /widgets/new-ideas-number
 * @function
 * @inner
 */
router.get('/widgets/new-ideas-number', asyncHandler(async (req, res) => {
  const count = await dashboardService.getNewIdeasCount();
  res.send(String(count));
}));

/**
 * GET /dashboard/widgets/top-ideas
 * Liefert das Widget für die Top-Ideen.
 * @name GET /widgets/top-ideas
 * @function
 * @inner
 */
router.get('/widgets/top-ideas', asyncHandler(async (req, res) => {
  const topIdeas = await dashboardService.getTopIdeas(3);
  res.render('dashboard/partials/top-ideas', { topIdeas });
}));

/**
 * GET /dashboard/widgets/charts
 * Liefert das Widget-Grid mit Diagrammen und Statistiken.
 * @name GET /widgets/charts
 * @function
 * @inner
 */
router.get('/widgets/charts', asyncHandler(async (req, res) => {
  const [popularCategories, projectStats, monthlyStats, topUsers, categories] = await Promise.all([
    dashboardService.getPopularCategories(5),
    dashboardService.getProjectStats(),
    dashboardService.getMonthlyStats(6),
    dashboardService.getTopUsers(5),
    dashboardService.getAllCategories()
  ]);

  // Project-Statistiken umformen: hier werden Status-Felder als projektnamen
  // genutzt, damit das Widget eine konsistente Struktur erhält.
  const popularProjects = projectStats.map(p => ({
    project_id: p.status,
    name: p.status,
    count: p.count,
    percentage: p.percentage
  }));

  res.render('dashboard/widgets/charts-grid', {
    stats: { 
      popularCategories, 
      projectStats, 
      monthlyStats, 
      topUsers, 
      categories, 
      popularProjects 
    }
  });
}));

/**
 * GET /dashboard/:id/card
 * Liefert eine einzelne Ideen-Karte für das Dashboard.
 * @name GET /:id/card
 * @function
 * @inner
 */
router.get('/:id/card', asyncHandler(async (req, res) => {
  const data = await dashboardService.getIdeaCardData(req.params.id);
  if (!data) {
    return res.status(404).send('Idee nicht gefunden');
  }

  res.render('partials/idea-card', {
    idea: data.idea,
    comments: data.comments,
    user: req.session.user,
    isSingleCard: true
  });
}));

/**
 * GET /dashboard/widgets/project-stats
 * Liefert das Widget für Projekt-Status-Statistiken.
 * @name GET /widgets/project-stats
 * @function
 * @inner
 */
router.get('/widgets/project-stats', asyncHandler(async (req, res) => {
  const projectStats = await dashboardService.getProjectStats();
  res.render('dashboard/partials/project-stats', { projectStats });
}));

/**
 * GET /dashboard/widgets/monthly-stats
 * Liefert das Widget für monatliche Statistiken.
 * @name GET /widgets/monthly-stats
 * @function
 * @inner
 */
router.get('/widgets/monthly-stats', asyncHandler(async (req, res) => {
  const monthlyStats = await dashboardService.getMonthlyStats(6);
  res.render('dashboard/partials/monthly-stats', { monthlyStats });
}));

/**
 * GET /dashboard/widgets/top-users
 * Liefert das Widget für Top-Benutzer.
 * @name GET /widgets/top-users
 * @function
 * @inner
 */
router.get('/widgets/top-users', asyncHandler(async (req, res) => {
  const topUsers = await dashboardService.getTopUsers(5);
  res.render('dashboard/partials/top-users', { topUsers });
}));

module.exports = router;
