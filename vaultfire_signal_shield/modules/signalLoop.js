const fetch = require('node-fetch');

const SEARCH_TERMS = ['Vaultfire', 'NS3', 'Ghostkey316'];

async function fetchX() {
  const token = process.env.X_API_KEY;
  if (!token) return [];
  // Placeholder: actual implementation would call X/Twitter API
  return [];
}

async function fetchReddit() {
  const token = process.env.REDDIT_TOKEN;
  if (!token) return [];
  // Placeholder: actual implementation would call Reddit API
  return [];
}

exports.fetchSignals = async function fetchSignals() {
  const [xData, redditData] = await Promise.all([fetchX(), fetchReddit()]);
  return [...xData, ...redditData];
};
