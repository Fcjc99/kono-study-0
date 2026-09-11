const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..', 'src')
const files = []

const walk = (directory) => {
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name)
    const stat = fs.statSync(file)
    if (stat.isDirectory()) walk(file)
    else if (/\.(ts|tsx)$/.test(name)) files.push(file)
  }
}

walk(root)
const errors = []
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      erasableSyntaxOnly: true,
      verbatimModuleSyntax: true,
    },
  })
  for (const diagnostic of result.diagnostics || []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue
    errors.push(`${path.relative(root, file)} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`validated ${files.length} TypeScript/TSX files`)
