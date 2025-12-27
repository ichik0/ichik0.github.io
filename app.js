let chapters = []

function addChapter() {
  chapters.push({
    title: '',
    description: '',
    definitions: [],
    propositions: []
  })
  render()
}

function addItem(chapterIndex, type) {
  chapters[chapterIndex][type].push({ text: '' })
  render()
}

function render() {
  const container = document.getElementById('chapters')
  container.innerHTML = ''

  chapters.forEach((ch, i) => {
    const div = document.createElement('div')
    div.className = 'chapter'

    div.innerHTML = `
      <label>Título do capítulo</label>
      <input value="${ch.title}" oninput="chapters[${i}].title=this.value; updateMap()">

      <label>Descrição</label>
      <textarea oninput="chapters[${i}].description=this.value; updateMap()">${ch.description}</textarea>

      <h4>Definições</h4>
      <button onclick="addItem(${i}, 'definitions')">Adicionar</button>
      <div class="list" id="defs-${i}"></div>

      <h4>Proposições</h4>
      <button onclick="addItem(${i}, 'propositions')">Adicionar</button>
      <div class="list" id="props-${i}"></div>
    `
    container.appendChild(div)

    renderList(`defs-${i}`, ch.definitions, i, 'definitions')
    renderList(`props-${i}`, ch.propositions, i, 'propositions')
  })

  updateMap()
}

function renderList(id, items, ci, type) {
  const el = document.getElementById(id)
  el.innerHTML = ''

  items.forEach((it, ii) => {
    const div = document.createElement('div')
    div.className = 'item'
    div.innerHTML = `<input value="${it.text}" oninput="chapters[${ci}].${type}[${ii}].text=this.value; updateMap()">`
    el.appendChild(div)
  })

  Sortable.create(el, {
    animation: 150,
    onEnd: () => {
      const reordered = [...el.children].map(c => ({
        text: c.querySelector('input').value
      }))
      chapters[ci][type] = reordered
      updateMap()
    }
  })
}

function updateMap() {
  const title = document.getElementById('bookTitle').value || 'Livro'

  let md = `# ${title}\n`
  chapters.forEach(ch => {
    md += `## ${ch.title || 'Capítulo'}\n`
    if (ch.definitions.length) {
      md += `### Definições\n`
      ch.definitions.forEach(d => md += `- ${d.text}\n`)
    }
    if (ch.propositions.length) {
      md += `### Proposições\n`
      ch.propositions.forEach(p => md += `- ${p.text}\n`)
    }
  })

  const transformer = new markmap.Transformer()
  const { root } = transformer.transform(md)
  markmap.Markmap.create('#markmap', null, root)
}
