(() => {
  const card = document.getElementById('poll-card');
  const token = window.location.pathname.split('/').filter(Boolean).pop();
  const storageKey = `pollVoterToken:${token}`;

  function getVoterToken() {
    try {
      return localStorage.getItem(storageKey);
    } catch (err) {
      return null;
    }
  }

  function setVoterToken(value) {
    try {
      localStorage.setItem(storageKey, value);
    } catch (err) {
      // ignore (private browsing etc.) — voting still works, just won't be editable later
    }
  }

  async function loadPoll() {
    const voterToken = getVoterToken();
    const url = `/api/public/polls/${token}${voterToken ? `?voterToken=${encodeURIComponent(voterToken)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Umfrage nicht gefunden');
    }
    const { poll } = await res.json();
    return poll;
  }

  async function submitVote(name, optionIds) {
    const res = await fetch(`/api/public/polls/${token}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterName: name, optionIds, voterToken: getVoterToken() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || 'Abstimmen fehlgeschlagen');
    }
    setVoterToken(body.voterToken);
    return body.poll;
  }

  function render(poll) {
    card.innerHTML = '';

    const title = document.createElement('h1');
    title.className = 'poll-title';
    title.textContent = poll.title;
    card.appendChild(title);

    if (poll.description) {
      const desc = document.createElement('p');
      desc.className = 'poll-description';
      desc.textContent = poll.description;
      card.appendChild(desc);
    }

    if (poll.closed) {
      const badge = document.createElement('p');
      badge.className = 'poll-closed-badge';
      badge.textContent = 'Diese Umfrage ist geschlossen — es kann nicht mehr abgestimmt werden.';
      card.appendChild(badge);
    }

    const totalParticipants = new Set(poll.options.flatMap((o) => o.voters)).size;

    const form = document.createElement('form');
    form.className = 'poll-options';

    poll.options.forEach((option) => {
      const row = document.createElement('label');
      row.className = 'poll-option-row';

      const input = document.createElement('input');
      input.type = poll.multiSelect ? 'checkbox' : 'radio';
      input.name = 'poll-option';
      input.value = option.id;
      input.disabled = poll.closed;
      if (poll.you && poll.you.optionIds.includes(option.id)) {
        input.checked = true;
      }

      const main = document.createElement('div');
      main.className = 'poll-option-main';

      const labelRow = document.createElement('div');
      labelRow.className = 'poll-option-label-row';
      const labelText = document.createElement('span');
      labelText.className = 'poll-option-label';
      labelText.textContent = option.label;
      const count = document.createElement('span');
      count.className = 'poll-option-count';
      count.textContent = `${option.voters.length} ${option.voters.length === 1 ? 'Stimme' : 'Stimmen'}`;
      labelRow.append(labelText, count);

      const barTrack = document.createElement('div');
      barTrack.className = 'poll-option-bar-track';
      const bar = document.createElement('div');
      bar.className = 'poll-option-bar';
      const pct = totalParticipants > 0 ? Math.round((option.voters.length / totalParticipants) * 100) : 0;
      bar.style.width = `${pct}%`;
      barTrack.appendChild(bar);

      main.append(labelRow, barTrack);

      if (option.voters.length > 0) {
        const voters = document.createElement('p');
        voters.className = 'poll-option-voters';
        voters.textContent = option.voters.join(', ');
        main.appendChild(voters);
      }

      row.append(input, main);
      form.appendChild(row);
    });

    card.appendChild(form);

    const nameLabel = document.createElement('label');
    nameLabel.className = 'poll-name-label';
    nameLabel.textContent = 'Dein Name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 100;
    nameInput.placeholder = 'Name eingeben';
    nameInput.value = (poll.you && poll.you.name) || '';
    nameInput.disabled = poll.closed;
    nameLabel.appendChild(nameInput);
    card.appendChild(nameLabel);

    const error = document.createElement('p');
    error.className = 'error';
    card.appendChild(error);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'primary-btn poll-submit-btn';
    submitBtn.textContent = poll.you ? 'Antwort aktualisieren' : 'Abstimmen';
    submitBtn.disabled = poll.closed;
    submitBtn.addEventListener('click', async () => {
      error.textContent = '';
      const name = nameInput.value.trim();
      const selected = [...form.querySelectorAll('input:checked')].map((el) => Number(el.value));

      if (!name) {
        error.textContent = 'Bitte einen Namen eingeben.';
        return;
      }
      if (selected.length === 0) {
        error.textContent = 'Bitte mindestens eine Option auswählen.';
        return;
      }

      submitBtn.disabled = true;
      try {
        const updated = await submitVote(name, selected);
        render(updated);
      } catch (err) {
        error.textContent = err.message;
        submitBtn.disabled = false;
      }
    });
    card.appendChild(submitBtn);
  }

  function renderError(message) {
    card.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'poll-loading';
    p.textContent = message;
    card.appendChild(p);
  }

  loadPoll().then(render).catch((err) => renderError(err.message));
})();
