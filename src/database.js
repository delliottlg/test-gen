const sqlite3 = require('sqlite3').verbose();
const config = require('./config');
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const dbPath = path.resolve(config.database.path);
      const dbDir = path.dirname(dbPath);
      
      require('fs').mkdirSync(dbDir, { recursive: true });
      
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          this.db = null;
          reject(err);
          return;
        }
        
        console.log('Connected to SQLite database');
        this.createTables()
          .then(resolve)
          .catch((error) => {
            this.close();
            reject(error);
          });
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createTicketsTable = `
        CREATE TABLE IF NOT EXISTS tickets_seen (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_key TEXT UNIQUE NOT NULL,
          pr_number INTEGER,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'processed',
          files_generated INTEGER DEFAULT 0
        )
      `;

      const createTestsTable = `
        CREATE TABLE IF NOT EXISTS generated_tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_key TEXT NOT NULL,
          file_path TEXT NOT NULL,
          test_file_path TEXT NOT NULL,
          generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'generated',
          FOREIGN KEY (ticket_key) REFERENCES tickets_seen(ticket_key)
        )
      `;

      this.db.run(createTicketsTable, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.db.run(createTestsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  async isNewTicket(ticketKey) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const query = 'SELECT id FROM tickets_seen WHERE ticket_key = ?';
      this.db.get(query, [ticketKey], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(!row);
      });
    });
  }

  async markTicketSeen(ticketKey, prNumber = null, filesGenerated = 0) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const query = `
        INSERT OR REPLACE INTO tickets_seen 
        (ticket_key, pr_number, files_generated, processed_at) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(query, [ticketKey, prNumber, filesGenerated], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async logGeneratedTest(ticketKey, filePath, testFilePath) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const query = `
        INSERT INTO generated_tests 
        (ticket_key, file_path, test_file_path) 
        VALUES (?, ?, ?)
      `;
      
      this.db.run(query, [ticketKey, filePath, testFilePath], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  async getProcessedTickets(limit = 100) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const query = `
        SELECT * FROM tickets_seen 
        ORDER BY processed_at DESC 
        LIMIT ?
      `;
      
      this.db.all(query, [limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = new Database();