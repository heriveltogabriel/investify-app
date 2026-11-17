// Global fetch interceptor to handle 401 (session timeout/unauthorized)
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    if (response.status === 401 && !response.url.includes('/api/login')) {
        // com o login único do site, volta para a tela de login dele
        window.location.href = window.INVESTIFY_LOGIN_UNICO ? '/login?next=/investify/' : 'login';
    }
    return response;
};

// State variables
let financialData = {};
let extrasData = { bens: [], notas: {}, meta: 0, plano: {} }; // bens, anotações por mês e meta (extras.json)
let activeTab = 'overview';
const currentDate = new Date();
let selectedYear = currentDate.getFullYear().toString();
let selectedMonth = (currentDate.getMonth() + 1).toString();
let monthSelectorYear = null; // ano para o qual o seletor de mês foi montado

// Category Keys (dynamically populated from db.json)

// Chart instances

// Month mappings
const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Document elements
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    const initialFilterYearEl = document.getElementById('filter-year');
    if (initialFilterYearEl) {
        // Garante que o ano corrente exista no seletor, mesmo sem dados ainda
        if (![...initialFilterYearEl.options].some(o => o.value === selectedYear)) {
            initialFilterYearEl.insertAdjacentHTML('afterbegin', `<option value="${selectedYear}">${selectedYear}</option>`);
        }
        initialFilterYearEl.value = selectedYear;
    }

    // Troca de tela pelo menu
    document.querySelectorAll('.nav-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const tabId = btn.getAttribute('data-tab');

            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');

            activeTab = tabId;
            updateHeaderTitle();
            renderPendingNotice();
            updateUI();
        });
    });

    // Seletor de ano
    const filterYearSelect = document.getElementById('filter-year');
    filterYearSelect.addEventListener('change', (e) => {
        selectedYear = e.target.value;
        populateMonthSelector();
        updateUI();
    });

    // Seletor de mês
    const filterMonthSelect = document.getElementById('filter-month');
    if (filterMonthSelect) {
        filterMonthSelect.addEventListener('change', (e) => {
            selectedMonth = e.target.value;
            updateUI();
        });
    }

    // Exportar Excel
    document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);

    // Sair
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (window.INVESTIFY_LOGIN_UNICO) {
                // sai do site inteiro (login único) e volta para a tela de login
                fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
                    .finally(() => { window.location.href = '/login'; });
            } else {
                window.location.href = 'logout';
            }
        });
    }

    // Sincronizar Google Sheets (Configurações)
    document.getElementById('btn-sync-gsheet').addEventListener('click', syncGoogleSheets);

    fetchData();
    applyCurrencyMaskListeners();
}

function updateHeaderTitle() {
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    const yearWrapper = document.querySelector('.year-selector-wrapper');
    const monthWrapper = document.getElementById('filter-month-container');
    
    if (activeTab === 'overview') {
        titleEl.textContent = 'Visão Geral';
        subtitleEl.textContent = 'Patrimônio, orçamento do mês e meta em uma tela.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'flex';
    } else if (activeTab === 'patrimonio') {
        titleEl.textContent = 'Patrimônio';
        subtitleEl.textContent = 'Quanto você tem, onde está e quanto rendeu.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'flex';
    } else if (activeTab === 'planejamento') {
        titleEl.textContent = 'Planejamento';
        subtitleEl.textContent = 'Em quanto tempo você chega à meta e quanto precisa aportar.';
        if (yearWrapper) yearWrapper.style.display = 'none';
        if (monthWrapper) monthWrapper.style.display = 'none';
    } else if (activeTab === 'lancar') {
        titleEl.textContent = 'Lançar mês';
        subtitleEl.textContent = 'Receitas, despesas e investimentos do mês escolhido ao lado.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'flex';
    } else if (activeTab === 'historico') {
        titleEl.textContent = 'Histórico';
        subtitleEl.textContent = 'A planilha do ano inteira e a comparação entre anos.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'none';
    } else if (activeTab === 'orcamento') {
        titleEl.textContent = 'Orçamento';
        subtitleEl.textContent = 'Receitas, despesas e para onde o dinheiro foi.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'flex';
    } else if (activeTab === 'settings') {
        titleEl.textContent = 'Configurações';
        subtitleEl.textContent = 'Gerencie as conexões, sincronização de dados e preferências do sistema.';
        if (yearWrapper) yearWrapper.style.display = 'none';
        if (monthWrapper) monthWrapper.style.display = 'none';
    }
}

// Fetch general data from API
async function fetchData() {
    try {
        const [response, extrasResponse] = await Promise.all([fetch('api/data'), fetch('api/extras')]);
        financialData = await response.json();
        if (extrasResponse.ok) {
            extrasData = await extrasResponse.json();
        }
        populateMonthSelector();
        updateUI();
    } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Erro', 'Não foi possível carregar os dados.', 'error');
    }
}

// Populate UI components depending on state
function updateUI() {
    if (!financialData[selectedYear]) {
        // Year doesn't exist in database yet, create empty state
        financialData[selectedYear] = {};
    }
    
    // Check which tab is active
    if (activeTab === 'overview') {
        renderOverview();
    } else if (activeTab === 'patrimonio') {
        renderPatrimonio();
    } else if (activeTab === 'orcamento') {
        renderOrcamento();
    } else if (activeTab === 'historico') {
        renderHistorico();
    } else if (activeTab === 'lancar') {
        renderLancar();
    } else if (activeTab === 'planejamento') {
        renderPlanejamento();
    }
}

// Helper to format values as currency
function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

// ---------------------------------------------------------------------------
// Regras de cálculo centrais (uma única definição para todas as telas)
// ---------------------------------------------------------------------------
function sumValues(obj) {
    return Object.values(obj || {}).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
}

// Resumo de um mês. Tudo que as telas mostram sai daqui:
//   sobra    = receita - despesa (aporte NÃO é gasto: é o destino da sobra)
//   networth = saldo + aporte + juros - retirada, somando os bancos
function monthSummary(year, month) {
    const mData = financialData[year]?.[month.toString()];
    const r = {
        income: 0, fixed: 0, cards: 0, expenses: 0, sobra: 0, savingsRate: 0,
        aporte: 0, juros: 0, retirada: 0, networth: 0,
        hasBudget: false, hasInvest: false
    };
    if (!mData) return r;

    r.income = sumValues(mData.incomes);
    r.fixed = sumValues(mData.expenses?.fixed);
    r.cards = sumValues(mData.expenses?.cards);
    r.expenses = r.fixed + r.cards;
    r.sobra = r.income - r.expenses;
    r.savingsRate = r.income > 0 ? (r.sobra / r.income) * 100 : 0;

    const inv = mData.investments || {};
    for (const bank in inv) {
        const item = inv[bank] || {};
        if (bank === 'outros') {
            for (const asset in item) {
                r.aporte += parseFloat(item[asset].aporte) || 0;
                r.juros += parseFloat(item[asset].juros) || 0;
                r.networth += parseFloat(item[asset].saldo) || 0;
            }
        } else {
            const ap = parseFloat(item.aporte) || 0;
            const ju = parseFloat(item.juros) || 0;
            const re = parseFloat(item.retirada) || 0;
            r.aporte += ap;
            r.juros += ju;
            r.retirada += re;
            r.networth += (parseFloat(item.cdb) || 0) + ap + ju - re;
        }
    }
    r.hasBudget = r.income > 0 || r.expenses > 0;
    r.hasInvest = r.networth > 0;
    return r;
}

// Grava bens, anotações e meta no servidor e atualiza a cópia local
async function saveExtras() {
    const response = await fetch('api/extras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extrasData)
    });
    if (!response.ok) throw new Error('Falha ao salvar');
    extrasData = await response.json();
    return extrasData;
}

// Valor líquido (valor - dívida) dos bens que já existiam em um dado mês
function assetsValueAt(year, month) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return (extrasData.bens || []).reduce((acc, b) => b.desde <= key ? acc + (b.valor || 0) - (b.divida || 0) : acc, 0);
}

function monthNote(year, month) {
    return (extrasData.notas || {})[`${year}-${parseInt(month)}`] || '';
}

// 'vazio'    : nada lançado
// 'pendente' : só um dos lados lançado (orçamento ou investimentos) num ano que usa os dois
// 'completo' : mês fechado, entra em médias, totais e gráficos
function monthStatus(year, month) {
    const s = monthSummary(year, month);
    if (!s.hasBudget && !s.hasInvest) return 'vazio';
    if (s.hasBudget && s.hasInvest) return 'completo';
    let yearHasBudget = false;
    let yearHasInvest = false;
    for (let m = 1; m <= 12; m++) {
        const o = monthSummary(year, m);
        if (o.hasBudget) yearHasBudget = true;
        if (o.hasInvest) yearHasInvest = true;
    }
    return (yearHasBudget && yearHasInvest) ? 'pendente' : 'completo';
}

function isMonthComplete(year, month) {
    return monthStatus(year, month) === 'completo';
}

// Último mês fechado do ano (0 se não houver nenhum)
function getLastCompleteMonth(year) {
    for (let m = 12; m >= 1; m--) {
        if (isMonthComplete(year, m)) return m;
    }
    return 0;
}

// Meses do ano (até o limite do calendário) que ainda não foram fechados
function getPendingMonths(year) {
    const limit = getLatestMonthIndex(year);
    const out = [];
    for (let m = 1; m <= limit; m++) {
        if (!isMonthComplete(year, m)) out.push(m);
    }
    return out;
}

function getLatestMonthIndex(year) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed (1 = January, 5 = May)
    
    const yNum = parseInt(year);
    if (yNum === currentYear) {
        return currentMonth;
    } else if (yNum < currentYear) {
        return 12; // Past years are fully complete
    } else {
        return 1; // Future years show starting month
    }
}

function populateMonthSelector() {
    const monthSelect = document.getElementById('filter-month');
    if (!monthSelect) return;
    
    const previousSelection = monthSelect.value;
    monthSelect.innerHTML = '';
    
    // Vai até o mês do calendário ou até o mês seguinte ao último fechado, para dar para lançar o próximo mês
    const lastComplete = getLastCompleteMonth(selectedYear);
    const latestMonth = Math.max(getLatestMonthIndex(selectedYear), lastComplete ? Math.min(12, lastComplete + 1) : 0);
    
    for (let m = 1; m <= latestMonth; m++) {
        const opt = document.createElement('option');
        opt.value = m.toString();
        opt.textContent = isMonthComplete(selectedYear, m) ? monthNames[m - 1] : `${monthNames[m - 1]} (pendente)`;
        monthSelect.appendChild(opt);
    }
    
    // Na primeira carga (ou ao trocar de ano) abre no último mês fechado, não no mês do calendário
    const defaultMonth = getLastCompleteMonth(selectedYear) || latestMonth;
    const keepPrevious = monthSelectorYear === selectedYear && previousSelection && parseInt(previousSelection) <= latestMonth;
    selectedMonth = keepPrevious ? previousSelection : defaultMonth.toString();
    monthSelect.value = selectedMonth;
    monthSelectorYear = selectedYear;
    renderPendingNotice();
}

// Aviso de meses sem lançamento completo no ano selecionado
function renderPendingNotice() {
    const el = document.getElementById('pending-notice');
    if (!el) return;
    const pending = getPendingMonths(selectedYear);
    const tabsWithoutNotice = ['historico', 'lancar', 'planejamento', 'settings'];
    if (pending.length === 0 || !getLastCompleteMonth(selectedYear) || tabsWithoutNotice.includes(activeTab)) {
        el.style.display = 'none';
        return;
    }
    const names = pending.map(m => monthNames[m - 1]).join(', ');
    el.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span><strong>${pending.length === 1 ? 'Mês pendente' : 'Meses pendentes'} em ${selectedYear}:</strong> ${names}. Ficam fora de médias, totais e gráficos até serem lançados.</span>`;
    el.style.display = 'flex';
}

// Translate database keys to human-readable labels
function formatLabel(key) {
    const mapping = {
        "condominio": "Condomínio",
        "agua": "Água",
        "luz": "Luz",
        "net": "NET / Internet",
        "celular": "Celular",
        "faxina": "Faxina",
        "carro_ipva_iptu": "Carro (IPVA/IPTU)",
        "ingles": "Inglês",
        "itau_seguro": "Seguro Itaú",
        "prestacao_carro": "Prestação do carro",
        "academia": "Academia",
        "mastercard_itau": "Mastercard Itaú",
        "visa_c6": "Visa C6",
        "elo_bb": "Elo BB",
        "salario": "Salário (Líquido)",
        "salario_dia_15": "Salário Dia 15",
        "salario_dia_30": "Salário Dia 30",
        "somatorio_salario": "Somatório Salário",
        "aluguel": "Aluguel Recebido",
        "extra": "Extra / Outros"
    };
    if (mapping[key]) return mapping[key];
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

// Show Toast alert
function showToast(title, message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.className = `toast ${type === 'error' ? 'error' : ''} show`;
    
    toast.querySelector('.toast-title').textContent = title;
    toast.querySelector('.toast-message').textContent = message;
    
    const icon = toast.querySelector('.toast-icon');
    if (type === 'success') {
        icon.className = 'fa-solid fa-circle-check toast-icon';
    } else {
        icon.className = 'fa-solid fa-circle-xmark toast-icon';
    }
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Trigger Excel export from server
async function exportToExcel() {
    try {
        const response = await fetch('api/export', { method: 'POST' });
        const res = await response.json();
        if (response.ok) {
            showToast('Excel Exportado', `Salvo em: Documents/investimento/Investimentos_Exportado.xlsx`, 'success');
        } else {
            showToast('Erro', res.error || 'Erro ao gerar planilha Excel.', 'error');
        }
    } catch (err) {
        console.error('Error exporting excel:', err);
        showToast('Erro', 'Não foi possível exportar para Excel.', 'error');
    }
}


// Synchronize Google Sheets online data
async function syncGoogleSheets() {
    const urlInput = document.getElementById('gsheet-url');
    const syncBtn = document.getElementById('btn-sync-gsheet');
    const syncIcon = document.getElementById('sync-icon');
    const syncBtnText = document.getElementById('sync-btn-text');
    
    const url = urlInput.value.trim();
    if (!url) {
        showToast('Erro', 'Por favor, insira uma URL válida do Google Sheets.', 'error');
        return;
    }
    
    // Set loading state
    syncBtn.disabled = true;
    urlInput.disabled = true;
    syncIcon.classList.add('spin-animation');
    syncBtnText.textContent = 'Sincronizando...';
    
    try {
        const response = await fetch('api/import-gsheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Sucesso', 'Sincronização concluída! Dados importados com sucesso.', 'success');
            await fetchData(); // Reload everything from the new database
        } else {
            // Check for specific error status codes from server
            if (response.status === 403) {
                showToast('Erro de Permissão', data.error || 'Acesso negado. Altere o compartilhamento para público no Google Drive.', 'error');
            } else {
                showToast('Erro na Importação', data.error || 'Erro ao processar dados da planilha.', 'error');
            }
        }
    } catch (error) {
        console.error('Error syncing Google Sheets:', error);
        showToast('Erro de Conexão', 'Não foi possível se comunicar com o servidor.', 'error');
    } finally {
        // Reset state
        syncBtn.disabled = false;
        urlInput.disabled = false;
        syncIcon.classList.remove('spin-animation');
        syncBtnText.textContent = 'Sincronizar';
    }
}

// ==========================================
// ADVANCED SIMULATOR (SIMULADOR PRO) LOGIC
// ==========================================


// ==========================================
// VISÃO RÁPIDA (CONFRONTO DE CONTAS) LOGIC
// ==========================================

// Portuguese BRL currency masking helpers
function formatCurrencyString(rawVal) {
    if (rawVal === undefined || rawVal === null || rawVal === '') return "0,00";
    let number = 0;
    if (typeof rawVal === 'number') {
        number = rawVal;
    } else {
        let clean = rawVal.toString().replace(/\D/g, '');
        if (!clean) return "0,00";
        number = parseFloat(clean) / 100;
    }
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePtBrFloat(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    
    const str = val.toString().trim();
    if (str.includes(',')) {
        const clean = str.replace(/\./g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    }
    return parseFloat(str) || 0;
}

function applyCurrencyMaskListeners() {
    document.querySelectorAll('input.currency-input').forEach(input => {
        if (input.dataset.masked) return;
        input.dataset.masked = "true";
        
        // Initial formatting if it has value
        if (input.value) {
            input.value = formatCurrencyString(input.value);
        }
        
        input.addEventListener('input', (e) => {
            const cursor = e.target.selectionStart;
            const originalLength = e.target.value.length;
            
            // Format input value
            e.target.value = formatCurrencyString(e.target.value);
            
            // Fix cursor drift
            const newLength = e.target.value.length;
            e.target.setSelectionRange(cursor + (newLength - originalLength), cursor + (newLength - originalLength));
        });
        
        input.addEventListener('blur', (e) => {
            if (e.target.value.trim() === '') {
                e.target.value = "0,00";
            } else {
                e.target.value = formatCurrencyString(e.target.value);
            }
        });
    });
}


