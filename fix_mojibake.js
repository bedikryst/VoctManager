const fs = require('fs');
const path = require('path');

const dir = 'frontend/src/features/projects/ProjectEditorPanel';
const map = {
  'Ä…': 'ą',
  'Ä‡': 'ć',
  'Ä™': 'ę',
  'Ĺ‚': 'ł',
  'Ĺ„': 'ń',
  'Ăł': 'ó',
  'Ĺ›': 'ś',
  'Ĺş': 'ź',
  'ĹĽ': 'ż',
  'Ä„': 'Ą',
  'Ä†': 'Ć',
  'Ä˜': 'Ę',
  'Ĺ': 'Ł',
  'Ĺƒ': 'Ń',
  'Ă“': 'Ó',
  'Ĺš': 'Ś',
  'Ĺą': 'Ź',
  'Ĺ»': 'Ż'
};

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(dir);
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  for (const [bad, good] of Object.entries(map)) {
    content = content.split(bad).join(good);
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log('Fixed', file);
  }
});
console.log('Total fixed:', changedFiles);
