const url = require('url');

class Validators {
  static isValidUrl(string) {
    try {
      const parsedUrl = new url.URL(string);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  static isValidCronExpression(expression) {
    if (!expression || typeof expression !== 'string') {
      return false;
    }

    const parts = expression.trim().split(/\s+/);
    
    // Standard cron: 5 parts (minute hour day month weekday)
    // Extended cron: 6 parts (second minute hour day month weekday)
    if (parts.length !== 5 && parts.length !== 6) {
      return false;
    }

    // Basic validation - check each part has valid characters
    const validPattern = /^[\d,\-*/]+$/;
    return parts.every(part => validPattern.test(part) || part === '*');
  }

  static async checkDiskSpace(path = './') {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(`df -k "${path}" | tail -1`);
      const parts = stdout.trim().split(/\s+/);
      const availableKB = parseInt(parts[3]);
      const availableMB = availableKB / 1024;
      
      return {
        available: availableMB,
        sufficient: availableMB > 100 // Need at least 100MB free
      };
    } catch (error) {
      console.error('Error checking disk space:', error);
      return { available: 0, sufficient: false };
    }
  }

  static sanitizeLimit(value, defaultValue = 50, max = 1000) {
    const parsed = parseInt(value);
    
    if (isNaN(parsed) || parsed < 1) {
      return defaultValue;
    }
    
    return Math.min(parsed, max);
  }
}

module.exports = Validators;