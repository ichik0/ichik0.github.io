// app.js — deletions diretas e export PDF sem duplicar título
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'adler_books_v1'
  let books = loadBooks()
  let selectedBookId = books.length ? books[0].id : null

  let mm = null
  const svg = document.getElementById('markmap')
  const fallback = document.getElementById('fallback')
  const centerBtn = document.getElementById('centerBtn')
  const exportBtn = document.getElementById('exportPdf')

  const uid = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)

  function saveBooks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(books)) }
  function loadBooks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw)
    } catch (e) { console.warn('loadBooks failed', e); return [] }
  }

  // throttle fit/center
  let lastFit = 0
  function scheduleFitCenter(delay = 60) {
    const now = Date.now()
    if (now - lastFit < 300) return
    lastFit = now
    setTimeout(() => {
      try { if (mm && mm.fit) mm.fit(); if (mm && mm.center) mm.center() } catch (e) {}
    }, delay)
  }

  // add book
  document.getElementById('addBook').addEventListener('click', () => {
    const newBook = { id: uid(), title:'Livro sem título', description:'', type:'teorico', chapters:[] }
    books.unshift(newBook)
    selectedBookId = newBook.id
    saveBooks(); renderBooksList(); renderEditor()
  })

  function renderBooksList() {
    const list = document.getElementById('booksList'); list.innerHTML = ''
    books.forEach((bk) => {
      const div = document.createElement('div'); div.className = 'book-card'
      if (bk.id === selectedBookId) div.classList.add('active')
      const displayType = bk.type === 'pratico' ? 'Prático' : 'Teórico'
      div.innerHTML = `<div class="book-meta"><div class="book-title">${escapeHtml(bk.title)}</div><div class="book-type" style="font-size:.86rem;color:var(--muted)">${escapeHtml(displayType)}</div></div>
        <div class="book-actions">
          <button class="small-btn edit-book" title="Renomear">✎</button>
          <button class="small-btn remove-book" title="Remover">🗑</button>
        </div>`
      div.addEventListener('click', (e) => {
        if (e.target.closest('.book-actions')) return
        selectedBookId = bk.id; renderBooksList(); renderEditor()
      })
      list.appendChild(div)

      div.querySelector('.edit-book').addEventListener('click', (ev) => {
        ev.stopPropagation()
        const t = prompt('Título do livro', bk.title || '')
        if (t !== null) { bk.title = t; saveBooks(); renderBooksList(); renderEditor() }
      })
      // direct deletion (no modal)
      div.querySelector('.remove-book').addEventListener('click', (ev) => {
        ev.stopPropagation()
        books = books.filter(x => x.id !== bk.id)
        if (selectedBookId === bk.id) selectedBookId = books.length ? books[0].id : null
        saveBooks(); renderBooksList(); renderEditor()
      })
    })
  }

  function renderEditor() {
    const book = books.find(b=>b.id===selectedBookId)
    const editorPanel = document.getElementById('editorPanel')
    const visualPanel = document.getElementById('visualPanel')
    const emptyState = document.getElementById('emptyState')

    if (!book) {
      editorPanel.classList.add('hidden')
      visualPanel.classList.add('hidden')
      emptyState.classList.remove('hidden')
      return
    }

    emptyState.classList.add('hidden')
    editorPanel.classList.remove('hidden')
    visualPanel.classList.remove('hidden')

    const titleEl = document.getElementById('bookTitle')
    const descEl = document.getElementById('bookDescription')
    const typeBoxes = document.querySelectorAll('.type-box')
    const chaptersContainer = document.getElementById('chapters')
    chaptersContainer.innerHTML = ''

    titleEl.value = book.title || ''
    descEl.value = book.description || ''
    typeBoxes.forEach(b => b.classList.toggle('active', b.dataset.type === book.type))

    titleEl.oninput = (e) => { book.title = e.target.value; saveBooks(); renderBooksList(); updateMap() }
    descEl.oninput = (e) => { book.description = e.target.value; saveBooks() }

    // wire type boxes for current book
    typeBoxes.forEach(b => {
      b.onclick = () => {
        book.type = b.dataset.type
        saveBooks()
        typeBoxes.forEach(x => x.classList.toggle('active', x.dataset.type === book.type))
        renderBooksList()
      }
      b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click() } }
    })

    document.getElementById('addChapter').onclick = () => {
      book.chapters.push({ title:'Capítulo sem título', description:'', definitions:[], propositions:[] })
      saveBooks(); renderEditor(); updateMap()
    }

    book.chapters.forEach((ch, ci) => {
      const chDiv = document.createElement('div'); chDiv.className = 'chapter'
      chDiv.innerHTML = `
        <label>Título do capítulo</label>
        <input class="title" value="${escapeHtml(ch.title)}">
        <label>Descrição do capítulo (problema que resolve)</label>
        <textarea class="desc">${escapeHtml(ch.description)}</textarea>
        <div class="row" style="margin-top:10px">
          <button class="small-btn add-def">+ Termo</button>
          <button class="small-btn add-prop">+ Proposição</button>
          <button class="small-btn remove-ch">Remover capítulo</button>
        </div>
        <div class="section-title"><span>Termos</span><div class="section-divider"></div></div>
        <div class="definitions" id="defs-${ci}"></div>
        <div class="section-title"><span>Proposições</span><div class="section-divider"></div></div>
        <div class="propositions" id="props-${ci}"></div>
      `
      chaptersContainer.appendChild(chDiv)

      const [titleInput, descInput] = chDiv.querySelectorAll('input.title, textarea.desc')
      titleInput.oninput = e => { ch.title = e.target.value; saveBooks(); updateMap() }
      descInput.oninput = e => { ch.description = e.target.value; saveBooks() }

      chDiv.querySelector('.add-def').onclick = () => { ch.definitions.push({ termo:'', definicao:'' }); saveBooks(); renderEditor(); updateMap() }
      chDiv.querySelector('.add-prop').onclick = () => { ch.propositions.push({ text:'' }); saveBooks(); renderEditor(); updateMap() }
      // direct remove chapter
      chDiv.querySelector('.remove-ch').onclick = () => {
        ch && book.chapters.splice(ci,1); saveBooks(); renderEditor(); updateMap()
      }

      renderDefinitions(book, ci)
      renderPropositions(book, ci)
    })

    updateMap()
  }

  function renderDefinitions(book, ci) {
    const el = document.getElementById(`defs-${ci}`); el.innerHTML = ''
    const defs = book.chapters[ci].definitions
    if (!defs.length) {
      const placeholder = document.createElement('div'); placeholder.className = 'empty-placeholder'
      placeholder.textContent = 'Nenhum termo. Use "+ Termo" para adicionar.'
      el.appendChild(placeholder); return
    }
    defs.forEach((d, i) => {
      const div = document.createElement('div'); div.className = 'definition'
      div.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div class="number">Termo ${i+1}</div><button class="remove-x">✖</button></div>
        <input class="termo" placeholder="Termo" value="${escapeHtml(d.termo)}">
        <textarea class="definicao" placeholder="Definição">${escapeHtml(d.definicao)}</textarea>`
      el.appendChild(div)
      div.querySelector('.termo').oninput = e => { d.termo = e.target.value; saveBooks(); updateMap() }
      div.querySelector('.definicao').oninput = e => { d.definicao = e.target.value; saveBooks(); updateMap() }
      div.querySelector('.remove-x').onclick = () => { book.chapters[ci].definitions.splice(i,1); saveBooks(); renderEditor(); updateMap() }
    })
    Sortable.create(el, { animation:150, onEnd: () => {
      book.chapters[ci].definitions = [...el.children].filter(c => c.querySelector('.termo')).map(div => ({
        termo: div.querySelector('.termo').value, definicao: div.querySelector('.definicao').value
      }))
      saveBooks(); renderEditor(); updateMap()
    }})
  }

  function renderPropositions(book, ci) {
    const el = document.getElementById(`props-${ci}`); el.innerHTML = ''
    const props = book.chapters[ci].propositions
    if (!props.length) {
      const placeholder = document.createElement('div'); placeholder.className = 'empty-placeholder'
      placeholder.textContent = 'Nenhuma proposição. Use "+ Proposição" para adicionar.'
      el.appendChild(placeholder); return
    }
    props.forEach((p, i) => {
      const div = document.createElement('div'); div.className = 'proposition'
      div.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div class="number">Proposição ${i+1}</div><button class="remove-x">✖</button></div>
        <textarea class="prop-text" placeholder="Enunciado">${escapeHtml(p.text)}</textarea>`
      el.appendChild(div)
      div.querySelector('.prop-text').oninput = e => { p.text = e.target.value; saveBooks(); updateMap() }
      div.querySelector('.remove-x').onclick = () => { book.chapters[ci].propositions.splice(i,1); saveBooks(); renderEditor(); updateMap() }
    })
    Sortable.create(el, { animation:150, onEnd: () => {
      book.chapters[ci].propositions = [...el.children].filter(c=>c.querySelector('.prop-text')).map(div => ({ text: div.querySelector('.prop-text').value }))
      saveBooks(); renderEditor(); updateMap()
    }})
  }

  function updateMap() {
    const book = books.find(b=>b.id===selectedBookId)
    const title = book ? (book.title || 'Livro') : 'Sem livro'
    let md = `# ${title}\n\n`
    if (book) {
      book.chapters.forEach((ch, i) => {
        md += `## ${ch.title || 'Capítulo ' + (i+1)}\n`
        if (ch.definitions.length) { md += `### Termos\n`; ch.definitions.forEach((d, idx) => md += `- **${d.termo || 'Termo ' + (idx+1)}**: ${d.definicao || ''}\n`) }
        if (ch.propositions.length) { md += `### Proposições\n`; ch.propositions.forEach(p => md += `- ${p.text || ''}\n`) }
        md += '\n'
      })
    }

    if (!window.d3) { console.warn('D3 não detectado. Markmap não renderizará.'); showFallback(md); return }

    try {
      if (window.markmap && window.markmap.Transformer && window.markmap.Markmap) {
        fallback.classList.add('hidden')
        const transformer = new window.markmap.Transformer()
        const { root } = transformer.transform(md)
        if (!mm) {
          mm = window.markmap.Markmap.create(svg, { autoFit: true }, root)
          setTimeout(() => scheduleFitCenter(80), 120)
        } else {
          mm.setData(root)
          scheduleFitCenter(60)
        }
        return
      }
    } catch (err) { console.warn('Markmap error:', err) }
    showFallback(md)
  }

  function showFallback(md) {
    fallback.classList.remove('hidden')
    svg.innerHTML = ''
    fallback.innerHTML = renderFallbackHTML(md)
  }

  function renderFallbackHTML(md) {
    const lines = md.split('\n').map(l => l.trim()).filter(Boolean)
    let html = '<ul class="fallback-tree">'
    lines.forEach(line => {
      if (line.startsWith('# ')) html += `<li><strong>${escapeHtml(line.replace(/^#\s+/,''))}</strong><ul>`
      else if (line.startsWith('## ')) html += `<li>${escapeHtml(line.replace(/^##\s+/,''))}</li>`
      else if (line.startsWith('### ')) html += `<li style="font-weight:600;margin-top:6px">${escapeHtml(line.replace(/^###\s+/,''))}</li>`
      else if (line.startsWith('- ')) html += `<li>${escapeHtml(line.replace(/^-+\s*/,''))}</li>`
    })
    html += '</ul></li></ul>'
    return html
  }

  // export current book markdown to PDF (no duplicated title)
  exportBtn.addEventListener('click', () => {
    const book = books.find(b=>b.id===selectedBookId)
    if (!book) return
    // build markdown WITHOUT top-level title (we will add H1 in HTML)
    let md = ''
    book.chapters.forEach((ch, i) => {
      md += `## ${ch.title || 'Capítulo ' + (i+1)}\n`
      if (ch.definitions.length) { md += `### Termos\n`; ch.definitions.forEach((d, idx) => md += `- **${d.termo || 'Termo ' + (idx+1)}**: ${d.definicao || ''}\n`) }
      if (ch.propositions.length) { md += `### Proposições\n`; ch.propositions.forEach(p => md += `- ${p.text || ''}\n`) }
      md += '\n'
    })
    const mdIt = window.markdownit ? window.markdownit() : null
    const html = mdIt ? mdIt.render(md) : `<pre>${escapeHtml(md)}</pre>`
    const tmp = document.createElement('div')
    tmp.style.padding = '18px'; tmp.style.fontFamily = 'Inter, system-ui, Arial'
    tmp.innerHTML = `<h1>${escapeHtml(book.title || 'Livro')}</h1>` + html
    document.body.appendChild(tmp)
    try {
      html2pdf().from(tmp).set({ margin: 12, filename: `${(book.title||'livro').replace(/\s+/g,'_')}.pdf`, html2canvas: { scale: 1.5 } }).save().finally(()=> { document.body.removeChild(tmp) })
    } catch (e) {
      console.error('Export failed', e)
      document.body.removeChild(tmp)
      alert('Erro ao exportar PDF. Veja console.')
    }
  })

  function escapeHtml(s) { return (s === undefined || s === null) ? '' : String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  // initial render
  renderBooksList()
  renderEditor()

  // center button wiring
  centerBtn.addEventListener('click', () => scheduleFitCenter(40))

  window._adler = { books, saveBooks }
})
