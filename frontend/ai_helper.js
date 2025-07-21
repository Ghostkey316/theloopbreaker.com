// Reference: ethics/core.mdx
class ChatAssistant {
  constructor({ mode, prompt, context }) {
    this.mode = mode || 'Vaultfire';
    this.prompt = prompt || 'Ask me anything';
    this.context = context || {};
  }

  init(container) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-assistant';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this.prompt;
    input.style.marginRight = '5px';

    const btn = document.createElement('button');
    btn.textContent = 'Send';

    const output = document.createElement('div');
    output.className = 'chat-output';
    output.style.marginTop = '10px';
    output.style.padding = '5px';
    output.style.border = '1px solid #ccc';

    btn.addEventListener('click', () => {
      const q = input.value.trim();
      if (!q) return;
      const p = document.createElement('p');
      p.textContent = `You asked: ${q}`;
      output.appendChild(p);
      input.value = '';
    });

    wrap.appendChild(input);
    wrap.appendChild(btn);
    wrap.appendChild(output);
    container.appendChild(wrap);
  }
}

// Expose globally
window.ChatAssistant = ChatAssistant;
