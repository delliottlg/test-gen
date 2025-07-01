const express = require('express');
const axios = require('axios');
const path = require('path');
const config = require('./config');
const database = require('./database');
const jiraClient = require('./jiraClient');
const githubClient = require('./githubClient');
const aiGenerator = require('./aiGenerator');
const scheduler = require('./scheduler');
const validators = require('./validators');
const FileCleanup = require('./fileCleanup');

class TestGeneratorApp {
  constructor() {
    this.app = express();
    this.fileCleanup = new FileCleanup({ retentionDays: 7 });
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Add request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Jira Test Generator',
        version: '1.0.0',
        endpoints: {
          'GET /': 'This help message',
          'GET /health': 'Health check and scheduler status',
          'POST /trigger': 'Manual trigger for ticket processing',
          'GET /tickets': 'List processed tickets',
          'GET /status': 'Detailed application status'
        }
      });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        scheduler: scheduler.getJobStatus()
      });
    });

    // Manual trigger endpoint
    this.app.post('/trigger', async (req, res) => {
      try {
        await scheduler.runOnce(() => this.processTickets());
        res.json({ status: 'triggered', timestamp: new Date().toISOString() });
      } catch (error) {
        console.error('Manual trigger error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get processed tickets
    this.app.get('/tickets', async (req, res) => {
      try {
        let limit = parseInt(req.query.limit) || 50;
        
        // Validate limit parameter
        if (isNaN(limit) || limit < 1) {
          limit = 50;
        } else if (limit > 1000) {
          limit = 1000; // Max limit to prevent resource exhaustion
        }
        
        const tickets = await database.getProcessedTickets(limit);
        res.json(tickets);
      } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Webhook endpoint for external test runner
    this.app.post('/webhook/test-runner', (req, res) => {
      console.log('Test runner webhook received:', req.body);
      res.json({ received: true, timestamp: new Date().toISOString() });
    });

    // Status endpoint
    this.app.get('/status', async (req, res) => {
      try {
        const status = {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          scheduler: scheduler.getJobStatus(),
          nextRuns: scheduler.getNextRunTimes(),
          timestamp: new Date().toISOString()
        };
        res.json(status);
      } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  async processTickets() {
    console.log('Starting ticket processing cycle...');
    
    try {
      const tickets = await jiraClient.getQATickets();
      console.log(`Found ${tickets.length} QA tickets`);

      let processedCount = 0;
      let generatedCount = 0;

      for (const ticket of tickets) {
        try {
          await this.processTicket(ticket);
          processedCount++;
          generatedCount++;
        } catch (error) {
          console.error(`Error processing ticket ${ticket.key}:`, error.message);
          continue;
        }
      }

      console.log(`Processing complete: ${processedCount}/${tickets.length} tickets processed, ${generatedCount} tests generated`);
      return { processedCount, generatedCount, totalTickets: tickets.length };
    } catch (error) {
      console.error('Error in processTickets:', error);
      throw error;
    }
  }

  async processTicket(ticket) {
    const ticketKey = ticket.key;
    
    // Check if we've already processed this ticket
    const isNew = await database.isNewTicket(ticketKey);
    if (!isNew) {
      console.log(`Ticket ${ticketKey} already processed, skipping...`);
      return;
    }

    console.log(`Processing ticket: ${ticketKey} - ${ticket.fields.summary}`);

    // Extract GitHub info
    const githubInfo = jiraClient.extractGithubInfo(ticket);
    if (!githubInfo) {
      console.log(`No valid GitHub PR found for ticket ${ticketKey}`);
      await database.markTicketSeen(ticketKey, null, 0);
      return;
    }

    const { prNumber, repo } = githubInfo;
    console.log(`Found PR #${prNumber} in repo ${repo}`);

    try {
      // Get PR files
      const prFiles = await githubClient.getPRFiles(prNumber);
      const testableFiles = githubClient.filterTestableFiles(prFiles);
      
      if (testableFiles.length === 0) {
        console.log(`No testable files found in PR #${prNumber}`);
        await database.markTicketSeen(ticketKey, prNumber, 0);
        return;
      }

      console.log(`Found ${testableFiles.length} testable files`);

      // Get file contents with changes
      const filesWithContent = await githubClient.getFileContentWithChanges(testableFiles, prNumber);
      
      let testsGenerated = 0;
      const ticketContext = `${ticket.fields.summary}\n${ticket.fields.description || ''}`;

      // Generate tests for each file
      for (const fileData of filesWithContent) {
        try {
          console.log(`Generating tests for ${fileData.filename}...`);
          
          const tests = await aiGenerator.generateTests(fileData, ticketContext);
          const savedTests = await aiGenerator.saveTest(tests, './output', ticketKey);
          
          // Log each generated test file
          for (const savedTest of savedTests) {
            await database.logGeneratedTest(ticketKey, fileData.path, savedTest.path);
            testsGenerated++;
          }
          
          console.log(`Generated ${savedTests.length} test files for ${fileData.filename}`);
        } catch (error) {
          console.error(`Error generating tests for ${fileData.filename}:`, error.message);
          continue;
        }
      }

      // Mark ticket as processed
      await database.markTicketSeen(ticketKey, prNumber, testsGenerated);
      
      // Notify test runner if we generated tests
      if (testsGenerated > 0) {
        await this.notifyTestRunner(ticketKey, prNumber, testsGenerated);
        
        // Add comment to Jira ticket
        try {
          const comment = `Automated tests generated: ${testsGenerated} test files created for PR #${prNumber}`;
          await jiraClient.addComment(ticketKey, comment);
        } catch (commentError) {
          console.warn(`Could not add comment to ${ticketKey}:`, commentError.message);
        }
      }

      console.log(`Successfully processed ${ticketKey}: ${testsGenerated} tests generated`);
    } catch (error) {
      console.error(`Error processing PR for ticket ${ticketKey}:`, error.message);
      await database.markTicketSeen(ticketKey, prNumber, 0);
      throw error;
    }
  }

  async notifyTestRunner(ticketKey, prNumber, testsGenerated) {
    if (!config.webhook.testRunnerUrl) {
      console.log('No test runner webhook URL configured');
      return;
    }

    // Validate webhook URL
    if (!validators.isValidUrl(config.webhook.testRunnerUrl)) {
      console.error('Invalid webhook URL configured:', config.webhook.testRunnerUrl);
      return;
    }

    try {
      const payload = {
        ticketKey,
        prNumber,
        testsGenerated,
        timestamp: new Date().toISOString(),
        outputPath: `./output/generated`
      };

      await axios.post(config.webhook.testRunnerUrl, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`Notified test runner for ticket ${ticketKey}`);
    } catch (error) {
      console.error('Error notifying test runner:', error.message);
    }
  }

  async start() {
    try {
      // Initialize database
      await database.initDB();
      console.log('Database initialized');

      // Load AI test documentation
      await aiGenerator.loadTestDocumentation();
      console.log('AI generator initialized');

      // Setup and start scheduler
      scheduler.setupCronJobs(() => this.processTickets());
      scheduler.start();
      console.log('Scheduler started');

      // Start file cleanup scheduler
      this.fileCleanup.scheduleCleanup(24); // Clean up daily

      // Start Express server
      const port = config.server.port;
      this.app.listen(port, () => {
        console.log(`Test Generator server listening on port ${port}`);
        console.log(`Health check: http://localhost:${port}/health`);
        console.log(`Manual trigger: POST http://localhost:${port}/trigger`);
      });

      // Handle graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error('Error starting application:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    console.log('Shutting down gracefully...');
    
    try {
      scheduler.stop();
      scheduler.destroy();
      this.fileCleanup.stopCleanup();
      database.close();
      console.log('Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the application
if (require.main === module) {
  const app = new TestGeneratorApp();
  app.start().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = TestGeneratorApp;