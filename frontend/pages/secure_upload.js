async function connectWallet() {
  if (!window.ethereum) {
    alert('Wallet provider not found');
    return;
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const address = accounts[0];
  const msg = 'Vaultfire upload ' + Date.now();
  const signature = await window.ethereum.request({ method: 'personal_sign', params: [msg, address] });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
  window.vaultKey = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt']);
  document.getElementById('walletStatus').textContent = address;
  window.walletAddress = address;
}

function dropHandler(ev) {
  ev.preventDefault();
  document.getElementById('fileInput').files = ev.dataTransfer.files;
}

function dragOver(ev) {
  ev.preventDefault();
}

document.getElementById('walletBtn').addEventListener('click', connectWallet);
const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover', dragOver);
dropZone.addEventListener('drop', dropHandler);
dropZone.addEventListener('click', () => document.getElementById('fileInput').click());

async function stripExif(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => resolve(blob), file.type || 'image/jpeg');
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function encrypt(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, window.vaultKey, data);
  const combined = new Uint8Array(iv.length + enc.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(enc), iv.length);
  const hash = await crypto.subtle.digest('SHA-256', combined);
  console.log('Encrypted payload hash:', toHex(hash));
  return combined;
}

document.getElementById('metaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!window.walletAddress || !window.vaultKey) {
    alert('Connect wallet first');
    return;
  }
  const file = document.getElementById('fileInput').files[0];
  if (!file) {
    alert('Select a file');
    return;
  }
  const cleanBlob = await stripExif(file);
  const arrayBuf = await cleanBlob.arrayBuffer();
  const encrypted = await encrypt(arrayBuf);

  const tier = document.getElementById('tierInput').value;
  const score = parseInt(document.getElementById('scoreInput').value, 10);
  const trigger = document.getElementById('triggerInput').value;
  const timestamp = new Date().toISOString();
  if (Math.abs(Date.now() - Date.parse(timestamp)) > 500) {
    alert('Timestamp drift detected');
    return;
  }
  const meta = { wallet: window.walletAddress, tier, score, timestamp, trigger };
  const payload = { meta, data: btoa(String.fromCharCode(...encrypted)) };
  try {
    const resp = await fetch('/secure-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Upload failed');
    const li = document.createElement('li');
    li.textContent = `Uploaded ${timestamp} trigger ${trigger} score ${score}`;
    document.getElementById('uploadLog').appendChild(li);
  } catch (err) {
    alert('Upload failed: ' + err.message);
  }
});
