// Patrimônio: quanto você tem, onde está e quanto rendeu.
// Investimentos financeiros vêm dos lançamentos; bens e anotações vêm de extrasData (extras.json).

const PAT_COLORS = { financeiro: '#6366f1', bens: '#d97706' };
const PAT_BANKS = [
    { key: 'itau', name: 'Itaú' },
    { key: 'bb', name: 'Banco do Brasil' },
    { key: 'c6', name: 'C6 Bank' }
];
const PAT_TYPES = { imovel: 'Imóvel', veiculo: 'Veículo', outro: 'Outro' };

let patRange = 'all';
let patChart = null;
let patEditingId = null;

function patEsc(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function patParseAmount(text) {
    const raw = String(text || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    return parseFloat(raw) || 0;
}

function patFormatInput(value) {
    return value ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
}

// Meses com investimentos, em ordem, com a decomposição da variação de cada um
function patTimeline() {
    const months = ovTimeline().filter(p => p.s.hasInvest);
    return months.map((p, i) => {
        const prev = i > 0 ? months[i - 1] : null;
        const liquido = p.s.aporte - p.s.retirada;
        const variation = prev ? p.s.networth - prev.s.networth : null;
        const adjust = variation === null ? 0 : variation - (liquido + p.s.juros);
        const opening = p.s.networth - liquido - p.s.juros; // soma dos saldos iniciais do mês
        return {
            ...p,
            liquido,
            variation,
            adjust: Math.abs(adjust) >= 1 ? adjust : 0,
            yieldPct: opening > 0 ? (p.s.juros / opening) * 100 : null,
            bens: assetsValueAt(p.year, p.month),
            note: monthNote(p.year, p.month)
        };
    });
}

function renderPatrimonio() {
    const root = document.getElementById('tab-patrimonio');
    if (!root) return;

    const timeline = patTimeline();
    const selMonth = parseInt(selectedMonth);
    let refIdx = timeline.findIndex(p => p.year === selectedYear && p.month === selMonth);
    const emptyEl = document.getElementById('pat-empty');
    const bodyEl = document.getElementById('pat-body');

    if (refIdx === -1) {
        bodyEl.style.display = 'none';
        emptyEl.style.display = 'block';
        emptyEl.innerHTML = `<strong>${monthNames[selMonth - 1]} de ${selectedYear} não tem investimentos lançados.</strong>
            Lance os saldos do mês em Lançamentos, ou escolha outro mês no seletor acima.`;
        return;
    }
    emptyEl.style.display = 'none';
    bodyEl.style.display = 'block';

    const ref = timeline[refIdx];
    const monthLabel = `${monthNames[ref.month - 1].toLowerCase()} de ${ref.year}`;
    const hasAssets = (extrasData.bens || []).length > 0;

    // ---- Números do topo ---------------------------------------------------
    const total = ref.s.networth + ref.bens;
    document.getElementById('pat-summary').innerHTML = `
        <div class="ov-stat">
            <p class="ov-stat-label">${hasAssets ? 'Patrimônio total' : 'Investimentos financeiros'} em ${monthLabel}</p>
            <p class="ov-hero-value">${formatBRL(hasAssets ? total : ref.s.networth)}</p>
            ${ref.variation === null ? '' : `<p class="ov-delta ${ref.variation >= 0 ? 'up' : 'down'}">${ovSigned(ref.variation)} nos investimentos em relação ao mês anterior</p>`}
        </div>
        ${hasAssets ? `
        <div class="ov-stat">
            <p class="ov-stat-label">Investimentos financeiros</p>
            <p class="ov-stat-value">${formatBRL(ref.s.networth)}</p>
            <p class="ov-stat-foot ov-muted">${total > 0 ? ovPct((ref.s.networth / total) * 100) : '0%'} do total. Base do rendimento e da meta.</p>
        </div>
        <div class="ov-stat">
            <p class="ov-stat-label">Bens (valor menos dívida)</p>
            <p class="ov-stat-value">${formatBRL(ref.bens)}</p>
            <p class="ov-stat-foot ov-muted">${total > 0 ? ovPct((ref.bens / total) * 100) : '0%'} do total. Valor estimado por você.</p>
        </div>` : `
        <div class="ov-stat">
            <p class="ov-stat-label">Bens</p>
            <p class="ov-stat-foot ov-muted">Nenhum bem cadastrado. Inclua imóveis e veículos no fim desta página para ver o patrimônio total.</p>
        </div>`}`;

    // ---- Gráfico de evolução ----------------------------------------------
    const windowSize = patRange === 'all' ? timeline.length : 12;
    const win = timeline.slice(Math.max(0, refIdx + 1 - windowSize), refIdx + 1);
    document.querySelectorAll('#pat-range button').forEach(b => b.classList.toggle('active', b.dataset.range === patRange));
    document.getElementById('pat-legend').style.display = hasAssets ? 'flex' : 'none';

    const pointRadius = win.map(p => p.note ? 5 : (win.length > 24 ? 0 : 2.5));
    const datasets = [{
        label: 'Investimentos financeiros',
        data: win.map(p => p.s.networth),
        borderColor: PAT_COLORS.financeiro,
        backgroundColor: hasAssets ? 'rgba(99, 102, 241, 0.28)' : 'rgba(99, 102, 241, 0.10)',
        fill: true,
        borderWidth: 2,
        tension: 0.2,
        pointRadius,
        pointHoverRadius: 6,
        pointBackgroundColor: win.map(p => p.note ? '#f3f4f6' : PAT_COLORS.financeiro),
        pointBorderColor: PAT_COLORS.financeiro,
        pointBorderWidth: 2
    }];
    if (hasAssets) {
        datasets.push({
            label: 'Bens',
            data: win.map(p => p.bens),
            borderColor: PAT_COLORS.bens,
            backgroundColor: 'rgba(217, 119, 6, 0.28)',
            fill: true,
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 5
        });
    }
    if (patChart) patChart.destroy();
    patChart = new Chart(document.getElementById('pat-chart').getContext('2d'), {
        type: 'line',
        data: { labels: win.map(ovLabel), datasets },
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
                            const p = win[items[0].dataIndex];
                            const lines = [];
                            if (hasAssets) lines.push(`Total: ${formatBRL(p.s.networth + p.bens)}`);
                            if (p.note) lines.push(`Anotação: ${p.note}`);
                            return lines;
                        }
                    }
                }
            },
            scales: ovAxis({ y: { stacked: true, beginAtZero: true } })
        }
    });

    // Anotações da janela, listadas abaixo do gráfico
    const notes = win.filter(p => p.note);
    document.getElementById('pat-notes').innerHTML = notes.length
        ? notes.map(p => `<li><span class="pat-note-date">${ovLabel(p)}</span>${patEsc(p.note)}</li>`).join('')
        : '';

    // ---- Por banco no mês ---------------------------------------------------
    document.getElementById('pat-banks-title').textContent = `Por banco em ${monthLabel}`;
    const inv = financialData[ref.year]?.[ref.month.toString()]?.investments || {};
    const sums = { opening: 0, aporte: 0, retirada: 0, juros: 0, closing: 0 };
    const bankRows = PAT_BANKS.map(b => {
        const d = inv[b.key] || {};
        const opening = parseFloat(d.cdb) || 0;
        const aporte = parseFloat(d.aporte) || 0;
        const retirada = parseFloat(d.retirada) || 0;
        const juros = parseFloat(d.juros) || 0;
        const closing = opening + aporte + juros - retirada;
        sums.opening += opening; sums.aporte += aporte; sums.retirada += retirada; sums.juros += juros; sums.closing += closing;
        return { name: b.name, opening, aporte, retirada, juros, closing };
    }).filter(r => r.opening || r.aporte || r.retirada || r.juros);
    const bankLine = (r, cls = '') => `<tr class="${cls}">
        <th scope="row">${r.name}</th>
        <td>${formatBRL(r.opening)}</td>
        <td>${r.aporte ? ovSigned(r.aporte) : '—'}</td>
        <td class="${r.retirada ? 'neg' : ''}">${r.retirada ? '− ' + formatBRL(r.retirada) : '—'}</td>
        <td>${ovSigned(r.juros)}</td>
        <td>${r.opening > 0 ? ovPct((r.juros / r.opening) * 100, 2) : '—'}</td>
        <td class="strong">${formatBRL(r.closing)}</td>
        <td>${sums.closing > 0 ? ovPct((r.closing / sums.closing) * 100) : '—'}</td>
    </tr>`;
    document.getElementById('pat-banks').innerHTML = `
        <thead><tr><th scope="col">Banco</th><th scope="col">Saldo inicial</th><th scope="col">Aportes</th><th scope="col">Retiradas</th><th scope="col">Rendimento</th><th scope="col">Rentab. no mês</th><th scope="col">Saldo final</th><th scope="col">Participação</th></tr></thead>
        <tbody>${bankRows.map(r => bankLine(r)).join('')}${bankLine({ name: 'Total', ...sums }, 'total')}</tbody>`;

    // ---- Mês a mês do ano ---------------------------------------------------
    document.getElementById('pat-months-title').textContent = `Mês a mês em ${ref.year}`;
    const yearRows = timeline.filter(p => p.year === ref.year);
    const yearTotals = yearRows.reduce((acc, p) => {
        acc.aporte += p.s.aporte; acc.retirada += p.s.retirada; acc.juros += p.s.juros; acc.adjust += p.adjust;
        return acc;
    }, { aporte: 0, retirada: 0, juros: 0, adjust: 0 });
    const showAdjust = yearRows.some(p => p.adjust !== 0);
    // Rentabilidade acumulada no ano: composição das rentabilidades mensais
    const yearYield = (yearRows.reduce((acc, p) => acc * (1 + (p.yieldPct || 0) / 100), 1) - 1) * 100;
    document.getElementById('pat-months').innerHTML = `
        <thead><tr>
            <th scope="col">Mês</th><th scope="col">Aportes</th><th scope="col">Retiradas</th><th scope="col">Rendimento</th><th scope="col">Rentab.</th>
            ${showAdjust ? '<th scope="col" title="Diferença entre o saldo inicial do mês e o saldo final do mês anterior">Ajuste de saldo</th>' : ''}
            <th scope="col">Saldo final</th><th scope="col" class="left">Anotação</th>
        </tr></thead>
        <tbody>
        ${yearRows.map(p => `<tr class="${p.month === ref.month ? 'current' : ''}">
            <th scope="row">${monthNames[p.month - 1]}</th>
            <td>${p.s.aporte ? ovSigned(p.s.aporte) : '—'}</td>
            <td class="${p.s.retirada ? 'neg' : ''}">${p.s.retirada ? '− ' + formatBRL(p.s.retirada) : '—'}</td>
            <td>${ovSigned(p.s.juros)}</td>
            <td>${p.yieldPct === null ? '—' : ovPct(p.yieldPct, 2)}</td>
            ${showAdjust ? `<td class="${p.adjust < 0 ? 'neg' : ''}">${p.adjust ? ovSigned(p.adjust) : '—'}</td>` : ''}
            <td class="strong">${formatBRL(p.s.networth)}</td>
            <td class="left note"><input type="text" class="pat-note-cell" maxlength="200" value="${patEsc(p.note)}" data-key="${p.year}-${p.month}" placeholder="Adicionar anotação" aria-label="Anotação de ${monthNames[p.month - 1]} de ${p.year}" autocomplete="off"></td>
        </tr>`).join('')}
        <tr class="total">
            <th scope="row">Total do ano</th>
            <td>${ovSigned(yearTotals.aporte)}</td>
            <td class="${yearTotals.retirada ? 'neg' : ''}">${yearTotals.retirada ? '− ' + formatBRL(yearTotals.retirada) : '—'}</td>
            <td>${ovSigned(yearTotals.juros)}</td>
            <td>${ovPct(yearYield, 2)}</td>
            ${showAdjust ? `<td class="${yearTotals.adjust < 0 ? 'neg' : ''}">${yearTotals.adjust ? ovSigned(yearTotals.adjust) : '—'}</td>` : ''}
            <td></td><td></td>
        </tr>
        </tbody>`;

    renderPatAssets();
}

function renderPatAssets() {
    const bens = extrasData.bens || [];
    const listEl = document.getElementById('pat-assets');
    if (!bens.length) {
        listEl.innerHTML = '<p class="ov-muted pat-assets-empty">Nenhum bem cadastrado ainda.</p>';
    } else {
        const totals = bens.reduce((acc, b) => { acc.valor += b.valor; acc.divida += b.divida; return acc; }, { valor: 0, divida: 0 });
        listEl.innerHTML = `<div class="table-responsive"><table class="pat-table">
            <thead><tr><th scope="col">Bem</th><th scope="col" class="left">Tipo</th><th scope="col" class="left">Desde</th><th scope="col">Valor estimado</th><th scope="col">Dívida</th><th scope="col">Valor líquido</th><th scope="col"></th></tr></thead>
            <tbody>
            ${bens.map(b => {
                const [y, m] = b.desde.split('-');
                return `<tr>
                    <th scope="row">${patEsc(b.nome)}</th>
                    <td class="left">${PAT_TYPES[b.tipo] || 'Outro'}</td>
                    <td class="left">${OV_SHORT_MONTHS[parseInt(m) - 1]}/${y}</td>
                    <td>${formatBRL(b.valor)}</td>
                    <td class="${b.divida ? 'neg' : ''}">${b.divida ? '− ' + formatBRL(b.divida) : '—'}</td>
                    <td class="strong">${formatBRL(b.valor - b.divida)}</td>
                    <td class="actions">
                        <button type="button" class="ov-link" data-asset-edit="${patEsc(b.id)}">Editar</button>
                        <button type="button" class="ov-link danger" data-asset-remove="${patEsc(b.id)}">Remover</button>
                    </td>
                </tr>`;
            }).join('')}
            ${bens.length > 1 ? `<tr class="total"><th scope="row">Total</th><td></td><td></td><td>${formatBRL(totals.valor)}</td><td>${totals.divida ? '− ' + formatBRL(totals.divida) : '—'}</td><td>${formatBRL(totals.valor - totals.divida)}</td><td></td></tr>` : ''}
            </tbody></table></div>`;
    }
    document.getElementById('pat-asset-submit').textContent = patEditingId ? 'Salvar alterações' : 'Adicionar bem';
    document.getElementById('pat-asset-cancel').style.display = patEditingId ? 'inline-flex' : 'none';
}

function patResetAssetForm() {
    patEditingId = null;
    document.getElementById('pat-asset-form').reset();
    document.getElementById('pat-asset-error').textContent = '';
}

async function patPersist(successMessage) {
    try {
        await saveExtras();
        showToast('Salvo', successMessage, 'success');
        return true;
    } catch (e) {
        showToast('Erro', 'Não foi possível salvar. Tente de novo.', 'error');
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#pat-range button').forEach(btn => {
        btn.addEventListener('click', () => {
            patRange = btn.dataset.range;
            renderPatrimonio();
        });
    });

    // Anotação do mês: campo direto na tabela, salva ao sair do campo ou com Enter
    const monthsTable = document.getElementById('pat-months');
    if (monthsTable) {
        monthsTable.addEventListener('keydown', e => {
            if (e.target.classList.contains('pat-note-cell') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
            if (e.target.classList.contains('pat-note-cell') && e.key === 'Escape') { e.target.value = extrasData.notas[e.target.dataset.key] || ''; e.target.blur(); }
        });
        monthsTable.addEventListener('change', async e => {
            const input = e.target;
            if (!input.classList.contains('pat-note-cell')) return;
            const text = input.value.trim();
            const previous = { ...extrasData.notas };
            extrasData.notas = { ...extrasData.notas };
            if (text) extrasData.notas[input.dataset.key] = text;
            else delete extrasData.notas[input.dataset.key];
            if (!await patPersist(text ? 'Anotação salva.' : 'Anotação removida.')) extrasData.notas = previous;
            renderPatrimonio();
        });
    }

    // Cadastro de bens
    const assetForm = document.getElementById('pat-asset-form');
    if (assetForm) {
        assetForm.addEventListener('submit', async e => {
            e.preventDefault();
            const errorEl = document.getElementById('pat-asset-error');
            const nome = document.getElementById('pat-asset-name').value.trim();
            const desde = document.getElementById('pat-asset-since').value;
            const valor = patParseAmount(document.getElementById('pat-asset-value').value);
            const divida = patParseAmount(document.getElementById('pat-asset-debt').value);
            if (!nome || !/^\d{4}-\d{2}$/.test(desde) || valor <= 0) {
                errorEl.textContent = 'Preencha o nome, o mês de aquisição e um valor estimado maior que zero.';
                return;
            }
            errorEl.textContent = '';
            const item = { id: patEditingId || `b${Date.now()}`, nome, tipo: document.getElementById('pat-asset-type').value, valor, divida, desde };
            const previous = extrasData.bens;
            extrasData.bens = patEditingId ? previous.map(b => b.id === patEditingId ? item : b) : [...previous, item];
            if (await patPersist(patEditingId ? 'Bem atualizado.' : 'Bem adicionado.')) patResetAssetForm();
            else extrasData.bens = previous;
            renderPatrimonio();
        });
        document.getElementById('pat-asset-cancel').addEventListener('click', () => {
            patResetAssetForm();
            renderPatAssets();
        });
    }

    const assetsEl = document.getElementById('pat-assets');
    if (assetsEl) {
        assetsEl.addEventListener('click', async e => {
            const editId = e.target.getAttribute('data-asset-edit');
            const removeId = e.target.getAttribute('data-asset-remove');
            if (editId) {
                const b = extrasData.bens.find(x => x.id === editId);
                if (!b) return;
                patEditingId = b.id;
                document.getElementById('pat-asset-name').value = b.nome;
                document.getElementById('pat-asset-type').value = b.tipo;
                document.getElementById('pat-asset-since').value = b.desde;
                document.getElementById('pat-asset-value').value = patFormatInput(b.valor);
                document.getElementById('pat-asset-debt').value = patFormatInput(b.divida);
                renderPatAssets();
                document.getElementById('pat-asset-name').focus();
            } else if (removeId) {
                // Remoção em dois cliques, sem caixa de diálogo do navegador
                if (e.target.dataset.confirm !== '1') {
                    e.target.dataset.confirm = '1';
                    e.target.textContent = 'Confirmar remoção';
                    return;
                }
                const previous = extrasData.bens;
                extrasData.bens = previous.filter(b => b.id !== removeId);
                if (!await patPersist('Bem removido.')) extrasData.bens = previous;
                if (patEditingId === removeId) patResetAssetForm();
                renderPatrimonio();
            }
        });
    }
});
