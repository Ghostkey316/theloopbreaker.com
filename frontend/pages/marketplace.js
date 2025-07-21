// Reference: ethics/core.mdx
async function loadJSON(path) {
  const res = await fetch(path).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

async function loadConfig() {
  return loadJSON('../../vaultfire-core/marketplace_config.json');
}

async function loadListings() {
  return loadJSON('../../dashboards/marketplace_listings.json') || [];
}

async function loadSignalFeed() {
  return loadJSON('../../dashboards/signal_feed.json') || [];
}

async function loadScorecard() {
  return loadJSON('../../user_scorecard.json') || {};
}

function displaySellers(users) {
  const container = document.querySelector('.sellerList');
  container.innerHTML = '';
  (users || []).forEach(u => {
    const div = document.createElement('div');
    div.className = 'seller';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = (u.user || '?').slice(0,2).toUpperCase();
    const name = document.createElement('span');
    name.textContent = `${u.user} – ${u.score}`;
    div.appendChild(avatar);
    div.appendChild(name);
    container.appendChild(div);
  });
}

function filterListings(listings) {
  const rank = document.getElementById('filterRank').value;
  const signal = parseFloat(document.getElementById('filterSignal').value) || 0;
  const cat = document.getElementById('filterCategory').value;
  return listings.filter(item => {
    // apply smart filters: seller must have high signal and ethics verified
    if (!item.ethics_verified) return false;
    if (item.seller && item.seller.signal_score < 90) return false;
    if (rank && item.ethics_rank !== rank) return false;
    if (cat && item.category !== cat) return false;
    if (signal && item.signal < signal) return false;
    return true;
  });
}

function displayListings(listings) {
  const feed = document.getElementById('listingFeed');
  feed.innerHTML = '';
  listings.forEach(item => {
    const li = document.createElement('li');
    const seller = item.seller ? item.seller.name : 'Unknown';
    li.textContent = `${item.name} - ${item.price} ${item.currency} [${item.category}] by ${seller}`;
    feed.appendChild(li);
  });
}

function displayStats(stats) {
  const pre = document.getElementById('stats');
  pre.textContent = JSON.stringify(stats, null, 2);
}

async function init() {
  const config = await loadConfig();
  const catSelect = document.getElementById('filterCategory');
  const categories = (config && config.categories) || [];
  catSelect.innerHTML = '<option value="">All</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');

  const listings = await loadListings();
  displayListings(listings);

  const feed = await loadSignalFeed();
  const sellers = feed.length ? feed[feed.length-1].top_users : [];
  displaySellers(sellers);

  const scorecard = await loadScorecard();
  displayStats(scorecard);

  const update = async () => {
    const fresh = await loadListings();
    const filtered = filterListings(fresh);
    displayListings(filtered);
  };

  document.getElementById('filterRank').addEventListener('change', update);
  document.getElementById('filterSignal').addEventListener('input', update);
  document.getElementById('filterCategory').addEventListener('change', update);
  setInterval(update, 5000);
}

document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('theme-dark');
});

init();
