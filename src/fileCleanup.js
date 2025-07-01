const fs = require('fs').promises;
const path = require('path');

class FileCleanup {
  constructor(options = {}) {
    this.retentionDays = options.retentionDays || 7;
    this.outputDir = options.outputDir || './output/generated';
  }

  async cleanOldFiles() {
    try {
      const now = Date.now();
      const maxAge = this.retentionDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      
      console.log(`Starting cleanup of files older than ${this.retentionDays} days...`);
      
      const cleaned = await this.cleanDirectory(this.outputDir, now, maxAge);
      
      console.log(`Cleanup complete: removed ${cleaned.files} files and ${cleaned.directories} directories`);
      return cleaned;
    } catch (error) {
      console.error('Error during file cleanup:', error.message);
      throw error;
    }
  }

  async cleanDirectory(dirPath, now, maxAge) {
    let filesRemoved = 0;
    let dirsRemoved = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        try {
          const stats = await fs.stat(fullPath);
          const age = now - stats.mtime.getTime();
          
          if (age > maxAge) {
            if (entry.isDirectory()) {
              // Recursively clean subdirectory first
              const subResult = await this.cleanDirectory(fullPath, now, maxAge);
              filesRemoved += subResult.files;
              dirsRemoved += subResult.directories;
              
              // Try to remove the directory if it's empty
              try {
                await fs.rmdir(fullPath);
                dirsRemoved++;
                console.log(`Removed empty directory: ${fullPath}`);
              } catch (e) {
                // Directory not empty, that's okay
              }
            } else {
              await fs.unlink(fullPath);
              filesRemoved++;
              console.log(`Removed old file: ${fullPath}`);
            }
          } else if (entry.isDirectory()) {
            // Still check subdirectories even if parent is recent
            const subResult = await this.cleanDirectory(fullPath, now, maxAge);
            filesRemoved += subResult.files;
            dirsRemoved += subResult.directories;
          }
        } catch (error) {
          console.warn(`Error processing ${fullPath}:`, error.message);
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${dirPath}:`, error.message);
    }

    return { files: filesRemoved, directories: dirsRemoved };
  }

  // Schedule periodic cleanup
  scheduleCleanup(intervalHours = 24) {
    console.log(`Scheduling file cleanup every ${intervalHours} hours`);
    
    // Run immediately on startup
    this.cleanOldFiles().catch(console.error);
    
    // Then run periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanOldFiles().catch(console.error);
    }, intervalHours * 60 * 60 * 1000);
  }

  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('File cleanup scheduler stopped');
    }
  }
}

module.exports = FileCleanup;