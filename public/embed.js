/**
 * CreateAgent.ai — Embed Widget
 * Add this to any website to embed your AI agent as a chat bubble.
 *
 * Usage:
 * <script src="https://createagents.ai/embed.js" data-agent-id="YOUR_AGENT_ID"></script>
 */
(function () {
  const script = document.currentScript
  const agentId = script?.getAttribute('data-agent-id')
  const position = script?.getAttribute('data-position') || 'right'
  const baseUrl = script?.getAttribute('data-base-url') || 'https://createagents.ai'

  if (!agentId) {
    console.error('CreateAgent embed: missing data-agent-id')
    return
  }

  // Styles
  const style = document.createElement('style')
  style.textContent = `
    #ca-widget-btn{position:fixed;bottom:24px;${position}:24px;z-index:99999;width:56px;height:56px;border-radius:50%;background:#C44B2C;color:white;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(196,75,44,0.4);display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform .2s}
    #ca-widget-btn:hover{transform:scale(1.08)}
    #ca-widget-frame{position:fixed;bottom:92px;${position}:24px;z-index:99999;width:380px;height:520px;border:none;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.15);display:none;background:white;overflow:hidden}
    @media(max-width:440px){#ca-widget-frame{width:calc(100vw - 32px);${position}:16px;bottom:84px;height:70vh}}
  `
  document.head.appendChild(style)

  // Button
  const btn = document.createElement('button')
  btn.id = 'ca-widget-btn'
  btn.innerHTML = '💬'
  btn.title = 'Chat with AI Agent'
  document.body.appendChild(btn)

  // Iframe
  const frame = document.createElement('iframe')
  frame.id = 'ca-widget-frame'
  frame.src = `${baseUrl}/share/${agentId}`
  frame.allow = 'clipboard-write'
  document.body.appendChild(frame)

  let open = false
  btn.addEventListener('click', function () {
    open = !open
    frame.style.display = open ? 'block' : 'none'
    btn.innerHTML = open ? '✕' : '💬'
  })
})()
