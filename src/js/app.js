const DEFAULT_STATE = {
  columns: [
    { id: 'col-1', title: 'To Do', cards: [] },
    { id: 'col-2', title: 'In Progress', cards: [] },
    { id: 'col-3', title: 'Done', cards: [] },
  ],
}

function generateId() {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

class TrelloBoard {
  constructor(rootSelector) {
    this.root = document.querySelector(rootSelector)
    this.state = this.loadState()
    this.dragState = null
    this.placeholderEl = null

    this.onDragMove = this.onDragMove.bind(this)
    this.onDragEnd = this.onDragEnd.bind(this)
  }

  loadState() {
    try {
      const saved = localStorage.getItem('trello-board-state')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      // ignore
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE))
  }

  saveState() {
    localStorage.setItem('trello-board-state', JSON.stringify(this.state))
  }

  init() {
    this.render()
  }

  render() {
    const { root, state } = this
    root.innerHTML = ''

    const board = document.createElement('div')
    board.className = 'board'

    state.columns.forEach((col) => {
      const { id: columnId, title, cards } = col

      const columnEl = document.createElement('div')
      columnEl.className = 'column'
      columnEl.dataset.columnId = columnId

      const titleEl = document.createElement('h2')
      titleEl.className = 'column-title'
      titleEl.textContent = title

      const cardsContainer = document.createElement('div')
      cardsContainer.className = 'cards-container'
      cardsContainer.dataset.columnId = columnId

      cards.forEach((card) => {
        const cardEl = this.createCardElement(card, columnId)
        cardsContainer.append(cardEl)
      })

      const addBlock = document.createElement('div')
      addBlock.className = 'add-block'
      const addBtn = document.createElement('button')
      addBtn.className = 'add-card-btn'
      addBtn.type = 'button'
      addBtn.textContent = '+ Add another card'
      addBtn.dataset.columnId = columnId
      addBlock.append(addBtn)

      columnEl.append(titleEl, cardsContainer, addBlock)
      board.append(columnEl)
    })

    root.append(board)
    this.bindEvents()
  }

  createCardElement(card, columnId) {
    const { id: cardId, text } = card

    const wrap = document.createElement('div')
    wrap.className = 'card-wrap'
    wrap.dataset.cardId = cardId
    wrap.dataset.columnId = columnId

    const cardEl = document.createElement('div')
    cardEl.className = 'card'
    cardEl.textContent = text

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'card-delete'
    deleteBtn.type = 'button'
    deleteBtn.setAttribute('aria-label', 'delete')
    deleteBtn.innerHTML = '&#10060;'
    deleteBtn.dataset.cardId = cardId

    wrap.append(cardEl, deleteBtn)
    return wrap
  }

  bindEvents() {
    const { root } = this
    root.querySelectorAll('.add-card-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => this.onAddCardClick(e))
    })
    root.querySelectorAll('.card-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => this.onDeleteCardClick(e))
    })
    root.querySelectorAll('.card-wrap').forEach((wrap) => {
      wrap.addEventListener('mousedown', (e) => {
        if (e.detail === 2) return
        this.onCardMouseDown(e)
      })
    })
    root.querySelectorAll('.card').forEach((cardEl) => {
      cardEl.addEventListener('dblclick', (e) => this.onCardDblClick(e))
    })
  }

  onCardDblClick(e) {
    const cardEl = e.target.closest('.card')
    if (!cardEl) return

    const wrap = cardEl.closest('.card-wrap')
    if (!wrap) return

    // уже в режиме редактирования
    if (wrap.classList.contains('card-editing')) return

    const { cardId, columnId } = wrap.dataset
    const column = this.state.columns.find((c) => c.id === columnId)
    if (!column) return
    const card = column.cards.find((c) => c.id === cardId)
    if (!card) return

    wrap.classList.add('card-editing')

    const originalText = card.text
    cardEl.textContent = ''

    const textarea = document.createElement('textarea')
    textarea.className = 'card-edit'
    textarea.value = originalText
    textarea.rows = 3

    cardEl.append(textarea)
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    const finish = (save) => {
      const newText = textarea.value.trim()
      wrap.classList.remove('card-editing')

      if (save && newText && newText !== originalText) {
        card.text = newText
        this.saveState()
      }

      this.render()
    }

    textarea.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault()
        finish(true)
      }
      if (ev.key === 'Escape') {
        ev.preventDefault()
        finish(false)
      }
    })

    textarea.addEventListener('blur', () => {
      finish(true)
    })
  }

  onAddCardClick(e) {
    const btn = e.target.closest('.add-card-btn')
    if (!btn) return

    btn.classList.add('hidden')
    const { columnId } = btn.dataset
    const addBlock = btn.closest('.add-block')
    if (addBlock.querySelector('.add-card-form')) return

    const form = document.createElement('div')
    form.className = 'add-card-form'

    const input = document.createElement('textarea')
    input.placeholder = 'Enter card title...'
    input.rows = 2

    const actions = document.createElement('div')
    actions.className = 'add-card-actions'

    const submitBtn = document.createElement('button')
    submitBtn.type = 'button'
    submitBtn.className = 'add-card-submit'
    submitBtn.textContent = 'Add Card'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'add-card-cancel'
    cancelBtn.textContent = 'Cancel'

    const submit = () => {
      const text = input.value.trim()
      if (text) {
        const col = this.state.columns.find((c) => c.id === columnId)
        if (col) {
          col.cards.push({ id: generateId(), text })
          this.saveState()
          this.render()
        }
      } else {
        btn.classList.remove('hidden')
        form.remove()
      }
    }

    submitBtn.addEventListener('click', submit)
    cancelBtn.addEventListener('click', () => {
      btn.classList.remove('hidden')
      form.remove()
    })
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault()
        submit()
      }
    })

    actions.append(submitBtn, cancelBtn)
    form.append(input, actions)
    addBlock.insertBefore(form, btn)
    input.focus()
  }

  onDeleteCardClick(e) {
    const btn = e.target.closest('.card-delete')
    if (!btn) return

    e.stopPropagation()
    const { cardId } = btn.dataset

    this.state.columns.forEach((col) => {
      col.cards = col.cards.filter((c) => c.id !== cardId)
    })
    this.saveState()
    this.render()
  }

  onCardMouseDown(e) {
    const wrap = e.target.closest('.card-wrap')
    if (!wrap || e.target.closest('.card-delete')) return
    e.preventDefault()

    const { clientX, clientY } = e
    const rect = wrap.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top

    const ghost = wrap.cloneNode(true)
    ghost.classList.add('card-ghost')
    ghost.style.width = `${rect.width}px`
    ghost.style.height = `${rect.height}px`
    ghost.style.left = `${clientX - offsetX}px`
    ghost.style.top = `${clientY - offsetY}px`
    document.body.append(ghost)

    wrap.classList.add('card-dragging')

    // индекс исходного положения карточки в колонке
    const columnContainer = wrap.closest('.cards-container')
    const wraps = Array.from(
      columnContainer.querySelectorAll('.card-wrap:not(.card-placeholder)'),
    )
    const originalIndex = wraps.indexOf(wrap)

    this.dragState = {
      cardId: wrap.dataset.cardId,
      columnId: wrap.dataset.columnId,
      wrap,
      ghost,
      offsetX,
      offsetY,
      cardHeight: rect.height,
      originalIndex,
    }

    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', this.onDragMove)
    document.addEventListener('mouseup', this.onDragEnd)
  }

  onDragMove(e) {
    if (!this.dragState) return

    const { ghost, offsetX, offsetY } = this.dragState
    const { clientX, clientY } = e

    ghost.style.left = `${clientX - offsetX}px`
    ghost.style.top = `${clientY - offsetY}px`

    const { columnId: targetColId, index: targetIndex } = this.findDropTarget(e)
    this.updatePlaceholder(targetColId, targetIndex)
  }

  findDropTarget(e) {
    const { clientX, clientY } = e
    const columns = this.root.querySelectorAll('.cards-container')

    for (let i = 0; i < columns.length; i += 1) {
      const col = columns[i]
      const { left, right, top, bottom } = col.getBoundingClientRect()

      if (clientX < left || clientX > right) continue
      if (clientY < top || clientY > bottom) continue

      const wraps = col.querySelectorAll('.card-wrap:not(.card-placeholder)')
      const { columnId } = col.dataset

      if (wraps.length === 0) {
        return { columnId, index: 0 }
      }

      for (let j = 0; j < wraps.length; j += 1) {
        const r = wraps[j].getBoundingClientRect()
        const mid = r.top + r.height / 2
        if (clientY < mid) {
          return { columnId, index: j }
        }
      }

      return { columnId, index: wraps.length }
    }

    return { columnId: null, index: -1 }
  }

  updatePlaceholder(columnId, index) {
    this.removePlaceholder()
    if (columnId == null || index < 0) return

    // если находимся над исходным местом карточки — ничего не показываем
    if (
      this.dragState
      && columnId === this.dragState.columnId
      && index === this.dragState.originalIndex
    ) {
      return
    }

    const col = this.root.querySelector(
      `.cards-container[data-column-id="${columnId}"]`,
    )
    if (!col) return

    const { cardHeight } = this.dragState
    this.placeholderEl = document.createElement('div')
    this.placeholderEl.className = 'card-placeholder'
    this.placeholderEl.style.height = `${cardHeight}px`

    const ref = col.querySelectorAll('.card-wrap:not(.card-placeholder)')[index]
    if (ref) {
      col.insertBefore(this.placeholderEl, ref)
    } else {
      col.append(this.placeholderEl)
    }
  }

  removePlaceholder() {
    if (this.placeholderEl && this.placeholderEl.parentNode) {
      this.placeholderEl.parentNode.removeChild(this.placeholderEl)
    }
    this.placeholderEl = null
  }

  onDragEnd() {
    const { dragState } = this
    if (!dragState) return

    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', this.onDragMove)
    document.removeEventListener('mouseup', this.onDragEnd)

    const ghostRect = dragState.ghost.getBoundingClientRect()
    const { columnId: targetColId, index: targetIndex } = this.findDropTarget({
      clientX: ghostRect.left + 10,
      clientY: ghostRect.top + 10,
    })

    if (targetColId != null && targetIndex >= 0) {
      let card = null
      this.state.columns.forEach((col) => {
        const idx = col.cards.findIndex((c) => c.id === dragState.cardId)
        if (idx !== -1) {
          [card] = col.cards.splice(idx, 1)
        }
      })

      if (card) {
        const targetCol = this.state.columns.find((c) => c.id === targetColId)
        if (targetCol) {
          targetCol.cards.splice(targetIndex, 0, card)
          this.saveState()
        }
      }
    }

    if (dragState.wrap) dragState.wrap.classList.remove('card-dragging')
    dragState.ghost.remove()
    this.dragState = null
    this.removePlaceholder()
    this.render()
  }
}

const board = new TrelloBoard('#app')
board.init()
