const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');
const fs = require('fs').promises;
const path = require('path');

class AIGenerator {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
    this.testDocumentation = '';
    this.maxTokens = 4000;
  }

  async loadTestDocumentation() {
    try {
      const docsPath = path.join(__dirname, '..', 'docs', 'test-patterns.md');
      this.testDocumentation = await fs.readFile(docsPath, 'utf8');
      console.log('Test documentation loaded successfully');
    } catch (error) {
      console.warn('Test documentation not found, using default patterns');
      this.testDocumentation = this.getDefaultTestPatterns();
    }
  }

  getDefaultTestPatterns() {
    return `
# Test Generation Patterns

## C# Test Patterns
- Use xUnit framework
- Follow AAA pattern (Arrange, Act, Assert)
- Mock dependencies using Moq
- Test both success and failure scenarios
- Include edge cases and boundary conditions

## JavaScript/TypeScript Test Patterns
- Use Jest framework
- Mock external dependencies
- Test async functions properly
- Include integration tests for API endpoints
- Test error handling

## General Guidelines
- Write clear, descriptive test names
- One assertion per test when possible
- Use meaningful test data
- Clean up resources in teardown
`;
  }

  async generateTests(fileData, ticketContext = '') {
    try {
      if (!this.testDocumentation) {
        await this.loadTestDocumentation();
      }

      const prompt = this.buildPrompt(fileData, ticketContext);
      
      const message = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: this.maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const response = message.content[0].text;
      return this.parseTestResponse(response, fileData.filename);
    } catch (error) {
      console.error('Error generating tests with AI:', error.message);
      throw error;
    }
  }

  buildPrompt(fileData, ticketContext) {
    const { filename, content, patch } = fileData;
    
    return `You are a senior software engineer writing comprehensive unit tests. 

CONTEXT:
Jira ticket context: ${ticketContext}
File: ${filename}
Recent changes (git patch):
${patch || 'No patch available'}

TEST DOCUMENTATION:
${this.testDocumentation}

SOURCE CODE:
\`\`\`
${content}
\`\`\`

TASK:
Generate comprehensive unit tests for the above code, focusing on:
1. The recent changes highlighted in the patch
2. Critical business logic and edge cases
3. Error handling and validation
4. Integration points and dependencies

REQUIREMENTS:
- Follow the test patterns from the documentation
- Generate complete, runnable test files
- Include proper setup/teardown
- Test both positive and negative scenarios
- Use appropriate mocking for dependencies
- Write clear, descriptive test names

OUTPUT FORMAT:
Provide the complete test file content wrapped in code blocks with appropriate language tags.
Include any necessary imports and setup code.

Example output:
\`\`\`csharp
// Complete test file content here
\`\`\`

Generate the tests now:`;
  }

  parseTestResponse(response, originalFilename) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const tests = [];
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || this.detectLanguage(originalFilename);
      const code = match[2].trim();
      
      if (code.length > 0) {
        tests.push({
          language,
          code,
          filename: this.generateTestFilename(originalFilename, language)
        });
      }
    }

    if (tests.length === 0) {
      // If no code blocks found, treat entire response as code
      const language = this.detectLanguage(originalFilename);
      tests.push({
        language,
        code: response.trim(),
        filename: this.generateTestFilename(originalFilename, language)
      });
    }

    return tests;
  }

  detectLanguage(filename) {
    const ext = path.extname(filename).toLowerCase();
    const languageMap = {
      '.cs': 'csharp',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java'
    };
    
    return languageMap[ext] || 'text';
  }

  generateTestFilename(originalFilename, language) {
    const baseName = path.basename(originalFilename, path.extname(originalFilename));
    const ext = path.extname(originalFilename);
    
    const testExtensions = {
      'csharp': '.Tests.cs',
      'javascript': '.test.js',
      'typescript': '.test.ts',
      'python': '_test.py',
      'java': 'Test.java'
    };

    const testExt = testExtensions[language] || '.test' + ext;
    return baseName + testExt;
  }

  async saveTest(testData, outputDir, ticketKey) {
    try {
      // Check disk space before generating files
      const validators = require('./validators');
      const diskSpace = await validators.checkDiskSpace(outputDir);
      
      if (!diskSpace.sufficient) {
        throw new Error(`Insufficient disk space: ${diskSpace.available}MB available, need at least 100MB`);
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const testDir = path.join(outputDir, 'generated', timestamp, ticketKey);
      
      await fs.mkdir(testDir, { recursive: true });
      
      const savedTests = [];
      for (const test of testData) {
        const filePath = path.join(testDir, test.filename);
        await fs.writeFile(filePath, test.code, 'utf8');
        savedTests.push({
          filename: test.filename,
          path: filePath,
          language: test.language
        });
      }
      
      console.log(`Generated ${savedTests.length} test files in ${testDir}`);
      return savedTests;
    } catch (error) {
      console.error('Error saving test files:', error.message);
      throw error;
    }
  }

  async generateTestSummary(tests, ticketKey, prNumber) {
    const summary = {
      ticketKey,
      prNumber,
      timestamp: new Date().toISOString(),
      testsGenerated: tests.length,
      files: tests.map(test => ({
        filename: test.filename,
        language: test.language,
        linesOfCode: test.code.split('\n').length
      }))
    };

    return summary;
  }
}

module.exports = new AIGenerator();