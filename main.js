const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game State
let score = 0;
let animationId;
let isGameRunning = false;

// Audio (Optional Placeholder)
const sounds = {
    shoot: null,
    explosion: null
};

// UI Elements
const scoreVal = document.getElementById('score-val');
const finalScoreVal = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const restartBtn = document.getElementById('restart-btn');

// --- Classes ---

class Player {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = { x: 0, y: 0 };
        this.speed = 5;
        this.friction = 0.95; // Simulates space drag
    }

    draw() {
        ctx.beginPath();
        // Triangle Ship Shape
        ctx.moveTo(this.x + Math.cos(this.angle) * this.radius, this.y + Math.sin(this.angle) * this.radius);
        ctx.lineTo(this.x + Math.cos(this.angle + 2.6) * this.radius, this.y + Math.sin(this.angle + 2.6) * this.radius);
        ctx.lineTo(this.x + Math.cos(this.angle - 2.6) * this.radius, this.y + Math.sin(this.angle - 2.6) * this.radius);
        ctx.closePath();
        
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // Glow Effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        
        // Reset Shadow for performance in other draws (optional, but good practice if mixed)
        // ctx.shadowBlur = 0; 
    }

    update(keys) {
        // Movement Logic
        if (keys['w'] || keys['arrowup']) this.velocity.y -= 0.5;
        if (keys['s'] || keys['arrowdown']) this.velocity.y += 0.5;
        if (keys['a'] || keys['arrowleft']) this.velocity.x -= 0.5;
        if (keys['d'] || keys['arrowright']) this.velocity.x += 0.5;

        // Apply Velocity
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // Friction
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;

        // Boundary Check
        if (this.x - this.radius < 0) { this.x = this.radius; this.velocity.x = 0; }
        if (this.x + this.radius > canvas.width) { this.x = canvas.width - this.radius; this.velocity.x = 0; }
        if (this.y - this.radius < 0) { this.y = this.radius; this.velocity.y = 0; }
        if (this.y + this.radius > canvas.height) { this.y = canvas.height - this.radius; this.velocity.y = 0; }

        // Angle checks (Point towards mouse is common, but let's keep it simple: Point up or combine with movement?)
        // For this arcade style, let's just make it point up always for now, or rotate based on movement?
        // Let's rotate based on mouse!
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

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
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
    }

    draw() {
        ctx.beginPath();
        // Variety in shapes could go here, for now circles
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.draw();
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
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.restore();
    }

    update() {
        this.velocity.x *= 0.98; // Drag
        this.velocity.y *= 0.98;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02; // Fade out
        this.draw();
    }
}

// --- Game Logic ---

const x = canvas.width / 2;
const y = canvas.height / 2;
let player = new Player(x, y, 15, 'white');
let projectiles = [];
let enemies = [];
let particles = [];
let keys = {};
let mouse = { x: canvas.width / 2, y: 0 }; // Default aim up
let spawnInterval;

function init() {
    score = 0;
    scoreVal.innerText = 0;
    player = new Player(canvas.width / 2, canvas.height / 2, 15, '#ffffff');
    projectiles = [];
    enemies = [];
    particles = [];
    isGameRunning = true;
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    animate();
    clearInterval(spawnInterval);
    spawnInterval = setInterval(spawnEnemies, 1000);
}

function spawnEnemies() {
    if (!isGameRunning) return;
    
    // Spawn from edge
    const r = Math.random() * (30 - 10) + 10;
    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 0 - r : canvas.width + r;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? 0 - r : canvas.height + r;
    }

    const color = `hsl(${Math.random() * 360}, 50%, 50%)`;
    
    // Move towards player
    const angle = Math.atan2(player.y - y, player.x - x);
    const velocity = {
        x: Math.cos(angle) * (1 + Math.random()), 
        y: Math.sin(angle) * (1 + Math.random())
    };

    enemies.push(new Enemy(x, y, r, color, velocity));
}

function animate() {
    if (!isGameRunning) return;
    animationId = requestAnimationFrame(animate);
    
    // Clear with trail effect
    ctx.fillStyle = 'rgba(5, 5, 16, 0.2)'; // 0.2 alpha for trail
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Clear screen

    player.update(keys);

    // Filter out particles
    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            particle.update();
        }
    });

    // Update Projectiles
    projectiles.forEach((projectile, index) => {
        projectile.update();

        // Remove off-screen
        if (projectile.x + projectile.radius < 0 ||
            projectile.x - projectile.radius > canvas.width ||
            projectile.y + projectile.radius < 0 ||
            projectile.y - projectile.radius > canvas.height) {
            setTimeout(() => {
                projectiles.splice(index, 1);
            }, 0);
        }
    });

    // Update Enemies
    enemies.forEach((enemy, index) => {
        enemy.update();

        // Check collision with Player
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (dist - enemy.radius - player.radius < 1) {
            // GAME OVER
            cancelAnimationFrame(animationId);
            isGameRunning = false;
            finalScoreVal.innerText = score;
            gameOverScreen.classList.add('active');
            clearInterval(spawnInterval);
        }

        // Check collision with Projectiles
        projectiles.forEach((projectile, pIndex) => {
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            
            // Hit!
            if (dist - enemy.radius - projectile.radius < 1) {
                
                // Explosions
                for (let i = 0; i < enemy.radius * 2; i++) {
                     particles.push(new Particle(projectile.x, projectile.y, Math.random() * 2, enemy.color, {
                         x: (Math.random() - 0.5) * (Math.random() * 8),
                         y: (Math.random() - 0.5) * (Math.random() * 8)
                     }))
                }

                // Shrink or destroy?
                if (enemy.radius - 10 > 10) {
                    score += 10;
                    scoreVal.innerText = score;
                    // Shrink with animation (gsap ideally, but manual for now)
                    // Simplified: just destroy for arcade feel, maybe split later
                    setTimeout(() => {
                        enemies.splice(index, 1);
                        projectiles.splice(pIndex, 1);
                    }, 0);
                } else {
                    // Destroy
                    score += 20;
                    scoreVal.innerText = score;
                    setTimeout(() => {
                        enemies.splice(index, 1);
                        projectiles.splice(pIndex, 1);
                    }, 0);
                }
            }
        })
    });
}

// Event Listeners
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mousedown', () => {
    if (!isGameRunning) return;
    
    // Shoot
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    const velocity = {
        x: Math.cos(angle) * 8, // Bullet speed
        y: Math.sin(angle) * 8
    };
    
    projectiles.push(new Projectile(player.x, player.y, 4, '#00f3ff', velocity));
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Optional: Re-center player or pause?
});

// UI Controls
startScreen.addEventListener('click', () => {
    if (!isGameRunning) init();
});

// Add spacebar start support
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isGameRunning && !gameOverScreen.classList.contains('active')) {
        init();
    }
});

restartBtn.addEventListener('click', () => {
    init();
});
