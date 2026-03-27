const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function debugSources() {
    const sources = [
        { name: 'TecnoSpeed API', url: 'https://monitor.tecnospeed.com.br/monitores?doc=nfe&last=true' },
        { name: 'National Portal', url: 'http://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx' },
        { name: 'SVRS Portal', url: 'https://dfe-portal.svrs.rs.gov.br/Nfe/Disponibilidade' }
    ];

    for (const src of sources) {
        console.log(`\n--- Testando: ${src.name} ---`);
        try {
            const res = await axios.get(src.url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                    'Referer': 'https://monitor.tecnospeed.com.br/'
                },
                timeout: 10000,
                httpsAgent: agent
            });
            console.log(`Status: ${res.status}`);
            console.log(`Body (primeiros 500 chars): ${JSON.stringify(res.data).substring(0, 500)}`);
        } catch (e) {
            console.log(`ERRO: ${e.message}`);
            if (e.response) {
                console.log(`Status Erro: ${e.response.status}`);
                console.log(`Dados Erro: ${JSON.stringify(e.response.data).substring(0, 500)}`);
            }
        }
    }
}

debugSources();
