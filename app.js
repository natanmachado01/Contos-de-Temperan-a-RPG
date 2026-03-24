// ==========================================
// ESTADO DA APLICAÇÃO
// ==========================================
let currentUser = null; 
let currentCampaign = null;

const views = {
    login: document.getElementById('view-login'),
    narratorDash: document.getElementById('view-narrator-dash'),
    narratorCamp: document.getElementById('view-narrator-camp'),
    playerDash: document.getElementById('view-player-dash')
};

function showView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
}

// ==========================================
// COMUNICAÇÃO COM O SERVIDOR (API)
// ==========================================
async function getCampaignsDB() {
    const response = await fetch('/api/campaigns');
    return await response.json();
}

async function saveCampaignsDB(campaigns) {
    await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaigns)
    });
}

function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) { code += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return code;
}

// ==========================================
// LÓGICA DE LOGIN E ACESSO
// ==========================================
// ==========================================
// LÓGICA DE LOGIN E ACESSO (VERSÃO BLINDADA)
// ==========================================
document.getElementById('login-role').addEventListener('change', (e) => {
    const groupJuiz = document.getElementById('group-juiz');
    const groupJogador = document.getElementById('group-jogador');
    
    if (e.target.value === 'jogador') {
        groupJuiz.classList.add('hidden');
        groupJogador.classList.remove('hidden');
    } else {
        groupJuiz.classList.remove('hidden');
        groupJogador.classList.add('hidden');
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.getElementById('login-role').value;
    const errorMsg = document.getElementById('login-error');
    errorMsg.style.display = 'none';

    try {
        if (role === 'narrador') {
            const name = document.getElementById('login-name-juiz').value.trim();
            if (!name) return;
            
            currentUser = { name, role };
            document.getElementById('narrator-name-display').innerText = name.toUpperCase();
            showView('narratorDash');
            await loadCampaigns(); 
        } else {
            const code = document.getElementById('login-code').value.trim().toUpperCase();
            const username = document.getElementById('login-user-jogador').value.trim();
            const pass = document.getElementById('login-pass-jogador').value.trim();

            if (!code || !username || !pass) {
                errorMsg.innerText = "[ERRO] Preencha todos os campos da credencial.";
                errorMsg.style.display = 'block';
                return;
            }

            const campaigns = await getCampaignsDB();
            const targetCampaign = campaigns.find(c => c.inviteCode === code);

            if (!targetCampaign) {
                errorMsg.innerText = "[ACESSO NEGADO] Código de sala inexistente. Cuidado com a Letra 'O' e o Número '0'.";
                errorMsg.style.display = 'block';
                return;
            }

            // Proteção 1: Garante que a lista de usuários existe (caso seja uma campanha velha)
            const usersList = targetCampaign.users || [];
            
            // Proteção 2: Busca o usuário evitando quebras por letras maiúsculas/minúsculas
            const validUser = usersList.find(u => 
                u && u.username && u.username.toLowerCase() === username.toLowerCase() && u.password === pass
            );

            if (!validUser) {
                errorMsg.innerText = "[ACESSO NEGADO] Usuário ou senha incorretos.";
                errorMsg.style.display = 'block';
                return;
            }

            // Tudo certo! Configura o jogador
            currentUser = { name: validUser.username, role, assignedSheets: validUser.sheets || [] };
            currentCampaign = targetCampaign;

            document.getElementById('player-name-display').innerText = `${validUser.username.toUpperCase()} [SALA: ${targetCampaign.name}]`;
            
            renderPlayerSheets(); 
            showView('playerDash');
        }
    } catch (erro) {
        console.error("Erro Crítico no Login:", erro);
        errorMsg.innerText = "[ERRO DE SISTEMA] Falha ao ler banco de dados. Verifique se o server.js está rodando.";
        errorMsg.style.display = 'block';
    }
});

// Botões de Desconectar (Logout)
document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', () => {
        currentUser = null;
        currentCampaign = null;
        document.getElementById('login-form').reset();
        document.getElementById('login-error').style.display = 'none';
        showView('login');
    });
});

// ==========================================
// RENDERIZAR FICHAS DO JOGADOR
// ==========================================
function renderPlayerSheets() {
    const list = document.getElementById('player-sheets-list');
    list.innerHTML = '';
    
    // Proteção 3: Se a campanha for velha e não tiver fichas criadas, não quebra
    const sheets = currentCampaign.sheets || [];
    
    // Filtra as fichas em que o campo dono (ignorando maiúsculas) bate com o usuário
    const minhasFichas = sheets.filter(f => (f.dono || "").toLowerCase() === currentUser.name.toLowerCase());
    
    if (minhasFichas.length === 0) {
        list.innerHTML = '<li class="text-muted">O Juiz ainda não atribuiu nenhum Condenado a você.</li>';
        return;
    }

    minhasFichas.forEach(ficha => {
        const li = document.createElement('li');
        li.innerHTML = `<span>> ${ficha.nome}</span> <button class="btn-small btn-access-sheet">ACESSAR</button>`;
        li.querySelector('.btn-access-sheet').addEventListener('click', () => openSheet(ficha));
        list.appendChild(li);
    });
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.getElementById('login-role').value;
    const errorMsg = document.getElementById('login-error');
    errorMsg.style.display = 'none';

    if (role === 'narrador') {
        const name = document.getElementById('login-name-juiz').value.trim();
        if (!name) return;
        
        currentUser = { name, role };
        document.getElementById('narrator-name-display').innerText = name.toUpperCase();
        showView('narratorDash');
        await loadCampaigns(); 
    } else {
        const code = document.getElementById('login-code').value.trim().toUpperCase();
        const username = document.getElementById('login-user-jogador').value.trim();
        const pass = document.getElementById('login-pass-jogador').value.trim();

        if (!code || !username || !pass) {
            errorMsg.innerText = "[ERRO] Preencha todos os campos da credencial.";
            errorMsg.style.display = 'block';
            return;
        }

        const campaigns = await getCampaignsDB();
        const targetCampaign = campaigns.find(c => c.inviteCode === code);

        if (!targetCampaign) {
            errorMsg.innerText = "[ACESSO NEGADO] Código de sala inexistente.";
            errorMsg.style.display = 'block';
            return;
        }

        const validUser = targetCampaign.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === pass);

        if (!validUser) {
            errorMsg.innerText = "[ACESSO NEGADO] Usuário ou senha incorretos.";
            errorMsg.style.display = 'block';
            return;
        }

        currentUser = { name: validUser.username, role, assignedSheets: validUser.sheets || [] };
        renderPlayerSheets();
        currentCampaign = targetCampaign;

        document.getElementById('player-name-display').innerText = `${validUser.username.toUpperCase()} [SALA: ${targetCampaign.name}]`;
        showView('playerDash');
    }
});

document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', () => {
        currentUser = null;
        currentCampaign = null;
        document.getElementById('login-form').reset();
        document.getElementById('login-error').style.display = 'none';
        showView('login');
    });
});

// ==========================================
// PAINEL DO NARRADOR - CAMPANHAS
// ==========================================
async function loadCampaigns() {
    const campaigns = await getCampaignsDB();
    const list = document.getElementById('campaign-list');
    list.innerHTML = '';

    if (campaigns.length === 0) {
        list.innerHTML = '<li class="text-muted">Nenhuma campanha detectada no sistema.</li>';
        return;
    }

    campaigns.forEach((camp) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${camp.name}</strong><br>
                <span class="text-muted" style="font-size: 0.9em;">CÓDIGO DE SALA: <span style="color: var(--text-main);">${camp.inviteCode}</span></span>
            </div>
            <button class="btn-small btn-access-camp">GERENCIAR</button>
        `;
        li.querySelector('.btn-access-camp').addEventListener('click', () => openCampaign(camp));
        list.appendChild(li);
    });
}

document.getElementById('btn-create-campaign').addEventListener('click', async () => {
    const campName = document.getElementById('new-campaign-name').value.trim();
    if (!campName) return;

    const campaigns = await getCampaignsDB();
    campaigns.push({
        id: Date.now().toString(),
        inviteCode: generateInviteCode(),
        name: campName,
        users: [], 
        sheets: [] 
    });
    
    await saveCampaignsDB(campaigns);
    document.getElementById('new-campaign-name').value = '';
    await loadCampaigns();
});

// ==========================================
// DENTRO DA CAMPANHA (Narrador)
// ==========================================
async function openCampaign(campaign) {
    const campaigns = await getCampaignsDB();
    currentCampaign = campaigns.find(c => c.id === campaign.id) || campaign; 
    
    document.getElementById('current-campaign-name').innerText = currentCampaign.name.toUpperCase();
    showView('narratorCamp');
    renderCampaignUsers();
    renderCampaignSheets();
}

document.getElementById('btn-back-dash').addEventListener('click', async () => {
    currentCampaign = null;
    await loadCampaigns();
    showView('narratorDash');
});

document.getElementById('btn-create-user').addEventListener('click', async () => {
    const username = document.getElementById('new-user-name').value.trim();
    const password = document.getElementById('new-user-pass').value.trim();
    
    if (!username || !password || !currentCampaign) return;

    const campaigns = await getCampaignsDB();
    const campIndex = campaigns.findIndex(c => c.id === currentCampaign.id);
    
    if (campIndex > -1) {
        const userExists = campaigns[campIndex].users.some(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!userExists) {
            campaigns[campIndex].users.push({
                username: username,
                password: password,
                sheets: [] 
            });
            await saveCampaignsDB(campaigns);
            currentCampaign = campaigns[campIndex];
            renderCampaignUsers();
        } else {
            alert("Erro: Já existe uma credencial com este nome nesta sala.");
        }
    }
    
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-pass').value = '';
});

function renderCampaignUsers() {
    const list = document.getElementById('campaign-users-list');
    list.innerHTML = '';
    
    if (!currentCampaign.users || currentCampaign.users.length === 0) {
        list.innerHTML = '<li class="text-muted">Nenhuma credencial emitida.</li>';
        return;
    }

    currentCampaign.users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>> ${user.username} <span style="font-size: 0.7em; color: #555;">(Senha: ${user.password})</span></span>
            <button class="btn-small btn-revoke" style="border-color: var(--danger); color: var(--danger);">REVOGAR</button>
        `;
        
        li.querySelector('.btn-revoke').addEventListener('click', async () => {
            if(confirm(`Tem certeza que deseja revogar o acesso de ${user.username}?`)) {
                const campaigns = await getCampaignsDB();
                const campIndex = campaigns.findIndex(c => c.id === currentCampaign.id);
                campaigns[campIndex].users = campaigns[campIndex].users.filter(u => u.username !== user.username);
                await saveCampaignsDB(campaigns);
                currentCampaign = campaigns[campIndex];
                renderCampaignUsers();
            }
        });
        
        list.appendChild(li);
    });

    // ==========================================
// SISTEMA DE FICHAS DE PERSONAGEM
// ==========================================
const sheetModal = document.getElementById('sheet-modal');

// Botão FECHAR Ficha
document.getElementById('btn-close-sheet').addEventListener('click', () => {
    sheetModal.classList.add('hidden');
    // Atualiza as listas na tela que ficou por baixo
    if (currentUser.role === 'narrador') renderCampaignSheets();
    if (currentUser.role === 'jogador') renderPlayerSheets();
});

// Botão NOVA FICHA (Visão Juiz)
// Botão NOVA FICHA (Visão Juiz)
document.getElementById('btn-create-sheet').addEventListener('click', async () => {
    if (!currentCampaign) return;

    const campaigns = await getCampaignsDB();
    const campIndex = campaigns.findIndex(c => c.id === currentCampaign.id);
    
    if (campIndex > -1) {
        // Proteção: Se a campanha for velha e não tiver a gaveta de fichas, cria agora
        if (!campaigns[campIndex].sheets) {
            campaigns[campIndex].sheets = [];
        }

        const novaFicha = {
            id: 'ficha_' + Date.now(),
            nome: "Novo Condenado",
            dono: "", 
            estresse: 0,
            ativos: { fisico: 1, motoras: 1, intelecto: 1, mente: 1 },
            passivos: { vontade: 0, fortitude: 0, reflexos: 0 },
            notasDano: ""
        };
        
        campaigns[campIndex].sheets.push(novaFicha);
        await saveCampaignsDB(campaigns);
        currentCampaign = campaigns[campIndex];
        renderCampaignSheets();
    }
});

// Renderizar Fichas para o Juiz
function renderCampaignSheets() {
    const list = document.getElementById('sheets-list');
    list.innerHTML = '';
    
    if (!currentCampaign.sheets || currentCampaign.sheets.length === 0) {
        list.innerHTML = '<li class="text-muted">Nenhuma ficha criada.</li>';
        return;
    }

    currentCampaign.sheets.forEach(ficha => {
        const li = document.createElement('li');
        const donoTexto = ficha.dono ? `[Dono: ${ficha.dono}]` : `[NPC]`;
        li.innerHTML = `
            <span>> ${ficha.nome} <span style="font-size: 0.7em; color: var(--text-muted);">${donoTexto}</span></span>
            <button class="btn-small">ABRIR</button>
        `;
        li.querySelector('button').addEventListener('click', () => openSheet(ficha));
        list.appendChild(li);
    });
}

// Renderizar Fichas para o Jogador (Apenas as que ele é dono)
function renderPlayerSheets() {
    const list = document.getElementById('player-sheets-list');
    list.innerHTML = '';
    
    // Proteção: garante que "sheets" existe mesmo em campanhas criadas antes da atualização
    const sheets = currentCampaign.sheets || [];
    
    // Filtra as fichas onde o campo "dono" é igual ao nome do usuário atual
    const minhasFichas = sheets.filter(f => (f.dono || "").toLowerCase() === currentUser.name.toLowerCase());
    
    if (minhasFichas.length === 0) {
        list.innerHTML = '<li class="text-muted">O Juiz ainda não atribuiu nenhum Condenado a você.</li>';
        return;
    }

    minhasFichas.forEach(ficha => {
        const li = document.createElement('li');
        li.innerHTML = `<span>> ${ficha.nome}</span> <button class="btn-small">ACESSAR</button>`;
        li.querySelector('button').addEventListener('click', () => openSheet(ficha));
        list.appendChild(li);
    });
}

// ==========================================
// ABRIR A FICHA NO MODAL (VERSÃO BLINDADA)
// ==========================================
function openSheet(ficha) {
    try {
        // Proteções contra fichas antigas ou propriedades ausentes no JSON
        const ativos = ficha.ativos || { fisico: 1, motoras: 1, intelecto: 1, mente: 1 };
        const passivos = ficha.passivos || { vontade: 0, fortitude: 0, reflexos: 0 };

        // Preenche o HTML com os dados do JSON (ou valores vazios/padrão caso não existam)
        document.getElementById('sheet-id-active').value = ficha.id || '';
        document.getElementById('sheet-nome').value = ficha.nome || '';
        document.getElementById('sheet-dono').value = ficha.dono || '';
        document.getElementById('sheet-estresse').value = ficha.estresse || 0;
        
        document.getElementById('sheet-fisico').value = ativos.fisico || 1;
        document.getElementById('sheet-motoras').value = ativos.motoras || 1;
        document.getElementById('sheet-intelecto').value = ativos.intelecto || 1;
        document.getElementById('sheet-mente').value = ativos.mente || 1;
        
        document.getElementById('sheet-vontade').value = passivos.vontade || 0;
        document.getElementById('sheet-fortitude').value = passivos.fortitude || 0;
        document.getElementById('sheet-reflexos').value = passivos.reflexos || 0;
        
        document.getElementById('sheet-notas-dano').value = ficha.notasDano || "";

        // Bloqueia o campo "Dono" se for um jogador acessando (só o Juiz pode mudar o dono)
        document.getElementById('sheet-dono').disabled = (currentUser && currentUser.role === 'jogador');

        // Mostra o Modal de forma segura puxando direto do documento
        document.getElementById('sheet-modal').classList.remove('hidden');

    } catch (erro) {
        console.error("[ERRO DO SISTEMA] Falha ao renderizar a ficha:", erro);
        alert("Ocorreu um erro ao tentar ler os dados desta ficha. Verifique o console (F12).");
    }
}

// Salvar Dados da Ficha
document.getElementById('btn-save-sheet').addEventListener('click', async () => {
    const idAtiva = document.getElementById('sheet-id-active').value;
    const campaigns = await getCampaignsDB();
    const campIndex = campaigns.findIndex(c => c.id === currentCampaign.id);
    
    if (campIndex > -1) {
        const sheetIndex = campaigns[campIndex].sheets.findIndex(s => s.id === idAtiva);
        
        if (sheetIndex > -1) {
            // Atualiza o objeto com os valores digitados na tela
            campaigns[campIndex].sheets[sheetIndex].nome = document.getElementById('sheet-nome').value || "Sem Nome";
            campaigns[campIndex].sheets[sheetIndex].dono = document.getElementById('sheet-dono').value.trim();
            campaigns[campIndex].sheets[sheetIndex].estresse = parseInt(document.getElementById('sheet-estresse').value) || 0;
            
            campaigns[campIndex].sheets[sheetIndex].ativos.fisico = parseInt(document.getElementById('sheet-fisico').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].ativos.motoras = parseInt(document.getElementById('sheet-motoras').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].ativos.intelecto = parseInt(document.getElementById('sheet-intelecto').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].ativos.mente = parseInt(document.getElementById('sheet-mente').value) || 0;
            
            campaigns[campIndex].sheets[sheetIndex].passivos.vontade = parseInt(document.getElementById('sheet-vontade').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].passivos.fortitude = parseInt(document.getElementById('sheet-fortitude').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].passivos.reflexos = parseInt(document.getElementById('sheet-reflexos').value) || 0;
            
            campaigns[campIndex].sheets[sheetIndex].notasDano = document.getElementById('sheet-notas-dano').value;
            
            // Salva no servidor
            await saveCampaignsDB(campaigns);
            currentCampaign = campaigns[campIndex]; // Atualiza local
            
            // Atualiza visualmente as listas debaixo do modal
            if (currentUser.role === 'narrador') renderCampaignSheets();
            if (currentUser.role === 'jogador') renderPlayerSheets();

            alert("Ficha salva no sistema do Juiz com sucesso!");
        }
    }
});

}