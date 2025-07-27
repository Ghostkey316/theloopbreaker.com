const Sentiment = require('sentiment');
const sentiment = new Sentiment();

function mapScore(score) {
  if (score > 3) return 'Supportive';
  if (score > 0) return 'Neutral';
  if (score === 0) return 'Caution';
  if (score > -3) return 'Hostile';
  return 'Escalating';
}

exports.analyze = function analyze(posts) {
  let total = 0;
  const tagged = posts.map(p => {
    const result = sentiment.analyze(p.text || '');
    total += result.score;
    return { ...p, tone: mapScore(result.score) };
  });
  const globalIndex = Math.min(100, Math.max(0, 50 - total));
  return { tagged, globalIndex };
};
