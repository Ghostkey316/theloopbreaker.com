import { loyalty } from '../js/vaultfire.js';

async function main() {
  const score = await loyalty('demo-user');
  console.log('Loyalty score:', score);
}

main();
