const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\Aarthy\\.gemini\\antigravity\\brain\\2b612606-56ac-43dd-9b0f-98244bb196b9\\.system_generated\\logs\\transcript.jsonl';
const outFile = path.join(process.cwd(), 'proflow1.md');

try {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  
  let md = '# Chat Export\n\n';
  
  for (const line of lines) {
    const data = JSON.parse(line);
    if (data.type === 'USER_INPUT' && data.content) {
      md += `## User\n\n${data.content}\n\n`;
    } else if (data.type === 'PLANNER_RESPONSE' && data.content) {
      md += `## Assistant\n\n${data.content}\n\n`;
    }
  }
  
  fs.writeFileSync(outFile, md, 'utf8');
  console.log('Successfully exported chat to', outFile);
} catch (error) {
  console.error('Error exporting chat:', error.message);
}
