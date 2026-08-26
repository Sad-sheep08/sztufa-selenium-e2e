require('../config/env');

const USERS = {
  newsEditor: {
    username: process.env.E2E_NEWS_EDITOR_USERNAME || 'editor',
    password: process.env.E2E_NEWS_EDITOR_PASSWORD || 'editor123',
    role: 'news_editor',
    roleBadgeText: '新闻录入员',
    allowedRoutes: ['/news'],
    forbiddenRoutes: ['/registration-review', '/teams', '/statistics', '/audit-logs', '/settings', '/registration'],
  },
  superAdmin: {
    username: 'admin',
    password: 'admin123',
    role: 'super_admin',
    roleBadgeText: '超管',
    allowedRoutes: ['/', '/registration-review', '/teams', '/schedule', '/statistics', '/news', '/audit-logs', '/settings'],
    forbiddenRoutes: ['/registration'],
  },
  matchScorer: {
    username: process.env.E2E_MATCH_SCORER_USERNAME || 'scorer',
    password: process.env.E2E_MATCH_SCORER_PASSWORD || 'scorer123',
    role: 'match_scorer',
    roleBadgeText: '记录员',
    allowedRoutes: ['/teams', '/statistics', '/news'],
    forbiddenRoutes: ['/registration-review', '/audit-logs', '/settings', '/registration'],
  },
  coach: {
    username: 'coach',
    password: 'coach123',
    role: 'coach',
    roleBadgeText: '教练',
    allowedRoutes: ['/registration', '/schedule'],
    forbiddenRoutes: ['/registration-review', '/teams', '/statistics', '/news', '/audit-logs', '/settings'],
  },
};

module.exports = USERS;
