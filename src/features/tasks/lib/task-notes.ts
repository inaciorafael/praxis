export function taskNotesToPlainText(value: string | null) {
  if (!value) {
    return ''
  }

  const document = new DOMParser().parseFromString(value, 'text/html')
  const blocks = [...document.body.querySelectorAll('p, li')]
    .map((element) => element.textContent?.trim() ?? '')
    .filter(Boolean)

  return (blocks.length > 0 ? blocks.join(' ') : (document.body.textContent ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
}

const ALLOWED_NOTE_ELEMENTS = new Set(['BR', 'EM', 'LI', 'OL', 'P', 'STRONG', 'UL'])

export function sanitizeTaskNotesHtml(value: string | null) {
  if (!value) {
    return ''
  }

  const source = new DOMParser().parseFromString(value, 'text/html')
  const output = document.implementation.createHTMLDocument('')

  function appendSafeNode(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(output.createTextNode(node.textContent ?? ''))
      return
    }

    if (!(node instanceof HTMLElement)) {
      return
    }

    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
      return
    }

    const nextParent = ALLOWED_NOTE_ELEMENTS.has(node.tagName)
      ? parent.appendChild(output.createElement(node.tagName.toLowerCase()))
      : parent

    node.childNodes.forEach((child) => appendSafeNode(child, nextParent))
  }

  source.body.childNodes.forEach((node) => appendSafeNode(node, output.body))
  return output.body.innerHTML
}

export function decoratePraxisInTaskNotesHtml(value: string | null) {
  const safeHtml = sanitizeTaskNotesHtml(value)

  if (!safeHtml) {
    return ''
  }

  const document = new DOMParser().parseFromString(safeHtml, 'text/html')
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }

  for (const textNode of textNodes) {
    const text = textNode.data
    const matches = [...text.matchAll(/\bpraxis\b/gi)]

    if (matches.length === 0) {
      continue
    }

    const fragment = document.createDocumentFragment()
    let cursor = 0

    for (const match of matches) {
      const start = match.index ?? 0
      fragment.append(text.slice(cursor, start))

      const decoration = document.createElement('span')
      decoration.className = 'praxis-word-decoration'
      decoration.textContent = match[0]
      fragment.append(decoration)
      cursor = start + match[0].length
    }

    fragment.append(text.slice(cursor))
    textNode.replaceWith(fragment)
  }

  return document.body.innerHTML
}
