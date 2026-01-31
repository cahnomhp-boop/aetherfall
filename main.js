const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- Debug Logger ---
const debugLog = document.getElementById('debug-log');
function log(msg) {
    if (!debugLog) return;
    debugLog.innerHTML += `<div>${msg}</div>`;
    // Keep only last 10 lines
    const lines = debugLog.innerHTML.split('<div>');
    if (lines.length > 10) {
        debugLog.innerHTML = lines.slice(lines.length - 10).join('<div>');
    }
    console.log(msg);
}

window.onerror = function (msg, url, lineNo, columnNo, error) {
    log(`ERROR: ${msg} at line ${lineNo}`);
    return false;
};

log("Script loaded. Canvas size: " + canvas.width + "x" + canvas.height);

// --- Game State ---
let score = 0;
let wave = 1;
let animationId;
let isGameRunning = false;
let frames = 0;

// UI Elements
const scoreVal = document.getElementById('score-val');
const waveVal = document.getElementById('wave-val');
const finalScoreVal = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const restartBtn = document.getElementById('restart-btn');
const startBtnMain = document.getElementById('start-btn-main');

// Mobile UI
const joystickArea = document.getElementById('joystick-area');
const joystickKnob = document.getElementById('joystick-knob');
const shootBtnMobile = document.getElementById('shoot-btn-mobile');

// Check Elements
if (!startBtnMain) log("ERROR: startBtnMain not found!");
if (!joystickArea) log("ERROR: joystickArea not found!");

// Input State
const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let touchMove = { x: 0, y: 0, active: false }; // Joystick vector (-1 to 1)

// --- Utility Functions ---
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

// --- Classes ---

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = '#ffffff';
        this.velocity = { x: 0, y: 0 };
        this.speed = 5;
        this.friction = 0.92;
        this.angle = 0;
        this.powerUp = null; // 'spread', 'shield'
        this.powerUpTimer = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Shield Effect
        if (this.powerUp === 'shield') {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00f3ff';
        }

        ctx.beginPath();
        // Triangle Ship Shape
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-10, -10);
        ctx.closePath();

        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        ctx.restore();
    }

    update() {
        // Movement Logic (Keyboard)
        if (keys['w'] || keys['arrowup']) this.velocity.y -= 0.5;
        if (keys['s'] || keys['arrowdown']) this.velocity.y += 0.5;
        if (keys['a'] || keys['arrowleft']) this.velocity.x -= 0.5;
        if (keys['d'] || keys['arrowright']) this.velocity.x += 0.5;

        // movement Logic (Touch/Joystick)
        if (touchMove.active) {
            this.velocity.x += touchMove.x * 0.8;
            this.velocity.y += touchMove.y * 0.8;
        }

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;

        // Boundaries
        if (this.x < this.radius) { this.x = this.radius; this.velocity.x = 0; }
        if (this.x > canvas.width - this.radius) { this.x = canvas.width - this.radius; this.velocity.x = 0; }
        if (this.y < this.radius) { this.y = this.radius; this.velocity.y = 0; }
        if (this.y > canvas.height - this.radius) { this.y = canvas.height - this.radius; this.velocity.y = 0; }

        // Rotation Logic
        const isMouseActive = mouse.x !== canvas.width / 2 && mouse.y !== canvas.height / 2;

        if (touchMove.active && (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.y) > 0.1)) {
            this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        } else {
            this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        }

        // Powerup Timer
        if (this.powerUp && this.powerUpTimer > 0) {
            this.powerUpTimer--;
            if (this.powerUpTimer <= 0) this.powerUp = null;
        }

        this.draw();
    }
}

class Projectile {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.draw();
    }
}

class Enemy {
    constructor(x, y, radius, color, velocity, type = 'basic') {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.type = type;
        this.shootTimer = 0;
    }

    draw() {
        ctx.beginPath();
        if (this.type === 'shooter') {
            ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        } else if (this.type === 'dasher') {
            ctx.moveTo(this.x, this.y - this.radius);
            ctx.lineTo(this.x + this.radius, this.y + this.radius);
            ctx.lineTo(this.x - this.radius, this.y + this.radius);
            ctx.closePath();
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        }

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
    }

    update() {
        this.draw();

        if (this.type === 'basic') {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
        } else if (this.type === 'dasher') {
            this.x += this.velocity.x * 1.5;
            this.y += this.velocity.y * 1.5;
        } else if (this.type === 'shooter') {
            this.x += this.velocity.x * 0.5;
            this.y += this.velocity.y * 0.5;
            this.shootTimer++;
        }
    }
}

class Particle {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.velocity.x *= 0.96;
        this.velocity.y *= 0.96;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02;
        this.draw();
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 12;
        this.color = type === 'shield' ? '#00f3ff' : '#ff00ff';
        this.angle = 0;
    }

    draw() {
        this.angle += 0.05;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.rect(-8, -8, 16, 16);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.restore();

        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.type === 'spread' ? 'S' : 'H', this.x, this.y + 4);
    }
}

// --- Managers ---

let player = new Player(canvas.width / 2, canvas.height / 2);
let projectiles = [];
let enemies = [];
let particles = [];
let powerUps = [];
let spawnInterval;

function init() {
    try {
        log("Init called");
        score = 0;
        wave = 1;
        frames = 0;
        scoreVal.innerText = 0;
        waveVal.innerText = 1;

        player = new Player(canvas.width / 2, canvas.height / 2);
        projectiles = [];
        enemies = [];
        particles = [];
        powerUps = [];

        isGameRunning = true;
        startScreen.classList.remove('active');
        gameOverScreen.classList.remove('active');

        cancelAnimationFrame(animationId); // Stop previous if any
        animate();
        clearInterval(spawnInterval);
        spawnInterval = setInterval(spawnEnemies, 1000);
        log("Game loop started");
    } catch (e) {
        log("Init error: " + e.message);
    }
}

function spawnEnemies() {
    if (!isGameRunning) return;
    try {
        const r = Math.random() * (30 - 15) + 15;
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? 0 - r : canvas.width + r;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? 0 - r : canvas.height + r;
        }

        const hue = Math.random() * 360;
        const color = `hsl(${hue}, 50%, 50%)`;

        const angle = Math.atan2(player.y - y, player.x - x);
        const speedMultiplier = 1 + (wave * 0.1);
        const velocity = {
            x: Math.cos(angle) * speedMultiplier,
            y: Math.sin(angle) * speedMultiplier
        };

        let type = 'basic';
        if (score > 100 && Math.random() < 0.3) type = 'dasher';
        if (score > 300 && Math.random() < 0.2) type = 'shooter';

        enemies.push(new Enemy(x, y, r, color, velocity, type));
    } catch (e) {
        log("Spawn error: " + e.message);
    }
}

function spawnPowerUp(x, y) {
    if (Math.random() < 0.1) {
        const type = Math.random() < 0.5 ? 'spread' : 'shield';
        powerUps.push(new PowerUp(x, y, type));
    }
}

function shoot() {
    if (!isGameRunning) return;
    try {
        const angle = player.angle;

        const fireBullet = (offsetAngle = 0) => {
            const vel = {
                x: Math.cos(angle + offsetAngle) * 10,
                y: Math.sin(angle + offsetAngle) * 10
            };
            projectiles.push(new Projectile(player.x, player.y, 4, '#00f3ff', vel));
        };

        fireBullet();

        if (player.powerUp === 'spread') {
            fireBullet(0.2);
            fireBullet(-0.2);
        }
    } catch (e) {
        log("Shoot error: " + e.message);
    }
}


function animate() {
    if (!isGameRunning) return;
    animationId = requestAnimationFrame(animate);
    frames++;

    try {
        ctx.fillStyle = 'rgba(5, 5, 16, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        player.update();

        particles.forEach((p, i) => {
            if (p.alpha <= 0) particles.splice(i, 1);
            else p.update();
        });

        powerUps.forEach((p, i) => {
            p.draw();
            const dist = Math.hypot(player.x - p.x, player.y - p.y);
            if (dist - player.radius - p.radius < 1) {
                player.powerUp = p.type;
                player.powerUpTimer = 600;
                powerUps.splice(i, 1);
            }
        });

        projectiles.forEach((p, i) => {
            p.update();
            if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                setTimeout(() => projectiles.splice(i, 1), 0);
            }
        });

        enemies.forEach((enemy, i) => {
            if (frames % 60 === 0 && enemy.type === 'basic') {
                const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                const speedMultiplier = 1 + (wave * 0.1);
                enemy.velocity = { x: Math.cos(angle) * speedMultiplier, y: Math.sin(angle) * speedMultiplier };
            }

            enemy.update();

            const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (dist - enemy.radius - player.radius < 1) {
                if (player.powerUp === 'shield') {
                    player.powerUp = null;
                    enemies.splice(i, 1);
                    for (let j = 0; j < 10; j++) particles.push(new Particle(enemy.x, enemy.y, 3, enemy.color, { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 }));
                } else {
                    cancelAnimationFrame(animationId);
                    isGameRunning = false;
                    finalScoreVal.innerText = score;
                    gameOverScreen.classList.add('active');
                    clearInterval(spawnInterval);
                    log("Game Over");
                }
            }

            projectiles.forEach((p, pIndex) => {
                const pDist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (pDist - enemy.radius - p.radius < 1) {
                    for (let k = 0; k < 8; k++) {
                        particles.push(new Particle(p.x, p.y, Math.random() * 2, enemy.color, {
                            x: (Math.random() - 0.5) * 6,
                            y: (Math.random() - 0.5) * 6
                        }))
                    }

                    if (enemy.radius - 10 > 10) {
                        score += 10;
                        enemy.radius -= 10;
                        setTimeout(() => projectiles.splice(pIndex, 1), 0);
                    } else {
                        score += 20;
                        spawnPowerUp(enemy.x, enemy.y);
                        setTimeout(() => {
                            enemies.splice(i, 1);
                            projectiles.splice(pIndex, 1);
                        }, 0);
                    }
                    scoreVal.innerText = score;

                    if (score > wave * 500) {
                        wave++;
                        waveVal.innerText = wave;
                    }
                }
            })
        });
    } catch (e) {
        log("Animate error: " + e.message);
        isGameRunning = false; // Stop loop on error
    }
}

// --- Input Handling ---

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.code === 'Space') {
        if (!isGameRunning && !gameOverScreen.classList.contains('active')) {
            init();
        } else if (isGameRunning) {
            shoot();
        }
    }
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', () => shoot());

if (joystickArea) {
    joystickArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchMove.active = true;
        updateJoystick(e.touches[0]);
    });
    joystickArea.addEventListener('touchmove', (e) => {
        e.preventDefault();
        updateJoystick(e.touches[0]);
    });
    joystickArea.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchMove.active = false;
        touchMove.x = 0;
        touchMove.y = 0;
        joystickKnob.style.top = '50%';
        joystickKnob.style.left = '50%';
    });
}

function updateJoystick(touch) {
    if (!joystickArea) return; // Safety
    const rect = joystickArea.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;

    const dist = Math.min(Math.hypot(dx, dy), rect.width / 2);
    const angle = Math.atan2(dy, dx);

    const moveX = Math.cos(angle) * dist;
    const moveY = Math.sin(angle) * dist;

    joystickKnob.style.left = `calc(50% + ${moveX}px)`;
    joystickKnob.style.top = `calc(50% + ${moveY}px)`;

    // Normalize to -1 to 1
    touchMove.x = moveX / (rect.width / 2);
    touchMove.y = moveY / (rect.height / 2);
}

if (shootBtnMobile) {
    shootBtnMobile.addEventListener('touchstart', (e) => {
        e.preventDefault();
        shoot();
        shootBtnMobile.style.background = 'var(--neon-pink)';
    });
    shootBtnMobile.addEventListener('touchend', (e) => {
        e.preventDefault();
        shootBtnMobile.style.background = 'rgba(255, 0, 255, 0.1)';
    });
}

if (startBtnMain) {
    startBtnMain.addEventListener('click', () => {
        log("Start btn clicked");
        init();
    });
    startBtnMain.addEventListener('touchstart', (e) => {
        e.preventDefault();
        log("Start btn touched");
        init();
    });
}

if (restartBtn) {
    restartBtn.addEventListener('click', init);
    restartBtn.addEventListener('touchstart', (e) => { e.preventDefault(); init(); });
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
