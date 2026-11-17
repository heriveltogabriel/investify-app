// Visão Geral: tela inicial. Responde "como estou?" com o patrimônio, o orçamento do mês
// e a meta. Usa as regras centrais de app.js (monthSummary, isMonthComplete, formatBRL).

const OV_COLORS = {
    patrimonio: '#6366f1',
    aporte: '#6366f1',
    rendimento: '#d97706',
    positivo: '#0ea371',
    negativo: '#ef4444',
    grid: 'rgba(255, 255, 255, 0.05)',
    tick: '#9ca3af'
};
const OV_SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

let ovRange = '12'; // '12' meses ou 'all'
let ovCharts = {};
let ovGoalEditing = false;

function ovSigned(value) {
    const v = value || 0;
    if (Math.abs(v) < 0.005) return formatBRL(0);
    return (v > 0 ? '+ ' : '− ') + formatBRL(Math.abs(v));
}

function ovPct(value, digits = 1) {
    return `${value.toFixed(digits).replace('.', ',')}%`;
}

function ovLabel(p) {
    return `${OV_SHORT_MONTHS[p.month - 1]}/${p.year.slice(2)}`;
}

// Todos os meses fechados, de todos os anos, em ordem cronológica
function ovTimeline() {
    const out = [];
    Object.keys(financialData).filter(y => /^\d{4}$/.test(y)).sort().forEach(year => {
        for (let m = 1; m <= 12; m++) {
            if (!isMonthComplete(year, m)) continue;
            out.push({ year, month: m, s: monthSummary(year, m) });
        }
    });
    return out;
}

function ovGetGoal() {
    return parseFloat(extrasData.meta) || 0;
}

// A meta fica no servidor (extras.json), junto com bens e anotações
async function ovSetGoal(value) {
    const previous = extrasData.meta;
    extrasData.meta = value > 0 ? value : 0;
    try {
        await saveExtras();
    } catch (e) {
        extrasData.meta = previous;
        showToast('Erro', 'Não foi possível salvar a meta.', 'error');
    }
}

function ovDestroy(name) {
    if (ovCharts[name]) {
        ovCharts[name].destroy();
        ovCharts[name] = null;
    }
}

function ovAxis(extra = {}) {
    return {
        x: { grid: { display: false }, ticks: { color: OV_COLORS.tick, font: { family: 'Inter', size: 11 }, maxRotation: 0, autoSkipPadding: 12 }, ...(extra.x || {}) },
        y: { grid: { color: OV_COLORS.grid }, border: { display: false }, ticks: { color: OV_COLORS.tick, font: { family: 'Inter', size: 11 }, callback: v => ovCompact(v) }, ...(extra.y || {}) }
    };
}

function ovCompact(v) {
    const abs = Math.abs(v);
    if (abs >= 1000000) return `R$ ${(v / 1000000).toFixed(1).replace('.', ',')} mi`;
    if (abs >= 1000) return `R$ ${Math.round(v / 1000)} mil`;
    return `R$ ${Math.round(v)}`;
}

function renderOverview() {
    const root = document.getElementById('tab-overview');
    if (!root) return;

    const timeline = ovTimeline();
    const refIdx = timeline.findIndex(p => p.year === selectedYear && p.month === parseInt(selectedMonth));
    const emptyEl = document.getElementById('ov-empty');
    const bodyEl = document.getElementById('ov-body');

    if (refIdx === -1) {
        bodyEl.style.display = 'none';
        emptyEl.style.display = 'block';
        emptyEl.innerHTML = `<strong>${monthNames[parseInt(selectedMonth) - 1]} de ${selectedYear} ainda não foi fechado.</strong>
            Lance receitas, despesas e investimentos do mês em Lançamentos, ou escolha outro mês no seletor acima.`;
        return;
    }
    emptyEl.style.display = 'none';
    bodyEl.style.display = 'block';

    const ref = timeline[refIdx];
    const prev = refIdx > 0 ? timeline[refIdx - 1] : null;
    const monthName = monthNames[ref.month - 1];
    const withInvest = timeline.slice(0, refIdx + 1).filter(p => p.s.hasInvest);

    // ---- Patrimônio ------------------------------------------------------
    document.getElementById('ov-nw-label').textContent = `Patrimônio investido em ${monthName.toLowerCase()} de ${ref.year}`;
    document.getElementById('ov-nw-value').textContent = formatBRL(ref.s.networth);

    const prevInvest = withInvest.length > 1 ? withInvest[withInvest.length - 2] : null;
    const monthVar = prevInvest ? ref.s.networth - prevInvest.s.networth : null;
    const deltaEl = document.getElementById('ov-nw-delta');
    if (monthVar === null) {
        deltaEl.className = 'ov-delta';
        deltaEl.textContent = 'Primeiro mês com investimentos lançados';
    } else {
        const pct = prevInvest.s.networth > 0 ? (monthVar / prevInvest.s.networth) * 100 : 0;
        deltaEl.className = `ov-delta ${monthVar >= 0 ? 'up' : 'down'}`;
        deltaEl.innerHTML = `<i class="fa-solid ${monthVar >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${ovSigned(monthVar)} no mês (${ovPct(Math.abs(pct), 2)})`;
    }

    const assets = assetsValueAt(ref.year, ref.month);
    const totalEl = document.getElementById('ov-nw-total');
    totalEl.style.display = assets > 0 ? 'block' : 'none';
    totalEl.textContent = assets > 0 ? `Patrimônio total com bens: ${formatBRL(ref.s.networth + assets)}` : '';

    // Decomposição: de onde veio a variação
    const yearMonths = timeline.filter(p => p.year === ref.year && p.month <= ref.month);
    const yearBase = timeline.filter(p => p.year < ref.year && p.s.hasInvest).pop() || null;
    const yearSum = yearMonths.reduce((acc, p) => {
        acc.aporte += p.s.aporte; acc.retirada += p.s.retirada; acc.juros += p.s.juros;
        return acc;
    }, { aporte: 0, retirada: 0, juros: 0 });
    const yearVar = yearBase ? ref.s.networth - yearBase.s.networth : null;

    const rows = [
        { label: 'No mês', s: ref.s, variation: monthVar },
        { label: `Em ${ref.year}`, s: yearSum, variation: yearVar }
    ];
    const cols = rows.map(r => {
        const liquido = r.s.aporte - r.s.retirada;
        const adjust = r.variation === null ? 0 : r.variation - (liquido + r.s.juros);
        return { ...r, liquido, adjust };
    });
    const hasAdjust = cols.some(c => Math.abs(c.adjust) >= 1);
    const line = (label, cell, cls = '') => `<tr class="${cls}"><th scope="row">${label}</th>${cols.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`;
    document.getElementById('ov-breakdown').innerHTML = `
        <thead><tr><th scope="col">De onde veio a variação</th>${cols.map(c => `<th scope="col">${c.label}</th>`).join('')}</tr></thead>
        <tbody>
            ${line('Aportes', c => ovSigned(c.s.aporte))}
            ${line('Retiradas', c => c.s.retirada > 0 ? `<span class="neg">− ${formatBRL(c.s.retirada)}</span>` : formatBRL(0))}
            ${line('Aporte líquido', c => `<span class="${c.liquido < 0 ? 'neg' : ''}">${ovSigned(c.liquido)}</span>`, 'sub')}
            ${line('Rendimento', c => ovSigned(c.s.juros))}
            ${hasAdjust ? line('Ajustes de saldo', c => Math.abs(c.adjust) >= 1 ? ovSigned(c.adjust) : formatBRL(0), 'muted') : ''}
            ${line('Variação do patrimônio', c => c.variation === null ? '—' : `<span class="${c.variation < 0 ? 'neg' : ''}">${ovSigned(c.variation)}</span>`, 'total')}
        </tbody>`;

    // Janela dos gráficos
    const windowSize = ovRange === 'all' ? timeline.length : 12;
    const win = timeline.slice(Math.max(0, refIdx + 1 - windowSize), refIdx + 1);
    const winInvest = win.filter(p => p.s.hasInvest);
    document.querySelectorAll('#ov-range button').forEach(b => b.classList.toggle('active', b.dataset.range === ovRange));

    // Gráfico 1: evolução do patrimônio
    ovDestroy('networth');
    ovCharts.networth = new Chart(document.getElementById('ov-chart-networth').getContext('2d'), {
        type: 'line',
        data: {
            labels: winInvest.map(ovLabel),
            datasets: [{
                label: 'Patrimônio',
                data: winInvest.map(p => p.s.networth),
                borderColor: OV_COLORS.patrimonio,
                backgroundColor: OV_COLORS.patrimonio,
                borderWidth: 2,
                tension: 0.25,
                pointRadius: winInvest.length > 24 ? 0 : 3,
                pointHoverRadius: 6,
                pointBorderColor: '#0e1320',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Patrimônio: ${formatBRL(ctx.raw)}`,
                        afterLabel: ctx => {
                            const p = winInvest[ctx.dataIndex];
                            const lines = [`Aporte líquido: ${ovSigned(p.s.aporte - p.s.retirada)}`, `Rendimento: ${ovSigned(p.s.juros)}`];
                            return lines;
                        }
                    }
                }
            },
            scales: ovAxis()
        }
    });

    // ---- Meta ------------------------------------------------------------
    renderOverviewGoal(ref, withInvest);

    // ---- Por banco -------------------------------------------------------
    const banks = [
        { key: 'itau', name: 'Itaú' },
        { key: 'bb', name: 'Banco do Brasil' },
        { key: 'c6', name: 'C6 Bank' }
    ];
    const inv = financialData[ref.year]?.[ref.month.toString()]?.investments || {};
    const bankRows = banks.map(b => {
        const d = inv[b.key] || {};
        const total = (parseFloat(d.cdb) || 0) + (parseFloat(d.aporte) || 0) + (parseFloat(d.juros) || 0) - (parseFloat(d.retirada) || 0);
        return { ...b, total };
    }).filter(b => b.total > 0).sort((a, b) => b.total - a.total);
    const bankMax = bankRows.length ? bankRows[0].total : 0;
    document.getElementById('ov-banks').innerHTML = bankRows.length ? bankRows.map(b => {
        const share = ref.s.networth > 0 ? (b.total / ref.s.networth) * 100 : 0;
        return `<div class="ov-bank">
            <div class="ov-bank-head"><span>${b.name}</span><span class="ov-num">${formatBRL(b.total)} <em>${ovPct(share)}</em></span></div>
            <div class="ov-bar"><div style="width: ${bankMax > 0 ? Math.max(1.5, (b.total / bankMax) * 100) : 0}%"></div></div>
        </div>`;
    }).join('') : '<p class="ov-muted">Sem investimentos lançados neste mês.</p>';

    renderOverviewYield(ref);

    // ---- Orçamento do mês ------------------------------------------------
    document.getElementById('ov-budget-title').textContent = `Orçamento de ${monthName.toLowerCase()}`;
    const history = timeline.slice(Math.max(0, refIdx - 6), refIdx).filter(p => p.s.hasBudget);
    const avg = key => history.length ? history.reduce((acc, p) => acc + p.s[key], 0) / history.length : null;
    const compare = (value, mean, higherIsGood) => {
        if (mean === null || mean === 0) return '<span class="ov-muted">Sem meses anteriores para comparar</span>';
        const diff = value - mean;
        const pct = (diff / Math.abs(mean)) * 100;
        if (Math.abs(pct) < 0.5) return `<span class="ov-muted">Igual à média dos últimos ${history.length} meses</span>`;
        const good = higherIsGood ? diff > 0 : diff < 0;
        return `<span class="${good ? 'ov-good' : 'ov-bad'}"><i class="fa-solid ${diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${ovPct(Math.abs(pct), 0)} ${diff > 0 ? 'acima' : 'abaixo'}</span>
            <span class="ov-muted">da média dos últimos ${history.length} meses (${formatBRL(mean)})</span>`;
    };
    document.getElementById('ov-budget').innerHTML = `
        <div class="ov-stat">
            <p class="ov-stat-label">Receita</p>
            <p class="ov-stat-value">${formatBRL(ref.s.income)}</p>
            <p class="ov-stat-foot">${compare(ref.s.income, avg('income'), true)}</p>
        </div>
        <div class="ov-stat">
            <p class="ov-stat-label">Despesa</p>
            <p class="ov-stat-value">${formatBRL(ref.s.expenses)}</p>
            <p class="ov-stat-foot">${compare(ref.s.expenses, avg('expenses'), false)}</p>
            <p class="ov-stat-foot ov-muted">Fixos ${formatBRL(ref.s.fixed)} e cartões ${formatBRL(ref.s.cards)}</p>
        </div>
        ${ovInvestedStat(ref.s)}`;

    // Gráfico 2: receita e despesa por mês
    const winBudget = win.filter(p => p.s.hasBudget);
    ovDestroy('budget');
    ovCharts.budget = ovBudgetChart(document.getElementById('ov-chart-budget'), winBudget);

    // Gráfico 3: de onde veio o crescimento
    ovDestroy('growth');
    ovCharts.growth = new Chart(document.getElementById('ov-chart-growth').getContext('2d'), {
        type: 'bar',
        data: {
            labels: winInvest.map(ovLabel),
            datasets: [
                {
                    label: 'Aporte líquido',
                    data: winInvest.map(p => p.s.aporte - p.s.retirada),
                    backgroundColor: OV_COLORS.aporte,
                    borderColor: '#0e1320',
                    borderWidth: { top: 1, bottom: 1 },
                    borderRadius: 3,
                    maxBarThickness: 28
                },
                {
                    label: 'Rendimento',
                    data: winInvest.map(p => p.s.juros),
                    backgroundColor: OV_COLORS.rendimento,
                    borderColor: '#0e1320',
                    borderWidth: { top: 1, bottom: 1 },
                    borderRadius: 3,
                    maxBarThickness: 28
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ovSigned(ctx.raw)}`,
                        afterBody: items => {
                            const p = winInvest[items[0].dataIndex];
                            return p.s.retirada > 0 ? [`(aportes ${formatBRL(p.s.aporte)}, retiradas ${formatBRL(p.s.retirada)})`] : [];
                        }
                    }
                }
            },
            scales: ovAxis({ x: { stacked: true }, y: { stacked: true } })
        }
    });
}

// Terceiro número do orçamento: quanto foi investido no mês (aporte líquido), não uma "sobra" calculada
function ovInvestedStat(s, yearNote = '') {
    const liquido = s.aporte - s.retirada;
    const pct = s.income > 0 ? (liquido / s.income) * 100 : null;
    const detail = s.retirada > 0
        ? `Aportes de ${formatBRL(s.aporte)} menos retiradas de ${formatBRL(s.retirada)}`
        : 'Aportes do mês, sem retiradas';
    return `<div class="ov-stat">
            <p class="ov-stat-label">Investido no mês</p>
            <p class="ov-stat-value ${liquido < 0 ? 'neg' : ''}">${liquido < 0 ? '− ' + formatBRL(Math.abs(liquido)) : formatBRL(liquido)}</p>
            <p class="ov-stat-foot">${pct === null ? '' : `<span class="${liquido >= 0 ? 'ov-good' : 'ov-bad'}">${ovPct(Math.abs(pct), 0)} da receita</span>`}${s.expenses > s.income && s.income > 0 ? ' <span class="ov-bad">· despesa acima da receita</span>' : ''}</p>
            <p class="ov-stat-foot ov-muted">${detail}</p>
            ${yearNote}
        </div>`;
}

// Receita ao lado da despesa (fixos + cartões). Meses em que a despesa passou da receita ficam com o rótulo em vermelho.
const OV_BUDGET_COLORS = { receita: '#0ea371', fixos: '#6366f1', cartoes: '#d97706' };
function ovBudgetChart(canvas, months) {
    const over = months.map(p => p.s.expenses > p.s.income && p.s.income > 0);
    const bar = (label, data, color, stack) => ({
        label, data, stack, backgroundColor: color,
        borderColor: '#0e1320', borderWidth: { top: 1, bottom: 0, left: 0, right: 0 },
        borderRadius: 3, maxBarThickness: 22, categoryPercentage: 0.72, barPercentage: 0.9
    });
    const scales = ovAxis({ x: { stacked: true }, y: { stacked: true, beginAtZero: true } });
    scales.x.ticks.color = ctx => over[ctx.index] ? '#f87171' : OV_COLORS.tick;
    return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: months.map(ovLabel),
            datasets: [
                bar('Receita', months.map(p => p.s.income), OV_BUDGET_COLORS.receita, 'receita'),
                bar('Gastos fixos', months.map(p => p.s.fixed), OV_BUDGET_COLORS.fixos, 'despesa'),
                bar('Cartões', months.map(p => p.s.cards), OV_BUDGET_COLORS.cartoes, 'despesa')
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatBRL(ctx.raw)}`,
                        footer: items => {
                            const p = months[items[0].dataIndex];
                            const lines = [`Despesa total: ${formatBRL(p.s.expenses)}`];
                            if (p.s.expenses > p.s.income && p.s.income > 0) lines.push(`Acima da receita em ${formatBRL(p.s.expenses - p.s.income)}`);
                            return lines;
                        }
                    }
                }
            },
            scales
        }
    });
}

function renderOverviewGoal(ref, withInvest) {
    const el = document.getElementById('ov-goal');
    const goal = ovGetGoal();
    const editing = ovGoalEditing;
    ovGoalEditing = false;

    if (!goal || editing) {
        el.innerHTML = `
            <p class="ov-muted">Defina um valor de patrimônio para acompanhar o quanto falta.</p>
            <form class="ov-goal-form" id="ov-goal-form">
                <label for="ov-goal-input">Meta de patrimônio (R$)</label>
                <div class="ov-goal-row">
                    <input type="text" id="ov-goal-input" inputmode="numeric" placeholder="1.000.000" autocomplete="off">
                    <button type="submit" class="btn btn-primary">Salvar meta</button>
                </div>
            </form>`;
    } else {
        const current = ref.s.networth;
        const pct = Math.min(100, (current / goal) * 100);
        const remaining = goal - current;

        // Ritmo: variação média mensal do patrimônio nos últimos 6 meses
        let pace = '';
        if (remaining <= 0) {
            pace = '<span class="ov-good">Meta atingida.</span>';
        } else if (withInvest.length >= 4) {
            const span = Math.min(6, withInvest.length - 1);
            const base = withInvest[withInvest.length - 1 - span];
            const perMonth = (current - base.s.networth) / span;
            if (perMonth > 0) {
                const months = Math.ceil(remaining / perMonth);
                const d = new Date(parseInt(ref.year), ref.month - 1 + months, 1);
                pace = `No ritmo dos últimos ${span} meses (${ovSigned(perMonth)} por mês), você chega lá em <strong>${OV_SHORT_MONTHS[d.getMonth()]}/${d.getFullYear()}</strong>. Estimativa linear, sem juros compostos.`;
            } else {
                pace = 'O patrimônio não cresceu nos últimos meses, então não há estimativa de chegada.';
            }
        }

        el.innerHTML = `
            <div class="ov-goal-head">
                <span class="ov-goal-pct">${ovPct(pct)}</span>
                <span class="ov-muted">de ${formatBRL(goal)}</span>
            </div>
            <div class="ov-bar ov-bar-goal" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct.toFixed(0)}"><div style="width: ${pct}%"></div></div>
            <p class="ov-goal-remaining">${remaining > 0 ? `Faltam <strong>${formatBRL(remaining)}</strong>` : ''}</p>
            <p class="ov-muted ov-goal-pace">${pace}</p>
            <div class="ov-goal-links">
                <button type="button" class="ov-link" id="ov-goal-edit">Alterar meta</button>
                <button type="button" class="ov-link" id="ov-goal-plan">Simular no Planejamento</button>
            </div>`;
    }

    const form = document.getElementById('ov-goal-form');
    if (form) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const raw = document.getElementById('ov-goal-input').value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
            const value = parseFloat(raw) || 0;
            if (value > 0) {
                ovSetGoal(value).then(renderOverview);
            }
        });
    }
    const plan = document.getElementById('ov-goal-plan');
    if (plan) plan.addEventListener('click', () => document.querySelector('[data-tab="planejamento"]').click());
    const edit = document.getElementById('ov-goal-edit');
    if (edit) {
        edit.addEventListener('click', () => {
            // Abre o formulário já com o valor atual; a meta só muda ao salvar
            ovGoalEditing = true;
            renderOverview();
            const input = document.getElementById('ov-goal-input');
            if (input) {
                input.value = Math.round(goal).toLocaleString('pt-BR');
                input.focus();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#ov-range button').forEach(btn => {
        btn.addEventListener('click', () => {
            ovRange = btn.dataset.range;
            renderOverview();
        });
    });
});

// Rentabilidade: quanto o dinheiro investido rendeu em % em cada mês
function renderOverviewYield(ref) {
    const all = patTimeline().filter(p => p.yieldPct !== null);
    const end = all.findIndex(p => p.year === ref.year && p.month === ref.month);
    const win = (end === -1 ? all : all.slice(0, end + 1)).slice(-12);
    const statsEl = document.getElementById('ov-yield-stats');
    ovDestroy('yield');
    if (!win.length) {
        statsEl.innerHTML = '<p class="ov-muted">Sem rendimento lançado ainda.</p>';
        return;
    }
    const avg = win.reduce((a, p) => a + p.yieldPct, 0) / win.length;
    const acc = (win.reduce((a, p) => a * (1 + p.yieldPct / 100), 1) - 1) * 100;
    statsEl.innerHTML = `
        <div><span class="ov-muted">Média por mês</span><strong>${ovPct(avg, 2)}</strong></div>
        <div><span class="ov-muted">Acumulado em ${win.length} ${win.length === 1 ? 'mês' : 'meses'}</span><strong>${ovPct(acc, 1)}</strong></div>`;
    ovCharts.yield = new Chart(document.getElementById('ov-chart-yield').getContext('2d'), {
        type: 'bar',
        data: {
            labels: win.map(ovLabel),
            datasets: [{
                label: 'Rentabilidade',
                data: win.map(p => p.yieldPct),
                backgroundColor: OV_COLORS.aporte,
                borderRadius: 3,
                maxBarThickness: 22
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `Rentabilidade: ${ovPct(ctx.raw, 2)}`, afterLabel: ctx => `Rendimento: ${formatBRL(win[ctx.dataIndex].s.juros)}` } }
            },
            scales: ovAxis({ y: { ticks: { callback: v => ovPct(v, 1), color: OV_COLORS.tick, font: { family: 'Inter', size: 11 } } } })
        }
    });
}
