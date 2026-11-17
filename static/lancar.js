// Lançar mês: uma página só, em sequência (receitas, despesas, investimentos, anotação),
// para o mês escolhido no seletor do topo. Um único botão salva tudo.

const LAN_BANKS = [
    { key: 'itau', name: 'Itaú' },
    { key: 'bb', name: 'Banco do Brasil' },
    { key: 'c6', name: 'C6 Bank' }
];
const LAN_GROUPS = {
    income: { title: 'receita', path: d => d.incomes || {} },
    fixed: { title: 'gasto fixo', path: d => d.expenses?.fixed || {} },
    card: { title: 'cartão', path: d => d.expenses?.cards || {} }
};

let lanExtraKeys = { income: [], fixed: [], card: [] }; // categorias criadas nesta sessão, ainda não salvas
let lanContext = null; // { year, month } do formulário em tela
let lanDirty = false;

function lanSlug(name) {
    return name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9_]/g, '_').replace(/__+/g, '_').replace(/^_+|_+$/g, '');
}

function lanMoney(value) {
    return (parseFloat(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mês imediatamente anterior que tenha algum dado
function lanPreviousMonth(year, month) {
    let y = parseInt(year);
    let m = parseInt(month);
    for (let i = 0; i < 24; i++) {
        m -= 1;
        if (m === 0) { m = 12; y -= 1; }
        const s = monthSummary(y.toString(), m);
        if (s.hasBudget || s.hasInvest) return { year: y.toString(), month: m };
    }
    return null;
}

// Categorias do formulário: as usadas no ano, as do próprio mês, as do mês anterior e as recém-criadas
function lanKeys(type, year, month, prev) {
    const keys = [];
    const add = k => { if (!keys.includes(k)) keys.push(k); };
    const group = LAN_GROUPS[type];
    const yearData = financialData[year] || {};
    for (let m = 1; m <= 12; m++) {
        const d = yearData[m.toString()];
        if (!d) continue;
        Object.entries(group.path(d)).forEach(([k, v]) => { if ((parseFloat(v) || 0) !== 0) add(k); });
    }
    const current = yearData[month.toString()];
    if (current) Object.keys(group.path(current)).forEach(k => { if ((parseFloat(group.path(current)[k]) || 0) !== 0) add(k); });
    if (prev) {
        const d = financialData[prev.year]?.[prev.month.toString()] || {};
        Object.entries(group.path(d)).forEach(([k, v]) => { if ((parseFloat(v) || 0) !== 0) add(k); });
    }
    lanExtraKeys[type].forEach(add);
    return keys;
}

function lanField(id, label, value, suggested = false) {
    return `<div class="lan-field ${suggested ? 'suggested' : ''}">
        <label for="${id}">${patEsc(label)}</label>
        <input type="text" id="${id}" class="currency-input lan-input" inputmode="numeric" autocomplete="off" value="${lanMoney(value)}">
    </div>`;
}

function renderLancar() {
    const root = document.getElementById('tab-lancar');
    if (!root) return;

    const year = selectedYear;
    const month = parseInt(selectedMonth);
    const monthLabel = `${monthNames[month - 1].toLowerCase()} de ${year}`;
    const data = financialData[year]?.[month.toString()] || {};
    const summary = monthSummary(year, month);
    const prev = lanPreviousMonth(year, month);
    const prevData = prev ? (financialData[prev.year]?.[prev.month.toString()] || {}) : {};
    const prevLabel = prev ? `${monthNames[prev.month - 1].toLowerCase()} de ${prev.year}` : '';

    if (!lanContext || lanContext.year !== year || lanContext.month !== month) {
        lanExtraKeys = { income: [], fixed: [], card: [] };
    }
    lanContext = { year, month };
    lanDirty = false;

    // Situação do mês
    const statusEl = document.getElementById('lan-status');
    // Enquanto o mês não estiver fechado, todo campo ainda zerado abre com o valor do mês anterior
    const open = !isMonthComplete(year, month);
    const suggestBudget = open && !!prev;
    const suggestInvest = open && !summary.hasInvest && !!prev;
    if (!summary.hasBudget && !summary.hasInvest) {
        statusEl.className = 'lan-status new';
        statusEl.innerHTML = `<strong>${monthNames[month - 1]} de ${year} ainda não foi lançado.</strong> ${prev
            ? `Receitas, gastos fixos e saldos iniciais abrem com os valores de ${prevLabel}. Altere só o que mudou e salve.`
            : 'Preencha os valores e salve.'}`;
    } else if (!summary.hasBudget || !summary.hasInvest) {
        statusEl.className = 'lan-status new';
        statusEl.innerHTML = `<strong>${monthNames[month - 1]} de ${year} está incompleto.</strong> Falta lançar ${summary.hasBudget ? 'os investimentos' : 'receitas e despesas'}.${prev ? ` Os campos ainda zerados abrem com os valores de ${prevLabel} (destacados). Altere só o que mudou e salve.` : ''}`;
    } else {
        statusEl.className = 'lan-status';
        statusEl.innerHTML = `Você está editando <strong>${monthLabel}</strong>, que já foi lançado.`;
    }

    // Receitas, gastos fixos e cartões
    const renderGroup = (type, containerId, suggest) => {
        const group = LAN_GROUPS[type];
        const keys = lanKeys(type, year, month, prev);
        const current = group.path(data);
        const previous = group.path(prevData);
        document.getElementById(containerId).innerHTML = keys.map(k => {
            const has = (parseFloat(current[k]) || 0) !== 0;
            // 'extra' é receita eventual: não se repete de um mês para o outro
            const useSuggestion = suggest && !has && k !== 'extra' && (parseFloat(previous[k]) || 0) !== 0;
            return lanField(`lan-${type}-${k}`, formatLabel(k), useSuggestion ? previous[k] : current[k], useSuggestion);
        }).join('') || '<p class="ov-muted lan-none">Nenhuma categoria ainda.</p>';
    };
    renderGroup('income', 'lan-incomes', suggestBudget);
    renderGroup('fixed', 'lan-fixed', suggestBudget);
    renderGroup('card', 'lan-cards', false); // fatura muda todo mês: não sugere

    // Investimentos por banco
    document.getElementById('lan-banks').innerHTML = LAN_BANKS.map(b => {
        const cur = data.investments?.[b.key] || {};
        const p = prevData.investments?.[b.key] || {};
        const prevTotal = (parseFloat(p.cdb) || 0) + (parseFloat(p.aporte) || 0) + (parseFloat(p.juros) || 0) - (parseFloat(p.retirada) || 0);
        const hasOpening = (parseFloat(cur.cdb) || 0) !== 0;
        const useSuggestion = suggestInvest && !hasOpening && prevTotal > 0;
        return `<fieldset class="lan-bank" data-bank="${b.key}">
            <legend>${b.name}</legend>
            <div class="lan-bank-row">
                ${lanField(`lan-${b.key}-cdb`, 'Saldo inicial', useSuggestion ? prevTotal : cur.cdb, useSuggestion)}
                <span class="lan-op" aria-hidden="true">+</span>
                ${lanField(`lan-${b.key}-aporte`, 'Aportes', cur.aporte)}
                <span class="lan-op" aria-hidden="true">−</span>
                ${lanField(`lan-${b.key}-retirada`, 'Retiradas', cur.retirada)}
                <span class="lan-op" aria-hidden="true">+</span>
                ${lanField(`lan-${b.key}-juros`, 'Rendimento', cur.juros)}
                <span class="lan-op" aria-hidden="true">=</span>
                <div class="lan-field lan-total"><span class="lan-total-label">Saldo final</span><output id="lan-${b.key}-total">R$ 0,00</output></div>
            </div>
        </fieldset>`;
    }).join('');

    // Anotação
    document.getElementById('lan-note').value = monthNote(year, month);
    document.getElementById('lan-save').textContent = `Salvar ${monthLabel}`;

    applyCurrencyMaskListeners();
    lanRecalculate();
}

function lanValue(id) {
    const el = document.getElementById(id);
    return el ? parsePtBrFloat(el.value) : 0;
}

function lanCollect(type) {
    const out = {};
    document.querySelectorAll(`#tab-lancar input[id^="lan-${type}-"]`).forEach(el => {
        out[el.id.slice(`lan-${type}-`.length)] = parsePtBrFloat(el.value);
    });
    return out;
}

// Totais ao vivo: saldo final de cada banco e a barra de resumo
function lanRecalculate() {
    const sum = obj => Object.values(obj).reduce((a, v) => a + v, 0);
    const income = sum(lanCollect('income'));
    const expenses = sum(lanCollect('fixed')) + sum(lanCollect('card'));
    let invested = 0;
    let portfolio = 0;
    LAN_BANKS.forEach(b => {
        const aporte = lanValue(`lan-${b.key}-aporte`);
        const retirada = lanValue(`lan-${b.key}-retirada`);
        const total = lanValue(`lan-${b.key}-cdb`) + aporte - retirada + lanValue(`lan-${b.key}-juros`);
        document.getElementById(`lan-${b.key}-total`).textContent = formatBRL(total);
        invested += aporte - retirada;
        portfolio += total;
    });
    document.getElementById('lan-sum-income').textContent = formatBRL(income);
    document.getElementById('lan-sum-expenses').textContent = formatBRL(expenses);
    const expEl = document.getElementById('lan-sum-expenses');
    expEl.classList.toggle('neg', expenses > income && income > 0);
    document.getElementById('lan-sum-invested').textContent = invested < 0 ? '− ' + formatBRL(Math.abs(invested)) : formatBRL(invested);
    document.getElementById('lan-sum-portfolio').textContent = formatBRL(portfolio);
    document.getElementById('lan-dirty').textContent = lanDirty ? 'Alterações não salvas' : '';
}

async function lanSave() {
    if (!lanContext) return;
    const { year, month } = lanContext;
    const button = document.getElementById('lan-save');
    const investments = {};
    LAN_BANKS.forEach(b => {
        investments[b.key] = {
            cdb: lanValue(`lan-${b.key}-cdb`),
            aporte: lanValue(`lan-${b.key}-aporte`),
            retirada: lanValue(`lan-${b.key}-retirada`),
            juros: lanValue(`lan-${b.key}-juros`)
        };
    });
    const payload = {
        year, month: month.toString(), investments,
        expenses: { fixed: lanCollect('fixed'), cards: lanCollect('card') },
        incomes: lanCollect('income')
    };
    const note = document.getElementById('lan-note').value.trim();
    const noteKey = `${year}-${month}`;

    button.disabled = true;
    try {
        const response = await fetch('api/entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const res = await response.json().catch(() => ({}));
            showToast('Erro', res.error || 'Não foi possível salvar o mês.', 'error');
            return;
        }
        if (note !== monthNote(year, month)) {
            extrasData.notas = { ...extrasData.notas };
            if (note) extrasData.notas[noteKey] = note;
            else delete extrasData.notas[noteKey];
            await saveExtras();
        }
        showToast('Salvo', `${monthNames[month - 1]} de ${year} salvo.`, 'success');
        lanExtraKeys = { income: [], fixed: [], card: [] };
        await fetchData(); // recarrega os dados e redesenha o formulário já salvo
    } catch (err) {
        showToast('Erro', 'Não foi possível salvar. Verifique a conexão e tente de novo.', 'error');
    } finally {
        button.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tab = document.getElementById('tab-lancar');
    if (!tab) return;

    tab.addEventListener('input', e => {
        if (e.target.matches('.lan-input, #lan-note')) {
            lanDirty = true;
            const field = e.target.closest('.lan-field');
            if (field) field.classList.remove('suggested');
            lanRecalculate();
        }
    });

    document.getElementById('lan-form').addEventListener('submit', e => {
        e.preventDefault();
        lanSave();
    });

    // Nova categoria (receita, gasto fixo ou cartão), sem caixa de diálogo do navegador
    tab.querySelectorAll('.lan-add').forEach(box => {
        const type = box.dataset.type;
        const input = box.querySelector('input');
        const message = box.querySelector('.lan-add-msg');
        const add = () => {
            const name = input.value.trim();
            const key = lanSlug(name);
            if (!key) { message.textContent = 'Digite um nome.'; return; }
            if (document.getElementById(`lan-${type}-${key}`)) { message.textContent = 'Essa categoria já existe.'; return; }
            message.textContent = '';
            lanExtraKeys[type].push(key);
            const container = document.getElementById({ income: 'lan-incomes', fixed: 'lan-fixed', card: 'lan-cards' }[type]);
            const none = container.querySelector('.lan-none');
            if (none) none.remove();
            container.insertAdjacentHTML('beforeend', lanField(`lan-${type}-${key}`, formatLabel(key), 0));
            applyCurrencyMaskListeners();
            input.value = '';
            lanDirty = true;
            lanRecalculate();
            const created = document.getElementById(`lan-${type}-${key}`);
            created.focus();
            created.select();
        };
        box.querySelector('button').addEventListener('click', add);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
        });
    });
});
