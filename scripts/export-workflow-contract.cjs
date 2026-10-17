// Export the editor vocabulary for bot-side validation. Pass the bot checkout.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
function readModule(name) {
  const file = path.join(root, 'src/components/Manage/workflow', name + '.ts');
  const m = new Module(file, module);
  m.filename = file; m.paths = module.paths;
  m.require = name => name === './blocks' ? readModule('blocks') : require(name);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
  return m.exports;
}
const { BLOCKS } = readModule('blocks');
const { isRunnable } = readModule('serialize');
const result = { version: 1, blocks: Object.fromEntries(BLOCKS.map(b => [b.type, { ...b, runnable: isRunnable(b.type) }])) };
const target = path.resolve(process.argv[2] || '.', 'utils/workflow_contract.json');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== JSON.stringify(result, null, 2) + '\n') throw Error('Workflow contract differs. Run the exporter again.');
} else fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n');
console.log(`Workflow contract: ${BLOCKS.length} definitions`);
