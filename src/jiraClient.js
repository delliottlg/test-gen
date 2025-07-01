const axios = require('axios');
const config = require('./config');

class JiraClient {
  constructor() {
    this.baseURL = config.jira.baseUrl;
    this.auth = {
      username: config.jira.email,
      password: config.jira.token
    };
  }

  async getQATickets() {
    try {
      const projects = config.jira.project.split(',').map(p => p.trim());
      const projectQuery = projects.length > 1 
        ? `project IN (${projects.join(',')})` 
        : `project=${projects[0]}`;
      const jql = `${projectQuery} AND status="QA"`;
      const response = await axios.get(`${this.baseURL}/rest/api/3/search`, {
        auth: this.auth,
        params: {
          jql: jql,
          fields: 'key,summary,description,status,updated',
          maxResults: 50
        }
      });

      return response.data.issues || [];
    } catch (error) {
      console.error('Error fetching QA tickets:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  extractGithubInfo(ticket) {
    const text = `${ticket.fields.summary} ${ticket.fields.description || ''}`;
    
    // Look for GitHub PR URLs
    const prRegex = /github\.com\/[^\/]+\/([^\/]+)\/pull\/(\d+)/gi;
    const matches = [...text.matchAll(prRegex)];
    
    if (matches.length === 0) {
      return null;
    }

    const match = matches[0];
    const repo = match[1];
    const prNumber = parseInt(match[2]);

    // Check if it's the lingraphica-app repo or contains "lingraphica"
    const isLingraphicaRepo = repo.toLowerCase().includes('lingraphica') || 
                             text.toLowerCase().includes('lingraphica-app');

    if (!isLingraphicaRepo) {
      return null;
    }

    return {
      repo: repo,
      prNumber: prNumber,
      fullUrl: match[0]
    };
  }

  async getTicketDetails(ticketKey) {
    try {
      const response = await axios.get(`${this.baseURL}/rest/api/3/issue/${ticketKey}`, {
        auth: this.auth,
        params: {
          fields: 'key,summary,description,status,updated,comment'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching ticket ${ticketKey}:`, error.message);
      throw error;
    }
  }

  async addComment(ticketKey, comment) {
    try {
      const response = await axios.post(
        `${this.baseURL}/rest/api/3/issue/${ticketKey}/comment`,
        {
          body: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: comment
                  }
                ]
              }
            ]
          }
        },
        {
          auth: this.auth,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error adding comment to ${ticketKey}:`, error.message);
      throw error;
    }
  }

  isValidTicket(ticket) {
    if (!ticket || !ticket.key) {
      return false;
    }

    const githubInfo = this.extractGithubInfo(ticket);
    return githubInfo !== null;
  }
}

module.exports = new JiraClient();