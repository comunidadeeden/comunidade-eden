const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');
const renderAdminMissionsContent = fs.readFileSync('src/renderAdminMissions.tsx', 'utf-8');

// Insert renderAdminMissions before renderAdminPanel
content = content.replace('const renderAdminPanel = () => (', renderAdminMissionsContent + '\n\n  const renderAdminPanel = () => (');

// Replace the old adminActiveSection === 'missoes' block
const targetStartStr = "{adminActiveSection === 'missoes' && (";
const startIdx = content.indexOf(targetStartStr);

if (startIdx === -1) {
  console.log('Could not find adminActiveSection === missoes block start');
  process.exit(1);
}

// Find the matching closing bracket for this block
let openBrackets = 0;
let endIdx = -1;

for (let i = startIdx; i < content.length; i++) {
  if (content[i] === '{') openBrackets++;
  if (content[i] === '}') {
    openBrackets--;
    if (openBrackets === 0) {
      endIdx = i;
      break;
    }
  }
}

// the string `)}` usually follows the close bracket for short circuit evaluation. Wait, the `endIdx` is on the closing `}`, and there is a `)` right after it. Let's make sure.
content = content.replace(content.substring(startIdx, endIdx + 2), "{adminActiveSection === 'missoes' && renderAdminMissions()}");

fs.writeFileSync('src/App.tsx', content, 'utf-8');
console.log('App.tsx successfully updated');
