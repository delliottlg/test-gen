# Questions for Jira Test Generator Setup

## Critical Information Needed:

1. **Where are GitHub PR links stored in your Jira tickets?**
   - In the ticket description?
   - In comments?
   - In a custom field?
   - In linked issues?

2. **What format do the GitHub PR references use?**
   - Full URL: `https://github.com/lingraphica/lingraphica-app/pull/123`
   - Short format: `PR #123`
   - Something else?

3. **Example tickets to check:**
   - SGD-4762 - Add plugin changes for Google STT
   - SGD-4754 - App Tile and Initial App Layout
   - SGD-4685 - Add a msg to Talk Settings Card Behavior when MW is on

## Current Status:
- ✅ App deployed to 137.184.4.152:3000
- ✅ Connected to Jira (found 5 tickets in "Ready For Test QA" status)
- ❌ No GitHub PR links found in ticket descriptions
- 🔄 Need to know where to look for PR links

## Next Steps Once We Have This Info:
1. Update jiraClient.js to look in the correct location for PR links
2. Test with a ticket that has a PR link
3. Verify test generation works end-to-end