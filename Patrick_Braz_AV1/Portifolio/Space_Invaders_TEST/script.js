// ========================================================
//                  SPACE INVADERS CLONE
// ========================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
console.log("Canvas Context:", ctx ? "Obtido" : "FALHOU"); // Verifica se o contexto foi criado

const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const messageElement = document.getElementById('message');

// --- Constantes do Jogo ---
const PLAYER_WIDTH = 60;
const PLAYER_HEIGHT = 30;
const PLAYER_SPEED = 7;
const BULLET_WIDTH = 4;
const BULLET_HEIGHT = 18;
const BULLET_SPEED = 9;
const ALIEN_ROWS = 5;
const ALIEN_COLS = 10;
const ALIEN_WIDTH = 40;
const ALIEN_HEIGHT = 30;
const ALIEN_PADDING = 15;
const ALIEN_OFFSET_TOP = 60;
const ALIEN_OFFSET_LEFT = 30;
const ALIEN_MOVE_SPEED_X_INITIAL = 1;
const ALIEN_MOVE_SPEED_Y = 25;
const ALIEN_SHOOT_INTERVAL = 800;
const STAR_COUNT = 150;

// --- Variáveis do Jogo ---
let player;
let playerBullets = [];
let aliens = [];
let alienBullets = [];
let stars = [];
let alienDirection = 1;
let alienMoveTimer = 0;
let alienCurrentSpeedX = ALIEN_MOVE_SPEED_X_INITIAL;
let lastAlienMoveTime = 0;
let timeBetweenAlienMoves = 1000;
let lastAlienShootTime = 0;
let score = 0;
let lives = 3;
let gameOver = false;
let gamePaused = false;
let keys = {};
let pendingLevelUp = false;
let alienMoveSoundToggle = false;

// --- Variáveis de Áudio ---
let audioContext;
let soundBuffers = {};
let audioInitialized = false;

// !! IMPORTANTE: Crie uma pasta 'sounds' e coloque seus arquivos de som lá !!
// !! Substitua os nomes abaixo pelos nomes REAIS dos seus arquivos !!
const soundFiles = {
    shoot: 'sounds/shoot.wav',              // Som de tiro do jogador
    invaderKilled: 'sounds/invaderkilled.wav',  // Som de alien destruído
    playerExplosion: 'sounds/explosion.wav',   // Som jogador atingido/destruído
    alienMove1: 'sounds/fastinvader1.wav',     // Som movimento alien 1 (opcional)
    alienMove2: 'sounds/fastinvader2.wav'      // Som movimento alien 2 (opcional)
};

// ========================================================
//                  Inicialização de Áudio
// ========================================================
function initAudio() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!window.AudioContext) {
             console.warn("Web Audio API não suportada neste navegador.");
             return;
        }
        audioContext = new AudioContext();
        console.log("AudioContext criado, estado inicial:", audioContext.state);
        loadAllSounds(); // Começa a carregar os sons
    } catch (e) {
        console.error("Erro ao inicializar Web Audio API:", e);
    }
}

async function loadSound(url) {
    if (!audioContext) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (error) {
        console.error(`Erro ao carregar ou decodificar o som: ${url}`, error);
        return null;
    }
}

async function loadAllSounds() {
    console.log("Carregando sons...");
    const loadPromises = [];
    for (const key in soundFiles) {
        const url = soundFiles[key];
        console.log(`Tentando carregar: ${key} de ${url}`);
        const promise = loadSound(url).then(buffer => {
            if (buffer) {
                soundBuffers[key] = buffer;
                console.log(`Som carregado e decodificado: ${key}`);
            } else {
                 console.warn(`Falha ao carregar ${key}`);
            }
        });
        loadPromises.push(promise);
    }
    try {
        await Promise.all(loadPromises);
        console.log("Todos os sons solicitados foram processados.");
    } catch (error) {
         console.error("Erro durante o carregamento de sons com Promise.all:", error);
    }
}

function playSound(key) {
    if (!audioInitialized || !audioContext || audioContext.state !== 'running' || !soundBuffers[key]) {
        // console.log(`Áudio não pronto ou buffer não encontrado para: ${key}. Estado: ${audioContext?.state}`);
        return;
    }
    try {
        const source = audioContext.createBufferSource();
        source.buffer = soundBuffers[key];
        source.connect(audioContext.destination);
        source.start(0);
    } catch (error) {
        console.error(`Erro ao tocar o som ${key}:`, error);
    }
}

function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        console.log("Tentando resumir AudioContext...");
        audioContext.resume().then(() => {
            console.log('AudioContext resumido com sucesso!');
            audioInitialized = true;
        }).catch(e => console.error('Erro ao resumir AudioContext:', e));
    } else if (audioContext && audioContext.state === 'running') {
         console.log('AudioContext já está rodando.');
         audioInitialized = true;
    } else {
         console.log(`Não é possível resumir AudioContext. Estado atual: ${audioContext?.state}`);
    }
}

// ========================================================
//                  Classes do Jogo
// ========================================================
class Player {
    constructor(x, y, width, height, color) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.color = color; this.speed = PLAYER_SPEED; this.canShoot = true;
        this.shootCooldown = 280;
    }
    draw() { drawPlayer(this); }
    move(direction) {
        if (direction === 'left' && this.x > 0) { this.x -= this.speed; }
        else if (direction === 'right' && this.x < canvas.width - this.width) { this.x += this.speed; }
    }
    shoot() {
        if (this.canShoot && !gamePaused) {
            const bulletX = this.x + this.width / 2 - BULLET_WIDTH / 2;
            const bulletY = this.y - BULLET_HEIGHT;
            playerBullets.push(new Bullet(bulletX, bulletY, BULLET_WIDTH, BULLET_HEIGHT, '#0f0', -BULLET_SPEED));
            this.canShoot = false;
            playSound('shoot');
            setTimeout(() => { this.canShoot = true; }, this.shootCooldown);
        }
    }
}

class Bullet {
    constructor(x, y, width, height, color, speedY) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.color = color; this.speedY = speedY;
    }
    draw() { ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.width, this.height); }
    update() { this.y += this.speedY; }
    isOffScreen() { return this.y < -this.height || this.y > canvas.height; }
}

class Alien {
    constructor(x, y, width, height, color, type) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.color = color; this.type = type; this.alive = true;
    }
    draw() { if (this.alive) { drawAlien(this); } }
}

class Star {
    constructor(x, y, size, speed) {
        this.x = x; this.y = y; this.size = size; this.speed = speed;
    }
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.3})`;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    }
    update() {
        this.y += this.speed;
        if (this.y > canvas.height + this.size) {
            this.y = -this.size; this.x = Math.random() * canvas.width;
            this.speed = Math.random() * 1.5 + 0.5;
        }
    }
}

// ========================================================
//                  Funções de Desenho
// ========================================================
function drawPlayer(player) {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.moveTo(player.x + player.width * 0.2, player.y + player.height);
    ctx.lineTo(player.x + player.width * 0.8, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height * 0.5);
    ctx.lineTo(player.x + player.width * 0.7, player.y);
    ctx.lineTo(player.x + player.width * 0.3, player.y);
    ctx.lineTo(player.x, player.y + player.height * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aaa';
    ctx.fillRect(player.x + player.width * 0.35, player.y + player.height * 0.1, player.width * 0.3, player.height * 0.4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + player.width * 0.45, player.y - player.height * 0.2, player.width * 0.1, player.height * 0.4);
}

function drawAlien(alien) {
    ctx.fillStyle = alien.color;
    let bodyX = alien.x; let bodyY = alien.y; let w = alien.width; let h = alien.height;
    if (alien.type === 0) { // Squid
        ctx.fillRect(bodyX + w * 0.2, bodyY, w * 0.6, h * 0.6);
        ctx.fillRect(bodyX, bodyY + h * 0.6, w, h * 0.4);
        ctx.fillRect(bodyX - w * 0.1, bodyY + h * 0.8, w * 0.3, h * 0.4);
        ctx.fillRect(bodyX + w * 0.8, bodyY + h * 0.8, w * 0.3, h * 0.4);
    } else if (alien.type === 1) { // Crab
        ctx.fillRect(bodyX, bodyY + h * 0.2, w, h * 0.6);
        ctx.fillRect(bodyX + w * 0.1, bodyY, w * 0.8, h * 0.3);
        ctx.fillRect(bodyX + w * 0.3, bodyY + h * 0.8, w * 0.4, h * 0.3);
        ctx.fillRect(bodyX - w * 0.2, bodyY + h * 0.4, w * 0.4, h * 0.2);
        ctx.fillRect(bodyX + w * 0.8, bodyY + h * 0.4, w * 0.4, h * 0.2);
        ctx.fillRect(bodyX - w * 0.2, bodyY + h * 0.6, w * 0.2, h * 0.3);
        ctx.fillRect(bodyX + w, bodyY + h * 0.6, w * 0.2, h * 0.3);
    } else { // Octopus
        ctx.fillRect(bodyX + w*0.1, bodyY, w*0.8, h*0.5);
        ctx.fillRect(bodyX, bodyY + h*0.5, w, h*0.3);
        ctx.fillRect(bodyX + w*0.1, bodyY + h*0.8, w*0.2, h*0.4);
        ctx.fillRect(bodyX + w*0.4, bodyY + h*0.8, w*0.2, h*0.5);
        ctx.fillRect(bodyX + w*0.7, bodyY + h*0.8, w*0.2, h*0.4);
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(bodyX + w * 0.25, bodyY + h * 0.2, w * 0.15, h * 0.2);
    ctx.fillRect(bodyX + w * 0.6, bodyY + h * 0.2, w * 0.15, h * 0.2);
}

function drawStars() { for (const star of stars) { star.draw(); } }

// ========================================================
//                  Funções Principais do Jogo
// ========================================================
function createAliens() {
    aliens = [];
    const alienTypes = [0, 1, 1, 2, 2];
    for (let r = 0; r < ALIEN_ROWS; r++) {
        const alienType = alienTypes[r % alienTypes.length];
        const hue = (alienType * 60 + r * 10) % 360;
        const color = `hsl(${hue}, 80%, 55%)`;
        for (let c = 0; c < ALIEN_COLS; c++) {
            const alienX = ALIEN_OFFSET_LEFT + c * (ALIEN_WIDTH + ALIEN_PADDING);
            const alienY = ALIEN_OFFSET_TOP + r * (ALIEN_HEIGHT + ALIEN_PADDING);
            aliens.push(new Alien(alienX, alienY, ALIEN_WIDTH, ALIEN_HEIGHT, color, alienType));
        }
    }
}

function createStars(count) {
    stars = [];
    for (let i = 0; i < count; i++) {
        const x = Math.random() * canvas.width; const y = Math.random() * canvas.height;
        const size = Math.random() * 1.5 + 0.5; const speed = Math.random() * 1.5 + 0.5;
        stars.push(new Star(x, y, size, speed));
    }
}

function moveAliens(currentTime) {
    if (gameOver || gamePaused || aliens.length === 0) return;
    if (currentTime - lastAlienMoveTime < timeBetweenAlienMoves) return;
    lastAlienMoveTime = currentTime;

    let hitEdge = false; let lowestAlienY = 0; let moved = false;
    for (const alien of aliens) {
        if (alien.alive) {
            alien.x += alienCurrentSpeedX * alienDirection;
            moved = true;
            if (alien.x <= 0 || alien.x + alien.width >= canvas.width) { hitEdge = true; }
            if(alien.y > lowestAlienY) { lowestAlienY = alien.y; }
        }
    }

    if (moved) {
        alienMoveSoundToggle = !alienMoveSoundToggle;
        playSound(alienMoveSoundToggle ? 'alienMove1' : 'alienMove2');
    }

    if (hitEdge) {
        alienDirection *= -1;
        timeBetweenAlienMoves = Math.max(50, timeBetweenAlienMoves * 0.93);
        if (aliens.length > 0) {
             for (const alien of aliens) {
                 if (alien.y + ALIEN_MOVE_SPEED_Y + alien.height < player.y + player.height * 0.5) {
                    alien.y += ALIEN_MOVE_SPEED_Y;
                 } else if (alien.alive) {
                     if (!gameOver) triggerGameOver("Os aliens invadiram!");
                     break;
                 }
             }
        }
    } else {
         if(lowestAlienY + ALIEN_HEIGHT >= player.y && !gameOver) {
             const invadersAliveLow = aliens.some(a => a.alive && a.y === lowestAlienY);
             if(invadersAliveLow) { triggerGameOver("Os aliens invadiram!"); }
         }
    }
}

function alienTryShoot(currentTime) {
    if (gameOver || gamePaused || currentTime - lastAlienShootTime < ALIEN_SHOOT_INTERVAL) return;
    const livingAliens = aliens.filter(a => a.alive);
    if (livingAliens.length === 0) return;
    lastAlienShootTime = currentTime;
    const shooterIndex = Math.floor(Math.random() * livingAliens.length);
    const shooter = livingAliens[shooterIndex];
    const bulletX = shooter.x + shooter.width / 2 - BULLET_WIDTH / 2;
    const bulletY = shooter.y + shooter.height;
    alienBullets.push(new Bullet(bulletX, bulletY, BULLET_WIDTH, BULLET_HEIGHT * 0.8, '#ff5555', BULLET_SPEED * 0.7));
}

function checkCollisions() {
     if (gameOver || gamePaused) return;
    // 1. Balas Jogador vs Aliens
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i]; if (!bullet) continue; let bulletRemoved = false;
        for (let j = aliens.length - 1; j >= 0; j--) {
            const alien = aliens[j]; if (!alien) continue;
            if (alien.alive && bullet.x < alien.x + alien.width && bullet.x + bullet.width > alien.x &&
                bullet.y < alien.y + alien.height && bullet.y + bullet.height > alien.y)
            {
                alien.alive = false; playSound('invaderKilled');
                if (!bulletRemoved) { playerBullets.splice(i, 1); bulletRemoved = true; }
                score += 10 * (ALIEN_ROWS - Math.floor(j / ALIEN_COLS)); updateUI();
                 // break; // Descomente para bala única acertar só um
            }
        }
    }
    // 2. Balas Aliens vs Jogador
    for (let i = alienBullets.length - 1; i >= 0; i--) {
        const bullet = alienBullets[i]; if (!bullet) continue;
        if (bullet.x < player.x + player.width && bullet.x + bullet.width > player.x &&
            bullet.y < player.y + player.height && bullet.y + bullet.height > player.y)
        { alienBullets.splice(i, 1); playerHit(); break; }
    }
     // 3. Verifica fim da onda
    const livingAliens = aliens.filter(a => a.alive);
    if (livingAliens.length === 0 && aliens.length > 0 && !pendingLevelUp) {
        console.log("Todos os aliens mortos, preparando level up...");
        pendingLevelUp = true;
    }
}

function levelUp() {
     console.log("Executando Level Up!");
     alienCurrentSpeedX = Math.min(5, alienCurrentSpeedX + 0.3); // Usa velocidade atual como base
     timeBetweenAlienMoves = 1000; // Reseta tempo inicial da nova onda
     alienDirection = 1;
     playerBullets = []; alienBullets = [];
     createAliens();
     lastAlienMoveTime = performance.now(); lastAlienShootTime = performance.now();
     showMessage("PRÓXIMA ONDA!", 1000);
}

function playerHit() {
    if (gameOver) return; lives--; updateUI(); playSound('playerExplosion');
    let blinkCount = 0; const originalColor = player.color; player.canShoot = false;
    const blinkInterval = setInterval(() => {
        player.color = (blinkCount % 2 === 0) ? 'rgba(255, 255, 255, 0.5)' : originalColor;
        blinkCount++;
        if (blinkCount > 7) {
            clearInterval(blinkInterval); player.color = originalColor;
            if (!gameOver) player.canShoot = true;
        }
    }, 100);
    if (lives <= 0) { triggerGameOver("VOCÊ PERDEU!"); }
    else { showMessage(`ATINGIDO! ${lives} vidas restantes`, 1000); }
}

function triggerGameOver(msg) {
    console.log("Game Over Triggered:", msg); gameOver = true; gamePaused = true;
    if (player) player.color = '#888'; // Verifica se player existe antes de mudar cor
    showMessage(`${msg}<br>Score Final: ${score}<br>Pressione Enter para reiniciar`, 0);
}

function showMessage(text, duration = 1500) {
    messageElement.innerHTML = text; messageElement.style.display = 'block';
    if (duration > 0) {
        setTimeout(() => { if (!gameOver) { messageElement.style.display = 'none'; } }, duration);
    }
}
function hideMessage() { messageElement.style.display = 'none'; }
function updateUI() { scoreElement.textContent = score; livesElement.textContent = lives; }
function handleInput() {
    if (keys['ArrowLeft'] || keys['a']) { player.move('left'); }
    if (keys['ArrowRight'] || keys['d']) { player.move('right'); }
}
function updateStars() { for (const star of stars) { star.update(); } }

// ========================================================
//                  Update & Draw & Loop Principal
// ========================================================
function updateGame(currentTime) {
    console.log(`updateGame: Iniciando. PendingLevelUp: ${pendingLevelUp}`);
    if (pendingLevelUp) {
        levelUp(); pendingLevelUp = false;
        console.log("updateGame: Level up executado, retornando.");
        return; // Sai do update neste quadro
    }
    if (gameOver || gamePaused) {
         console.log(`updateGame: Retornando (GameOver: ${gameOver}, Paused: ${gamePaused}).`);
         return;
    }
    console.log("updateGame: Executando lógica principal...");

    updateStars();
    handleInput();

    for (let i = playerBullets.length - 1; i >= 0; i--) {
        playerBullets[i].update(); if (playerBullets[i].isOffScreen()) { playerBullets.splice(i, 1); }
    }
    for (let i = alienBullets.length - 1; i >= 0; i--) {
        alienBullets[i].update(); if (alienBullets[i].isOffScreen()) { alienBullets.splice(i, 1); }
    }

    moveAliens(currentTime);
    alienTryShoot(currentTime);
    checkCollisions(); // Verifica DEPOIS de mover
}

function drawGame() {
     console.log("drawGame: Iniciando desenho...");
     ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
     drawStars();

     if (!gameOver && player) { // Verifica se player existe
         console.log(`drawGame: Desenhando jogador em x: ${player.x?.toFixed(1)}, y: ${player.y?.toFixed(1)}`);
         player.draw();
     } else if (gameOver) {
         console.log("drawGame: Jogo terminado, jogador não desenhado (ou desenhar explosão).");
     } else {
         console.log("drawGame: Jogador ainda não definido?");
     }

     for (const bullet of playerBullets) bullet.draw();
     for (const alien of aliens) alien.draw();
     for (const bullet of alienBullets) bullet.draw();
     console.log("drawGame: Desenho concluído.");
 }

function gameLoop(currentTime) {
    // Log sempre, mesmo se pausado, para ver se o loop está rodando
    console.log(`gameLoop: Executando frame. Paused: ${gamePaused}, GameOver: ${gameOver}`);

    // A lógica principal e o desenho só ocorrem se não estiver pausado
    // O updateGame já tem a verificação de gameOver internamente
    // if (!gamePaused) { // Removido para desenhar mesmo pausado
       updateGame(currentTime); // updateGame verifica internamente se deve fazer algo
       drawGame(); // drawGame decide o que mostrar baseado em gameOver/player
    // }

    console.log("gameLoop: Frame concluído, solicitando próximo.");
    requestAnimationFrame(gameLoop); // Mantém o loop rodando
}

// ========================================================
//                  Reset e Inicialização
// ========================================================
function resetGame() {
    console.log(">>> resetGame: Iniciando reset...");
    score = 0; lives = 3; gameOver = false; gamePaused = false;
    pendingLevelUp = false; playerBullets = []; alienBullets = []; keys = {};
    updateUI(); hideMessage();

    alienCurrentSpeedX = ALIEN_MOVE_SPEED_X_INITIAL; // Usa a constante
    timeBetweenAlienMoves = 1000; alienDirection = 1;

    player = new Player( canvas.width / 2 - PLAYER_WIDTH / 2, canvas.height - PLAYER_HEIGHT - 20,
                         PLAYER_WIDTH, PLAYER_HEIGHT, '#00dd00' );
    console.log(">>> resetGame: Jogador criado:", player ? `Pos(${player.x.toFixed(1)}, ${player.y.toFixed(1)})` : "FALHOU");

    createAliens();
    console.log(">>> resetGame: Aliens criados:", aliens.length);

    createStars(STAR_COUNT);
    console.log(">>> resetGame: Estrelas criadas:", stars.length);

    lastAlienMoveTime = performance.now(); lastAlienShootTime = performance.now();
    console.log("<<< resetGame: Reset concluído.");
}

// --- Event Listeners ---
window.addEventListener('keydown', (e) => {
    console.log(`Tecla pressionada: ${e.key}. AudioInitialized: ${audioInitialized}`);
    if (!audioInitialized && audioContext) {
        resumeAudioContext();
    }
    keys[e.key] = true;
    if ((e.key === ' ' || e.key === 'ArrowUp') && !gamePaused && !gameOver) {
        e.preventDefault(); player?.shoot(); // Usa optional chaining por segurança
    }
    if (e.key === 'Enter' && gameOver) { resetGame(); }
    if (e.key.toLowerCase() === 'p' && !gameOver) {
        gamePaused = !gamePaused;
        if (gamePaused) {
            showMessage("PAUSADO", 0);
            console.log("Jogo PAUSADO.");
        } else {
            hideMessage();
            resumeAudioContext(); // Tenta garantir que o áudio volte
            lastAlienMoveTime = performance.now() - (timeBetweenAlienMoves - (performance.now() - lastAlienMoveTime) % timeBetweenAlienMoves ); // Ajusta timer
             lastAlienShootTime = performance.now(); // Reseta timer de tiro ao despausar
             console.log("Jogo DESPAUSADO.");
        }
    }
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// --- Iniciar Jogo ---
console.log("Script: Inicializando áudio...");
initAudio();
console.log("Script: Chamando resetGame inicial...");
resetGame();
console.log("Script: Solicitando primeiro frame do gameLoop...");
requestAnimationFrame(gameLoop);
console.log("Script: Inicialização finalizada.");
// ========================================================
//                  FIM DO SCRIPT
// ========================================================