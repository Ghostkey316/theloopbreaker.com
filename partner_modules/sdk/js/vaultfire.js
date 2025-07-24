export async function loyalty(userId) {
  return fetch(`/loyalty/${userId}`).then(r => r.json());
}
export async function identity(name) {
  return fetch(`/resolve/${name}`).then(r => r.json());
}
export async function quiz(data) {
  return fetch('/ns3/quiz', {method: 'POST', body: JSON.stringify(data)}).then(r => r.json());
}
export async function wallet(addr) {
  return fetch(`/wallet/${addr}`).then(r => r.json());
}
export async function reward(user, amount) {
  return fetch('/reward', {method: 'POST', body: JSON.stringify({user, amount})});
}
export async function signal(data) {
  return fetch('/signal', {method: 'POST', body: JSON.stringify(data)});
}
