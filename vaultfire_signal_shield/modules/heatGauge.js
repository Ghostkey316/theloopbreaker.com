exports.display = function display(analysis) {
  console.log('--- Heat Gauge Dashboard ---');
  console.log('Hostility Index:', analysis.globalIndex);
  console.log('Sample Posts:');
  analysis.tagged.slice(0, 5).forEach(p => {
    console.log('-', p.tone, p.text ? p.text.slice(0, 60) : '');
  });
};
