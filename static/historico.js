// Histórico: a planilha do ano numa tela só (meses nas colunas) e a comparação entre anos.
// Só meses fechados entram nos totais; clicar no nome do mês abre o "Lançar mês" dele.

function hisBankBalances(year, month) {
    const inv = financialData[year]?.[month.toString()]?.investments || {};
    const out = {};
    Object.entries(inv).forEach(([bank, item]) => {
        if (bank === 'outros') return;
        out[bank] = (parseFloat(item.cdb) || 0) + (parseFloat(item.aporte) || 0) + (parseFloat(item.juros) || 0) - (parseFloat(item.retirada) || 0);
    });
    return out;
}

function hisYears() {
    return Object.keys(financialData).filter(y => /^\d{4}$/.test(y)).sort();
}

function renderHistorico() {
    const root = document.getElementById('tab-historico');
    if (!root) return;
    const year = selectedYear;
    const months = [];
    for (let m = 1; m <= 12; m++) months.push({ month: m, done: isMonthComplete(year, m), s: monthSummary(year, m) });
    const done = months.filter(x => x.done);
    const n = done.length;

    document.getElementById('his-title').textContent = `Planilha de ${year}`;
    document.getElementById('his-sub').textContent = n
        ? `${n} ${n === 1 ? 'mês fechado' : 'meses fechados'}. Clique no nome de um mês para editar os valores dele.`
        : 'Nenhum mês fechado neste ano.';

    const sum = key => done.reduce((a, x) => a + x.s[key], 0);
    const cell = (x, fn, cls = '') => x.done ? `<td class="${cls}">${fn(x)}</td>` : '<td class="his-off">—</td>';
    const num = v => ovPlain(v);
    const sign = v => v < 0 ? `<span class="neg">− ${ovPlain(Math.abs(v))}</span>` : ovPlain(v);

    // Categorias e receitas do ano
    const incomeKeys = [], fixedKeys = [], cardKeys = [];
    months.forEach(x => {
        const d = financialData[year]?.[x.month.toString()] || {};
        Object.keys(d.incomes || {}).forEach(k => { if (!incomeKeys.includes(k)) incomeKeys.push(k); });
        Object.keys(d.expenses?.fixed || {}).forEach(k => { if (!fixedKeys.includes(k)) fixedKeys.push(k); });
        Object.keys(d.expenses?.cards || {}).forEach(k => { if (!cardKeys.includes(k)) cardKeys.push(k); });
    });
    const getVal = (x, group, key) => {
        const d = financialData[year]?.[x.month.toString()] || {};
        const src = group === 'incomes' ? d.incomes : d.expenses?.[group];
        return parseFloat(src?.[key]) || 0;
    };

    const detailRow = (label, group, key) => {
        const vals = done.map(x => getVal(x, group, key));
        const total = vals.reduce((a, b) => a + b, 0);
        if (total <= 0) return '';
        return `<tr class="his-detail">
            <th scope="row">${patEsc(formatLabel(key))}</th>
            ${months.map(x => x.done ? `<td>${getVal(x, group, key) ? num(getVal(x, group, key)) : '—'}</td>` : '<td class="his-off">—</td>').join('')}
            <td>${n ? num(total / n) : '—'}</td><td class="strong">${num(total)}</td></tr>`;
    };
    const groupRows = (keys, group) => keys.map(k => detailRow(k, group, k)).join('');
    const line = (label, valueFn, totalValue, opts = {}) => `<tr class="${opts.cls || ''}">
        <th scope="row">${label}</th>
        ${months.map(x => cell(x, valueFn, opts.cellCls ? opts.cellCls(x) : '')).join('')}
        <td>${n ? (opts.mean ? opts.mean() : num(totalValue / n)) : '—'}</td>
        <td class="strong">${opts.totalHtml ?? num(totalValue)}</td></tr>`;
    const section = title => `<tr class="his-section"><th colspan="15" scope="colgroup">${title}</th></tr>`;

    const invested = x => x.s.aporte - x.s.retirada;
    const lastDone = done[done.length - 1];
    const firstDone = done[0];
    const banks = [...new Set(done.flatMap(x => Object.keys(hisBankBalances(year, x.month))))];

    document.getElementById('his-table').innerHTML = `
        <thead><tr>
            <th scope="col">${year}</th>
            ${months.map(x => `<th scope="col"><button type="button" class="his-month" data-month="${x.month}" title="Abrir ${monthNames[x.month - 1]} em Lançar mês">${OV_SHORT_MONTHS[x.month - 1]}</button></th>`).join('')}
            <th scope="col">Média</th><th scope="col">Total</th>
        </tr></thead>
        <tbody>
            ${section('Receitas')}
            ${groupRows(incomeKeys, 'incomes')}
            ${line('Receita total', x => num(x.s.income), sum('income'), { cls: 'his-total' })}
            ${section('Despesas')}
            ${groupRows(fixedKeys, 'fixed')}
            ${line('Gastos fixos', x => num(x.s.fixed), sum('fixed'), { cls: 'his-subtotal' })}
            ${groupRows(cardKeys, 'cards')}
            ${line('Cartões', x => num(x.s.cards), sum('cards'), { cls: 'his-subtotal' })}
            ${line('Despesa total', x => num(x.s.expenses), sum('expenses'), { cls: 'his-total', cellCls: x => x.s.expenses > x.s.income && x.s.income > 0 ? 'neg' : '' })}
            ${section('Investimentos')}
            ${line('Aportes', x => num(x.s.aporte), sum('aporte'))}
            ${line('Retiradas', x => x.s.retirada ? `<span class="neg">− ${num(x.s.retirada)}</span>` : '—', sum('retirada'), { totalHtml: sum('retirada') ? `<span class="neg">− ${num(sum('retirada'))}</span>` : '—', mean: () => sum('retirada') ? `<span class="neg">− ${num(sum('retirada') / n)}</span>` : '—' })}
            ${line('Investido (aportes − retiradas)', x => sign(invested(x)), sum('aporte') - sum('retirada'), { cls: 'his-subtotal', totalHtml: sign(sum('aporte') - sum('retirada')), mean: () => sign((sum('aporte') - sum('retirada')) / n) })}
            ${line('Rendimento', x => num(x.s.juros), sum('juros'))}
            ${banks.map(b => `<tr class="his-detail"><th scope="row">Saldo ${patEsc(formatLabel(b))}</th>
                ${months.map(x => x.done ? `<td>${num(hisBankBalances(year, x.month)[b] || 0)}</td>` : '<td class="his-off">—</td>').join('')}
                <td></td><td class="strong">${lastDone ? num(hisBankBalances(year, lastDone.month)[b] || 0) : '—'}</td></tr>`).join('')}
            <tr class="his-total"><th scope="row">Patrimônio financeiro</th>
                ${months.map(x => cell(x, y => num(y.s.networth))).join('')}
                <td></td><td class="strong">${lastDone ? num(lastDone.s.networth) : '—'}</td></tr>
        </tbody>`;

    // ---- Comparação entre anos ---------------------------------------------
    const rows = hisYears().map(y => {
        const ms = [];
        for (let m = 1; m <= 12; m++) if (isMonthComplete(y, m)) ms.push({ month: m, s: monthSummary(y, m) });
        const t = k => ms.reduce((a, x) => a + x.s[k], 0);
        const last = ms[ms.length - 1];
        return { y, n: ms.length, income: t('income'), expenses: t('expenses'), aporte: t('aporte'), retirada: t('retirada'), juros: t('juros'), end: last ? last.s.networth : null };
    }).filter(r => r.n > 0);
    document.getElementById('his-years').innerHTML = `
        <thead><tr><th scope="col">Ano</th><th scope="col">Meses</th><th scope="col">Receita</th><th scope="col">Despesa</th><th scope="col">Investido</th><th scope="col">% da receita</th><th scope="col">Rendimento</th><th scope="col">Patrimônio no fim</th></tr></thead>
        <tbody>${rows.map((r, i) => {
            const inv = r.aporte - r.retirada;
            return `<tr class="${r.y === year ? 'current' : ''}">
                <th scope="row">${r.y}</th><td>${r.n}</td><td>${num(r.income)}</td><td>${num(r.expenses)}</td>
                <td class="${inv < 0 ? 'neg' : ''}">${inv < 0 ? '− ' : ''}${num(Math.abs(inv))}</td>
                <td>${r.income > 0 ? ovPct(Math.abs(inv / r.income) * 100, 0) : '—'}</td>
                <td>${num(r.juros)}</td><td class="strong">${num(r.end)}</td></tr>`;
        }).join('')}</tbody>`;
}

document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('his-table');
    if (table) table.addEventListener('click', e => {
        const btn = e.target.closest('.his-month');
        if (!btn) return;
        const select = document.getElementById('filter-month');
        if (select && [...select.options].some(o => o.value === btn.dataset.month)) {
            select.value = btn.dataset.month;
            select.dispatchEvent(new Event('change'));
        } else {
            selectedMonth = btn.dataset.month;
        }
        document.querySelector('[data-tab="lancar"]').click();
    });
    const exp = document.getElementById('his-export');
    if (exp) exp.addEventListener('click', exportToExcel);
});
