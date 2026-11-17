// Planejamento: em quanto tempo você chega à meta e quanto precisa aportar.
// Junta o antigo Simulador (aporte necessário para uma meta) e o Simulador Pro (cenários com inflação).
// Parte dos números reais (patrimônio, aporte e rendimento recentes) e usa a mesma meta da Visão Geral.

const PL_COLORS = { nominal: '#6366f1', real: '#0ea371', aportado: '#d97706', meta: '#9ca3af' };
const PL_DEFAULTS = { juros: 10.5, inflacao: 4.5, crescimento: 3, bonus: 0, extra: 0, extra_ano: 5, anos: 20, swr: 4, renda: 0 };
const PL_SLIDERS = [
    { id: 'pl-swr', key: 'swr', suffix: '% ao ano' },
    { id: 'pl-cresc', key: 'crescimento', suffix: '%' },
    { id: 'pl-juros', key: 'juros', suffix: '% ao ano' },
    { id: 'pl-infl', key: 'inflacao', suffix: '% ao ano' },
    { id: 'pl-anos', key: 'anos', suffix: ' anos' }
];

let plChart = null;
let plReal = null;                          // números reais calculados dos lançamentos
let plState = { capital: null, aporte: null }; // null = usar o valor real
let plSaveTimer = null;

const plNum = id => {
    const el = document.getElementById(id);
    return el ? parsePtBrFloat(el.value) : 0;
};
const plSetMoney = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value > 0 ? formatCurrencyString(Math.round(value * 100) / 100) : '';
};

// ---- Dados reais -----------------------------------------------------------
function plLoadReal() {
    const tl = patTimeline();
    if (!tl.length) return null;
    const last = tl[tl.length - 1];
    const recent = tl.slice(-6);
    const avgInvest = recent.reduce((acc, p) => acc + p.liquido, 0) / recent.length;
    const yields = tl.slice(-12).filter(p => p.yieldPct !== null);
    let annualYield = null;
    if (yields.length >= 3) {
        const growth = yields.reduce((acc, p) => acc * (1 + p.yieldPct / 100), 1);
        annualYield = (Math.pow(growth, 12 / yields.length) - 1) * 100;
    }
    return {
        networth: last.s.networth,
        year: last.year,
        month: last.month,
        avgInvest: Math.max(0, avgInvest),
        avgMonths: recent.length,
        annualYield,
        yieldMonths: yields.length
    };
}

// ---- Simulação -------------------------------------------------------------
// Mês a mês: o aporte cresce a cada 12 meses, o extra anual cai no 12º mês de cada ano
// e o extra único no primeiro mês do ano escolhido. Rendimento composto mensal.
function plSimulate(p, months) {
    const rate = Math.pow(1 + p.juros / 100, 1 / 12) - 1;
    const nominal = [p.capital];
    const invested = [p.capital];
    const interest = [0];
    let balance = p.capital;
    let totalIn = p.capital;
    let totalInterest = 0;
    let aporte = p.aporte;
    for (let m = 1; m <= months; m++) {
        const yearIdx = Math.ceil(m / 12);
        if (m > 1 && (m - 1) % 12 === 0) aporte *= 1 + p.crescimento / 100;
        let deposit = aporte;
        if (m % 12 === 0) deposit += p.bonus;
        if (yearIdx === p.extra_ano && (m - 1) % 12 === 0) deposit += p.extra;
        const before = balance + deposit;
        balance = before * (1 + rate);
        totalIn += deposit;
        totalInterest += balance - before;
        nominal.push(balance);
        invested.push(totalIn);
        interest.push(totalInterest);
    }
    return { nominal, invested, interest };
}

const plDeflate = (value, m, inflation) => value / Math.pow(1 + inflation / 100, m / 12);

// Menor aporte mensal inicial que leva o patrimônio (em valores de hoje) à meta no prazo
function plRequiredAporte(p, target) {
    const months = p.anos * 12;
    const finalReal = a => {
        const sim = plSimulate({ ...p, aporte: a }, months);
        return plDeflate(sim.nominal[months], months, p.inflacao);
    };
    if (finalReal(0) >= target) return 0;
    let low = 0;
    let high = 1000000;
    if (finalReal(high) < target) return null;
    for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2;
        if (finalReal(mid) >= target) high = mid; else low = mid;
    }
    return high;
}

function plParams() {
    return {
        capital: plNum('pl-capital'),
        aporte: plNum('pl-aporte'),
        crescimento: parseFloat(document.getElementById('pl-cresc').value) || 0,
        bonus: plNum('pl-bonus'),
        extra: plNum('pl-extra'),
        extra_ano: Math.min(40, Math.max(1, parseInt(document.getElementById('pl-extra-ano').value) || 1)),
        juros: parseFloat(document.getElementById('pl-juros').value) || 0,
        inflacao: parseFloat(document.getElementById('pl-infl').value) || 0,
        anos: parseInt(document.getElementById('pl-anos').value) || 1,
        swr: parseFloat(document.getElementById('pl-swr').value) || 4,
        renda: plNum('pl-renda'),
        meta: plNum('pl-meta')
    };
}

function plDuration(months) {
    const y = Math.floor(months / 12);
    const m = months % 12;
    const parts = [];
    if (y) parts.push(`${y} ${y === 1 ? 'ano' : 'anos'}`);
    if (m) parts.push(`${m} ${m === 1 ? 'mês' : 'meses'}`);
    return parts.join(' e ') || 'menos de 1 mês';
}

// Data (mês e ano) de m meses depois do último mês lançado
function plDateAt(m) {
    const d = new Date(parseInt(plReal.year), plReal.month - 1 + m, 1);
    return { month: d.getMonth(), year: d.getFullYear() };
}

// ---- Tela ------------------------------------------------------------------
function renderPlanejamento() {
    const emptyEl = document.getElementById('pl-empty');
    const bodyEl = document.getElementById('pl-body');
    plReal = plLoadReal();
    if (!plReal) {
        bodyEl.style.display = 'none';
        emptyEl.style.display = 'block';
        emptyEl.innerHTML = `<strong>Ainda não há investimentos lançados.</strong>
            O Planejamento parte do seu patrimônio e dos seus aportes reais. Lance o primeiro mês em Lançar mês.`;
        return;
    }
    emptyEl.style.display = 'none';
    bodyEl.style.display = 'block';

    const saved = extrasData.plano || {};
    const value = key => (saved[key] !== undefined ? saved[key] : PL_DEFAULTS[key]);

    // Rendimento sugerido: o histórico real, arredondado, se existir e estiver dentro da faixa do controle
    const historic = plReal.annualYield !== null ? Math.round(plReal.annualYield * 10) / 10 : null;
    document.getElementById('pl-real').innerHTML = `
        <div class="ov-stat">
            <p class="ov-stat-label">Patrimônio financeiro</p>
            <p class="ov-stat-value">${formatBRL(plReal.networth)}</p>
            <p class="ov-stat-foot ov-muted">Em ${monthNames[plReal.month - 1].toLowerCase()} de ${plReal.year}, o último mês fechado. Não inclui bens.</p>
        </div>
        <div class="ov-stat">
            <p class="ov-stat-label">Aporte líquido por mês</p>
            <p class="ov-stat-value">${formatBRL(plReal.avgInvest)}</p>
            <p class="ov-stat-foot ov-muted">Média dos últimos ${plReal.avgMonths} meses, já descontadas as retiradas.</p>
        </div>
        <div class="ov-stat">
            <p class="ov-stat-label">Rendimento recente</p>
            <p class="ov-stat-value">${historic === null ? '—' : ovPct(historic) + ' ao ano'}</p>
            <p class="ov-stat-foot ov-muted">${historic === null ? 'Poucos meses lançados para calcular.' : `Composto sobre os últimos ${plReal.yieldMonths} meses, sem descontar inflação.`}</p>
        </div>`;

    // Valores dos controles
    document.getElementById('pl-meta').value = '';
    plSetMoney('pl-meta', extrasData.meta || 0);
    plSetMoney('pl-renda', value('renda'));
    plSetMoney('pl-bonus', value('bonus'));
    plSetMoney('pl-extra', value('extra'));
    plSetMoney('pl-capital', plState.capital !== null ? plState.capital : plReal.networth);
    plSetMoney('pl-aporte', plState.aporte !== null ? plState.aporte : plReal.avgInvest);
    document.getElementById('pl-extra-ano').value = value('extra_ano');
    PL_SLIDERS.forEach(s => {
        document.getElementById(s.id).value = value(s.key);
        document.getElementById(`${s.id}-out`).textContent = `${value(s.key)}${s.suffix}`;
    });

    // Referências de rendimento
    const presets = [{ label: 'Poupança 6%', v: 6 }, { label: 'Renda fixa 10,5%', v: 10.5 }, { label: 'Renda variável 13%', v: 13 }];
    if (historic !== null && historic >= 1 && historic <= 25) presets.unshift({ label: `Meu histórico ${String(historic).replace('.', ',')}%`, v: historic });
    document.getElementById('pl-presets').innerHTML = presets.map(p => `<button type="button" data-v="${p.v}">${p.label}</button>`).join('');

    applyCurrencyMaskListeners();
    plCompute();
}

function plCompute() {
    if (!plReal) return;
    const p = plParams();
    const months = p.anos * 12;
    const sim = plSimulate(p, months);
    const real = sim.nominal.map((v, m) => plDeflate(v, m, p.inflacao));

    // Meta efetiva: o maior entre o patrimônio desejado e o necessário para a renda desejada
    const needForIncome = p.renda > 0 ? (p.renda * 12) / (p.swr / 100) : 0;
    const target = Math.max(p.meta, needForIncome);

    document.querySelectorAll('#pl-presets button').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.v) === p.juros));

    // ---- Resposta principal ----
    const answer = document.getElementById('pl-answer');
    if (target <= 0) {
        answer.innerHTML = `<p class="pl-answer-title">Defina uma meta</p>
            <p>Informe o patrimônio que você quer alcançar, ou a renda mensal que quer receber, para ver em quanto tempo chega lá. A projeção abaixo já mostra quanto você terá em ${p.anos} anos.</p>`;
    } else {
        let reach = -1;
        for (let m = 0; m <= months; m++) {
            if (real[m] >= target) { reach = m; break; }
        }
        const required = plRequiredAporte(p, target);
        const targetNote = needForIncome > p.meta
            ? `A meta usada é <strong>${formatBRL(target)}</strong>, o patrimônio necessário para uma renda de ${formatBRL(p.renda)} por mês retirando ${String(p.swr).replace('.', ',')}% ao ano.`
            : `A meta de <strong>${formatBRL(target)}</strong> é em valores de hoje: o patrimônio é comparado já descontada a inflação.`;
        let title;
        let body = '';
        if (reach === 0) {
            title = `<p class="pl-answer-title ok">Você já atingiu a meta</p>`;
            body = `<p>O patrimônio de ${formatBRL(plReal.networth)} já cobre ${formatBRL(target)}.</p>`;
        } else if (reach > 0) {
            const d = plDateAt(reach);
            title = `<p class="pl-answer-title ok">Você chega à meta em ${monthNames[d.month].toLowerCase()} de ${d.year}</p>`;
            body = `<p>Daqui a <strong>${plDuration(reach)}</strong>, aportando ${formatBRL(p.aporte)} por mês, com rendimento de ${String(p.juros).replace('.', ',')}% ao ano e inflação de ${String(p.inflacao).replace('.', ',')}%.</p>`;
        } else {
            const shortfall = target - real[months];
            title = `<p class="pl-answer-title no">Com esses valores, a meta não é atingida em ${p.anos} anos</p>`;
            body = `<p>Faltariam <strong>${formatBRL(shortfall)}</strong> em valores de hoje no fim do prazo.</p>`;
        }
        let need = '';
        if (reach !== 0) {
            if (required === null) {
                need = `<p>Mesmo com aportes muito altos, o prazo de ${p.anos} anos é curto demais para essa meta. Aumente o prazo.</p>`;
            } else {
                const diff = required - p.aporte;
                need = `<p>Para chegar em ${p.anos} anos, o aporte mensal inicial precisa ser de <strong>${formatBRL(required)}</strong>${
                    diff > 1 ? `, ${formatBRL(diff)} a mais que o simulado.` : diff < -1 ? `, ${formatBRL(-diff)} a menos que o simulado.` : '.'}</p>`;
            }
        }
        answer.innerHTML = title + body + need + `<p>${targetNote}</p>`;
    }

    // ---- Números do fim do prazo ----
    const end = months;
    const passive = (real[end] * (p.swr / 100)) / 12;
    const interestShare = sim.nominal[end] > 0 ? (sim.interest[end] / sim.nominal[end]) * 100 : 0;
    const endDate = plDateAt(end);
    document.getElementById('pl-end-title').textContent = `Em ${monthNames[endDate.month].toLowerCase()} de ${endDate.year}, daqui a ${p.anos} anos`;
    document.getElementById('pl-stats').innerHTML = `
        <div class="ov-stat"><p class="ov-stat-label">Patrimônio</p><p class="ov-stat-value">${formatBRL(sim.nominal[end])}</p>
            <p class="ov-stat-foot ov-muted">${formatBRL(real[end])} em valores de hoje</p></div>
        <div class="ov-stat"><p class="ov-stat-label">Renda mensal possível</p><p class="ov-stat-value">${formatBRL(passive)}</p>
            <p class="ov-stat-foot ov-muted">Em valores de hoje, retirando ${String(p.swr).replace('.', ',')}% ao ano do patrimônio</p></div>
        <div class="ov-stat"><p class="ov-stat-label">Total aportado</p><p class="ov-stat-value">${formatBRL(sim.invested[end])}</p>
            <p class="ov-stat-foot ov-muted">Inclui o patrimônio inicial</p></div>
        <div class="ov-stat"><p class="ov-stat-label">Rendimento acumulado</p><p class="ov-stat-value">${formatBRL(sim.interest[end])}</p>
            <p class="ov-stat-foot ov-muted">${ovPct(interestShare, 0)} do patrimônio final</p></div>`;

    // ---- Gráfico: um ponto por ano ----
    const idx = [];
    for (let m = 0; m <= months; m += 12) idx.push(m);
    const label = m => { const d = plDateAt(m); return `${OV_SHORT_MONTHS[d.month]}/${String(d.year).slice(2)}`; };
    const line = (name, data, color, extra = {}) => ({ label: name, data, borderColor: color, backgroundColor: color, borderWidth: 2, tension: 0.2, pointRadius: idx.length > 25 ? 0 : 2.5, pointHoverRadius: 5, ...extra });
    const datasets = [
        line('Patrimônio', idx.map(m => sim.nominal[m]), PL_COLORS.nominal),
        line('Em valores de hoje', idx.map(m => real[m]), PL_COLORS.real),
        line('Total aportado', idx.map(m => sim.invested[m]), PL_COLORS.aportado, { borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 })
    ];
    if (target > 0) datasets.push(line('Meta', idx.map(() => target), PL_COLORS.meta, { borderDash: [2, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0 }));
    if (plChart) plChart.destroy();
    plChart = new Chart(document.getElementById('pl-chart').getContext('2d'), {
        type: 'line',
        data: { labels: idx.map(label), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatBRL(ctx.raw)}` } }
            },
            scales: ovAxis({ y: { beginAtZero: true } })
        }
    });

    // ---- Tabela ano a ano ----
    const rows = idx.slice(1).map((m, i) => {
        const prev = idx[i];
        return `<tr>
            <th scope="row">${label(m)}</th>
            <td>${ovPlain(sim.invested[m] - sim.invested[prev])}</td>
            <td>${ovPlain(sim.interest[m] - sim.interest[prev])}</td>
            <td class="strong">${ovPlain(sim.nominal[m])}</td>
            <td>${ovPlain(real[m])}</td>
            <td>${ovPlain(sim.invested[m])}</td>
        </tr>`;
    }).join('');
    document.getElementById('pl-years').innerHTML = `
        <thead><tr><th scope="col">Até</th><th scope="col">Aportes no ano</th><th scope="col">Rendimento no ano</th><th scope="col">Patrimônio</th><th scope="col">Em valores de hoje</th><th scope="col">Total aportado</th></tr></thead>
        <tbody>${rows}</tbody>`;
}

// Salva meta e parâmetros do plano no servidor, sem pedir confirmação a cada ajuste
function plScheduleSave() {
    clearTimeout(plSaveTimer);
    const status = document.getElementById('pl-saved');
    status.textContent = 'Salvando…';
    plSaveTimer = setTimeout(async () => {
        const p = plParams();
        extrasData.meta = p.meta;
        extrasData.plano = { juros: p.juros, inflacao: p.inflacao, crescimento: p.crescimento, bonus: p.bonus, extra: p.extra, extra_ano: p.extra_ano, anos: p.anos, swr: p.swr, renda: p.renda };
        try {
            await saveExtras();
            status.textContent = 'Meta e parâmetros salvos. O patrimônio e o aporte iniciais seguem seus dados reais.';
        } catch (e) {
            status.textContent = 'Não foi possível salvar. Os valores valem só até você sair desta tela.';
        }
    }, 800);
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('pl-form');
    if (!form) return;
    form.addEventListener('submit', e => e.preventDefault());

    form.addEventListener('input', e => {
        const el = e.target;
        const slider = PL_SLIDERS.find(s => s.id === el.id);
        if (slider) document.getElementById(`${slider.id}-out`).textContent = `${el.value}${slider.suffix}`;
        if (el.id === 'pl-capital') plState.capital = plNum('pl-capital');
        if (el.id === 'pl-aporte') plState.aporte = plNum('pl-aporte');
        plCompute();
        if (el.id !== 'pl-capital' && el.id !== 'pl-aporte') plScheduleSave();
    });

    document.getElementById('pl-presets').addEventListener('click', e => {
        const v = e.target.getAttribute('data-v');
        if (!v) return;
        const slider = document.getElementById('pl-juros');
        slider.value = v;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    document.getElementById('pl-reset-real').addEventListener('click', () => {
        plState = { capital: null, aporte: null };
        if (plReal) {
            plSetMoney('pl-capital', plReal.networth);
            plSetMoney('pl-aporte', plReal.avgInvest);
            plCompute();
        }
    });
});
