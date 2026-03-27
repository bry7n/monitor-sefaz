const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testApi() {
    try {
        console.log("Testando API TecnoSpeed...");
        const response = await fetch('https://monitor.tecnospeed.com.br/api/monitor/all', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        
        console.log("Status:", response.status);
        if (response.ok) {
            const data = await response.json();
            console.log("Dados recebidos (primeiros 100 caracteres):", JSON.stringify(data).substring(0, 100));
        } else {
            const text = await response.text();
            console.log("Erro no corpo:", text.substring(0, 100));
        }
    } catch (err) {
        console.error("Erro no fetch:", err.message);
    }
}

testApi();
