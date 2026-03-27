/**
 * SEFAZ Monitor Dashboard - Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Estado da aplicação
    let currentData = [];
    let fullHistory = [];
    let currentFilter = 'all'; // Modelo (NFe, etc)
    let statusFilter = null; // Saúde (normal, lento, muito_lento, timeout)
    let searchQuery = '';
    let expandedState = 0; // 0 = initial, 1 = mid, 2 = all
    let selectedUF = 'MG';
    let selectedModel = 'NFe';
    let chartType = 'line';
    let chartViewMode = 'tempo';
    let performanceChart = null;

    const ufs = [
        'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
        'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 
        'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
    ];

    const ufNames = {
        'AC': 'Acre', 'AL': 'Alagoas', 'AM': 'Amazonas', 'AP': 'Amapá', 'BA': 'Bahia', 
        'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás', 
        'MA': 'Maranhão', 'MG': 'Minas Gerais', 'MS': 'Mato Grosso do Sul', 'MT': 'Mato Grosso', 
        'PA': 'Pará', 'PB': 'Paraíba', 'PE': 'Pernambuco', 'PI': 'Piauí', 'PR': 'Paraná', 
        'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RO': 'Rondônia', 'RR': 'Roraima', 
        'RS': 'Rio Grande do Sul', 'SC': 'Santa Catarina', 'SE': 'Sergipe', 'SP': 'São Paulo', 'TO': 'Tocantins'
    };

    // Elementos do DOM
    const statusGrid = document.getElementById('status-grid');
    const historyTableBody = document.querySelector('#history-table tbody');
    const refreshBtn = document.getElementById('refresh-btn');
    const lastUpdateSpan = document.getElementById('last-update');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const ufSelector = document.getElementById('uf-selector');
    const modelBtns = document.querySelectorAll('#model-selector .chip-btn');
    const chartTypeBtns = document.querySelectorAll('.chart-type-btn');
    const stateSearch = document.getElementById('state-search');
    const statCards = document.querySelectorAll('.stat-card');
    
    // Stats value elements
    const statNormalVal = document.querySelector('#stat-normal .stat-value');
    const statLentoVal = document.querySelector('#stat-lento .stat-value');
    const statMuitoLentoVal = document.querySelector('#stat-muito .stat-value');
    const statTimeoutVal = document.querySelector('#stat-timeout .stat-value');

    // Botão Mostrar Mais
    const showMoreContainer = document.getElementById('show-more-container');
    const showMoreBtn = document.getElementById('show-more-btn');

    function getExactStatus(tempo) {
        if (tempo <= 1000) return 'normal';
        if (tempo <= 2000) return 'lento';
        if (tempo <= 2500) return 'muito_lento';
        return 'timeout'; // 3000
    }

    /**
     * Inicializa os seletores e eventos
     */
    function initEvents() {
        // Gerar botões de UF para o gráfico
        ufs.forEach(uf => {
            const btn = document.createElement('button');
            btn.className = `chip-btn ${uf === selectedUF ? 'active' : ''}`;
            btn.textContent = uf;
            btn.dataset.uf = uf;
            btn.addEventListener('click', () => {
                document.querySelectorAll('#uf-selector .chip-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedUF = uf;
                updateChart();
            });
            ufSelector.appendChild(btn);
        });

        // Eventos dos modelos de nota no gráfico
        modelBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modelBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedModel = btn.dataset.model;
                updateChart();
            });
        });

        // Eventos do tipo de gráfico
        chartTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                chartTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                chartType = btn.dataset.type;
                updateChart();
            });
        });

        const chartModeSelect = document.getElementById('chart-view-mode');
        if (chartModeSelect) {
            chartModeSelect.addEventListener('change', (e) => {
                chartViewMode = e.target.value;
                updateChart();
            });
        }

        // Filtro de Busca por Texto
        stateSearch.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            updateGrid();
        });

        // Filtros por Status (Stats Cards)
        statCards.forEach(card => {
            card.addEventListener('click', () => {
                const status = card.dataset.status;
                if (statusFilter === status) {
                    statusFilter = null;
                    card.classList.remove('active');
                } else {
                    statCards.forEach(c => c.classList.remove('active'));
                    statusFilter = status;
                    card.classList.add('active');
                }
                expandedState = 0;
                updateGrid();
            });
        });

        // Filtros de Modelo no Grid (NFe, etc)
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter || btn.dataset.model || 'all';
                updateGrid();
            });
        });

        // Botão Mostrar Mais
        showMoreBtn.addEventListener('click', () => {
            expandedState = (expandedState + 1) % 3;
            
            if (expandedState === 0) {
                showMoreBtn.innerHTML = 'Mostrar Mais <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
            } else if (expandedState === 1) {
                showMoreBtn.innerHTML = 'Mostrar Todos <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
            } else {
                showMoreBtn.innerHTML = 'Recolher Tudo <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
            }
            updateGrid();
        });

        refreshBtn.addEventListener('click', fetchData);
    }

    /**
     * Inicializa o Chart.js
     */
    function initChart() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        performanceChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: [],
                datasets: [{
                    label: 'Tempo de Resposta (ms)',
                    data: [],
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    strokeColor: '#58a6ff',
                    pointBackgroundColor: '#58a6ff',
                    pointRadius: 4
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
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#8b949e' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8b949e' }
                    }
                }
            }
        });
    }

    /**
     * Atualiza o gráfico com dados filtrados
     */
    function updateChart() {
        if (!performanceChart || !fullHistory.length) return;

        const fortyMinutesAgo = Date.now() - (40 * 60 * 1000);

        const filteredHistory = fullHistory
            .filter(entry => new Date(entry.timestamp).getTime() >= fortyMinutesAgo)
            .map(entry => {
                const item = entry.data.find(d => d.estado === selectedUF && d.servico === selectedModel);
                return {
                    time: new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    value: item ? item.tempoResposta : 0
                };
            }).reverse();

        performanceChart.config.type = chartType;

        if (chartViewMode === 'status') {
            const mappedHistory = filteredHistory.map(h => {
                let statusVal = 1; // Normal
                if (h.value > 1000 && h.value <= 2000) statusVal = 2; // Lento
                else if (h.value > 2000 && h.value < 3000) statusVal = 3; // Muito Lento
                else if (h.value >= 3000) statusVal = 4; // Timeout
                
                return { time: h.time, value: statusVal };
            });

            performanceChart.data.labels = mappedHistory.map(h => h.time);
            performanceChart.data.datasets[0].data = mappedHistory.map(h => h.value);
            
            performanceChart.options.scales.y = {
                beginAtZero: false,
                min: 0,
                max: 5,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: '#8b949e',
                    stepSize: 1,
                    callback: function(value) {
                        switch(value) {
                            case 1: return 'Normal: <= 2s';
                            case 2: return 'Lento: <= 5s';
                            case 3: return 'Muito lento: < 30s';
                            case 4: return 'Timeout: > 30s';
                            default: return '';
                        }
                    }
                }
            };
        } else {
            performanceChart.data.labels = filteredHistory.map(h => h.time);
            performanceChart.data.datasets[0].data = filteredHistory.map(h => h.value);

            performanceChart.options.scales.y = {
                beginAtZero: true,
                min: 0,
                max: 3000,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: '#8b949e',
                    stepSize: 500,
                    callback: function(value) { return value; }
                }
            };
        }
        
        if (chartType === 'bar') {
            performanceChart.data.datasets[0].backgroundColor = 'rgba(88, 166, 255, 0.6)';
        } else {
            performanceChart.data.datasets[0].backgroundColor = 'rgba(88, 166, 255, 0.1)';
        }

        performanceChart.update();
    }

    /**
     * Busca os dados da API
     */
    async function fetchData() {
        try {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = 'Atualizando...';
            
            const [statusRes, historyRes] = await Promise.all([
                fetch('/api/status'),
                fetch('/api/history')
            ]);

            const statusResult = await statusRes.json();
            const historyResult = await historyRes.json();

            if (statusResult.success) {
                currentData = statusResult.current;
                updateStats();
                updateGrid();
                
                const now = new Date();
                lastUpdateSpan.textContent = `Última atualização: ${now.toLocaleTimeString()}`;
            }

            if (historyResult.success) {
                fullHistory = historyResult.history;
                updateChart();
                updateHistoryTable();
            }
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            statusGrid.innerHTML = '<div class="error-message">Erro ao conectar com o servidor.</div>';
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
                Atualizar Agora
            `;
        }
    }

    /**
     * Atualiza os cards de estatísticas globais
     */
    function updateStats() {
        const counts = currentData.reduce((acc, curr) => {
            const st = getExactStatus(curr.tempoResposta);
            acc[st] = (acc[st] || 0) + 1;
            return acc;
        }, { normal: 0, lento: 0, muito_lento: 0, timeout: 0 });

        statNormalVal.textContent = counts.normal;
        statLentoVal.textContent = counts.lento;
        statMuitoLentoVal.textContent = counts.muito_lento;
        statTimeoutVal.textContent = counts.timeout;
    }

    /**
     * Atualiza o grid de status aplicando TODOS os filtros combinados
     */
    function updateGrid() {
        statusGrid.innerHTML = '';
        const gridContainer = document.querySelector('.status-grid-container');

        let filtered = currentData;

        // 1. Filtro por Modelo (NFe, etc)
        if (currentFilter !== 'all') {
            filtered = filtered.filter(item => item.servico === currentFilter);
        }

        // 2. Filtro por Saúde Exata (via clique nos cards)
        if (statusFilter) {
            filtered = filtered.filter(item => getExactStatus(item.tempoResposta) === statusFilter);
        }

        // 3. Filtro por Pesquisa
        if (searchQuery) {
            filtered = filtered.filter(item => {
                const fullName = (ufNames[item.estado] || '').toLowerCase();
                const ufCode = item.estado.toLowerCase();
                return fullName.includes(searchQuery) || ufCode.includes(searchQuery);
            });
        }

        filtered.sort((a, b) => a.estado.localeCompare(b.estado));

        if (filtered.length === 0) {
            statusGrid.innerHTML = '<div class="empty-results">Nenhum serviço encontrado.</div>';
            showMoreContainer.style.display = 'none';
            return;
        }

        // Nova Lógica de "Mostrar Mais" (3 steps)
        const itemsPerRow = window.innerWidth > 992 ? 4 : (window.innerWidth > 768 ? 2 : 1);
        const limit0 = itemsPerRow * 2; // ex: 8 
        const limit1 = itemsPerRow * 5; // ex: 20
        
        let displayLimit;
        if (expandedState === 0) displayLimit = limit0;
        else if (expandedState === 1) displayLimit = limit1;
        else displayLimit = filtered.length;

        const totalItems = filtered.length;
        
        if (totalItems <= limit0) {
            showMoreContainer.style.display = 'none';
            gridContainer.classList.remove('expanded');
        } else {
            showMoreContainer.style.display = 'flex';
            if (expandedState !== 2) {
                filtered = filtered.slice(0, displayLimit);
                gridContainer.classList.remove('expanded');
            } else {
                gridContainer.classList.add('expanded');
            }
        }

        filtered.forEach((item, index) => {
            const card = document.createElement('div');
            const exactStatus = getExactStatus(item.tempoResposta);
            card.className = `status-card ${exactStatus}`;
            card.style.animationDelay = `${index * 0.02}s`;
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="state-badge">${item.estado}</span>
                    <span class="service-name">${item.servico}</span>
                </div>
                <div class="card-body">
                    <span class="status-tag">${translateStatus(exactStatus)}</span>
                    <span class="response-time">${item.tempoResposta} ms</span>
                </div>
            `;
            
            statusGrid.appendChild(card);
        });
    }

    /**
     * Atualiza a tabela de histórico (resumida)
     */
    function updateHistoryTable() {
        historyTableBody.innerHTML = '';

        fullHistory.slice(0, 10).forEach(entry => {
            const row = document.createElement('tr');
            const time = new Date(entry.timestamp).toLocaleTimeString();
            
            const summary = entry.data.reduce((acc, curr) => {
                acc[curr.status] = (acc[curr.status] || 0) + 1;
                return acc;
            }, { online: 0, instavel: 0, offline: 0 });

            row.innerHTML = `
                <td>${time}</td>
                <td><span class="status-tag online">Verificado</span></td>
                <td>
                    <div class="summary-pill">
                        <span class="history-badge badge-online">${summary.online} Online</span>
                        <span class="history-badge badge-instavel">${summary.instavel} Instável</span>
                        <span class="history-badge badge-offline">${summary.offline} Offline</span>
                    </div>
                </td>
            `;
            
            historyTableBody.appendChild(row);
        });
    }

    /**
     * Traduz o status técnico para amigável
     */
    function translateStatus(status) {
        const mapping = {
            'normal': 'Normal',
            'lento': 'Lento',
            'muito_lento': 'Muito Lento',
            'timeout': 'Timeout'
        };
        return mapping[status] || status;
    }

    // Inicialização do APP
    initEvents();
    initChart();
    fetchData();

    // Auto-refresh a cada 60 segundos
    setInterval(fetchData, 60000);
});
