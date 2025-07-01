const axios = require('axios');
const config = require('./config');

class GitHubClient {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.headers = {
      'Authorization': `token ${config.github.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'jira-test-generator'
    };
  }

  async getPRFiles(prNumber, owner = config.github.owner, repo = config.github.repo) {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
        { headers: this.headers }
      );

      return response.data.map(file => ({
        filename: file.filename,
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        sha: file.sha
      }));
    } catch (error) {
      console.error(`Error fetching PR ${prNumber} files:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  async getFileContent(filePath, owner = config.github.owner, repo = config.github.repo, ref = 'main') {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/contents/${filePath}`,
        { 
          headers: this.headers,
          params: { ref }
        }
      );

      if (response.data.encoding === 'base64') {
        return Buffer.from(response.data.content, 'base64').toString('utf8');
      }
      
      return response.data.content;
    } catch (error) {
      console.error(`Error fetching file content for ${filePath}:`, error.message);
      if (error.response?.status === 404) {
        console.warn(`File not found: ${filePath}`);
        return null;
      }
      throw error;
    }
  }

  async getPRDetails(prNumber, owner = config.github.owner, repo = config.github.repo) {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/pulls/${prNumber}`,
        { headers: this.headers }
      );

      return {
        number: response.data.number,
        title: response.data.title,
        body: response.data.body,
        state: response.data.state,
        head: {
          sha: response.data.head.sha,
          ref: response.data.head.ref
        },
        base: {
          sha: response.data.base.sha,
          ref: response.data.base.ref
        }
      };
    } catch (error) {
      console.error(`Error fetching PR ${prNumber} details:`, error.message);
      throw error;
    }
  }

  filterTestableFiles(files) {
    const testableExtensions = ['.cs', '.js', '.ts', '.jsx', '.tsx', '.py', '.java'];
    const excludePatterns = [
      /\.test\./,
      /\.spec\./,
      /test/i,
      /spec/i,
      /\.config\./,
      /\.json$/,
      /\.md$/,
      /\.txt$/
    ];

    return files.filter(file => {
      // Check if file has testable extension
      const hasTestableExtension = testableExtensions.some(ext => 
        file.filename.toLowerCase().endsWith(ext)
      );

      if (!hasTestableExtension) {
        return false;
      }

      // Exclude test files and config files
      const shouldExclude = excludePatterns.some(pattern => 
        pattern.test(file.filename)
      );

      return !shouldExclude && file.status !== 'removed';
    });
  }

  async getFileContentWithChanges(prFiles, prNumber) {
    const results = [];
    
    for (const file of prFiles) {
      try {
        const content = await this.getFileContent(file.path);
        if (content) {
          results.push({
            filename: file.filename,
            path: file.path,
            content: content,
            changes: file.changes,
            additions: file.additions,
            deletions: file.deletions,
            patch: file.patch
          });
        }
      } catch (error) {
        console.warn(`Skipping file ${file.path} due to error:`, error.message);
        continue;
      }
    }

    return results;
  }
}

module.exports = new GitHubClient();