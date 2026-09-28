/* Deriv Live Analyser - Educational tool
   Connects to public WebSocket. Real trading requires your own token.
   USE AT YOUR OWN RISK.
*/

const APP = {
  ws: null,
  connected: false,
  authorized: false,
  symbol: 'R_50',
  ticks: [],
  digitCounts: Array(10).fill(0),
  totalTicks: 0,
  lastDigit: null,
  streak: { type: null, count: 0 },
  proposalId: null,
  hedgeProposalId: null,
  autoRunning: false,
  autoInterval: null,
  reqId: 1
};

const $ = id => document.getElementById(id);
const log = (msg, type = 'info') => {
  const box = $('trade-log');
  const time = new Date().toLocaleTimeString();
  box.innerHTML = `[${time}] ${msg}\n` + box.innerHTML;
};

function nextReqId() {
  return APP.reqId++;
}

function connect() {
  const appId = $('app-id').value.trim() || '1089';
  const url = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;

  if (APP.ws) {
    try { APP.ws.close(); } catch (e) {}
  }

  APP.ws = new WebSocket(url);

  APP.ws.onopen = () => {
    APP.connected = true;
    updateStatus(true);
    $('btn-connect').disabled = true;
    $('btn-disconnect').disabled = false;
    $('btn-proposal').disabled = false;
    log('Connected to Deriv WebSocket');

    // Authorize if token provided
    const token = $('api-token').value.trim();
    if (token) {
      send({ authorize: token });
    }

    // Subscribe to ticks
    subscribeTicks();
  };

  APP.ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      handleMessage(data);
    } catch (e) {
      console.error('Parse error', e);
    }
  };

  APP.ws.onclose = () => {
    APP.connected = false;
    APP.authorized = false;
    updateStatus(false);
    $('btn-connect').disabled = false;
    $('btn-disconnect').disabled = true;
    $('btn-proposal').disabled = true;
    $('btn-buy').disabled = true;
    log('Disconnected');
  };

  APP.ws.onerror = (err) => {
    log('WebSocket error – check App ID / network', 'error');
    console.error(err);
  };
}

function disconnect() {
  if (APP.ws) APP.ws.close();
  stopAuto();
}

function send(obj) {
  if (!APP.ws || APP.ws.readyState !== WebSocket.OPEN) return;
  obj.req_id = nextReqId();
  APP.ws.send(JSON.stringify(obj));
}

function subscribeTicks() {
  APP.symbol = $('symbol').value;
  // Forget previous subscription if any
  send({ forget_all: 'ticks' });
  send({ ticks: APP.symbol, subscribe: 1 });
  // Reset stats on symbol change
  APP.ticks = [];
  APP.digitCounts = Array(10).fill(0);
  APP.totalTicks = 0;
  APP.lastDigit = null;
  APP.streak = { type: null, count: 0 };
  renderDigitStats();
}

function handleMessage(data) {
  if (data.error) {
    log(`API Error: ${data.error.message}`, 'error');
    return;
  }

  if (data.msg_type === 'authorize') {
    APP.authorized = true;
    log(`Authorized as ${data.authorize.loginid} (${data.authorize.currency})`);
    $('btn-buy').disabled = false;
    return;
  }

  if (data.msg_type === 'tick') {
    const tick = data.tick;
    const quote = tick.quote;
    const epoch = tick.epoch;
    const lastDigit = Math.floor(quote * 100) % 10; // for most synthetic indices

    APP.ticks.push({ quote, epoch, lastDigit });
    if (APP.ticks.length > 200) APP.ticks.shift();

    APP.digitCounts[lastDigit]++;
    APP.totalTicks++;
    APP.lastDigit = lastDigit;

    // Streak
    const isEven = lastDigit % 2 === 0;
    const type = isEven ? 'Even' : 'Odd';
    if (APP.streak.type === type) {
      APP.streak.count++;
    } else {
      APP.streak = { type, count: 1 };
    }

    $('last-tick').textContent = quote.toFixed(tick.pip_size || 2);
    $('tick-time').textContent = new Date(epoch * 1000).toLocaleTimeString();
    renderDigitStats();
    return;
  }

  if (data.msg_type === 'proposal') {
    const p = data.proposal;
    APP.proposalId = p.id;
    const box = $('proposal-result');
    box.innerHTML = `Proposal ID: ${p.id}\n` +
      `Payout: ${p.payout} ${p.currency || ''}\n` +
      `Spot: ${p.spot}\n` +
      `Ask Price: ${p.ask_price}\n` +
      `Longcode: ${p.longcode}`;
    $('btn-buy').disabled = !APP.authorized;
    log(`Proposal received: ${p.longcode}`);
    return;
  }

  if (data.msg_type === 'buy') {
    const b = data.buy;
    log(`BOUGHT → Contract ${b.contract_id} | Buy price: ${b.buy_price} | Payout: ${b.payout}`);
    return;
  }
}

function renderDigitStats() {
  const container = $('digit-freq');
  let html = '';
  for (let d = 0; d < 10; d++) {
    const cnt = APP.digitCounts[d];
    const pct = APP.totalTicks ? ((cnt / APP.totalTicks) * 100).toFixed(1) : '0.0';
    html += `<div class="digit-cell"><div class="num">${d}</div><div class="pct">${pct}%</div></div>`;
  }
  container.innerHTML = html;

  const even = APP.digitCounts[0] + APP.digitCounts[2] + APP.digitCounts[4] +
               APP.digitCounts[6] + APP.digitCounts[8];
  const odd = APP.totalTicks - even;
  $('even-pct').textContent = APP.totalTicks ? ((even / APP.totalTicks) * 100).toFixed(1) + '%' : '—';
  $('odd-pct').textContent = APP.totalTicks ? ((odd / APP.totalTicks) * 100).toFixed(1) + '%' : '—';
  $('digit-streak').textContent = APP.streak.type ? `${APP.streak.type} × ${APP.streak.count}` : '—';

  // Recent digits
  const recent = APP.ticks.slice(-20).reverse();
  $('recent-digits').innerHTML = recent.map(t => {
    const cls = t.lastDigit % 2 === 0 ? 'even' : 'odd';
    return `<span class="${cls}">${t.lastDigit}</span>`;
  }).join('');
}

function getProposal(isHedge = false) {
  if (!APP.connected) return;

  const type = $('contract-type').value;
  const duration = parseInt($('duration').value, 10) || 5;
  const stake = parseFloat($('stake').value) || 1;
  const barrier = $('barrier').value;

  const params = {
    proposal: 1,
    amount: stake,
    basis: 'stake',
    contract_type: isHedge ? getOpposing(type) : type,
    currency: 'USD',
    duration,
    duration_unit: 't',
    symbol: APP.symbol
  };

  // Barriers / digits / selected tick
  if (['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(type) ||
      ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(params.contract_type)) {
    params.barrier = barrier;
  }
  if (['TICKHIGH', 'TICKLOW'].includes(params.contract_type)) {
    params.selected_tick = parseInt(barrier, 10) || 1;
  }

  send(params);
}

function getOpposing(type) {
  const map = {
    CALL: 'PUT',
    PUT: 'CALL',
    TICKHIGH: 'TICKLOW',
    TICKLOW: 'TICKHIGH',
    DIGITEVEN: 'DIGITODD',
    DIGITODD: 'DIGITEVEN',
    DIGITOVER: 'DIGITUNDER',
    DIGITUNDER: 'DIGITOVER',
    DIGITMATCH: 'DIGITDIFF',
    DIGITDIFF: 'DIGITMATCH'
  };
  return map[type] || type;
}

function buyContract() {
  if (!APP.authorized || !APP.proposalId) {
    log('Need authorization + valid proposal first');
    return;
  }
  if (!$('real-trading').checked) {
    log('Real trading checkbox is OFF – simulation only');
    return;
  }

  const stake = parseFloat($('stake').value) || 1;
  send({
    buy: APP.proposalId,
    price: stake
  });

  // Hedge buy if enabled
  if ($('hedge-mode').checked && APP.hedgeProposalId) {
    send({
      buy: APP.hedgeProposalId,
      price: stake
    });
  }
}

function startAuto() {
  if (APP.autoRunning) return;
  APP.autoRunning = true;
  $('btn-auto-start').disabled = true;
  $('btn-auto-stop').disabled = false;
  log('Auto mode started (simulation unless Real Trading is checked)');

  APP.autoInterval = setInterval(() => {
    if (!APP.connected) return;
    const strategy = $('auto-strategy').value;

    if (strategy === 'even-odd') {
      $('contract-type').value = Math.random() > 0.5 ? 'DIGITEVEN' : 'DIGITODD';
    } else if (strategy === 'over-under') {
      $('contract-type').value = Math.random() > 0.5 ? 'DIGITOVER' : 'DIGITUNDER';
      $('barrier').value = 5;
    } else if (strategy === 'hedge-rise-fall') {
      $('contract-type').value = 'CALL';
      $('hedge-mode').checked = true;
    } else if (strategy === 'hedge-high-low') {
      $('contract-type').value = 'TICKHIGH';
      $('barrier').value = 3;
      $('hedge-mode').checked = true;
    }

    getProposal();
    // In real mode a human would still confirm; here we only buy if real-trading is on
    if ($('real-trading').checked && APP.authorized) {
      setTimeout(() => buyContract(), 800);
    } else {
      log(`[SIM] Would place ${$('contract-type').value} (hedge=${$('hedge-mode').checked})`);
    }
  }, 12000); // every ~12s
}

function stopAuto() {
  APP.autoRunning = false;
  if (APP.autoInterval) clearInterval(APP.autoInterval);
  $('btn-auto-start').disabled = false;
  $('btn-auto-stop').disabled = true;
  log('Auto mode stopped');
}

function updateStatus(online) {
  const el = $('conn-status');
  el.textContent = online ? 'Connected' : 'Disconnected';
  el.className = 'status ' + (online ? 'online' : 'offline');
}

// UI event listeners
$('btn-connect').addEventListener('click', connect);
$('btn-disconnect').addEventListener('click', disconnect);
$('symbol').addEventListener('change', () => {
  if (APP.connected) subscribeTicks();
});
$('contract-type').addEventListener('change', () => {
  const t = $('contract-type').value;
  const needsBarrier = ['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF','TICKHIGH','TICKLOW'].includes(t);
  $('barrier-row').style.display = needsBarrier ? 'block' : 'none';
});
$('btn-proposal').addEventListener('click', () => {
  getProposal(false);
  if ($('hedge-mode').checked) {
    setTimeout(() => getProposal(true), 300);
  }
});
$('btn-buy').addEventListener('click', buyContract);
$('btn-auto-start').addEventListener('click', startAuto);
$('btn-auto-stop').addEventListener('click', stopAuto);

// Initial
$('btn-auto-start').disabled = true;
log('Ready. Enter App ID (default 1089) and optionally a token, then Connect.');
