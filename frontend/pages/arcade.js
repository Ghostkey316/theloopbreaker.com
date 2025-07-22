async function loadGames() {
  const res = await fetch('../../vaultfire_arcade/games.json').catch(() => null);
  if (!res || !res.ok) return {};
  try { return await res.json(); } catch { return {}; }
}

function displayGames(list) {
  const container = document.getElementById('gameList');
  container.innerHTML = '';
  Object.entries(list).forEach(([id, info]) => {
    const div = document.createElement('div');
    div.className = 'game-entry';
    const btn = document.createElement('button');
    btn.textContent = `Play ${info.title}`;
    btn.addEventListener('click', () => playGame(id));
    div.appendChild(btn);
    container.appendChild(div);
  });
}

async function playGame(gameId) {
  const payload = {
    user_id: 'demo_user',
    game_id: gameId,
    outcome: { demo: true },
    achievements: ['started'],
    loyalty: 1
  };
  await fetch('/arcade/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  alert(`Session logged for ${gameId}`);
}

loadGames().then(displayGames);
