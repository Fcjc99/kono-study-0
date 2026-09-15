// A tiny, safe markdown-lite renderer for AI-generated study guides — only headings, bullet lists
// and **bold** spans are interpreted; everything else stays plain escaped React text, the same
// "our formatting language only, never raw HTML" approach SafeNoteBody uses for notes.
const boldSpans = (line: string, keyBase: string) =>
  line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') && part.length > 4
    ? <strong key={keyBase + i}>{part.slice(2, -2)}</strong>
    : <span key={keyBase + i}>{part}</span>)

export default function KQuizGuide({ text }: { text: string }) {
  const lines = text.split(/\r?\n/)
  const blocks: { type: 'h2' | 'h3' | 'li' | 'p'; text: string }[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const h2 = /^#{1,2}\s+(.*)$/.exec(line)
    const h3 = /^#{3,6}\s+(.*)$/.exec(line)
    const li = /^[-*]\s+(.*)$/.exec(line)
    if (h2) blocks.push({ type: 'h2', text: h2[1] })
    else if (h3) blocks.push({ type: 'h3', text: h3[1] })
    else if (li) blocks.push({ type: 'li', text: li[1] })
    else blocks.push({ type: 'p', text: line })
  }
  const groups: (typeof blocks[number] | { type: 'ul'; items: string[] })[] = []
  for (const block of blocks) {
    const last = groups[groups.length - 1]
    if (block.type === 'li') { if (last?.type === 'ul') last.items.push(block.text); else groups.push({ type: 'ul', items: [block.text] }) }
    else groups.push(block)
  }
  return <div className="kquiz-guide">{groups.map((g, i) => {
    if (g.type === 'ul') return <ul key={i}>{g.items.map((item, j) => <li key={j}>{boldSpans(item, i + '-' + j)}</li>)}</ul>
    if (g.type === 'h2') return <h4 key={i}>{boldSpans(g.text, String(i))}</h4>
    if (g.type === 'h3') return <h5 key={i}>{boldSpans(g.text, String(i))}</h5>
    return <p key={i}>{boldSpans(g.text, String(i))}</p>
  })}</div>
}
