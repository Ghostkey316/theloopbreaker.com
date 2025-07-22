document.getElementById('caseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    pseudonym: form.pseudonym.value || undefined,
    condition: form.condition.value,
    treatment: form.treatment.value,
    notes: form.notes.value
  };
  const res = await fetch('/case-study', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    alert('Submitted!');
    form.reset();
  } else {
    const err = await res.json();
    alert(err.error || 'Submission failed');
  }
});
