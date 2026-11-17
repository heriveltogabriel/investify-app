// Orçamento: para onde vai o dinheiro. Junta receitas, gastos fixos e cartões numa tela só.
// Usa ovTimeline() (meses fechados) e os helpers de overview.js/app.js.

let orcRange = '12';
let orcChart = null;

function orcMonthData(p) {
    return financialData[p.year]?.[p.month.toString()] || {};
}

// Lista de categorias de despesa de um mês: gastos fixos e cada cartão
function orcExpenseItems(p) {
    const d = orcMonthData(p);
    const items = [];
    Object.entries(d.expenses?.fixed || {}).forEach(([key, v]) => items.push({ id: `f:${key}`, key, group: 'Fixo', value: parseFloat(v) || 0 }));
    Object.entries(d.expenses?.cards || {}).forEach(([key, v]) => items.push({ id: `c:${key}`, key, group: 'Cartão', value: parseFloat(v) || 0 }));
    return items;
}

function orcIncomeItems(p) {
    const d = orcMonthData(p);
    return Object.entries(d.incomes || {}).map(([key, v]) => ({ key, value: parseFloat(v) || 0 })).filter(i => i.value > 0);
}

function renderOrcamento() {
    const root = document.getElementById('tab-orcamento');
    if (!root) return;

    const timeline = ovTimeline().filter(p => p.s.hasBudget);
    const selMonth = parseInt(selectedMonth);
    const refIdx = timeline.findIndex(p => p.year === selectedYear && p.month === selMonth);
    const emptyEl = document.getElementById('orc-empty');
    const bodyEl = document.getElementById('orc-body');

    if (refIdx === -1) {
        bodyEl.style.display = 'none';
        emptyEl.style.display = 'block';
        emptyEl.innerHTML = `<strong>${monthNames[selMonth - 1]} de ${selectedYear} ainda não foi fechado.</strong>
            Lance receitas e despesas do mês em Lançamentos, ou escolha outro mês no seletor acima.`;
        return;
    }
    emptyEl.style.display = 'none';
    bodyEl.style.display = 'block';

    const ref = timeline[refIdx];
    const monthLabel = `${monthNames[ref.month - 1].toLowerCase()} de ${ref.year}`;
    const yearRows = timeline.filter(p => p.year === ref.year);
    const n = yearRows.length;
    const yearSum = key => yearRows.reduce((acc, p) => acc + p.s[key], 0);
    const history = timeline.slice(Math.max(0, refIdx - 6), refIdx);

    // ---- Números do topo ---------------------------------------------------
    const stat = (label, value, key, extra = '') => `
        <div class="ov-stat">
            <p class="ov-stat-label">${label}</p>
            <p class="ov-stat-value">${formatBRL(value)}</p>
            ${extra}
            <p class="ov-stat-foot ov-muted">Em ${ref.year}: média de ${formatBRL(yearSum(key) / n)} por mês, total de ${formatBRL(yearSum(key))}</p>
        </div>`;
    const yearIncome = yearSum('income');
    const yearInvested = yearSum('aporte') - yearSum('retirada');
    document.getElementById('orc-summary-title').textContent = `Resumo de ${monthLabel}`;
    document.getElementById('orc-summary').innerHTML =
        stat('Receita', ref.s.income, 'income') +
        stat('Despesa', ref.s.expenses, 'expenses', `<p class="ov-stat-foot ov-muted">Fixos ${formatBRL(ref.s.fixed)} e cartões ${formatBRL(ref.s.cards)}</p>`) +
        ovInvestedStat(ref.s, `<p class="ov-stat-foot ov-muted">Em ${ref.year}: ${formatBRL(yearInvested)} investidos${yearIncome > 0 ? `, ${ovPct((yearInvested / yearIncome) * 100, 0)} da receita` : ''}</p>`);

    // ---- Gráfico: receita x despesa ---------------------------------------
    const windowSize = orcRange === 'all' ? timeline.length : 12;
    const win = timeline.slice(Math.max(0, refIdx + 1 - windowSize), refIdx + 1);
    document.querySelectorAll('#orc-range button').forEach(b => b.classList.toggle('active', b.dataset.range === orcRange));

    if (orcChart) orcChart.destroy();
    orcChart = ovBudgetChart(document.getElementById('orc-chart'), win);

    // ---- Para onde foi o dinheiro ------------------------------------------
    document.getElementById('orc-where-title').textContent = `Para onde foi o dinheiro em ${monthLabel}`;
    const avgById = {};
    history.forEach(p => orcExpenseItems(p).forEach(i => { avgById[i.id] = (avgById[i.id] || 0) + i.value; }));
    Object.keys(avgById).forEach(id => { avgById[id] = avgById[id] / history.length; });

    const items = orcExpenseItems(ref).filter(i => i.value > 0).sort((a, b) => b.value - a.value);
    const scaleMax = Math.max(1, ...items.map(i => Math.max(i.value, avgById[i.id] || 0)));
    document.getElementById('orc-where-note').textContent = history.length
        ? `O traço em cada barra marca a média dos ${history.length} meses anteriores.`
        : 'Sem meses anteriores para comparar.';
    document.getElementById('orc-where').innerHTML = items.length ? items.map(i => {
        const avg = avgById[i.id];
        const share = ref.s.expenses > 0 ? (i.value / ref.s.expenses) * 100 : 0;
        let cmp = '<span class="ov-muted">novo</span>';
        if (avg > 0) {
            const pct = ((i.value - avg) / avg) * 100;
            cmp = Math.abs(pct) < 5
                ? '<span class="ov-muted">na média</span>'
                : `<span class="${pct > 0 ? 'ov-bad' : 'ov-good'}">${pct > 0 ? '+' : '−'}${ovPct(Math.abs(pct), 0)}</span>`;
        } else if (!history.length) {
            cmp = '';
        }
        return `<div class="orc-row">
            <div class="orc-row-name">${patEsc(formatLabel(i.key))}<span class="orc-tag">${i.group}</span></div>
            <div class="orc-row-bar">
                <div class="orc-fill ${i.group === 'Cartão' ? 'card' : ''}" style="width: ${Math.max(0.8, (i.value / scaleMax) * 100)}%"></div>
                ${avg > 0 ? `<span class="orc-tick" style="left: ${(avg / scaleMax) * 100}%" title="Média: ${formatBRL(avg)}"></span>` : ''}
            </div>
            <div class="orc-row-value">${formatBRL(i.value)}</div>
            <div class="orc-row-share">${ovPct(share, 0)}</div>
            <div class="orc-row-cmp">${cmp}</div>
        </div>`;
    }).join('') : '<p class="ov-muted">Nenhuma despesa lançada neste mês.</p>';

    // ---- Receitas do mês ---------------------------------------------------
    const incomes = orcIncomeItems(ref).sort((a, b) => b.value - a.value);
    const incMax = Math.max(1, ...incomes.map(i => i.value));
    document.getElementById('orc-incomes').innerHTML = incomes.length ? incomes.map(i => `
        <div class="ov-bank">
            <div class="ov-bank-head"><span>${patEsc(formatLabel(i.key))}</span><span>${formatBRL(i.value)} <em>${ref.s.income > 0 ? ovPct((i.value / ref.s.income) * 100, 0) : ''}</em></span></div>
            <div class="ov-bar orc-income-bar"><div style="width: ${(i.value / incMax) * 100}%"></div></div>
        </div>`).join('') : '<p class="ov-muted">Nenhuma receita lançada neste mês.</p>';

    // ---- Mês a mês do ano --------------------------------------------------
    document.getElementById('orc-months-title').textContent = `Mês a mês em ${ref.year}`;
    const monthLine = (label, s, cls = '') => {
        const invested = s.aporte - s.retirada;
        const over = s.expenses > s.income && s.income > 0;
        return `<tr class="${cls}">
        <th scope="row">${label}</th>
        <td>${formatBRL(s.income)}</td>
        <td>${formatBRL(s.fixed)}</td>
        <td>${formatBRL(s.cards)}</td>
        <td class="${over ? 'neg' : ''}">${formatBRL(s.expenses)}${over ? '<span class="orc-over">acima da receita</span>' : ''}</td>
        <td class="strong ${invested < 0 ? 'neg' : ''}">${invested < 0 ? '− ' + formatBRL(Math.abs(invested)) : formatBRL(invested)}</td>
        <td class="${invested < 0 ? 'neg' : ''}">${s.income > 0 ? (invested < 0 ? '−' : '') + ovPct(Math.abs((invested / s.income) * 100), 0) : '—'}</td>
    </tr>`;
    };
    const totals = { income: yearSum('income'), fixed: yearSum('fixed'), cards: yearSum('cards'), expenses: yearSum('expenses'), aporte: yearSum('aporte'), retirada: yearSum('retirada') };
    const means = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / n]));
    document.getElementById('orc-months').innerHTML = `
        <thead><tr><th scope="col">Mês</th><th scope="col">Receita</th><th scope="col">Gastos fixos</th><th scope="col">Cartões</th><th scope="col">Despesa</th><th scope="col">Investido</th><th scope="col">% da receita</th></tr></thead>
        <tbody>
            ${yearRows.map(p => monthLine(monthNames[p.month - 1], p.s, p.month === ref.month ? 'current' : '')).join('')}
            ${monthLine('Média mensal', means, 'total')}
            ${monthLine(`Total (${n} ${n === 1 ? 'mês' : 'meses'})`, totals, 'subtotal')}
        </tbody>`;

    // ---- Detalhe por categoria (planilha do ano, recolhida) ----------------
    const catTotals = {};
    const catOrder = [];
    yearRows.forEach(p => orcExpenseItems(p).forEach(i => {
        if (!(i.id in catTotals)) { catTotals[i.id] = { ...i, byMonth: {}, total: 0 }; catOrder.push(i.id); }
        catTotals[i.id].byMonth[p.month] = i.value;
        catTotals[i.id].total += i.value;
    }));
    const cats = catOrder.map(id => catTotals[id]).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
    document.getElementById('orc-detail-title').textContent = `Detalhe por categoria em ${ref.year}`;
    document.getElementById('orc-detail').innerHTML = `
        <thead><tr><th scope="col">Categoria</th>${yearRows.map(p => `<th scope="col">${OV_SHORT_MONTHS[p.month - 1]}</th>`).join('')}<th scope="col">Média</th><th scope="col">Total</th></tr></thead>
        <tbody>
            ${cats.map(c => `<tr>
                <th scope="row">${patEsc(formatLabel(c.key))}</th>
                ${yearRows.map(p => `<td>${c.byMonth[p.month] ? ovPlain(c.byMonth[p.month]) : '—'}</td>`).join('')}
                <td>${ovPlain(c.total / n)}</td>
                <td class="strong">${ovPlain(c.total)}</td>
            </tr>`).join('')}
            <tr class="total"><th scope="row">Despesa total</th>${yearRows.map(p => `<td>${ovPlain(p.s.expenses)}</td>`).join('')}<td>${ovPlain(totals.expenses / n)}</td><td>${ovPlain(totals.expenses)}</td></tr>
        </tbody>`;
}

// Número sem "R$", para tabelas densas
function ovPlain(value) {
    return (value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#orc-range button').forEach(btn => {
        btn.addEventListener('click', () => {
            orcRange = btn.dataset.range;
            renderOrcamento();
        });
    });
});
