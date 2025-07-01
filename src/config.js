require('dotenv').config();
const validators = require('./validators');

// Validate cron expressions at startup
const validateCronExpressions = () => {
  const workHours = process.env.CRON_WORK_HOURS || '*/15 8-14 * * 1-5';
  const offHours = process.env.CRON_OFF_HOURS || '0 */2 * * *';
  
  if (!validators.isValidCronExpression(workHours)) {
    console.warn(`Invalid work hours cron expression: ${workHours}, using default`);
    return { workHours: '*/15 8-14 * * 1-5', offHours };
  }
  
  if (!validators.isValidCronExpression(offHours)) {
    console.warn(`Invalid off hours cron expression: ${offHours}, using default`);
    return { workHours, offHours: '0 */2 * * *' };
  }
  
  return { workHours, offHours };
};

const validatedCron = validateCronExpressions();

module.exports = {
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net',
    token: process.env.JIRA_TOKEN,
    project: process.env.JIRA_PROJECT || 'XXX',
    email: process.env.JIRA_EMAIL
  },
  github: {
    token: process.env.GITHUB_PAT,
    owner: process.env.GITHUB_OWNER || 'lingraphica',
    repo: process.env.GITHUB_REPO || 'lingraphica-app'
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_KEY
  },
  server: {
    port: process.env.PORT || 3000
  },
  database: {
    path: process.env.DB_PATH || './data/tickets.db'
  },
  cron: {
    workHours: validatedCron.workHours,
    offHours: validatedCron.offHours
  },
  webhook: {
    testRunnerUrl: process.env.TEST_RUNNER_WEBHOOK_URL
  }
};