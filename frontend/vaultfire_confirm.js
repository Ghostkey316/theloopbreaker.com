function showVaultfireConfirmation() {
  if (sessionStorage.getItem('vaultfireConfirmed')) return;
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.right = 0;
  overlay.style.bottom = 0;
  overlay.style.background = 'rgba(0,0,0,0.8)';
  overlay.style.color = '#fff';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.flexDirection = 'column';
  overlay.style.zIndex = '10000';

  const msg = document.createElement('p');
  msg.textContent = 'You are building with Vaultfire. Proceed with honor.';
  msg.style.marginBottom = '20px';

  const btn = document.createElement('button');
  btn.textContent = 'Continue';
  btn.style.padding = '10px 20px';
  btn.addEventListener('click', () => {
    sessionStorage.setItem('vaultfireConfirmed', 'yes');
    overlay.remove();
  });

  overlay.appendChild(msg);
  overlay.appendChild(btn);
  document.body.appendChild(overlay);
}

window.addEventListener('DOMContentLoaded', showVaultfireConfirmation);
