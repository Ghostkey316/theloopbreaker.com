async function createModule() {
  const id = document.getElementById('modId').value.trim();
  const belief = document.getElementById('belief').value.trim();
  const quests = document.getElementById('quests').value
    .split('\n')
    .map(q => q.trim())
    .filter(q => q);
  const payload = { mod_id: id, belief, quests };
  const res = await fetch('/modding/module', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => null);
  const output = document.getElementById('result');
  if (res && res.ok) output.textContent = 'saved';
  else output.textContent = 'error';
}

document.getElementById('saveBtn').addEventListener('click', createModule);
