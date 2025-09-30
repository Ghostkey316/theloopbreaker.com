const cache = new Map();

export async function resolveEns(target) {
  if (!target) {
    return { address: null, name: null, avatar: null };
  }
  const key = target.toLowerCase();
  if (cache.has(key)) {
    return cache.get(key);
  }

  const fallback = { address: key, name: null, avatar: null };
  if (typeof fetch !== 'function') {
    cache.set(key, fallback);
    return fallback;
  }

  try {
    const response = await fetch(`https://api.ensideas.com/ens/resolve/${encodeURIComponent(key)}`);
    if (!response.ok) {
      cache.set(key, fallback);
      return fallback;
    }
    const data = await response.json();
    const result = {
      address: (data.address || key || '').toLowerCase(),
      name: data.name || null,
      avatar: data.avatar || null,
    };
    cache.set(key, result);
    return result;
  } catch (error) {
    cache.set(key, fallback);
    return fallback;
  }
}
