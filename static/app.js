// State variables
let financialData = {};
let activeTab = 'dashboard';
let selectedYear = '2026';
let selectedMonth = '5';
let simStartingCapital = 0;
let simMonthlyData = [];

// Category Keys (dynamically populated from db.json)
let fixedExpenseKeys = ['condominio', 'agua', 'luz', 'net', 'celular', 'faxina', 'carro_ipva_iptu', 'ingles', 'itau_seguro'];
let cardExpenseKeys = ['mastercard_itau', 'visa_c6', 'elo_bb'];
let incomeKeys = ['salario', 'aluguel', 'extra'];

// Chart instances
let chartNetworth = null;
let chartAllocation = null;
let chartCashflow = null;
let chartExpenses = null;
let chartProjection = null;
let chartIncEvolution = null;
let chartIncComposition = null;
let chartFixedEvolution = null;
let chartFixedDistribution = null;
let chartCardEvolution = null;
let chartCardDistribution = null;
let chartAdvProjection = null;
let chartAdvBreakdown = null;
let chartQuickConfrontation = null;
let chartQuickEvolution = null;

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
    // Tab switching listener
    document.querySelectorAll('.nav-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const tabId = btn.getAttribute('data-tab');
            
            // Remove active classes
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            
            // Add active classes
            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            activeTab = tabId;
            updateHeaderTitle();
            
            // Trigger chart updates/simulator recalculations if needed
            if (activeTab === 'simulator') {
                initSimulatorData();
            } else if (activeTab === 'adv-simulator') {
                initAdvSimulator();
            } else {
                updateUI();
            }
        });
    });

    // Year selector listener
    const filterYearSelect = document.getElementById('filter-year');
    filterYearSelect.addEventListener('change', (e) => {
        selectedYear = e.target.value;
        // Keep year selector in entries form in sync
        document.getElementById('entry-year').value = selectedYear;
        populateMonthSelector(); // Update month selector options
        // Reload all data views
        if (activeTab === 'simulator') {
            initSimulatorData();
        } else {
            updateUI();
        }
    });

    // Synchronize selector in entries form
    document.getElementById('entry-year').addEventListener('change', (e) => {
        selectedYear = e.target.value;
        filterYearSelect.value = selectedYear;
        populateMonthSelector(); // Update month selector options
        if (activeTab === 'simulator') {
            initSimulatorData();
        } else {
            updateUI();
        }
    });

    // Month selector listener
    const filterMonthSelect = document.getElementById('filter-month');
    if (filterMonthSelect) {
        filterMonthSelect.addEventListener('change', (e) => {
            selectedMonth = e.target.value;
            updateUI();
        });
    }

    // Load monthly data button listener
    document.getElementById('btn-load-existing').addEventListener('click', () => populateFormWithExistingData(true));

    // Automatically load monthly data when month changes
    document.getElementById('entry-month').addEventListener('change', () => populateFormWithExistingData(false));

    // Sub-tab switching listener
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const subtabId = e.currentTarget.getAttribute('data-subtab');
            
            // Remove active classes
            document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.sub-tab-content').forEach(sc => sc.classList.remove('active'));
            
            // Add active classes
            e.currentTarget.classList.add('active');
            document.getElementById(`subtab-${subtabId}`).classList.add('active');
        });
    });

    // Recalculate preview on any entry-form input change (dynamic or static)
    document.getElementById('entry-form').addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT') {
            calculateFormPreview();
        }
    });

    // Form submit listener
    document.getElementById('entry-form').addEventListener('submit', handleFormSubmit);

    // Dynamic Category addition buttons
    document.getElementById('btn-add-fixed').addEventListener('click', () => addCategory('fixed'));
    document.getElementById('btn-add-card').addEventListener('click', () => addCategory('card'));
    document.getElementById('btn-add-income').addEventListener('click', () => addCategory('income'));

    // Simulator starting capital listener
    const simStartingInput = document.getElementById('sim-starting');
    if (simStartingInput) {
        simStartingInput.addEventListener('input', (e) => {
            calculateProjection();
        });
    }

    // Export Excel button listener
    document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);

    // Google Sheets Sync button listener
    document.getElementById('btn-sync-gsheet').addEventListener('click', syncGoogleSheets);

    // History year selector listener
    document.querySelectorAll('#history-year-selector button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#history-year-selector button').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const year = e.currentTarget.getAttribute('data-year');
            selectedYear = year;
            filterYearSelect.value = year;
            document.getElementById('entry-year').value = year;
            populateMonthSelector(); // Update month options
            if (activeTab === 'simulator') {
                initSimulatorData();
            } else {
                updateUI();
            }
        });
    });

    // Fetch initial data
    fetchData();
}

function updateHeaderTitle() {
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    const yearWrapper = document.querySelector('.year-selector-wrapper');
    const monthWrapper = document.getElementById('filter-month-container');
    
    if (activeTab === 'dashboard') {
        titleEl.textContent = 'Dashboard Geral';
        subtitleEl.textContent = 'Visão unificada das suas finanças e investimentos.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'flex';
    } else if (activeTab === 'quick-view') {
        titleEl.textContent = 'Visão Rápida';
        subtitleEl.textContent = 'Confronto direto simplificado entre receitas, despesas, aportes e rendimentos.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'flex';
    } else if (activeTab === 'incomes') {
        titleEl.textContent = 'Análise de Receitas';
        subtitleEl.textContent = 'Acompanhamento detalhado das suas entradas financeiras.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'flex';
    } else if (activeTab === 'fixed-expenses') {
        titleEl.textContent = 'Análise de Gastos Fixos';
        subtitleEl.textContent = 'Acompanhamento detalhado e histórico de despesas fixas.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'flex';
    } else if (activeTab === 'card-expenses') {
        titleEl.textContent = 'Análise de Cartões de Crédito';
        subtitleEl.textContent = 'Acompanhamento detalhado de despesas de cartões de crédito.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'flex';
    } else if (activeTab === 'entries') {
        titleEl.textContent = 'Lançamentos Mensais';
        subtitleEl.textContent = 'Gerencie entradas, saídas fixas, faturas e investimentos.';
        if (yearWrapper) yearWrapper.style.display = 'none';
        if (monthWrapper) monthWrapper.style.display = 'none';
    } else if (activeTab === 'history') {
        titleEl.textContent = 'Histórico Geral';
        subtitleEl.textContent = 'Planilha consolidada de movimentações e investimentos.';
        if (yearWrapper) yearWrapper.style.display = 'flex';
        if (monthWrapper) monthWrapper.style.display = 'none';
    } else if (activeTab === 'simulator') {
        titleEl.textContent = 'Simulador de Juros Compostos';
        subtitleEl.textContent = 'Projete e simule o crescimento do seu patrimônio.';
        if (yearWrapper) yearWrapper.style.display = 'none';
        if (monthWrapper) monthWrapper.style.display = 'none';
    } else if (activeTab === 'adv-simulator') {
        titleEl.textContent = 'Simulador Pro (Avançado)';
        subtitleEl.textContent = 'Projeção customizável com cenários de juros, inflação, aportes extras e metas de aposentadoria.';
        if (yearWrapper) yearWrapper.style.display = 'none';
        if (monthWrapper) monthWrapper.style.display = 'none';
    }
}

// Fetch general data from API
async function fetchData() {
    try {
        const response = await fetch('/api/data');
        financialData = await response.json();
        populateMonthSelector();
        updateUI();
        // Sync simulator starting capital on first load if active
        if (activeTab === 'simulator') {
            initSimulatorData();
        }
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
    if (activeTab === 'dashboard') {
        renderKPIs();
        renderCharts();
    } else if (activeTab === 'incomes') {
        renderIncomesTab();
    } else if (activeTab === 'fixed-expenses') {
        renderFixedExpensesTab();
    } else if (activeTab === 'card-expenses') {
        renderCardExpensesTab();
    } else if (activeTab === 'entries') {
        renderFormDynamicInputs();
        populateFormWithExistingData(false);
    } else if (activeTab === 'history') {
        // Sync button active class in history
        document.querySelectorAll('#history-year-selector button').forEach(b => {
            if (b.getAttribute('data-year') === selectedYear) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        renderHistoryTables();
    } else if (activeTab === 'quick-view') {
        renderQuickView();
    }
}

// Helper to format values as currency
function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
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
    
    const latestMonth = getLatestMonthIndex(selectedYear);
    
    for (let m = 1; m <= latestMonth; m++) {
        const opt = document.createElement('option');
        opt.value = m.toString();
        opt.textContent = monthNames[m - 1];
        monthSelect.appendChild(opt);
    }
    
    if (previousSelection && parseInt(previousSelection) <= latestMonth) {
        monthSelect.value = previousSelection;
        selectedMonth = previousSelection;
    } else {
        monthSelect.value = latestMonth.toString();
        selectedMonth = latestMonth.toString();
    }
}

function getNetworthForMonth(year, monthStr) {
    const mData = financialData[year]?.[monthStr];
    
    let sum = 0;
    if (mData && mData.investments) {
        if (mData.total_carteira !== undefined) {
            sum = mData.total_carteira;
        } else {
            for (const bank in mData.investments) {
                const item = mData.investments[bank];
                if (bank === 'outros') {
                    for (const asset in item) {
                        sum += (item[asset].saldo || 0);
                    }
                } else {
                    sum += (item.cdb || 0) + (item.aporte || 0);
                }
            }
        }
    }
    
    // Carry forward previous month's networth if this month is active but has no saved investments yet
    if (sum === 0) {
        const monthInt = parseInt(monthStr);
        const latestMonth = getLatestMonthIndex(year);
        if (monthInt <= latestMonth && monthInt > 1) {
            return getNetworthForMonth(year, (monthInt - 1).toString());
        } else if (monthInt <= latestMonth && monthInt === 1) {
            const prevYear = (parseInt(year) - 1).toString();
            if (financialData[prevYear]) {
                return getNetworthForMonth(prevYear, '12');
            }
        }
    }
    
    return sum;
}

function getLatestNetworth() {
    const years = Object.keys(financialData).sort();
    if (years.length === 0) return 0;
    const latestYear = years[years.length - 1];
    const latestMonth = getLatestMonthIndex(latestYear);
    if (latestMonth === -1) return 0;
    return getNetworthForMonth(latestYear, latestMonth.toString());
}

// Render Dashboard Metrics (KPIs)
function renderKPIs() {
    const latestMonth = parseInt(selectedMonth) || getLatestMonthIndex(selectedYear);
    
    // 1. Patrimônio
    let networth = 0;
    let prevNetworth = 0;
    
    if (latestMonth !== -1) {
        networth = getNetworthForMonth(selectedYear, latestMonth.toString());
        // Get comparison (either previous month or December of previous year)
        if (latestMonth > 1) {
            prevNetworth = getNetworthForMonth(selectedYear, (latestMonth - 1).toString());
        } else {
            const prevYear = (parseInt(selectedYear) - 1).toString();
            if (financialData[prevYear]) {
                prevNetworth = getNetworthForMonth(prevYear, '12');
            }
        }
    }
    
    document.getElementById('kpi-networth').textContent = formatBRL(networth);
    
    const trendEl = document.getElementById('kpi-networth-trend');
    if (prevNetworth > 0) {
        const diff = networth - prevNetworth;
        const diffPct = (diff / prevNetworth) * 100;
        const sign = diff >= 0 ? '+' : '';
        const trendClass = diff >= 0 ? 'positive' : 'negative';
        const trendIcon = diff >= 0 ? 'fa-circle-arrow-up' : 'fa-circle-arrow-down';
        
        trendEl.className = `kpi-trend ${trendClass}`;
        trendEl.innerHTML = `<i class="fa-solid ${trendIcon}"></i> ${sign}${formatBRL(diff)} (${sign}${diffPct.toFixed(2)}% vs mês ant.)`;
    } else {
        trendEl.className = 'kpi-trend';
        trendEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> Sem histórico de comparação`;
    }

    // 2. Rendimento (Juros acumulados no ano)
    let totalYield = 0;
    let latestMonthYield = 0;
    for (let m = 1; m <= latestMonth; m++) {
        const mData = financialData[selectedYear]?.[m.toString()];
        if (mData && mData.investments) {
            let mYield = 0;
            for (const bank in mData.investments) {
                const item = mData.investments[bank];
                if (bank === 'outros') {
                    for (const asset in item) {
                        mYield += (item[asset].juros || 0);
                    }
                } else {
                    mYield += (item.juros || 0);
                }
            }
            totalYield += mYield;
            if (m === latestMonth) {
                latestMonthYield = mYield;
            }
        }
    }
    document.getElementById('kpi-yield').textContent = formatBRL(totalYield);
    document.getElementById('kpi-yield-rate').textContent = 'Rendimento acumulado no ano';

    // 2.1 Rendimento do Mês
    document.getElementById('kpi-month-yield').textContent = formatBRL(latestMonthYield);
    const monthYieldDescEl = document.getElementById('kpi-month-yield-desc');
    if (latestMonth !== -1) {
        monthYieldDescEl.textContent = `Recebido em ${monthNames[latestMonth - 1]}`;
    } else {
        monthYieldDescEl.textContent = `Nenhum mês ativo`;
    }

    // 3. Aportes no Ano
    let totalAportes = 0;
    let countAportesMonths = 0;
    for (let m = 1; m <= latestMonth; m++) {
        const mData = financialData[selectedYear]?.[m.toString()];
        if (mData && mData.investments) {
            let mAp = 0;
            for (const bank in mData.investments) {
                const item = mData.investments[bank];
                if (bank === 'outros') {
                    for (const asset in item) {
                        mAp += (item[asset].aporte || 0);
                    }
                } else {
                    mAp += (item.aporte || 0);
                }
            }
            totalAportes += mAp;
            if (mAp > 0) countAportesMonths++;
        }
    }
    document.getElementById('kpi-aportes').textContent = formatBRL(totalAportes);
    document.getElementById('kpi-aportes-count').textContent = `Realizados em ${countAportesMonths} meses este ano`;

    // 3.1 Aporte do Mês
    let monthAporte = 0;
    if (latestMonth !== -1) {
        const mData = financialData[selectedYear]?.[latestMonth.toString()];
        if (mData && mData.investments) {
            for (const bank in mData.investments) {
                const item = mData.investments[bank];
                if (bank === 'outros') {
                    for (const asset in item) {
                        monthAporte += (item[asset].aporte || 0);
                    }
                } else {
                    monthAporte += (item.aporte || 0);
                }
            }
        }
    }
    document.getElementById('kpi-month-aporte').textContent = formatBRL(monthAporte);
    const monthAporteDescEl = document.getElementById('kpi-month-aporte-desc');
    if (latestMonth !== -1) {
        monthAporteDescEl.textContent = `Aportado em ${monthNames[latestMonth - 1]}`;
    } else {
        monthAporteDescEl.textContent = `Nenhum mês ativo`;
    }

    // 4. Economia (Sobra do último mês ativo)
    let savings = 0;
    let savingsRate = 0;
    if (latestMonth !== -1) {
        const mData = financialData[selectedYear][latestMonth.toString()];
        if (mData) {
            const income = Object.values(mData.incomes || {}).reduce((acc, v) => acc + v, 0);
            
            const fixedExpenses = Object.values(mData.expenses?.fixed || {}).reduce((acc, v) => acc + v, 0);
            const cardExpenses = Object.values(mData.expenses?.cards || {}).reduce((acc, v) => acc + v, 0);
            const totalExpenses = fixedExpenses + cardExpenses;
            
            savings = income - totalExpenses;
            savingsRate = income > 0 ? (savings / income) * 100 : 0;
        }
    }
    
    document.getElementById('kpi-savings').textContent = formatBRL(savings);
    
    const savingsRateEl = document.getElementById('kpi-savings-rate');
    savingsRateEl.className = 'kpi-trend positive';
    savingsRateEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> Rendimentos + Aporte`;
}

// Render Dashboard Charts
function renderCharts() {
    // Prepare monthly data arrays
    const networthData = [];
    const incomeData = [];
    const expenseData = [];
    const aporteData = [];
    const labels = monthNames;

    const activeMonthsCount = parseInt(selectedMonth) || getLatestMonthIndex(selectedYear);
    
    for (let m = 1; m <= activeMonthsCount; m++) {
        const mStr = m.toString();
        const mData = financialData[selectedYear]?.[mStr];
        
        // Net worth cumulative
        const nw = getNetworthForMonth(selectedYear, mStr);
        if (nw > 0) {
            networthData.push(nw);
        } else {
            // Push null to not render unentered months
            networthData.push(null);
        }

        // Budget
        if (mData) {
            const inc = Object.values(mData.incomes || {}).reduce((acc, v) => acc + v, 0);
            const fixedExp = Object.values(mData.expenses?.fixed || {}).reduce((acc, v) => acc + v, 0);
            const cardExp = Object.values(mData.expenses?.cards || {}).reduce((acc, v) => acc + v, 0);
            
            // Total Aportes in month
            let ap = 0;
            if (mData.investments) {
                for (const bank in mData.investments) {
                    if (bank === 'outros') {
                        for (const asset in mData.investments[bank]) {
                            ap += (mData.investments[bank][asset].aporte || 0);
                        }
                    } else {
                        ap += (mData.investments[bank].aporte || 0);
                    }
                }
            }
            
            incomeData.push(inc);
            expenseData.push(fixedExp + cardExp);
            aporteData.push(ap);
        } else {
            incomeData.push(0);
            expenseData.push(0);
            aporteData.push(0);
        }
    }

    // 1. Chart: Networth Evolution (Line)
    if (chartNetworth) chartNetworth.destroy();
    
    const ctxNetworth = document.getElementById('chart-networth-growth').getContext('2d');
    const networthGradient = ctxNetworth.createLinearGradient(0, 0, 0, 300);
    networthGradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    networthGradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
    
    chartNetworth = new Chart(ctxNetworth, {
        type: 'line',
        data: {
            labels: labels.slice(0, activeMonthsCount),
            datasets: [{
                label: 'Patrimônio',
                data: networthData.slice(0, activeMonthsCount), // Crop empty months
                borderColor: '#6366f1',
                borderWidth: 3,
                backgroundColor: networthGradient,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#6366f1',
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', callback: val => formatBRL(val) }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            }
        }
    });

    // 2. Chart: Asset Allocation (Doughnut)
    if (chartAllocation) chartAllocation.destroy();
    
    const latestMonth = parseInt(selectedMonth) || getLatestMonthIndex(selectedYear);
    const allocationData = [];
    const allocationLabels = [];
    const allocationColors = ['#f97316', '#eab308', '#2563eb']; // Itau, BB, C6
    
    let mData = null;
    let checkMonth = latestMonth;
    let checkYear = parseInt(selectedYear);
    
    while (checkMonth > 0) {
        const testData = financialData[checkYear.toString()]?.[checkMonth.toString()];
        if (testData && testData.investments) {
            let sum = 0;
            for (const bank in testData.investments) {
                if (bank === 'outros') {
                    for (const asset in testData.investments[bank]) {
                        sum += (testData.investments[bank][asset].saldo || 0);
                    }
                } else {
                    const bankData = testData.investments[bank];
                    sum += bankData.total !== undefined ? bankData.total : (bankData.cdb || 0) + (bankData.aporte || 0);
                }
            }
            if (sum > 0) {
                mData = testData;
                break;
            }
        }
        checkMonth--;
        if (checkMonth === 0) {
            checkYear--;
            if (financialData[checkYear.toString()]) {
                checkMonth = 12;
            } else {
                break;
            }
        }
    }
    
    if (mData && mData.investments) {
        for (const bank in mData.investments) {
            if (bank !== 'outros') {
                const item = mData.investments[bank];
                const balance = item.total !== undefined ? item.total : (item.cdb || 0) + (item.aporte || 0);
                if (balance > 0) {
                    allocationData.push(balance);
                    allocationLabels.push(bank.toUpperCase());
                }
            } else {
                // For 2024
                for (const asset in mData.investments[bank]) {
                    const bal = mData.investments[bank][asset].saldo || 0;
                    if (bal > 0) {
                        allocationData.push(bal);
                        allocationLabels.push(asset.toUpperCase());
                    }
                }
            }
        }
    }
    
    const ctxAlloc = document.getElementById('chart-allocation').getContext('2d');
    chartAllocation = new Chart(ctxAlloc, {
        type: 'doughnut',
        data: {
            labels: allocationLabels.length > 0 ? allocationLabels : ['Nenhum investimento ativo'],
            datasets: [{
                data: allocationData.length > 0 ? allocationData : [1],
                backgroundColor: allocationLabels.length > 0 ? allocationColors.slice(0, allocationLabels.length) : ['rgba(255,255,255,0.05)'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af', font: { size: 11 } }
                }
            },
            cutout: '70%'
        }
    });

    // 3. Chart: Cash Flow comparison (Grouped Bars)
    if (chartCashflow) chartCashflow.destroy();
    
    const ctxCashflow = document.getElementById('chart-cashflow').getContext('2d');
    // Crop all to the active months of the year
    const activeIncome = incomeData.slice(0, activeMonthsCount);
    const activeExpense = expenseData.slice(0, activeMonthsCount);
    const activeAporte = aporteData.slice(0, activeMonthsCount);
    
    chartCashflow = new Chart(ctxCashflow, {
        type: 'bar',
        data: {
            labels: labels.slice(0, activeMonthsCount),
            datasets: [
                {
                    label: 'Receitas',
                    data: activeIncome,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                },
                {
                    label: 'Despesas',
                    data: activeExpense,
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                },
                {
                    label: 'Aportes',
                    data: activeAporte,
                    backgroundColor: '#f59e0b',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9ca3af' }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', callback: val => formatBRL(val) }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            }
        }
    });

    // 4. Chart: Expenses Composition Pie Chart
    if (chartExpenses) chartExpenses.destroy();
    
    const expenseTotals = {};
    let hasExpenses = false;
    
    const currentMonthData = financialData[selectedYear]?.[selectedMonth];
    if (currentMonthData && currentMonthData.expenses?.fixed) {
        for (const [key, val] of Object.entries(currentMonthData.expenses.fixed)) {
            if (val > 0) {
                expenseTotals[key] = val;
                hasExpenses = true;
            }
        }
    }
    
    const expLabels = [];
    const expData = [];
    const expColors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f43f5e'];
    
    if (hasExpenses) {
        for (const [key, val] of Object.entries(expenseTotals)) {
            expLabels.push(key.toUpperCase().replace('_', ' '));
            expData.push(val);
        }
    }
    
    const ctxExp = document.getElementById('chart-expenses-pie').getContext('2d');
    chartExpenses = new Chart(ctxExp, {
        type: 'pie',
        data: {
            labels: expLabels.length > 0 ? expLabels : ['Nenhuma despesa ativa'],
            datasets: [{
                data: expData.length > 0 ? expData : [1],
                backgroundColor: expLabels.length > 0 ? expColors.slice(0, expLabels.length) : ['rgba(255,255,255,0.05)'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af', font: { size: 9 } }
                }
            }
        }
    });
}

// Fetch form inputs and calculate real-time net budget preview
// Discover all unique category keys in the database for the selected year
function discoverKeys() {
    const yearData = financialData[selectedYear] || {};
    
    // Set fallback initial keys depending on selected year
    const fixedSet = new Set(['condominio', 'agua', 'luz', 'net', 'celular', 'faxina']);
    if (selectedYear === '2026') {
        const extraFixed = ['carro_ipva_iptu', 'ingles', 'itau_seguro'];
        extraFixed.forEach(k => fixedSet.add(k));
    }
    
    const cardSet = new Set();
    if (selectedYear === '2026') {
        const defaults = ['mastercard_itau', 'visa_c6', 'elo_bb'];
        defaults.forEach(k => cardSet.add(k));
    }
    
    const incomeSet = new Set();
    if (selectedYear === '2026') {
        incomeSet.add('salario_dia_15');
        incomeSet.add('salario_dia_30');
        incomeSet.add('aluguel');
        incomeSet.add('extra');
    } else {
        incomeSet.add('salario');
        incomeSet.add('aluguel');
        incomeSet.add('extra');
    }
    
    for (const m in yearData) {
        const monthData = yearData[m];
        if (monthData.expenses?.fixed) {
            Object.keys(monthData.expenses.fixed).forEach(k => fixedSet.add(k));
        }
        if (monthData.expenses?.cards) {
            Object.keys(monthData.expenses.cards).forEach(k => cardSet.add(k));
        }
        if (monthData.incomes) {
            Object.keys(monthData.incomes).forEach(k => {
                if (selectedYear !== '2026' || k !== 'salario') {
                    incomeSet.add(k);
                }
            });
        }
    }
    
    fixedExpenseKeys = Array.from(fixedSet);
    cardExpenseKeys = Array.from(cardSet);
    incomeKeys = Array.from(incomeSet);
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

// Dynamically render forms input fields
function renderFormDynamicInputs() {
    discoverKeys();
    
    // Render fixed expenses
    const fixedContainer = document.getElementById('fixed-expenses-container');
    fixedContainer.innerHTML = '';
    fixedExpenseKeys.forEach(key => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label for="input-fixed-${key}">${formatLabel(key)}</label>
            <input type="number" step="0.01" id="input-fixed-${key}" data-key="${key}" data-type="fixed" value="0.00">
        `;
        fixedContainer.appendChild(div);
    });
    
    // Render card expenses
    const cardContainer = document.getElementById('card-expenses-container');
    cardContainer.innerHTML = '';
    cardExpenseKeys.forEach(key => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label for="input-card-${key}">${formatLabel(key)}</label>
            <input type="number" step="0.01" id="input-card-${key}" data-key="${key}" data-type="card" value="0.00">
        `;
        cardContainer.appendChild(div);
    });
    
    // Render incomes
    const incomeContainer = document.getElementById('incomes-container');
    incomeContainer.innerHTML = '';
    incomeKeys.forEach(key => {
        const div = document.createElement('div');
        div.className = 'form-group';
        
        let defVal = "0.00";
        if (key === 'salario') defVal = "17000.00";
        if (key === 'salario_dia_15') defVal = "9409.48";
        if (key === 'salario_dia_30') defVal = "7579.26";
        if (key === 'aluguel') defVal = "3650.00";
        
        div.innerHTML = `
            <label for="input-income-${key}">${formatLabel(key)}</label>
            <input type="number" step="0.01" id="input-income-${key}" data-key="${key}" data-type="income" value="${defVal}">
        `;
        incomeContainer.appendChild(div);
    });
    
    // Attach input listeners for dynamic BRL sums preview
    document.querySelectorAll('.form-inputs-dynamic-grid input').forEach(input => {
        input.addEventListener('input', calculateFormPreview);
    });
}

// Add a new custom category dynamically
function addCategory(type) {
    const labelType = type === 'fixed' ? 'Despesa Fixa' : type === 'card' ? 'Cartão de Crédito' : 'Receita';
    const name = prompt(`Digite o nome da nova categoria para ${labelType}:`);
    if (!name || name.trim() === '') return;
    
    const key = name.trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9_]/g, "_")    // convert special characters to _
        .replace(/__+/g, "_")            // compress double _
        .replace(/^_+|_+$/g, "");        // trim _
        
    if (!key) return;
    
    if (type === 'fixed') {
        if (fixedExpenseKeys.includes(key)) {
            showToast('Erro', 'Esta categoria já existe.', 'error');
            return;
        }
        fixedExpenseKeys.push(key);
    } else if (type === 'card') {
        if (cardExpenseKeys.includes(key)) {
            showToast('Erro', 'Este cartão já existe.', 'error');
            return;
        }
        cardExpenseKeys.push(key);
    } else if (type === 'income') {
        if (incomeKeys.includes(key)) {
            showToast('Erro', 'Esta receita já existe.', 'error');
            return;
        }
        incomeKeys.push(key);
    }
    
    // Save current values before re-rendering
    const currentValues = captureFormValues();
    renderFormDynamicInputs();
    restoreFormValues(currentValues);
    
    // Focus the new field
    const newInput = document.getElementById(`input-${type}-${key}`);
    if (newInput) {
        newInput.focus();
        newInput.select();
    }
    
    showToast('Item Adicionado', `Item "${name}" adicionado. Não esqueça de salvar o lançamento!`, 'success');
}

// Capture current input values in form
function captureFormValues() {
    const vals = {
        investments: {
            itau: {
                cdb: document.getElementById('inv-itau-cdb').value,
                aporte: document.getElementById('inv-itau-aporte').value,
                juros: document.getElementById('inv-itau-juros').value
            },
            bb: {
                cdb: document.getElementById('inv-bb-cdb').value,
                aporte: document.getElementById('inv-bb-aporte').value,
                juros: document.getElementById('inv-bb-juros').value
            },
            c6: {
                cdb: document.getElementById('inv-c6-cdb').value,
                aporte: document.getElementById('inv-c6-aporte').value,
                juros: document.getElementById('inv-c6-juros').value
            }
        },
        fixed: {},
        cards: {},
        incomes: {}
    };
    
    fixedExpenseKeys.forEach(k => {
        const el = document.getElementById(`input-fixed-${k}`);
        if (el) vals.fixed[k] = el.value;
    });
    
    cardExpenseKeys.forEach(k => {
        const el = document.getElementById(`input-card-${k}`);
        if (el) vals.cards[k] = el.value;
    });
    
    incomeKeys.forEach(k => {
        const el = document.getElementById(`input-income-${k}`);
        if (el) vals.incomes[k] = el.value;
    });
    
    return vals;
}

// Restore input values to form
function restoreFormValues(vals) {
    if (!vals) return;
    
    document.getElementById('inv-itau-cdb').value = vals.investments.itau.cdb;
    document.getElementById('inv-itau-aporte').value = vals.investments.itau.aporte;
    document.getElementById('inv-itau-juros').value = vals.investments.itau.juros;
    
    document.getElementById('inv-bb-cdb').value = vals.investments.bb.cdb;
    document.getElementById('inv-bb-aporte').value = vals.investments.bb.aporte;
    document.getElementById('inv-bb-juros').value = vals.investments.bb.juros;
    
    document.getElementById('inv-c6-cdb').value = vals.investments.c6.cdb;
    document.getElementById('inv-c6-aporte').value = vals.investments.c6.aporte;
    document.getElementById('inv-c6-juros').value = vals.investments.c6.juros;
    
    for (const [k, v] of Object.entries(vals.fixed)) {
        const el = document.getElementById(`input-fixed-${k}`);
        if (el) el.value = v;
    }
    for (const [k, v] of Object.entries(vals.cards)) {
        const el = document.getElementById(`input-card-${k}`);
        if (el) el.value = v;
    }
    for (const [k, v] of Object.entries(vals.incomes)) {
        const el = document.getElementById(`input-income-${k}`);
        if (el) el.value = v;
    }
    
    calculateFormPreview();
}

// Fetch form inputs and calculate real-time net budget preview
function calculateFormPreview() {
    let totalIncome = 0;
    incomeKeys.forEach(key => {
        const el = document.getElementById(`input-income-${key}`);
        totalIncome += el ? (parseFloat(el.value) || 0) : 0;
    });
    
    let totalFixed = 0;
    fixedExpenseKeys.forEach(key => {
        const el = document.getElementById(`input-fixed-${key}`);
        totalFixed += el ? (parseFloat(el.value) || 0) : 0;
    });
    
    let totalCards = 0;
    cardExpenseKeys.forEach(key => {
        const el = document.getElementById(`input-card-${key}`);
        totalCards += el ? (parseFloat(el.value) || 0) : 0;
    });
    
    const totalExpenses = totalFixed + totalCards;
    const leftover = totalIncome - totalExpenses;
    
    const totalAportes = ['inv-itau-aporte', 'inv-bb-aporte', 'inv-c6-aporte'].reduce((acc, id) => {
        const el = document.getElementById(id);
        return acc + (el ? (parseFloat(el.value) || 0) : 0);
    }, 0);
    
    document.getElementById('preview-income').textContent = formatBRL(totalIncome);
    document.getElementById('preview-expenses').textContent = formatBRL(totalExpenses);
    
    const leftoverEl = document.getElementById('preview-leftover');
    leftoverEl.textContent = formatBRL(leftover);
    if (leftover >= 0) {
        leftoverEl.className = 'positive';
    } else {
        leftoverEl.className = 'negative';
    }
    
    document.getElementById('preview-aportes').textContent = formatBRL(totalAportes);
}

// Populate the form fields with existing DB values for selected month/year
function populateFormWithExistingData(showToastSuccess = true) {
    const year = document.getElementById('entry-year').value;
    const month = document.getElementById('entry-month').value;
    
    const monthData = financialData[year]?.[month];
    
    if (!monthData) {
        if (showToastSuccess) {
            showToast('Info', 'Não existem dados salvos para este mês. Iniciando formulário zerado.', 'error');
        }
        // Reset fields to defaults
        fixedExpenseKeys.forEach(key => {
            const input = document.getElementById(`input-fixed-${key}`);
            if (input) input.value = "0.00";
        });
        cardExpenseKeys.forEach(key => {
            const input = document.getElementById(`input-card-${key}`);
            if (input) input.value = "0.00";
        });
        incomeKeys.forEach(key => {
            const input = document.getElementById(`input-income-${key}`);
            if (input) {
                if (key === 'salario') input.value = "17000.00";
                else if (key === 'aluguel') input.value = "3650.00";
                else input.value = "0.00";
            }
        });
        document.getElementById('inv-itau-cdb').value = "0.00";
        document.getElementById('inv-itau-aporte').value = "0.00";
        document.getElementById('inv-itau-juros').value = "";
        
        document.getElementById('inv-bb-cdb').value = "0.00";
        document.getElementById('inv-bb-aporte').value = "0.00";
        document.getElementById('inv-bb-juros').value = "";
        
        document.getElementById('inv-c6-cdb').value = "0.00";
        document.getElementById('inv-c6-aporte').value = "0.00";
        document.getElementById('inv-c6-juros').value = "";
        
        calculateFormPreview();
        return;
    }
    
    // Fill investments
    const inv = monthData.investments || {};
    document.getElementById('inv-itau-cdb').value = inv.itau?.cdb || "0.00";
    document.getElementById('inv-itau-aporte').value = inv.itau?.aporte || "0.00";
    document.getElementById('inv-itau-juros').value = inv.itau?.juros !== undefined ? inv.itau.juros : "";
    
    document.getElementById('inv-bb-cdb').value = inv.bb?.cdb || "0.00";
    document.getElementById('inv-bb-aporte').value = inv.bb?.aporte || "0.00";
    document.getElementById('inv-bb-juros').value = inv.bb?.juros !== undefined ? inv.bb.juros : "";
    
    document.getElementById('inv-c6-cdb').value = inv.c6?.cdb || "0.00";
    document.getElementById('inv-c6-aporte').value = inv.c6?.aporte || "0.00";
    document.getElementById('inv-c6-juros').value = inv.c6?.juros !== undefined ? inv.c6.juros : "";
    
    // Fill expenses fixed
    const fixed = monthData.expenses?.fixed || {};
    fixedExpenseKeys.forEach(key => {
        const input = document.getElementById(`input-fixed-${key}`);
        if (input) {
            input.value = fixed[key] !== undefined ? fixed[key] : "0.00";
        }
    });
    
    // Fill card expenses
    const cards = monthData.expenses?.cards || {};
    cardExpenseKeys.forEach(key => {
        const input = document.getElementById(`input-card-${key}`);
        if (input) {
            input.value = cards[key] !== undefined ? cards[key] : "0.00";
        }
    });
    
    // Fill incomes
    const inc = monthData.incomes || {};
    incomeKeys.forEach(key => {
        const input = document.getElementById(`input-income-${key}`);
        if (input) {
            input.value = inc[key] !== undefined ? inc[key] : "0.00";
        }
    });
    
    calculateFormPreview();
    if (showToastSuccess) {
        showToast('Sucesso', 'Dados do mês carregados com sucesso!', 'success');
    }
}

// Handle form submit to backend
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const year = document.getElementById('entry-year').value;
    const month = document.getElementById('entry-month').value;
    
    const getVal = id => {
        const el = document.getElementById(id);
        return el ? (parseFloat(el.value) || 0) : 0;
    };
    const getOptionalVal = id => {
        const el = document.getElementById(id);
        if (!el || el.value === "") return null;
        return parseFloat(el.value);
    };
    
    // Dynamically collect expenses
    const fixedObj = {};
    fixedExpenseKeys.forEach(k => {
        fixedObj[k] = getVal(`input-fixed-${k}`);
    });
    
    const cardsObj = {};
    cardExpenseKeys.forEach(k => {
        cardsObj[k] = getVal(`input-card-${k}`);
    });
    
    // Dynamically collect incomes
    const incomesObj = {};
    incomeKeys.forEach(k => {
        incomesObj[k] = getVal(`input-income-${k}`);
    });
    
    const payload = {
        year: year,
        month: month,
        investments: {
            itau: {
                cdb: getVal('inv-itau-cdb'),
                aporte: getVal('inv-itau-aporte'),
                juros: getOptionalVal('inv-itau-juros')
            },
            bb: {
                cdb: getVal('inv-bb-cdb'),
                aporte: getVal('inv-bb-aporte'),
                juros: getOptionalVal('inv-bb-juros')
            },
            c6: {
                cdb: getVal('inv-c6-cdb'),
                aporte: getVal('inv-c6-aporte'),
                juros: getOptionalVal('inv-c6-juros')
            }
        },
        expenses: {
            fixed: fixedObj,
            cards: cardsObj
        },
        incomes: incomesObj
    };
    
    try {
        const response = await fetch('/api/entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const res = await response.json();
        if (response.ok) {
            let msg = 'Lançamento salvo e banco atualizado!';
            if (e.submitter) {
                const btnText = e.submitter.innerText || e.submitter.textContent;
                const cleanText = btnText.replace(/[\n\r]/g, '').replace(/Salvar\s*/i, '').trim();
                msg = `${cleanText} salvo com sucesso!`;
            }
            showToast('Sucesso', msg, 'success');
            await fetchData();
        } else {
            showToast('Erro', res.error || 'Erro ao salvar os dados.', 'error');
        }
    } catch (err) {
        console.error('Error submitting form:', err);
        showToast('Erro', 'Conexão com o servidor falhou.', 'error');
    }
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
        const response = await fetch('/api/export', { method: 'POST' });
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

// Render dynamic history tables
function renderHistoryTables() {
    const year = selectedYear;
    const yearData = financialData[year] || {};
    
    // --- 1. Investment table ---
    const tableInv = document.getElementById('table-investments');
    tableInv.innerHTML = ''; // Clear
    
    // Create headers
    const theadInv = document.createElement('thead');
    let headerHtml = `<tr><th>MÉTRICA / INSTITUIÇÃO</th>`;
    for (let m = 0; m < 12; m++) {
        headerHtml += `<th>${monthNames[m].substring(0, 3).toUpperCase()}</th>`;
    }
    headerHtml += `<th>ANUAL</th></tr>`;
    theadInv.innerHTML = headerHtml;
    tableInv.appendChild(theadInv);
    
    const tbodyInv = document.createElement('tbody');
    
    // If year 2024 is active, render the asset types structure, else render 2025/2026 banks
    if (year === '2024') {
        // Assets: CDB, IVVB11, FII, Fundos
        const assets = [
            { label: "CDB, Renda Fixa (Itaú)", key: "itau" }, // 2024 maps CDB under itau in db.json
            { label: "Ações IVVB11", subKey: "ivvb11" },
            { label: "FII - Imobiliário", subKey: "fii" },
            { label: "Fundos de Investimento", subKey: "fundos" }
        ];
        
        // Build table row by row
        assets.forEach(asset => {
            // Header for asset
            const rowSec = document.createElement('tr');
            rowSec.className = 'bank-section-row';
            rowSec.innerHTML = `<td colspan="14">${asset.label}</td>`;
            tbodyInv.appendChild(rowSec);
            
            // Rows for Aporte, Juros, Balance
            const metricRows = [
                { label: "Aporte", type: "aporte" },
                { label: "Juros / Rendimento", type: "juros" },
                { label: "Saldo Acumulado", type: "cdb" }
            ];
            
            metricRows.forEach(mr => {
                const tr = document.createElement('tr');
                let rowHtml = `<td>${mr.label}</td>`;
                let totalYear = 0;
                
                for (let m = 1; m <= 12; m++) {
                    const mData = yearData[m.toString()] || {};
                    let val = 0;
                    
                    if (asset.key) {
                        val = mData.investments?.itau?.[mr.type] || 0;
                    } else if (asset.subKey) {
                        const assetItem = mData.investments?.outros?.[asset.subKey] || {};
                        if (mr.type === 'cdb') {
                            val = assetItem.saldo || 0;
                        } else {
                            val = assetItem[mr.type] || 0;
                        }
                    }
                    
                    rowHtml += `<td class="num-val">${formatBRL(val)}</td>`;
                    if (mr.type === 'cdb') {
                        // For balances, year total is the December balance
                        if (m === 12) totalYear = val;
                    } else {
                        totalYear += val;
                    }
                }
                
                rowHtml += `<td class="num-val" style="font-weight:600;">${formatBRL(totalYear)}</td>`;
                tr.innerHTML = rowHtml;
                tbodyInv.appendChild(tr);
            });
        });
        
    } else {
        // 2025/2026 standard format (Itaú, BB, C6)
        const banks = [
            { label: "ITAÚ", key: "itau" },
            { label: "BANCO DO BRASIL", key: "bb" },
            { label: "C6 BANK", key: "c6" }
        ];
        
        banks.forEach(bank => {
            const rowSec = document.createElement('tr');
            rowSec.className = 'bank-section-row';
            rowSec.innerHTML = `<td colspan="14">${bank.label}</td>`;
            tbodyInv.appendChild(rowSec);
            
            const metrics = [
                { label: "CDB, Renda Fixa", type: "cdb" },
                { label: "Juros / Rendimento", type: "juros" },
                { label: "Aporte", type: "aporte" },
                { label: "Total Fim do Mês (CDB+Aporte)", type: "total" }
            ];
            
            metrics.forEach(mr => {
                const tr = document.createElement('tr');
                if (mr.type === 'total') tr.style.fontWeight = '500';
                
                let rowHtml = `<td>${mr.label}</td>`;
                let totalYear = 0;
                let lastActiveVal = 0;
                
                for (let m = 1; m <= 12; m++) {
                    const mData = yearData[m.toString()] || {};
                    const bankData = mData.investments?.[bank.key] || {};
                    
                    let val = 0;
                    if (mr.type === 'total') {
                        val = bankData.total !== undefined ? bankData.total : (bankData.cdb || 0) + (bankData.aporte || 0);
                    } else {
                        val = bankData[mr.type] || 0;
                    }
                    
                    rowHtml += `<td class="num-val">${formatBRL(val)}</td>`;
                    
                    if (mr.type === 'cdb' || mr.type === 'total') {
                        if (val > 0) lastActiveVal = val;
                    } else {
                        totalYear += val;
                    }
                }
                
                // Anual total value
                const finalYearVal = (mr.type === 'cdb' || mr.type === 'total') ? lastActiveVal : totalYear;
                rowHtml += `<td class="num-val" style="font-weight:600;">${formatBRL(finalYearVal)}</td>`;
                tr.innerHTML = rowHtml;
                tbodyInv.appendChild(tr);
            });
        });
        
        // CONSOLIDATION ROWS
        const rowSec = document.createElement('tr');
        rowSec.className = 'bank-section-row';
        rowSec.innerHTML = `<td colspan="14">CONSOLIDAÇÃO DA CARTEIRA</td>`;
        tbodyInv.appendChild(rowSec);
        
        const consolMetrics = [
            { label: "JUROS MENSAIS TOTAIS", type: "juros" },
            { label: "APORTES MENSAIS TOTAIS", type: "aporte" },
            { label: "VALOR TOTAL DA CARTEIRA", type: "total" }
        ];
        
        consolMetrics.forEach(mr => {
            const tr = document.createElement('tr');
            tr.className = mr.type === 'total' ? 'total-row' : '';
            
            let rowHtml = `<td>${mr.label}</td>`;
            let totalYear = 0;
            let lastActiveVal = 0;
            
            for (let m = 1; m <= 12; m++) {
                const mData = yearData[m.toString()] || {};
                let sum = 0;
                
                if (mData.investments) {
                    if (mr.type === 'total' && mData.total_carteira !== undefined) {
                        sum = mData.total_carteira;
                    } else {
                        for (const b in mData.investments) {
                            const bankData = mData.investments[b] || {};
                            if (mr.type === 'total') {
                                sum += bankData.total !== undefined ? bankData.total : (bankData.cdb || 0) + (bankData.aporte || 0);
                            } else {
                                sum += bankData[mr.type] || 0;
                            }
                        }
                    }
                }
                
                rowHtml += `<td class="num-val">${formatBRL(sum)}</td>`;
                
                if (mr.type === 'total') {
                    if (sum > 0) lastActiveVal = sum;
                } else {
                    totalYear += sum;
                }
            }
            
            const finalYearVal = mr.type === 'total' ? lastActiveVal : totalYear;
            rowHtml += `<td class="num-val">${formatBRL(finalYearVal)}</td>`;
            tr.innerHTML = rowHtml;
            tbodyInv.appendChild(tr);
        });
    }
    
    tableInv.appendChild(tbodyInv);

    // --- 2. Budget table (expenses / income) ---
    const tableBud = document.getElementById('table-budget');
    const budgetCard = document.getElementById('history-budget-card');
    
    if (year === '2024') {
        // 2024 has no expenses in the Excel sheet
        budgetCard.style.display = 'none';
        return;
    }
    
    budgetCard.style.display = 'block';
    tableBud.innerHTML = '';
    
    // Headers
    const theadBud = document.createElement('thead');
    let headerBudHtml = `<tr><th>CATEGORIA</th>`;
    for (let m = 0; m < 12; m++) {
        headerBudHtml += `<th>${monthNames[m].substring(0, 3).toUpperCase()}</th>`;
    }
    headerBudHtml += `<th>ANUAL</th></tr>`;
    theadBud.innerHTML = headerBudHtml;
    tableBud.appendChild(theadBud);
    
    const tbodyBud = document.createElement('tbody');
    
    // Sample a month to fetch keys
    const sampleMonth = Object.values(yearData)[0] || {};
    const fixedKeys = Object.keys(sampleMonth.expenses?.fixed || {});
    const cardKeys = Object.keys(sampleMonth.expenses?.cards || {});
    const incomeKeys = Object.keys(sampleMonth.incomes || {});
    
    if (fixedKeys.length === 0) {
        tbodyBud.innerHTML = `<tr><td colspan="14" style="text-align:center; padding: 20px;">Nenhum dado de orçamento disponível para este ano.</td></tr>`;
        tableBud.appendChild(tbodyBud);
        return;
    }
    
    // Gastos Fixos header row
    const rowFixedSec = document.createElement('tr');
    rowFixedSec.className = 'bank-section-row';
    rowFixedSec.innerHTML = `<td colspan="14">DESPESAS FIXAS</td>`;
    tbodyBud.appendChild(rowFixedSec);
    
    fixedKeys.forEach(key => {
        const tr = document.createElement('tr');
        let rowHtml = `<td>${key.toUpperCase().replace('_', ' ')}</td>`;
        let total = 0;
        
        for (let m = 1; m <= 12; m++) {
            const val = yearData[m.toString()]?.expenses?.fixed?.[key] || 0;
            rowHtml += `<td class="num-val">${formatBRL(val)}</td>`;
            total += val;
        }
        rowHtml += `<td class="num-val" style="font-weight:600;">${formatBRL(total)}</td>`;
        tr.innerHTML = rowHtml;
        tbodyBud.appendChild(tr);
    });
    
    // Total Fixed Expenses Row
    const trTotFixed = document.createElement('tr');
    trTotFixed.style.fontWeight = '600';
    let rowFixedTotHtml = `<td>TOTAL GASTOS FIXOS</td>`;
    let totalFixedYear = 0;
    for (let m = 1; m <= 12; m++) {
        const fixedData = yearData[m.toString()]?.expenses?.fixed || {};
        const sumFixed = Object.values(fixedData).reduce((acc, v) => acc + v, 0);
        rowFixedTotHtml += `<td class="num-val">${formatBRL(sumFixed)}</td>`;
        totalFixedYear += sumFixed;
    }
    rowFixedTotHtml += `<td class="num-val">${formatBRL(totalFixedYear)}</td>`;
    trTotFixed.innerHTML = rowFixedTotHtml;
    tbodyBud.appendChild(trTotFixed);
    
    // Cartões Credit Card rows (if any)
    let cardTotRowHtml = '';
    let totalCardsYear = 0;
    if (cardKeys.length > 0) {
        const rowCardSec = document.createElement('tr');
        rowCardSec.className = 'bank-section-row';
        rowCardSec.innerHTML = `<td colspan="14">CARTÕES DE CRÉDITO</td>`;
        tbodyBud.appendChild(rowCardSec);
        
        cardKeys.forEach(key => {
            const tr = document.createElement('tr');
            let rowHtml = `<td>${key.toUpperCase().replace('_', ' ')}</td>`;
            let total = 0;
            
            for (let m = 1; m <= 12; m++) {
                const val = yearData[m.toString()]?.expenses?.cards?.[key] || 0;
                rowHtml += `<td class="num-val">${formatBRL(val)}</td>`;
                total += val;
            }
            rowHtml += `<td class="num-val" style="font-weight:600;">${formatBRL(total)}</td>`;
            tr.innerHTML = rowHtml;
            tbodyBud.appendChild(tr);
        });
        
        // Total Cards Row
        const trTotCards = document.createElement('tr');
        trTotCards.style.fontWeight = '600';
        cardTotRowHtml = `<td>TOTAL CARTÕES</td>`;
        for (let m = 1; m <= 12; m++) {
            const cardsData = yearData[m.toString()]?.expenses?.cards || {};
            const sumCards = Object.values(cardsData).reduce((acc, v) => acc + v, 0);
            cardTotRowHtml += `<td class="num-val">${formatBRL(sumCards)}</td>`;
            totalCardsYear += sumCards;
        }
        cardTotRowHtml += `<td class="num-val">${formatBRL(totalCardsYear)}</td>`;
        trTotCards.innerHTML = cardTotRowHtml;
        tbodyBud.appendChild(trTotCards);
    }
    
    // Total Consolidated Expenses Row
    const trTotExpenses = document.createElement('tr');
    trTotExpenses.style.fontWeight = '700';
    let rowExpTotHtml = `<td>DESPESAS TOTAIS CONSOLIDADAS</td>`;
    let totalExpensesYear = 0;
    for (let m = 1; m <= 12; m++) {
        const fixedData = yearData[m.toString()]?.expenses?.fixed || {};
        const sumFixed = Object.values(fixedData).reduce((acc, v) => acc + v, 0);
        
        const cardsData = yearData[m.toString()]?.expenses?.cards || {};
        const sumCards = Object.values(cardsData).reduce((acc, v) => acc + v, 0);
        
        const sumTot = sumFixed + sumCards;
        rowExpTotHtml += `<td class="num-val">${formatBRL(sumTot)}</td>`;
        totalExpensesYear += sumTot;
    }
    rowExpTotHtml += `<td class="num-val">${formatBRL(totalExpensesYear)}</td>`;
    trTotExpenses.innerHTML = rowExpTotHtml;
    tbodyBud.appendChild(trTotExpenses);
    
    // Incomes section
    const rowIncSec = document.createElement('tr');
    rowIncSec.className = 'bank-section-row';
    rowIncSec.innerHTML = `<td colspan="14">RECEITAS</td>`;
    tbodyBud.appendChild(rowIncSec);
    
    incomeKeys.forEach(key => {
        if (year === '2026' && key === 'salario') return;
        
        const tr = document.createElement('tr');
        let rowHtml = `<td>${formatLabel(key).toUpperCase()}</td>`;
        let total = 0;
        
        for (let m = 1; m <= 12; m++) {
            const val = yearData[m.toString()]?.incomes?.[key] || 0;
            rowHtml += `<td class="num-val">${formatBRL(val)}</td>`;
            total += val;
        }
        rowHtml += `<td class="num-val" style="font-weight:600;">${formatBRL(total)}</td>`;
        tr.innerHTML = rowHtml;
        tbodyBud.appendChild(tr);
        
        // If 2026 and we just rendered salario_dia_30, insert Somatório Salário
        if (key === 'salario_dia_30' && year === '2026') {
            const trSum = document.createElement('tr');
            trSum.style.fontWeight = '600';
            let rowSumHtml = `<td>SOMATÓRIO SALÁRIO</td>`;
            let sumTotal = 0;
            
            for (let m = 1; m <= 12; m++) {
                const mData = yearData[m.toString()]?.incomes || {};
                const val15 = mData.salario_dia_15 || 0;
                const val30 = mData.salario_dia_30 || 0;
                const valSum = val15 + val30;
                rowSumHtml += `<td class="num-val">${formatBRL(valSum)}</td>`;
                sumTotal += valSum;
            }
            rowSumHtml += `<td class="num-val">${formatBRL(sumTotal)}</td>`;
            trSum.innerHTML = rowSumHtml;
            tbodyBud.appendChild(trSum);
        }
    });
    
    // Total Incomes Row
    const trTotIncomes = document.createElement('tr');
    trTotIncomes.style.fontWeight = '600';
    let rowIncTotHtml = `<td>TOTAL RECEITAS</td>`;
    let totalIncomesYear = 0;
    for (let m = 1; m <= 12; m++) {
        const incData = yearData[m.toString()]?.incomes || {};
        const sumInc = Object.values(incData).reduce((acc, v) => acc + v, 0);
        rowIncTotHtml += `<td class="num-val">${formatBRL(sumInc)}</td>`;
        totalIncomesYear += sumInc;
    }
    rowIncTotHtml += `<td class="num-val">${formatBRL(totalIncomesYear)}</td>`;
    trTotIncomes.innerHTML = rowIncTotHtml;
    tbodyBud.appendChild(trTotIncomes);
    
    // Net Flow Row (Sobra)
    const trNetFlow = document.createElement('tr');
    trNetFlow.className = 'total-row';
    let rowNetFlowHtml = `<td>FLUXO LÍQUIDO (RECEITAS - DESPESAS)</td>`;
    let totalNetFlowYear = 0;
    for (let m = 1; m <= 12; m++) {
        const fixedData = yearData[m.toString()]?.expenses?.fixed || {};
        const sumFixed = Object.values(fixedData).reduce((acc, v) => acc + v, 0);
        const cardsData = yearData[m.toString()]?.expenses?.cards || {};
        const sumCards = Object.values(cardsData).reduce((acc, v) => acc + v, 0);
        const incData = yearData[m.toString()]?.incomes || {};
        const sumInc = Object.values(incData).reduce((acc, v) => acc + v, 0);
        
        const leftover = sumInc - (sumFixed + sumCards);
        rowNetFlowHtml += `<td class="num-val ${leftover >= 0 ? 'positive' : 'negative'}">${formatBRL(leftover)}</td>`;
        totalNetFlowYear += leftover;
    }
    rowNetFlowHtml += `<td class="num-val ${totalNetFlowYear >= 0 ? 'positive' : 'negative'}">${formatBRL(totalNetFlowYear)}</td>`;
    trNetFlow.innerHTML = rowNetFlowHtml;
    tbodyBud.appendChild(trNetFlow);
    
    tableBud.appendChild(tbodyBud);
}

// Get January Starting CDB Capital for selected year
function getJanStartingCapital(year) {
    const yearData = financialData[year] || {};
    const janData = yearData['1'];
    let sum = 0;
    if (janData && janData.investments) {
        for (const bank in janData.investments) {
            const item = janData.investments[bank];
            if (bank === 'outros') {
                for (const asset in item) {
                    sum += (item[asset].saldo || 0);
                }
            } else {
                sum += (item.cdb || 0);
            }
        }
    }
    return sum;
}

// Initialize simulator data for active year
function initSimulatorData() {
    const year = selectedYear;
    const yearData = financialData[year] || {};
    
    // Default starting capital to January CDB sum
    simStartingCapital = getJanStartingCapital(year);
    const startInput = document.getElementById('sim-starting');
    if (startInput) {
        startInput.value = Math.round(simStartingCapital);
    }
    
    simMonthlyData = [];
    for (let m = 1; m <= 12; m++) {
        const mStr = m.toString();
        const mData = yearData[mStr] || {};
        
        let totalAporte = 0;
        let totalJuros = 0;
        
        if (mData.investments) {
            for (const bank in mData.investments) {
                const item = mData.investments[bank];
                if (bank === 'outros') {
                    for (const asset in item) {
                        totalAporte += (item[asset].aporte || 0);
                        totalJuros += (item[asset].juros || 0);
                    }
                } else {
                    totalAporte += (item.aporte || 0);
                    totalJuros += (item.juros || 0);
                }
            }
        }
        
        simMonthlyData.push({
            month: m,
            name: monthNames[m - 1],
            aporte: totalAporte,
            juros: totalJuros
        });
    }
    
    renderSimulatorInputs();
    calculateProjection();
}

// Render dynamic input table inside the simulator
function renderSimulatorInputs() {
    const container = document.getElementById('sim-months-inputs');
    if (!container) return;
    
    container.innerHTML = '';
    
    simMonthlyData.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // Month Name column
        const tdName = document.createElement('td');
        tdName.textContent = item.name;
        tr.appendChild(tdName);
        
        // Aporte Input column
        const tdAporte = document.createElement('td');
        const inputAporte = document.createElement('input');
        inputAporte.type = 'number';
        inputAporte.className = 'sim-input';
        inputAporte.id = `sim-aporte-input-${index}`;
        inputAporte.value = item.aporte === 0 ? '' : item.aporte.toFixed(2);
        inputAporte.placeholder = '0.00';
        inputAporte.addEventListener('input', (e) => {
            simMonthlyData[index].aporte = parseFloat(e.target.value) || 0;
            calculateProjection();
        });
        tdAporte.appendChild(inputAporte);
        tr.appendChild(tdAporte);
        
        // Juros Input column
        const tdJuros = document.createElement('td');
        const inputJuros = document.createElement('input');
        inputJuros.type = 'number';
        inputJuros.className = 'sim-input';
        inputJuros.id = `sim-juros-input-${index}`;
        inputJuros.value = item.juros === 0 ? '' : item.juros.toFixed(2);
        inputJuros.placeholder = '0.00';
        inputJuros.addEventListener('input', (e) => {
            simMonthlyData[index].juros = parseFloat(e.target.value) || 0;
            calculateProjection();
        });
        tdJuros.appendChild(inputJuros);
        tr.appendChild(tdJuros);
        
        // Total column (Aporte + Juros)
        const tdTotal = document.createElement('td');
        tdTotal.className = 'num-val';
        tdTotal.id = `sim-total-month-${index}`;
        tdTotal.style.fontWeight = '500';
        tdTotal.style.textAlign = 'right';
        tdTotal.textContent = formatBRL(item.aporte + item.juros);
        tr.appendChild(tdTotal);
        
        container.appendChild(tr);
    });
}

// Calculate compound interest projection and draw chart
function calculateProjection() {
    const startInput = document.getElementById('sim-starting');
    const P = startInput ? (parseFloat(startInput.value) || 0) : 0;
    
    const chartLabels = ["Início"];
    const previousBalances = [P];
    const monthlyAportes = [0];
    const monthlyJuros = [0];
    
    let currentTotal = P;
    let totalInvested = P;
    let totalInterest = 0;
    
    const monthlyRate = Math.pow(1 + 0.10, 1/12) - 1;
    
    simMonthlyData.forEach((item, index) => {
        let isAporteSimulated = false;
        let isJurosSimulated = false;
        
        let monthAporte = item.aporte;
        if (monthAporte === 0) {
            monthAporte = 7000.00;
            isAporteSimulated = true;
        }
        
        let monthJuros = item.juros;
        if (monthJuros === 0) {
            monthJuros = (currentTotal + monthAporte) * monthlyRate;
            isJurosSimulated = true;
        }
        
        previousBalances.push(Math.round(currentTotal));
        monthlyAportes.push(Math.round(monthAporte));
        monthlyJuros.push(Math.round(monthJuros));
        
        currentTotal += monthAporte + monthJuros;
        totalInvested += monthAporte;
        totalInterest += monthJuros;
        
        chartLabels.push(item.name.substring(0, 3));
        
        // Update elements in-place to avoid losing input focus
        const inputAporte = document.getElementById(`sim-aporte-input-${index}`);
        if (inputAporte) {
            if (item.aporte === 0) {
                inputAporte.placeholder = '7000.00';
                inputAporte.classList.add('simulated-placeholder');
            } else {
                inputAporte.placeholder = '0.00';
                inputAporte.classList.remove('simulated-placeholder');
            }
        }
        
        const inputJuros = document.getElementById(`sim-juros-input-${index}`);
        if (inputJuros) {
            if (item.juros === 0) {
                inputJuros.placeholder = monthJuros.toFixed(2);
                inputJuros.classList.add('simulated-placeholder');
            } else {
                inputJuros.placeholder = '0.00';
                inputJuros.classList.remove('simulated-placeholder');
            }
        }
        
        const tdTotal = document.getElementById(`sim-total-month-${index}`);
        if (tdTotal) {
            const formattedVal = formatBRL(monthAporte + monthJuros);
            const isAnySimulated = isAporteSimulated || isJurosSimulated;
            tdTotal.textContent = isAnySimulated ? `${formattedVal} *` : formattedVal;
            if (isAnySimulated) {
                tdTotal.classList.add('simulated-total');
            } else {
                tdTotal.classList.remove('simulated-total');
            }
        }
    });
    
    // Update KPI metrics
    document.getElementById('sim-result-starting').textContent = formatBRL(P);
    document.getElementById('sim-result-invested').textContent = formatBRL(totalInvested - P);
    document.getElementById('sim-result-juros').textContent = formatBRL(totalInterest);
    document.getElementById('sim-result-final').textContent = formatBRL(currentTotal);
    
    // Draw Projection Chart
    if (chartProjection) chartProjection.destroy();
    
    const ctxProj = document.getElementById('chart-projection').getContext('2d');
    chartProjection = new Chart(ctxProj, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: 'Saldo Anterior',
                    data: previousBalances,
                    backgroundColor: '#6366f1',
                    stack: 'Stack 0',
                },
                {
                    label: 'Aporte do Mês',
                    data: monthlyAportes,
                    backgroundColor: '#f59e0b',
                    stack: 'Stack 0',
                },
                {
                    label: 'Rendimento do Mês',
                    data: monthlyJuros,
                    backgroundColor: '#10b981',
                    stack: 'Stack 0',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af', font: { size: 10 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.raw !== null) {
                                label += formatBRL(context.raw);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    stacked: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', callback: val => formatBRL(val) }
                },
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            }
        }
    });
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
        const response = await fetch('/api/import-gsheet', {
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

// Render Incomes tab (Receitas)
function renderIncomesTab() {
    discoverKeys();
    const year = selectedYear;
    const yearData = financialData[year] || {};
    const latestMonth = getLatestMonthIndex(year);
    const monthsActive = latestMonth !== -1 ? latestMonth : 12;

    // Calculate total income, average income, highest income, and average savings rate
    let totalIncomeYear = 0;
    let highestIncomeVal = 0;
    let highestIncomeMonthName = 'N/A';
    
    // For savings rate calculation
    let totalSavingsRate = 0;
    let activeMonthsWithIncomeCount = 0;
    
    const monthlyIncomeData = {}; // key -> array of 12 values
    incomeKeys.forEach(k => { monthlyIncomeData[k] = Array(12).fill(0); });
    
    for (let m = 1; m <= monthsActive; m++) {
        const mStr = m.toString();
        const mData = yearData[mStr];
        
        if (mData) {
            let mIncome = 0;
            incomeKeys.forEach(k => {
                const val = mData.incomes?.[k] || 0;
                monthlyIncomeData[k][m - 1] = val;
                mIncome += val;
            });
            
            totalIncomeYear += mIncome;
            if (mIncome > highestIncomeVal) {
                highestIncomeVal = mIncome;
                highestIncomeMonthName = monthNames[m - 1];
            }
            
            // Calculate monthly savings rate: (income - expenses) / income
            const fixedExp = Object.values(mData.expenses?.fixed || {}).reduce((acc, v) => acc + v, 0);
            const cardExp = Object.values(mData.expenses?.cards || {}).reduce((acc, v) => acc + v, 0);
            const totalExp = fixedExp + cardExp;
            
            if (mIncome > 0) {
                const monthlySavings = mIncome - totalExp;
                totalSavingsRate += (monthlySavings / mIncome) * 100;
                activeMonthsWithIncomeCount++;
            }
        }
    }
    
    const avgIncome = activeMonthsWithIncomeCount > 0 ? (totalIncomeYear / activeMonthsWithIncomeCount) : 0;
    const avgSavingsRate = activeMonthsWithIncomeCount > 0 ? (totalSavingsRate / activeMonthsWithIncomeCount) : 0;
    
    // Calculate Monthly Salary and Rent for the selected reference month
    let monthSalaryVal = 0;
    let monthRentVal = 0;
    const refMonthStr = selectedMonth || latestMonth.toString();
    const refMonthData = yearData[refMonthStr];
    
    if (refMonthData && refMonthData.incomes) {
        const sal15 = refMonthData.incomes['salario_dia_15'] || 0;
        const sal30 = refMonthData.incomes['salario_dia_30'] || 0;
        const sal = refMonthData.incomes['salario'] || 0;
        monthSalaryVal = (sal15 || sal30) ? (sal15 + sal30) : sal;
        monthRentVal = refMonthData.incomes['aluguel'] || 0;
    }
    const refMonthName = monthNames[parseInt(refMonthStr) - 1] || 'N/A';

    // Set KPI Text
    document.getElementById('kpi-inc-total').textContent = formatBRL(totalIncomeYear);
    document.getElementById('kpi-inc-total-desc').innerHTML = `<i class="fa-solid fa-calendar-days"></i> Acumulado em ${selectedYear}`;
    
    // Receita Do Mês
    const monthTotalIncome = monthSalaryVal + monthRentVal;
    document.getElementById('kpi-inc-month-total').textContent = formatBRL(monthTotalIncome);
    document.getElementById('kpi-inc-month-total-desc').innerHTML = `<i class="fa-solid fa-clock"></i> Referente a ${refMonthName}`;
    
    document.getElementById('kpi-inc-salary-month').textContent = formatBRL(monthSalaryVal);
    document.getElementById('kpi-inc-salary-month-desc').innerHTML = `<i class="fa-solid fa-clock"></i> Referente a ${refMonthName}`;
    
    document.getElementById('kpi-inc-rent-month').textContent = formatBRL(monthRentVal);
    document.getElementById('kpi-inc-rent-month-desc').innerHTML = `<i class="fa-solid fa-clock"></i> Referente a ${refMonthName}`;
    
    // Render Evolution Chart (Stacked Bar)
    if (chartIncEvolution) chartIncEvolution.destroy();
    
    const ctxEvolution = document.getElementById('chart-inc-evolution').getContext('2d');
    const datasets = incomeKeys.map((key, index) => {
        const colors = ['#10b981', '#3b82f6', '#fbbf24', '#ec4899', '#8b5cf6'];
        return {
            label: formatLabel(key),
            data: monthlyIncomeData[key].slice(0, monthsActive),
            backgroundColor: colors[index % colors.length],
            borderRadius: 4
        };
    });
    
    chartIncEvolution = new Chart(ctxEvolution, {
        type: 'bar',
        data: {
            labels: monthNames.slice(0, monthsActive),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af' } }
            },
            scales: {
                y: {
                    stacked: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', callback: val => formatBRL(val) }
                },
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            }
        }
    });
    
    // Render Composition Chart (Doughnut)
    if (chartIncComposition) chartIncComposition.destroy();
    
    const compositionData = incomeKeys.map(key => {
        return monthlyIncomeData[key].reduce((acc, v) => acc + v, 0);
    });
    
    const ctxComposition = document.getElementById('chart-inc-composition').getContext('2d');
    chartIncComposition = new Chart(ctxComposition, {
        type: 'doughnut',
        data: {
            labels: incomeKeys.map(k => formatLabel(k)),
            datasets: [{
                data: compositionData.every(v => v === 0) ? [1] : compositionData,
                backgroundColor: ['#10b981', '#3b82f6', '#fbbf24', '#ec4899', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } }
            },
            cutout: '70%'
        }
    });
    
    // Render Table
    const tableEl = document.getElementById('table-inc-details');
    tableEl.innerHTML = '';
    
    const thead = document.createElement('thead');
    let headHtml = `<tr><th>Mês</th>`;
    
    // Custom column headers for 2026
    const colsToRender = [];
    if (year === '2026') {
        colsToRender.push({ key: 'salario_dia_15', label: 'Salário Dia 15' });
        colsToRender.push({ key: 'salario_dia_30', label: 'Salário Dia 30' });
        colsToRender.push({ key: 'somatorio_salario', label: 'Somatório Salário', isVirtual: true });
        colsToRender.push({ key: 'aluguel', label: 'Aluguel Recebido' });
        colsToRender.push({ key: 'extra', label: 'Extra / Outros' });
    } else {
        incomeKeys.forEach(k => {
            colsToRender.push({ key: k, label: formatLabel(k) });
        });
    }
    
    colsToRender.forEach(col => {
        headHtml += `<th>${col.label}</th>`;
    });
    headHtml += `<th>Total Mensal</th></tr>`;
    thead.innerHTML = headHtml;
    tableEl.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    const columnTotals = {};
    colsToRender.forEach(col => { columnTotals[col.key] = 0; });
    let grandTotal = 0;
    
    for (let m = 1; m <= monthsActive; m++) {
        const tr = document.createElement('tr');
        let rowHtml = `<td>${monthNames[m - 1]}</td>`;
        let mTotal = 0;
        
        colsToRender.forEach(col => {
            let val = 0;
            if (col.isVirtual && col.key === 'somatorio_salario') {
                val = (monthlyIncomeData['salario_dia_15']?.[m - 1] || 0) + (monthlyIncomeData['salario_dia_30']?.[m - 1] || 0);
            } else {
                val = monthlyIncomeData[col.key]?.[m - 1] || 0;
                mTotal += val; // only sum non-virtual columns
            }
            rowHtml += `<td class="num-val">${formatBRL(val)}</td>`;
            columnTotals[col.key] += val;
        });
        
        rowHtml += `<td class="num-val" style="font-weight: 600;">${formatBRL(mTotal)}</td>`;
        grandTotal += mTotal;
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    }
    
    // Append Anual Total Row
    const trTot = document.createElement('tr');
    trTot.className = 'total-row';
    let totHtml = `<td>TOTAL ANUAL</td>`;
    colsToRender.forEach(col => {
        totHtml += `<td class="num-val">${formatBRL(columnTotals[col.key])}</td>`;
    });
    totHtml += `<td class="num-val">${formatBRL(grandTotal)}</td>`;
    trTot.innerHTML = totHtml;
    tbody.appendChild(trTot);
    
    tableEl.appendChild(tbody);
}

// Render Fixed Expenses tab (Gastos Fixos)
function renderFixedExpensesTab() {
    discoverKeys();
    const year = selectedYear;
    const yearData = financialData[year] || {};
    const latestMonth = getLatestMonthIndex(year);
    const monthsActive = latestMonth !== -1 ? latestMonth : 12;

    let totalFixedYear = 0;
    let highestFixedVal = 0;
    let highestFixedMonthName = 'N/A';
    
    const monthlyFixedData = {}; // key -> array of 12 values
    fixedExpenseKeys.forEach(k => { monthlyFixedData[k] = Array(12).fill(0); });
    
    for (let m = 1; m <= monthsActive; m++) {
        const mStr = m.toString();
        const mData = yearData[mStr];
        
        if (mData) {
            let mFixed = 0;
            fixedExpenseKeys.forEach(k => {
                const val = mData.expenses?.fixed?.[k] || 0;
                monthlyFixedData[k][m - 1] = val;
                mFixed += val;
            });
            
            totalFixedYear += mFixed;
            if (mFixed > highestFixedVal) {
                highestFixedVal = mFixed;
                highestFixedMonthName = monthNames[m - 1];
            }
        }
    }
    
    const avgFixed = monthsActive > 0 ? (totalFixedYear / monthsActive) : 0;

    // Calculate values for the selected reference month
    let monthFixedTotal = 0;
    let monthHighestFixedVal = 0;
    let monthHighestFixedName = 'N/A';
    
    const refMonthStr = selectedMonth || latestMonth.toString();
    const refMonthData = yearData[refMonthStr];
    
    if (refMonthData && refMonthData.expenses?.fixed) {
        for (const [key, val] of Object.entries(refMonthData.expenses.fixed)) {
            const expenseVal = parseFloat(val) || 0;
            monthFixedTotal += expenseVal;
            if (expenseVal > monthHighestFixedVal) {
                monthHighestFixedVal = expenseVal;
                monthHighestFixedName = formatLabel(key);
            }
        }
    }
    const refMonthName = monthNames[parseInt(refMonthStr) - 1] || 'N/A';
    
    // Set KPI Text
    document.getElementById('kpi-fixed-total').textContent = formatBRL(totalFixedYear);
    document.getElementById('kpi-fixed-total-desc').innerHTML = `<i class="fa-solid fa-calendar-days"></i> Acumulado em ${selectedYear}`;
    
    // Total dos Gastos do mês
    document.getElementById('kpi-fixed-month-total').textContent = formatBRL(monthFixedTotal);
    document.getElementById('kpi-fixed-month-total-desc').innerHTML = `<i class="fa-solid fa-clock"></i> Referente a ${refMonthName}`;
    
    // Maior Gasto do Mês
    document.getElementById('kpi-fixed-month-highest').textContent = formatBRL(monthHighestFixedVal);
    document.getElementById('kpi-fixed-month-highest-desc').innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${monthHighestFixedName} em ${refMonthName}`;
    
    // Média Mensal
    document.getElementById('kpi-fixed-average').textContent = formatBRL(avgFixed);
    document.getElementById('kpi-fixed-average-desc').textContent = `Média mensal nos meses ativos`;
    
    // Render Evolution Chart (Stacked Bar)
    if (chartFixedEvolution) chartFixedEvolution.destroy();
    
    const ctxFixedEvolution = document.getElementById('chart-fixed-evolution').getContext('2d');
    const datasetsFixed = fixedExpenseKeys.map((key, index) => {
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f43f5e'];
        return {
            label: formatLabel(key),
            data: monthlyFixedData[key].slice(0, monthsActive),
            backgroundColor: colors[index % colors.length],
            borderRadius: 4
        };
    });
    
    chartFixedEvolution = new Chart(ctxFixedEvolution, {
        type: 'bar',
        data: {
            labels: monthNames.slice(0, monthsActive),
            datasets: datasetsFixed
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 9 } } }
            },
            scales: {
                y: {
                    stacked: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', callback: val => formatBRL(val) }
                },
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            }
        }
    });
    
    // Render Distribution Chart (Doughnut)
    if (chartFixedDistribution) chartFixedDistribution.destroy();
    
    const compositionFixedData = fixedExpenseKeys.map(key => {
        return monthlyFixedData[key].reduce((acc, v) => acc + v, 0);
    });
    
    const ctxFixedDistribution = document.getElementById('chart-fixed-distribution').getContext('2d');
    chartFixedDistribution = new Chart(ctxFixedDistribution, {
        type: 'doughnut',
        data: {
            labels: fixedExpenseKeys.map(k => formatLabel(k)),
            datasets: [{
                data: compositionFixedData.every(v => v === 0) ? [1] : compositionFixedData,
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f43f5e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 9 } } }
            },
            cutout: '70%'
        }
    });
    
    // Render Table
    const tableEl = document.getElementById('table-fixed-details');
    tableEl.innerHTML = '';
    
    const thead = document.createElement('thead');
    let headHtml = `<tr><th>Mês</th>`;
    fixedExpenseKeys.forEach(k => { headHtml += `<th>${formatLabel(k)}</th>`; });
    headHtml += `<th>Total Mensal</th></tr>`;
    thead.innerHTML = headHtml;
    tableEl.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    const annualTotals = {};
    fixedExpenseKeys.forEach(k => { annualTotals[k] = 0; });
    let grandTotal = 0;
    
    for (let m = 1; m <= monthsActive; m++) {
        const tr = document.createElement('tr');
        let rowHtml = `<td>${monthNames[m - 1]}</td>`;
        let mTotal = 0;
        
        fixedExpenseKeys.forEach(k => {
            const val = monthlyFixedData[k][m - 1];
            rowHtml += `<td class="num-val">${formatBRL(val)}</td>`;
            annualTotals[k] += val;
            mTotal += val;
        });
        
        rowHtml += `<td class="num-val" style="font-weight: 600;">${formatBRL(mTotal)}</td>`;
        grandTotal += mTotal;
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    }
    
    // Append Anual Total Row
    const trTot = document.createElement('tr');
    trTot.className = 'total-row';
    let totHtml = `<td>TOTAL ANUAL</td>`;
    fixedExpenseKeys.forEach(k => {
        totHtml += `<td class="num-val">${formatBRL(annualTotals[k])}</td>`;
    });
    totHtml += `<td class="num-val">${formatBRL(grandTotal)}</td>`;
    trTot.innerHTML = totHtml;
    tbody.appendChild(trTot);
    
    tableEl.appendChild(tbody);
}

// Render Card Expenses tab (Gastos com Cartão)
function renderCardExpensesTab() {
    discoverKeys();
    const year = selectedYear;
    const yearData = financialData[year] || {};
    const latestMonth = getLatestMonthIndex(year);
    const monthsActive = latestMonth !== -1 ? latestMonth : 12;

    let totalCardYear = 0;
    let highestCardVal = 0;
    let highestCardMonthName = 'N/A';
    
    const monthlyCardData = {}; // key -> array of 12 values
    cardExpenseKeys.forEach(k => { monthlyCardData[k] = Array(12).fill(0); });
    
    for (let m = 1; m <= monthsActive; m++) {
        const mStr = m.toString();
        const mData = yearData[mStr];
        
        if (mData) {
            let mCard = 0;
            cardExpenseKeys.forEach(k => {
                const val = mData.expenses?.cards?.[k] || 0;
                monthlyCardData[k][m - 1] = val;
                mCard += val;
            });
            
            totalCardYear += mCard;
            if (mCard > highestCardVal) {
                highestCardVal = mCard;
                highestCardMonthName = monthNames[m - 1];
            }
        }
    }
    
    const avgCard = monthsActive > 0 ? (totalCardYear / monthsActive) : 0;
    
    // Set KPI Text
    document.getElementById('kpi-card-total').textContent = formatBRL(totalCardYear);
    document.getElementById('kpi-card-total-desc').innerHTML = `<i class="fa-solid fa-calendar-days"></i> Acumulado em ${selectedYear}`;
    
    // Calculate values for the selected reference month
    const refMonthStr = selectedMonth || (latestMonth !== -1 ? latestMonth.toString() : "1");
    const refMonthData = yearData[refMonthStr];
    const refMonthName = monthNames[parseInt(refMonthStr) - 1] || 'N/A';
    
    let itauVal = 0;
    let c6Val = 0;
    let bbVal = 0;
    
    if (refMonthData && refMonthData.expenses?.cards) {
        itauVal = parseFloat(refMonthData.expenses.cards['mastercard_itau']) || 0;
        c6Val = parseFloat(refMonthData.expenses.cards['visa_c6']) || 0;
        bbVal = parseFloat(refMonthData.expenses.cards['elo_bb']) || 0;
    }
    const monthCardsTotal = itauVal + c6Val + bbVal;
    
    // Set Mastercard Itaú month value
    const itauEl = document.getElementById('kpi-card-itau-month');
    const itauDescEl = document.getElementById('kpi-card-itau-month-desc');
    if (itauEl) itauEl.textContent = formatBRL(itauVal);
    if (itauDescEl) itauDescEl.innerHTML = `<i class="fa-solid fa-clock"></i> Fatura de ${refMonthName}`;
    
    // Set C6 Visa month value
    const c6El = document.getElementById('kpi-card-c6-month');
    const c6DescEl = document.getElementById('kpi-card-c6-month-desc');
    if (c6El) c6El.textContent = formatBRL(c6Val);
    if (c6DescEl) c6DescEl.innerHTML = `<i class="fa-solid fa-clock"></i> Fatura de ${refMonthName}`;
    
    // Set BB Elo month value
    const bbEl = document.getElementById('kpi-card-bb-month');
    const bbDescEl = document.getElementById('kpi-card-bb-month-desc');
    if (bbEl) bbEl.textContent = formatBRL(bbVal);
    if (bbDescEl) bbDescEl.innerHTML = `<i class="fa-solid fa-clock"></i> Fatura de ${refMonthName}`;
    
    // Set Total Monthly Cards value
    const totalMonthEl = document.getElementById('kpi-card-month-total');
    const totalMonthDescEl = document.getElementById('kpi-card-month-total-desc');
    if (totalMonthEl) totalMonthEl.textContent = formatBRL(monthCardsTotal);
    if (totalMonthDescEl) totalMonthDescEl.innerHTML = `<i class="fa-solid fa-calculator"></i> Somatório de ${refMonthName}`;

    
    // Render Evolution Chart (Grouped Bars)
    if (chartCardEvolution) chartCardEvolution.destroy();
    
    const ctxCardEvolution = document.getElementById('chart-card-evolution').getContext('2d');
    const datasetsCard = cardExpenseKeys.map((key, index) => {
        const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'];
        return {
            label: formatLabel(key),
            data: monthlyCardData[key].slice(0, monthsActive),
            backgroundColor: colors[index % colors.length],
            borderRadius: 4
        };
    });
    
    chartCardEvolution = new Chart(ctxCardEvolution, {
        type: 'bar',
        data: {
            labels: monthNames.slice(0, monthsActive),
            datasets: datasetsCard
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af' } }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', callback: val => formatBRL(val) }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                }
            }
        }
    });
    
    // Render Distribution Chart (Doughnut)
    if (chartCardDistribution) chartCardDistribution.destroy();
    
    const compositionCardData = cardExpenseKeys.map(key => {
        return monthlyCardData[key].reduce((acc, v) => acc + v, 0);
    });
    
    const ctxCardDistribution = document.getElementById('chart-card-distribution').getContext('2d');
    chartCardDistribution = new Chart(ctxCardDistribution, {
        type: 'doughnut',
        data: {
            labels: cardExpenseKeys.map(k => formatLabel(k)),
            datasets: [{
                data: compositionCardData.every(v => v === 0) ? [1] : compositionCardData,
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 10 } } }
            },
            cutout: '70%'
        }
    });
    
    // Render Table
    const tableEl = document.getElementById('table-card-details');
    tableEl.innerHTML = '';
    
    const thead = document.createElement('thead');
    let headHtml = `<tr><th>Mês</th>`;
    cardExpenseKeys.forEach(k => { headHtml += `<th>${formatLabel(k)}</th>`; });
    headHtml += `<th>Total Mensal</th></tr>`;
    thead.innerHTML = headHtml;
    tableEl.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    const annualTotals = {};
    cardExpenseKeys.forEach(k => { annualTotals[k] = 0; });
    let grandTotal = 0;
    
    for (let m = 1; m <= monthsActive; m++) {
        const tr = document.createElement('tr');
        let rowHtml = `<td>${monthNames[m - 1]}</td>`;
        let mTotal = 0;
        
        cardExpenseKeys.forEach(k => {
            const val = monthlyCardData[k][m - 1];
            rowHtml += `<td class="num-val">${formatBRL(val)}</td>`;
            annualTotals[k] += val;
            mTotal += val;
        });
        
        rowHtml += `<td class="num-val" style="font-weight: 600;">${formatBRL(mTotal)}</td>`;
        grandTotal += mTotal;
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    }
    
    // Append Anual Total Row
    const trTot = document.createElement('tr');
    trTot.className = 'total-row';
    let totHtml = `<td>TOTAL ANUAL</td>`;
    cardExpenseKeys.forEach(k => {
        totHtml += `<td class="num-val">${formatBRL(annualTotals[k])}</td>`;
    });
    totHtml += `<td class="num-val">${formatBRL(grandTotal)}</td>`;
    trTot.innerHTML = totHtml;
    tbody.appendChild(trTot);
    
    tableEl.appendChild(tbody);
}

// ==========================================
// ADVANCED SIMULATOR (SIMULADOR PRO) LOGIC
// ==========================================

let advSimInitialized = false;

function initAdvSimulator() {
    if (advSimInitialized) {
        // Just recalculate and update if already initialized
        calculateAdvProjection();
        return;
    }
    
    // Set starting capital to January CDB sum if available
    const currentYear = selectedYear;
    const currentStartingCapital = getJanStartingCapital(currentYear);
    if (currentStartingCapital > 0) {
        document.getElementById('adv-sim-starting').value = Math.round(currentStartingCapital);
    }
    
    // Bind slider values displays
    const sliders = [
        { id: 'adv-sim-years', valId: 'adv-sim-years-val', suffix: ' anos' },
        { id: 'adv-sim-rate', valId: 'adv-sim-rate-val', suffix: '%' },
        { id: 'adv-sim-inflation', valId: 'adv-sim-inflation-val', suffix: '%' },
        { id: 'adv-sim-increase', valId: 'adv-sim-increase-val', suffix: '%' },
        { id: 'adv-sim-swr', valId: 'adv-sim-swr-val', suffix: '% ao ano' }
    ];
    
    sliders.forEach(s => {
        const sliderEl = document.getElementById(s.id);
        const valEl = document.getElementById(s.valId);
        if (sliderEl && valEl) {
            sliderEl.addEventListener('input', (e) => {
                valEl.textContent = e.target.value + s.suffix;
                calculateAdvProjection();
            });
        }
    });
    
    // Bind other inputs to trigger updates
    const inputs = [
        'adv-sim-starting',
        'adv-sim-monthly',
        'adv-sim-bonus',
        'adv-sim-oneoff',
        'adv-sim-oneoff-year',
        'adv-sim-target-wealth',
        'adv-sim-target-income'
    ];
    
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => calculateAdvProjection());
        }
    });
    
    // Bind Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const preset = e.currentTarget.getAttribute('data-preset');
            const rateSlider = document.getElementById('adv-sim-rate');
            const inflationSlider = document.getElementById('adv-sim-inflation');
            
            if (preset === 'saving') {
                rateSlider.value = 6.0;
                inflationSlider.value = 4.5;
            } else if (preset === 'fixed') {
                rateSlider.value = 10.5;
                inflationSlider.value = 4.5;
            } else if (preset === 'equity') {
                rateSlider.value = 13.0;
                inflationSlider.value = 4.5;
            } else if (preset === 'real') {
                rateSlider.value = 6.0;
                inflationSlider.value = 0.0;
            }
            
            // Trigger input events to update text labels and recalculate
            rateSlider.dispatchEvent(new Event('input'));
            inflationSlider.dispatchEvent(new Event('input'));
        });
    });
    
    advSimInitialized = true;
    calculateAdvProjection();
}

function calculateAdvProjection() {
    // 1. Get inputs
    const initialCapital = parseFloat(document.getElementById('adv-sim-starting').value) || 0;
    const initialMonthly = parseFloat(document.getElementById('adv-sim-monthly').value) || 0;
    const years = parseInt(document.getElementById('adv-sim-years').value) || 20;
    const annualRate = parseFloat(document.getElementById('adv-sim-rate').value) || 10.5;
    const annualInflation = parseFloat(document.getElementById('adv-sim-inflation').value) || 4.5;
    const annualIncrease = parseFloat(document.getElementById('adv-sim-increase').value) || 3.0;
    const annualBonus = parseFloat(document.getElementById('adv-sim-bonus').value) || 0;
    const oneoffAmount = parseFloat(document.getElementById('adv-sim-oneoff').value) || 0;
    const oneoffYear = parseInt(document.getElementById('adv-sim-oneoff-year').value) || 5;
    const targetWealth = parseFloat(document.getElementById('adv-sim-target-wealth').value) || 1500000;
    const targetIncome = parseFloat(document.getElementById('adv-sim-target-income').value) || 8000;
    const swr = parseFloat(document.getElementById('adv-sim-swr').value) || 4.0;
    
    // 2. Calculations setup
    const months = years * 12;
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    
    let nominalBalance = initialCapital;
    let totalInvested = initialCapital;
    
    let investedInitial = initialCapital;
    let investedMonthly = 0;
    let investedExtra = 0;
    
    let monthlyAporte = initialMonthly;
    
    const nominalHistory = [initialCapital];
    const realHistory = [initialCapital];
    const investedHistory = [initialCapital];
    const labels = ['Início'];
    
    let reachedTargetYear = -1;
    
    // Effective wealth goal target
    const requiredWealthForIncome = (targetIncome * 12) / (swr / 100);
    const effectiveTarget = Math.max(targetWealth, requiredWealthForIncome);
    
    // 3. Month by Month Loop
    for (let m = 1; m <= months; m++) {
        const yearOfSimulation = Math.ceil(m / 12);
        
        // Year transitions: grow monthly deposit
        if (m > 1 && (m - 1) % 12 === 0) {
            monthlyAporte = monthlyAporte * (1 + annualIncrease / 100);
        }
        
        let extraThisMonth = 0;
        
        // Annual recurring bonus (Dec)
        if (m % 12 === 0) {
            extraThisMonth += annualBonus;
            investedExtra += annualBonus;
        }
        
        // One-off contribution
        if (yearOfSimulation === oneoffYear && (m - 1) % 12 === 0) {
            extraThisMonth += oneoffAmount;
            investedExtra += oneoffAmount;
        }
        
        const currentAporte = monthlyAporte + extraThisMonth;
        investedMonthly += (currentAporte - extraThisMonth);
        totalInvested += currentAporte;
        
        // Compounding
        nominalBalance = (nominalBalance + currentAporte) * (1 + monthlyRate);
        
        // If year end, save history
        if (m % 12 === 0) {
            const y = m / 12;
            labels.push(`Ano ${y}`);
            nominalHistory.push(nominalBalance);
            investedHistory.push(totalInvested);
            
            // Discount for inflation to get real value (today's purchasing power)
            const realBalance = nominalBalance / Math.pow(1 + annualInflation / 100, y);
            realHistory.push(realBalance);
            
            if (reachedTargetYear === -1 && realBalance >= effectiveTarget) {
                reachedTargetYear = y;
            }
        }
    }
    
    const finalNominal = nominalBalance;
    const finalReal = finalNominal / Math.pow(1 + annualInflation / 100, years);
    const totalInterest = finalNominal - totalInvested;
    const passiveIncomeReal = (finalReal * (swr / 100)) / 12;
    
    // 4. Bind Results to UI
    document.getElementById('adv-result-gross').textContent = formatBRL(finalNominal);
    document.getElementById('adv-result-real').textContent = formatBRL(finalReal);
    document.getElementById('adv-result-invested').textContent = formatBRL(totalInvested);
    document.getElementById('adv-result-interest').textContent = formatBRL(totalInterest);
    document.getElementById('adv-result-passive-income').textContent = formatBRL(passiveIncomeReal);
    
    const investedPct = finalNominal > 0 ? Math.round((totalInvested / finalNominal) * 100) : 0;
    const interestPct = finalNominal > 0 ? 100 - investedPct : 0;
    
    document.getElementById('adv-result-invested-pct').textContent = `${investedPct}% do total`;
    document.getElementById('adv-result-interest-pct').textContent = `${interestPct}% do total`;
    document.getElementById('adv-result-passive-desc').textContent = `Equivale a ${swr.toFixed(1)}% a.a. sobre o patrimônio real`;
    
    // Goal status indicator
    const goalStatusEl = document.getElementById('adv-goal-status');
    if (goalStatusEl) {
        if (reachedTargetYear !== -1) {
            goalStatusEl.className = 'goal-status-box success';
            goalStatusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Meta atingida no Ano ${reachedTargetYear}!`;
        } else {
            goalStatusEl.className = 'goal-status-box warning';
            const missing = effectiveTarget - finalReal;
            if (missing > 0) {
                goalStatusEl.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Falta ${formatBRL(missing)} para a meta`;
            } else {
                goalStatusEl.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Meta não atingida no prazo`;
            }
        }
    }
    
    // 5. Update text summary
    const summaryEl = document.getElementById('adv-sim-text-summary');
    if (summaryEl) {
        let text = `<p>Ao final de <strong>${years} anos</strong>, seu patrimônio bruto acumulado será de <strong>${formatBRL(finalNominal)}</strong>.</p>`;
        text += `<p>Descontando a inflação anual estimada em <strong>${annualInflation.toFixed(1)}%</strong>, o poder de compra real deste valor equivale a <strong>${formatBRL(finalReal)}</strong> em dinheiro de hoje.</p>`;
        text += `<p>Você terá desembolsado o total de <strong>${formatBRL(totalInvested)}</strong> em aportes, e os juros compostos sozinhos geraram <strong>${formatBRL(totalInterest)}</strong> (${interestPct}% do saldo final).</p>`;
        
        if (reachedTargetYear !== -1) {
            text += `<p class="text-green" style="font-weight: 600; margin-top: 10px;"><i class="fa-solid fa-thumbs-up"></i> Parabéns! Você atingirá seu objetivo de independência financeira (${formatBRL(effectiveTarget)}) no <strong>Ano ${reachedTargetYear}</strong> da simulação.</p>`;
        } else {
            const timeToGoal = Math.round(Math.log(effectiveTarget / (initialCapital || 1)) / Math.log(1 + (annualRate - annualInflation)/100));
            if (timeToGoal > 0 && timeToGoal < 100) {
                text += `<p class="text-gold" style="font-weight: 500; margin-top: 10px;"><i class="fa-solid fa-circle-info"></i> Com as taxas e aportes atuais, estima-se que você precisará de aproximadamente <strong>${timeToGoal} anos</strong> de acumulação real para atingir o objetivo financeiro.</p>`;
            } else {
                text += `<p class="text-gold" style="font-weight: 500; margin-top: 10px;"><i class="fa-solid fa-circle-info"></i> Considere aumentar o valor dos aportes mensais ou a taxa anual de retorno para acelerar a independência financeira.</p>`;
            }
        }
        summaryEl.innerHTML = text;
    }
    
    // 6. Render Line Chart
    if (chartAdvProjection) chartAdvProjection.destroy();
    
    const ctxProjection = document.getElementById('chart-adv-projection').getContext('2d');
    chartAdvProjection = new Chart(ctxProjection, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Patrimônio Bruto (Nominal)',
                    data: nominalHistory,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.05)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1,
                    pointRadius: years <= 20 ? 3 : 0
                },
                {
                    label: 'Patrimônio Real (Poder de Compra)',
                    data: realHistory,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1,
                    pointRadius: years <= 20 ? 3 : 0
                },
                {
                    label: 'Total Investido (Principal)',
                    data: investedHistory,
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9ca3af', font: { family: 'Inter', size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatBRL(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 10 },
                        callback: function(value) {
                            if (value >= 1e6) return 'R$ ' + (value / 1e6).toFixed(1) + 'M';
                            if (value >= 1e3) return 'R$ ' + (value / 1e3).toFixed(0) + 'k';
                            return 'R$ ' + value;
                        }
                    }
                }
            }
        }
    });
    
    // 7. Render Doughnut Chart
    if (chartAdvBreakdown) chartAdvBreakdown.destroy();
    
    const ctxBreakdown = document.getElementById('chart-adv-breakdown').getContext('2d');
    chartAdvBreakdown = new Chart(ctxBreakdown, {
        type: 'doughnut',
        data: {
            labels: ['Capital Inicial', 'Aportes Mensais', 'Aportes Extras', 'Juros Compostos'],
            datasets: [
                {
                    data: [investedInitial, investedMonthly, investedExtra, totalInterest],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                            return context.label + ': ' + formatBRL(val) + ' (' + pct + '%)';
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// ==========================================
// VISÃO RÁPIDA (CONFRONTO DE CONTAS) LOGIC
// ==========================================

function renderQuickView() {
    discoverKeys();
    const year = selectedYear;
    const yearData = financialData[year] || {};
    const latestActiveMonth = getLatestMonthIndex(year);
    const selectedMonthIndex = parseInt(selectedMonth) || (latestActiveMonth !== -1 ? latestActiveMonth : 1);
    
    // Arrays for history/evolution charts
    const monthlyIncome = Array(12).fill(0);
    const monthlyExpenses = Array(12).fill(0);
    const monthlyAportes = Array(12).fill(0);
    const monthlyYields = Array(12).fill(0);
    
    // Fill monthly data
    for (let m = 1; m <= 12; m++) {
        const mStr = m.toString();
        const mData = yearData[mStr];
        if (mData) {
            // Income
            const inc = Object.values(mData.incomes || {}).reduce((acc, v) => acc + v, 0);
            monthlyIncome[m - 1] = inc;
            
            // Expenses
            const fixed = Object.values(mData.expenses?.fixed || {}).reduce((acc, v) => acc + v, 0);
            const cards = Object.values(mData.expenses?.cards || {}).reduce((acc, v) => acc + v, 0);
            monthlyExpenses[m - 1] = fixed + cards;
            
            // Aportes & Yields
            let ap = 0;
            let yld = 0;
            if (mData.investments) {
                for (const bank in mData.investments) {
                    const item = mData.investments[bank];
                    if (bank === 'outros') {
                        for (const asset in item) {
                            ap += (item[asset].aporte || 0);
                            yld += (item[asset].juros || 0);
                        }
                    } else {
                        ap += (item.aporte || 0);
                        yld += (item.juros || 0);
                    }
                }
            }
            monthlyAportes[m - 1] = ap;
            monthlyYields[m - 1] = yld;
        }
    }
    
    const activeMonthsCount = latestActiveMonth !== -1 ? latestActiveMonth : 12;
    
    // Selected Month Metrics
    const selIncome = monthlyIncome[selectedMonthIndex - 1];
    const selExpense = monthlyExpenses[selectedMonthIndex - 1];
    const selAporte = monthlyAportes[selectedMonthIndex - 1];
    const selYield = monthlyYields[selectedMonthIndex - 1];
    const selNetFlow = selIncome - selExpense - selAporte;
    const selSavingsRate = selIncome > 0 ? (selAporte / selIncome) * 100 : 0;
    
    const refMonthName = monthNames[selectedMonthIndex - 1];
    
    // Render KPIs
    document.getElementById('kpi-quick-income').textContent = formatBRL(selIncome);
    document.getElementById('kpi-quick-income-desc').innerHTML = `<i class="fa-solid fa-clock"></i> Entradas em ${refMonthName}`;
    
    document.getElementById('kpi-quick-expenses').textContent = formatBRL(selExpense);
    document.getElementById('kpi-quick-expenses-desc').innerHTML = `<i class="fa-solid fa-clock"></i> Saídas em ${refMonthName}`;
    
    document.getElementById('kpi-quick-aporte').textContent = formatBRL(selAporte);
    document.getElementById('kpi-quick-aporte-desc').innerHTML = `<i class="fa-solid fa-clock"></i> Investido em ${refMonthName}`;
    
    document.getElementById('kpi-quick-yield').textContent = formatBRL(selYield);
    document.getElementById('kpi-quick-yield-desc').innerHTML = `<i class="fa-solid fa-chart-line"></i> Recebido em ${refMonthName}`;
    
    // Secondary Summary bar
    const netflowEl = document.getElementById('kpi-quick-net-cashflow');
    netflowEl.textContent = formatBRL(selNetFlow);
    if (selNetFlow >= 0) {
        netflowEl.className = 'positive';
    } else {
        netflowEl.className = 'negative';
    }
    
    const savingsEl = document.getElementById('kpi-quick-savings-rate');
    savingsEl.textContent = `${selSavingsRate.toFixed(1)}%`;
    if (selSavingsRate >= 30) {
        savingsEl.className = 'positive';
    } else {
        savingsEl.className = '';
    }
    
    // Render Chart 1: Bar confrontation for the selected month
    if (chartQuickConfrontation) chartQuickConfrontation.destroy();
    const ctxConfront = document.getElementById('chart-quick-confrontation').getContext('2d');
    chartQuickConfrontation = new Chart(ctxConfront, {
        type: 'bar',
        data: {
            labels: ['Receitas', 'Despesas', 'Aportes', 'Rendimento/Juros'],
            datasets: [{
                label: `Valores em ${refMonthName}`,
                data: [selIncome, selExpense, selAporte, selYield],
                backgroundColor: ['#10b981', '#ef4444', '#3b82f6', '#f59e0b'],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatBRL(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#9ca3af', font: { family: 'Inter', size: 11 } } },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 10 },
                        callback: function(value) { return formatBRL(value); }
                    }
                }
            }
        }
    });
    
    // Render Chart 2: Annual evolution curves
    if (chartQuickEvolution) chartQuickEvolution.destroy();
    const ctxEvolution = document.getElementById('chart-quick-evolution').getContext('2d');
    chartQuickEvolution = new Chart(ctxEvolution, {
        type: 'line',
        data: {
            labels: monthNames.slice(0, activeMonthsCount),
            datasets: [
                {
                    label: 'Receitas',
                    data: monthlyIncome.slice(0, activeMonthsCount),
                    borderColor: '#10b981',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Despesas',
                    data: monthlyExpenses.slice(0, activeMonthsCount),
                    borderColor: '#ef4444',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Aportes',
                    data: monthlyAportes.slice(0, activeMonthsCount),
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Rendimentos',
                    data: monthlyYields.slice(0, activeMonthsCount),
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    borderDash: [3, 3],
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9ca3af', font: { family: 'Inter', size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatBRL(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 10 },
                        callback: function(value) { return formatBRL(value); }
                    }
                }
            }
        }
    });
    
    // Render confrontation table
    const tableEl = document.getElementById('table-quick-confrontation');
    tableEl.innerHTML = '';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Mês</th>
            <th>Receita</th>
            <th>Despesa</th>
            <th>Aporte</th>
            <th>Rendimento</th>
            <th>Sobra Líquida</th>
            <th>Balanço</th>
        </tr>
    `;
    tableEl.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    let sumInc = 0;
    let sumExp = 0;
    let sumAp = 0;
    let sumYld = 0;
    let sumNet = 0;
    
    for (let m = 1; m <= activeMonthsCount; m++) {
        const inc = monthlyIncome[m - 1];
        const exp = monthlyExpenses[m - 1];
        const ap = monthlyAportes[m - 1];
        const yld = monthlyYields[m - 1];
        const net = inc - exp - ap;
        
        sumInc += inc;
        sumExp += exp;
        sumAp += ap;
        sumYld += yld;
        sumNet += net;
        
        const isCurrent = m === selectedMonthIndex;
        const tr = document.createElement('tr');
        if (isCurrent) tr.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
        
        const statusIcon = net >= 0 ? 
            `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Superávit</span>` :
            `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Déficit</span>`;
            
        tr.innerHTML = `
            <td style="font-weight: ${isCurrent ? '700' : 'normal'};">${monthNames[m - 1]}</td>
            <td class="num-val">${formatBRL(inc)}</td>
            <td class="num-val">${formatBRL(exp)}</td>
            <td class="num-val">${formatBRL(ap)}</td>
            <td class="num-val">${formatBRL(yld)}</td>
            <td class="num-val ${net >= 0 ? 'text-green' : 'num-val negative'}" style="font-weight: 600;">${formatBRL(net)}</td>
            <td style="text-align: center;">${statusIcon}</td>
        `;
        tbody.appendChild(tr);
    }
    
    // Total Row
    const trTotal = document.createElement('tr');
    trTotal.className = 'total-row';
    const totalStatus = sumNet >= 0 ?
        `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Superávit</span>` :
        `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Déficit</span>`;
        
    trTotal.innerHTML = `
        <td>TOTAL ANUAL</td>
        <td class="num-val">${formatBRL(sumInc)}</td>
        <td class="num-val">${formatBRL(sumExp)}</td>
        <td class="num-val">${formatBRL(sumAp)}</td>
        <td class="num-val">${formatBRL(sumYld)}</td>
        <td class="num-val ${sumNet >= 0 ? 'text-green' : 'num-val negative'}" style="font-weight: 700;">${formatBRL(sumNet)}</td>
        <td style="text-align: center;">${totalStatus}</td>
    `;
    tbody.appendChild(trTotal);
    
    tableEl.appendChild(tbody);
}

