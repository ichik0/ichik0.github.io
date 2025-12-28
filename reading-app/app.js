// app.js — dragon eye mascot, scales background, chapters-only, PDF without "Regra 2"
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'adler_books_v1'
  const CONFIRM_TIMEOUT = 4000

  let books = loadBooks()
  let selectedBookId = books.length ? books[0].id : null

  let mm = null
  const svg = document.getElementById('markmap')
  const fallback = document.getElementById('fallback')
  const centerBtn = document.getElementById('centerBtn')
  const exportBtn = document.getElementById('exportPdf')
  const mascot = document.getElementById('mascot')
  const pupil = document.getElementById('pupil') || document.getElementById('pupil') // fallback safe

  const pendingBookDeletes = new Map()
  const pendingChapterDeletes = new Map()
  const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)

  function saveBooks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(books)) }
  function loadBooks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw)
    } catch (e) { console.warn('loadBooks failed', e); return [] }
  }

  function romanize(num) {
    if (!+num) return ''
    const nums = [1000,900,500,400,100,90,50,40,10,9,5,4,1]
    const romans = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I']
    let res = ''
    for (let i=0;i<nums.length;i++) {
      while (num >= nums[i]) { res += romans[i]; num -= nums[i] }
    }
    return res
  }

  // mascot eye follow: move pupil position (pupil is an ellipse/circle with cx/cy attributes)
  if (mascot) {
    const pupilEl = document.querySelector('#mascot #pupil') || document.querySelector('#mascot ellipse#pupil') || document.querySelector('#mascot ellipse')
    const irisEl = document.querySelector('#mascot #iris') || document.querySelector('#mascot ellipse#iris')
    document.addEventListener('mousemove', (e) => {
      const rect = mascot.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      mascot.style.transform = `rotate(${(angle/16)}deg)`
      // pupil movement vector bounded
      const max = 10
      const dist = Math.sqrt(dx*dx + dy*dy) || 1
      const nx = Math.max(-max, Math.min(max, dx/dist * max))
      const ny = Math.max(-max, Math.min(max, dy/dist * max))
      // set attributes if exists
      if (pupilEl) {
        if (pupilEl.tagName.toLowerCase() === 'ellipse') {
          pupilEl.setAttribute('cx', 70 + nx)
          pupilEl.setAttribute('cy', 66 + ny)
        } else {
          pupilEl.setAttribute('cx', 70 + nx)
          pupilEl.setAttribute('cy', 66 + ny)
        }
      }
    })
  }

  // schedule fit/center
  let lastFit = 0
  function scheduleFitCenter(delay = 60) {
    const now = Date.now()
    if (now - lastFit < 300) return
    lastFit = now
    setTimeout(() => {
      try { if (mm && mm.fit) mm.fit(); if (mm && mm.center) mm.center() } catch (e) {}
    }, delay)
  }

  // Add book
  const addBookBtn = document.getElementById('addBook')
  if (addBookBtn) addBookBtn.addEventListener('click', () => {
    const newBook = { id: uid(), title:'Livro sem título', description:'', chapters:[] }
    books.unshift(newBook)
    selectedBookId = newBook.id
    saveBooks(); renderBooksList(); renderEditor()
  })

  // Render books list (no rename button)
  function renderBooksList() {
    const list = document.getElementById('booksList'); list.innerHTML = ''
    books.forEach((bk) => {
      const div = document.createElement('div'); div.className = 'book-card'
      if (bk.id === selectedBookId) div.classList.add('active')
      div.innerHTML = `<div class="book-meta"><div class="book-title">${escapeHtml(bk.title)}</div></div>
        <div class="book-actions"><button class="small-btn remove-book" title="Remover">🗑</button></div>`
      div.addEventListener('click', (e) => {
        if (e.target.closest('.book-actions')) return
        selectedBookId = bk.id; renderBooksList(); renderEditor()
      })
      list.appendChild(div)

      const removeBtn = div.querySelector('.remove-book')
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        if (pendingBookDeletes.has(bk.id)) {
          clearTimeout(pendingBookDeletes.get(bk.id))
          pendingBookDeletes.delete(bk.id)
          removeBtn.classList.remove('confirm-pending')
          div.classList.add('fade-out')
          setTimeout(()=> {
            books = books.filter(x => x.id !== bk.id)
            if (selectedBookId === bk.id) selectedBookId = books.length ? books[0].id : null
            saveBooks(); renderBooksList(); renderEditor()
          }, 320)
        } else {
          removeBtn.classList.add('confirm-pending')
          const t = setTimeout(() => { pendingBookDeletes.delete(bk.id); removeBtn.classList.remove('confirm-pending') }, CONFIRM_TIMEOUT)
          pendingBookDeletes.set(bk.id, t)
        }
      })
    })
  }

  // Render editor (chapters only)
  function renderEditor() {
    const book = books.find(b=>b.id===selectedBookId)
    const editorPanel = document.getElementById('editorPanel')
    const visualPanel = document.getElementById('visualPanel')
    const emptyState = document.getElementById('emptyState')
    if (!book) {
      editorPanel.classList.add('hidden'); visualPanel.classList.add('hidden'); emptyState.classList.remove('hidden')
      return
    }
    emptyState.classList.add('hidden'); editorPanel.classList.remove('hidden'); visualPanel.classList.remove('hidden')

    // migrate legacy parts into chapter-level arrays (if present)
    book.chapters = book.chapters || []
    book.chapters.forEach(ch => {
      if (!ch.id) ch.id = uid()
      if (ch.parts && Array.isArray(ch.parts)) {
        ch.definitions = [].concat(...(ch.parts.map(p => p.definitions || [])))
        ch.propositions = [].concat(...(ch.parts.map(p => p.propositions || [])))
        delete ch.parts
      }
      ch.definitions = ch.definitions || []
      ch.propositions = ch.propositions || []
    })

    const titleEl = document.getElementById('bookTitle')
    const descEl = document.getElementById('bookDescription')
    const chaptersContainer = document.getElementById('chapters')
    chaptersContainer.innerHTML = ''

    titleEl.value = book.title || ''
    descEl.value = book.description || ''

    titleEl.oninput = (e) => { book.title = e.target.value; saveBooks(); renderBooksList(); updateMap() }
    descEl.oninput = (e) => { book.description = e.target.value; saveBooks() }

    document.getElementById('addChapter').onclick = () => {
      const ch = { id: uid(), title:'Capítulo sem título', description:'', definitions:[], propositions:[] }
      book.chapters.push(ch); saveBooks(); renderEditor(); updateMap()
    }

    // render chapters
    book.chapters.forEach((ch, ci) => {
      const chDiv = document.createElement('div'); chDiv.className = 'chapter'
      chDiv.dataset.chapterId = ch.id
      chDiv.innerHTML = `
        <label>Título do capítulo</label>
        <input class="title" value="${escapeHtml(ch.title)}">
        <label>Descrição do capítulo</label>
        <textarea class="desc">${escapeHtml(ch.description)}</textarea>

        <div class="row" style="margin-top:8px;align-items:center">
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

      const removeChBtn = chDiv.querySelector('.remove-ch')
      removeChBtn.addEventListener('click', (ev)=> {
        ev.stopPropagation()
        if (pendingChapterDeletes.has(ch.id)) {
          clearTimeout(pendingChapterDeletes.get(ch.id))
          pendingChapterDeletes.delete(ch.id)
          removeChBtn.classList.remove('confirm-pending')
          chDiv.classList.add('fade-out')
          setTimeout(()=> { ch && book.chapters.splice(ci,1); saveBooks(); renderEditor(); updateMap() }, 320)
        } else {
          removeChBtn.classList.add('confirm-pending')
          const t = setTimeout(()=>{ pendingChapterDeletes.delete(ch.id); removeChBtn.classList.remove('confirm-pending') }, CONFIRM_TIMEOUT)
          pendingChapterDeletes.set(ch.id, t)
        }
      })

      renderDefinitions(book, ci)
      renderPropositions(book, ci)
    })

    // sortable for chapters
    Sortable.create(chaptersContainer, {
      animation:150,
      onEnd: (evt) => {
        const oldIndex = evt.oldIndex, newIndex = evt.newIndex
        if (oldIndex===newIndex) return
        const moved = book.chapters.splice(oldIndex,1)[0]
        book.chapters.splice(newIndex,0,moved)
        saveBooks(); renderEditor(); updateMap()
      }
    })

    updateMap()
  }

  // definitions renderer (chapter level)
  function renderDefinitions(book, ci) {
    const el = document.getElementById(`defs-${ci}`); el.innerHTML = ''
    const defs = book.chapters[ci].definitions
    if (!defs.length) {
      const placeholder = document.createElement('div'); placeholder.className = 'empty-placeholder'
      placeholder.textContent = 'Nenhum termo. Use "+ Termo" para adicionar.'
      el.appendChild(placeholder)
      const addBtn = document.createElement('button'); addBtn.className='small-btn'; addBtn.textContent = '+ Termo'
      addBtn.onclick = () => { book.chapters[ci].definitions.push({ termo:'', definicao:'' }); saveBooks(); renderEditor(); updateMap() }
      el.appendChild(addBtn)
      return
    }
    defs.forEach((d, i) => {
      const div = document.createElement('div'); div.className = 'definition'
      div.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div class="number">Termo ${i+1}</div><button class="remove-x">✖</button></div>
        <input class="termo" placeholder="Termo" value="${escapeHtml(d.termo)}">
        <textarea class="definicao" placeholder="Definição">${escapeHtml(d.definicao)}</textarea>`
      el.appendChild(div)
      div.querySelector('.termo').oninput = e => { d.termo = e.target.value; saveBooks(); updateMap() }
      div.querySelector('.definicao').oninput = e => { d.definicao = e.target.value; saveBooks(); updateMap() }
      div.querySelector('.remove-x').onclick = () => { div.classList.add('fade-out'); setTimeout(()=> { book.chapters[ci].definitions.splice(i,1); saveBooks(); renderEditor(); updateMap() }, 280) }
    })
    const addBtn = document.createElement('button'); addBtn.className='small-btn'; addBtn.textContent = '+ Termo'
    addBtn.onclick = () => { book.chapters[ci].definitions.push({ termo:'', definicao:'' }); saveBooks(); renderEditor(); updateMap() }
    el.appendChild(addBtn)

    Sortable.create(el, {
      animation:150,
      onEnd: () => {
        const items = [...el.children].filter(c => c.querySelector && c.querySelector('.termo'))
        book.chapters[ci].definitions = items.map(div => ({ termo: div.querySelector('.termo').value, definicao: div.querySelector('.definicao').value }))
        saveBooks(); renderEditor(); updateMap()
      }
    })
  }

  // propositions renderer (chapter level)
  function renderPropositions(book, ci) {
    const el = document.getElementById(`props-${ci}`); el.innerHTML = ''
    const props = book.chapters[ci].propositions
    if (!props.length) {
      const placeholder = document.createElement('div'); placeholder.className = 'empty-placeholder'
      placeholder.textContent = 'Nenhuma proposição. Use "+ Proposição" para adicionar.'
      el.appendChild(placeholder)
      const addBtn = document.createElement('button'); addBtn.className='small-btn'; addBtn.textContent = '+ Proposição'
      addBtn.onclick = () => { book.chapters[ci].propositions.push({ text:'' }); saveBooks(); renderEditor(); updateMap() }
      el.appendChild(addBtn)
      return
    }
    props.forEach((p, i) => {
      const div = document.createElement('div'); div.className = 'proposition'
      div.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div class="number">Proposição ${i+1}</div><button class="remove-x">✖</button></div>
        <textarea class="prop-text" placeholder="Enunciado">${escapeHtml(p.text)}</textarea>`
      el.appendChild(div)
      div.querySelector('.prop-text').oninput = e => { p.text = e.target.value; saveBooks(); updateMap() }
      div.querySelector('.remove-x').onclick = () => { div.classList.add('fade-out'); setTimeout(()=> { book.chapters[ci].propositions.splice(i,1); saveBooks(); renderEditor(); updateMap() }, 280) }
    })
    const addBtn = document.createElement('button'); addBtn.className='small-btn'; addBtn.textContent = '+ Proposição'
    addBtn.onclick = () => { book.chapters[ci].propositions.push({ text:'' }); saveBooks(); renderEditor(); updateMap() }
    el.appendChild(addBtn)

    Sortable.create(el, {
      animation:150,
      onEnd: () => {
        const items = [...el.children].filter(c => c.querySelector && c.querySelector('.prop-text'))
        book.chapters[ci].propositions = items.map(div => ({ text: div.querySelector('.prop-text').value }))
        saveBooks(); renderEditor(); updateMap()
      }
    })
  }

  // markmap builder (chapter level)
  function updateMap() {
    const book = books.find(b=>b.id===selectedBookId)
    const title = book ? (book.title || 'Livro') : 'Sem livro'
    let md = `# ${title}\n\n`
    if (book) {
      book.chapters.forEach((ch, i) => {
        md += `## ${ch.title || 'Capítulo ' + (i+1)}\n`
        if (ch.definitions && ch.definitions.length) {
          md += `### Termos\n`
          ch.definitions.forEach((d, idx) => md += `- **${d.termo || 'Termo ' + (idx+1)}**: ${d.definicao || ''}\n`)
        }
        if (ch.propositions && ch.propositions.length) {
          md += `### Proposições\n`
          ch.propositions.forEach(pp => md += `- ${pp.text || ''}\n`)
        }
        md += '\n'
      })
    }
    if (!window.d3) { console.warn("D3 not detected. Markmap won't render"); showFallback(md); return }
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

  // Export PDF — description included plainly (no "Regra 2" label), readable theme
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const book = books.find(b=>b.id===selectedBookId)
      if (!book) return
      let html = `<div style="font-family:Times New Roman, serif;color:#111;background:#fff;padding:18px">`
      html += `<h1 style="color:#111">${escapeHtml(book.title || 'Livro')}</h1>`
      if (book.description) {
        html += `<div style="margin-bottom:12px">${escapeHtml(book.description)}</div>`
      }
      book.chapters.forEach((ch, ci) => {
        html += `<h2 style="color:#111;margin-top:18px">${romanize(ci+1)}. ${escapeHtml(ch.title || 'Capítulo ' + (ci+1))}</h2>`
        if (ch.definitions && ch.definitions.length) {
          html += `<div style="margin-left:12px"><em>Termos</em><br/>`
          ch.definitions.forEach(d => { html += `${escapeHtml(d.termo)} — ${escapeHtml(d.definicao)}<br/>` })
          html += `</div>`
        }
        if (ch.propositions && ch.propositions.length) {
          html += `<div style="margin-left:12px"><em>Proposições</em><br/>`
          ch.propositions.forEach(pp => { html += `${escapeHtml(pp.text)}<br/>` })
          html += `</div>`
        }
      })
      html += `</div>`
      const tmp = document.createElement('div'); tmp.style.padding='0'; tmp.innerHTML = html
      document.body.appendChild(tmp)
      try {
        html2pdf().from(tmp).set({ margin: 12, filename: `${(book.title||'livro').replace(/\s+/g,'_')}.pdf`, html2canvas: { scale: 1.5 } }).save().finally(()=> { document.body.removeChild(tmp) })
      } catch (e) {
        console.error('Export failed', e)
        document.body.removeChild(tmp)
        alert('Erro ao exportar PDF. Veja console.')
      }
    })
  }

  function escapeHtml(s) { return (s===undefined || s===null) ? '' : String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  // initial render
  renderBooksList()
  renderEditor()
  if (centerBtn) centerBtn.addEventListener('click', () => scheduleFitCenter(40))
  window._adler = { books, saveBooks }
})
