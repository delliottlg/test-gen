const cron = require('node-cron');
const config = require('./config');

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  setupCronJobs(processTicketsCallback) {
    console.log('Setting up cron jobs...');
    
    // Work hours job (frequent)
    const workHoursJob = cron.schedule(config.cron.workHours, async () => {
      if (this.isRunning) {
        console.log('Previous job still running, skipping...');
        return;
      }
      
      this.isRunning = true;
      try {
        console.log('Running work hours ticket processing...');
        await processTicketsCallback();
      } catch (error) {
        console.error('Error in work hours job:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Off hours job (less frequent)
    const offHoursJob = cron.schedule(config.cron.offHours, async () => {
      if (this.isRunning) {
        console.log('Previous job still running, skipping...');
        return;
      }
      
      this.isRunning = true;
      try {
        console.log('Running off hours ticket processing...');
        await processTicketsCallback();
      } catch (error) {
        console.error('Error in off hours job:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.jobs.set('workHours', workHoursJob);
    this.jobs.set('offHours', offHoursJob);

    console.log(`Work hours schedule: ${config.cron.workHours}`);
    console.log(`Off hours schedule: ${config.cron.offHours}`);
  }

  start() {
    console.log('Starting scheduled jobs...');
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`Started ${name} job`);
    });
  }

  stop() {
    console.log('Stopping scheduled jobs...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped ${name} job`);
    });
  }

  destroy() {
    console.log('Destroying scheduled jobs...');
    this.jobs.forEach((job, name) => {
      job.destroy();
      console.log(`Destroyed ${name} job`);
    });
    this.jobs.clear();
    this.isRunning = false;
  }

  getJobStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    });
    return {
      jobs: status,
      currentlyProcessing: this.isRunning
    };
  }

  // Manual trigger for testing
  async runOnce(processTicketsCallback) {
    if (this.isRunning) {
      throw new Error('Job already running');
    }

    this.isRunning = true;
    try {
      console.log('Manual job execution triggered...');
      await processTicketsCallback();
    } finally {
      this.isRunning = false;
    }
  }

  // Validate cron expressions
  static validateCronExpression(expression) {
    return cron.validate(expression);
  }

  // Get next scheduled run times
  getNextRunTimes() {
    const schedule = {};
    this.jobs.forEach((job, name) => {
      try {
        if (job.running) {
          schedule[name] = job.nextDate?.toString() || 'Unknown';
        }
      } catch (error) {
        schedule[name] = 'Error getting next run time';
      }
    });
    return schedule;
  }
}

module.exports = new Scheduler();