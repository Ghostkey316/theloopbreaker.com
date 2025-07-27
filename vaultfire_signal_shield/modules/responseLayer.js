const { openaiChat } = require('../../partner_api_shim');

const TONES = {
  humor: 'Diffuse Mode',
  calm: 'Bridge Mode',
  silence: 'Shadow Mode'
};

exports.recommend = async function recommend(posts) {
  const prompt = `Respond to hostility with humor or calm facts. Example post: ${posts[0]?.text || ''}`;
  const reply = await openaiChat(prompt);
  return reply || 'No suggestion';
};
