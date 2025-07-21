async function onboard() {
  const res = await fetch('/onboard/partner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partner_id: 'belieftech', wallet: 'belieftech.eth' })
  }).catch(() => null);
  const out = document.getElementById('result');
  if (res && res.ok) {
    out.textContent = 'BeliefTech Inc. onboarded!';
  } else {
    out.textContent = 'Onboarding failed';
  }
}

document.getElementById('onboardBtn').addEventListener('click', onboard);
