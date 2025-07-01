# Jira Test Generator

Automated test generation from Jira QA tickets with GitHub PR integration.

## Features

- Monitors Jira tickets in QA status
- Extracts GitHub PR information from ticket descriptions
- Fetches changed files from GitHub PRs
- Generates comprehensive unit tests using AI
- Scheduled processing with configurable intervals
- RESTful API for manual triggers and monitoring
- SQLite database for tracking processed tickets

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API tokens and configuration
   ```

3. **Start the application**
   ```bash
   npm start
   ```

4. **Health check**
   ```bash
   curl http://localhost:3000/health
   ```

## Configuration

### Required Environment Variables

- `JIRA_BASE_URL` - Your Jira instance URL
- `JIRA_EMAIL` - Your Jira email
- `JIRA_TOKEN` - Jira API token
- `JIRA_PROJECT` - Project key to monitor
- `GITHUB_PAT` - GitHub Personal Access Token
- `ANTHROPIC_KEY` - Anthropic API key

### Optional Environment Variables

- `PORT` - Server port (default: 3000)
- `DB_PATH` - SQLite database path (default: ./data/tickets.db)
- `CRON_WORK_HOURS` - Work hours schedule (default: */15 8-14 * * 1-5)
- `CRON_OFF_HOURS` - Off hours schedule (default: 0 */2 * * *)
- `TEST_RUNNER_WEBHOOK_URL` - Webhook URL for test runner notifications

## API Endpoints

- `GET /health` - Health check and scheduler status
- `POST /trigger` - Manual trigger for ticket processing
- `GET /tickets` - List processed tickets
- `GET /status` - Detailed application status
- `POST /webhook/test-runner` - Webhook endpoint for external test runners

## Generated Output

Tests are saved to `output/generated/{timestamp}/{ticket-key}/` with appropriate file extensions:

- C# files: `.Tests.cs`
- JavaScript: `.test.js`
- TypeScript: `.test.ts`
- Python: `_test.py`

## Cron Schedule

The application runs on two schedules:

- **Work Hours**: Every 15 minutes, 8am-2pm, weekdays
- **Off Hours**: Every 2 hours, all other times

## Requirements

- Node.js 18+
- Valid API tokens for Jira, GitHub, and Anthropic
- Network access to Jira and GitHub APIs

## Development

```bash
npm run dev  # Run with --watch flag for development
```

## Architecture

```
src/
├── app.js          # Main application and Express server
├── config.js       # Environment configuration
├── database.js     # SQLite database operations
├── jiraClient.js   # Jira API integration
├── githubClient.js # GitHub API integration
├── aiGenerator.js  # Anthropic AI test generation
└── scheduler.js    # Cron job management
```