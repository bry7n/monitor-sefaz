const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

// Agente para ignorar erros de SSL (comum em portais do governo)
const agent = new https.Agent({ rejectUnauthorized: false });

// Mapeamento Robusto de UF para o Web Service (Autorizador)
const ufAutorizador = {
    'AC': 'SVRS', 'AL': 'SVRS', 'AM': 'AM', 'AP': 'SVRS', 'BA': 'BA',
    'CE': 'CE', 'DF': 'SVRS', 'ES': 'SVRS', 'GO': 'GO', 'MA': 'SVAN',
    'MG': 'MG', 'MS': 'MS', 'MT': 'MT', 'PA': 'PA', 'PB': 'SVRS',
    'PE': 'PE', 'PI': 'SVRS', 'PR': 'PR', 'RJ': 'SVRS', 'RN': 'SVRS',
    'RO': 'SVRS', 'RR': 'SVRS', 'RS': 'RS', 'SC': 'SVRS', 'SE': 'SVRS',
    'SP': 'SP', 'TO': 'SVRS'
};

const ufs = Object.keys(ufAutorizador);
const models = ['NFe', 'NFCe', 'MDFe'];

let cachedStatus = [];
let lastUpdate = 0;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutos

// Mapeia o status para um "tempo de resposta" padronizado conforme solicitado pelo usuário
/**
 * @param {string} status - online, instavel, offline
 * @returns {number}
 */
const getMappedTime = (status) => {
    // Escala altamente responsiva (Max 3000ms):
    // Normal: 500, 1000
    // Instável: 1500, 2000, 2500
    // Offline/Timeout: 3000

    if (status === 'online') {
        const normalTimes = [500, 1000];
        return normalTimes[Math.floor(Math.random() * normalTimes.length)];
    } else if (status === 'instavel') {
        const slowTimes = [1500, 2000, 2500];
        return slowTimes[Math.floor(Math.random() * slowTimes.length)];
    } else {
        // offline
        return 3000;
    }
};

const parseStatus = (element, $) => {
    if (!element) return 'offline';
    const html = $(element).html() || '';
    const text = $(element).text().toLowerCase();
    const imgSrc = $(element).find('img').attr('src') || '';

    if (html.includes('verde') || html.includes('success') || html.includes('check') ||
        imgSrc.includes('verde') || imgSrc.includes('bola_1') ||
        text.includes('online') || text.includes('viva') || text.includes('disponivel')) return 'online';

    if (html.includes('amarela') || html.includes('warning') ||
        imgSrc.includes('amarela') || imgSrc.includes('bola_2') ||
        text.includes('instavel') || text.includes('sobrecarga')) return 'instavel';

    if (html.includes('vermelha') || html.includes('danger') || html.includes('error') ||
        imgSrc.includes('vermelha') || imgSrc.includes('bola_3') ||
        text.includes('offline') || text.includes('fora')) return 'offline';

    return 'offline';
};

const normalizeLabel = (label) => {
    if (!label) return '';
    let l = label.toUpperCase()
        .replace(/SEFAZ\s*-?\s*/g, '')
        .replace(/ESTADO\s*-?\s*/g, '')
        .replace(/\(.*\)/g, '')
        .trim();
    if (l.includes('PERNAMBUCO')) return 'PE';
    if (l.includes('SAO PAULO')) return 'SP';
    if (l.includes('RIO GRANDE DO SUL')) return 'RS';
    if (l.includes('MINAS GERAIS')) return 'MG';
    return l;
};

const getTecnoSpeedStatus = async () => {
    try {
        // Envolta a requisição na AllOrigins para evitar o IP Block da Vercel contra a Tecnospeed
        const targetUrl = 'https://monitor.tecnospeed.com.br/monitores?doc=nfe&last=true';
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        
        const response = await axios.get(proxyUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 6500,
            httpsAgent: agent
        });

        if (!Array.isArray(response.data)) {
            console.error('⚠️ [DEBUG] Tecnospeed API retornou sucesso, mas não é um array! Pode ser bloqueio Cloudflare. Prévia do corpo:', typeof response.data === 'string' ? response.data.substring(0, 100) : response.data);
            return null;
        }

        const apiMap = {};
        response.data.forEach(item => {
            const parts = item.id_worker.split('_');
            const uf = parts[parts.length - 1].toUpperCase();

            let st = 'offline';
            if (item.status === 1) st = 'online';
            else if (item.status === 2 || item.status === 3) st = 'instavel';

            apiMap[uf] = { status: st, tempo: getMappedTime(st) };
        });
        return apiMap;
    } catch (e) {
        console.error('⚠️ [DEBUG] Falha ao tentar buscar TecnoSpeed:', e.message, e.code);
        return null;
    }
};

const getNfeOfficialStatus = async () => {
    const statusMap = {};
    const sources = [
        { url: 'http://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx', isNational: true },
        { url: 'https://dfe-portal.svrs.rs.gov.br/Nfe/Disponibilidade', isNational: false }
    ];

    for (const src of sources) {
        try {
            const response = await axios.get(src.url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 4500,
                httpsAgent: agent
            });
            const $ = cheerio.load(response.data);

            $('table tr').each((i, row) => {
                const cols = $(row).find('td');
                if (cols.length >= 2) {
                    const originalLabel = $(cols[0]).text().trim();
                    const nLabel = normalizeLabel(originalLabel);

                    const statusTd = (src.isNational && cols.length >= 6) ? cols[5] : cols[1];
                    const status = parseStatus(statusTd, $);

                    if (nLabel && !statusMap[nLabel]) {
                        statusMap[nLabel] = { status, tempo: getMappedTime(status) };
                    }
                }
            });
            if (Object.keys(statusMap).length > 0) {
                break;
            } else {
                console.error(`⚠️ [DEBUG] SEFAZ Nacional via ${src.url} retornou HTML, mas tabela de status estava vazia. Prévia do body:`, response.data.substring(0, 100));
            }
        } catch (e) {
            console.error(`⚠️ [DEBUG] Falha ao buscar SEFAZ Nacional via ${src.url}:`, e.message, e.code);
        }
    }
    return statusMap;
};

const getOtherDfeStatus = async (type) => {
    try {
        const url = `https://dfe-portal.svrs.rs.gov.br/${type}/Disponibilidade`;
        const response = await axios.get(url, {
            timeout: 4500,
            httpsAgent: agent
        });
        const $ = cheerio.load(response.data);
        const stMap = {};
        $('table tr').each((i, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 2) {
                const nLabel = normalizeLabel($(cols[0]).text().trim());
                stMap[nLabel] = parseStatus(cols[1], $);
            }
        });
        if (Object.keys(stMap).length === 0) {
            console.error(`⚠️ [DEBUG] DFe (${type}) retornou sucesso mas a tabela de parsing falhou ou estava vazia! Prévia do body:`, response.data.substring(0, 100));
        }
        return stMap;
    } catch (e) {
        console.error(`⚠️ [DEBUG] Falha ao buscar DFe (${type}):`, e.message, e.code);
        return null;
    }
};

const fetchSefazStatus = async () => {
    const now = Date.now();
    if (cachedStatus.length > 0 && (now - lastUpdate < CACHE_TTL)) {
        return cachedStatus;
    }

    const [tecnoSpeedNfeData, officialNfeData, mdfeData, nfceData] = await Promise.all([
        getTecnoSpeedStatus(),
        getNfeOfficialStatus(),
        getOtherDfeStatus('MDFe'),
        getOtherDfeStatus('NFCe')
    ]);

    const nfeData = (tecnoSpeedNfeData && Object.keys(tecnoSpeedNfeData).length > 0) ? tecnoSpeedNfeData : officialNfeData;

    if (!nfeData || Object.keys(nfeData).length === 0) {
        if (cachedStatus.length > 0) return cachedStatus;
        return ufs.flatMap(uf => models.map(m => ({ estado: uf, servico: m, status: 'offline', tempoResposta: 3000 })));
    }

    const currentResults = [];

    ufs.forEach(uf => {
        const autorizador = ufAutorizador[uf];

        const nfeInfo = nfeData[uf] || nfeData[autorizador] || nfeData['SVRS'] || { status: 'offline', tempo: 3000 };
        currentResults.push({ estado: uf, servico: 'NFe', status: nfeInfo.status, tempoResposta: nfeInfo.tempo });

        const nfceStat = (nfceData && (nfceData[uf] || nfceData[autorizador])) ? (nfceData[uf] || nfceData[autorizador]) : nfeInfo.status;
        currentResults.push({ estado: uf, servico: 'NFCe', status: nfceStat, tempoResposta: getMappedTime(nfceStat) });

        const mdfeStat = (mdfeData && (mdfeData[uf] || mdfeData[autorizador] || mdfeData['SVRS'])) ? (mdfeData[uf] || mdfeData[autorizador] || mdfeData['SVRS']) : nfeInfo.status;
        currentResults.push({ estado: uf, servico: 'MDFe', status: mdfeStat, tempoResposta: getMappedTime(mdfeStat) });
    });

    cachedStatus = currentResults;
    lastUpdate = now;
    return currentResults;
};

module.exports = { fetchSefazStatus };
