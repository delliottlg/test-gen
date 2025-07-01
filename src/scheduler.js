const cron = require('node-cron');
const config = require('./config');

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.processingLock = null;
    this.processingStartTime = null;
    this.jobTimeouts = new Map();
    this.maxJobDuration = 30 * 60 * 1000; // 30 minutes max per job
  }

  setupCronJobs(processTicketsCallback) {
    console.log('Setting up cron jobs...');
    
    // Work hours job (frequent)
    const workHoursJob = cron.schedule(config.cron.workHours, async () => {
      await this.runJobWithLock('workHours', processTicketsCallback);
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Off hours job (less frequent)
    const offHoursJob = cron.schedule(config.cron.offHours, async () => {
      await this.runJobWithLock('offHours', processTicketsCallback);
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.jobs.set('workHours', workHoursJob);
    this.jobs.set('offHours', offHoursJob);

    console.log(`Work hours schedule: ${config.cron.workHours}`);
    console.log(`Off hours schedule: ${config.cron.offHours}`);
  }

  async runJobWithLock(jobName, callback) {
    // Check if another job is running
    if (this.processingLock) {
      const runningTime = Date.now() - this.processingStartTime;
      
      // Check for stale lock (job running too long)
      if (runningTime > this.maxJobDuration) {
        console.warn(`Job ${this.processingLock} has been running for ${runningTime}ms, forcing unlock`);
        this.clearProcessingLock();
      } else {
        console.log(`Job ${this.processingLock} is still running (${runningTime}ms), skipping ${jobName}`);
        return;
      }
    }

    // Acquire lock
    this.processingLock = jobName;
    this.processingStartTime = Date.now();
    
    try {
      console.log(`Running ${jobName} ticket processing...`);
      
      // Set timeout for this job
      const timeoutId = setTimeout(() => {
        console.error(`Job ${jobName} timed out after ${this.maxJobDuration}ms`);
        this.clearProcessingLock();
      }, this.maxJobDuration);
      
      this.jobTimeouts.set(jobName, timeoutId);
      
      await callback();
      
      // Clear timeout if job completed successfully
      clearTimeout(timeoutId);
      this.jobTimeouts.delete(jobName);
      
    } catch (error) {
      console.error(`Error in ${jobName} job:`, error);
    } finally {
      this.clearProcessingLock();
    }
  }

  clearProcessingLock() {
    const jobName = this.processingLock;
    if (jobName && this.jobTimeouts.has(jobName)) {
      clearTimeout(this.jobTimeouts.get(jobName));
      this.jobTimeouts.delete(jobName);
    }
    this.processingLock = null;
    this.processingStartTime = null;
  }

  async runOnce(callback) {
    return this.runJobWithLock('manual', callback);
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
    this.clearProcessingLock();
  }

  destroy() {
    console.log('Destroying scheduled jobs...');
    this.jobs.forEach((job, name) => {
      job.destroy();
      console.log(`Destroyed ${name} job`);
    });
    this.jobs.clear();
    this.clearProcessingLock();
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
      currentlyProcessing: this.processingLock,
      processingStartTime: this.processingStartTime,
      runningTime: this.processingStartTime ? Date.now() - this.processingStartTime : null
    };
  }

  getNextRunTimes() {
    const times = {};
    this.jobs.forEach((job, name) => {
      if (job.nextInvocation) {
        times[name] = job.nextInvocation();
      }
    });
    return times;
  }
}

module.exports = new Scheduler();