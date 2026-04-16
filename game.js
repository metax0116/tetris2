const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 200, 1000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowShadowMap;
document.getElementById('gameContainer').appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(50, 50, 50);
light.castShadow = true;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
light.shadow.camera.far = 500;
light.shadow.camera.left = -200;
light.shadow.camera.right = 200;
light.shadow.camera.top = 200;
light.shadow.camera.bottom = -200;
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const gameState = {
    coins: 0,
    stars: 0,
    health: 3,
    maxHealth: 3,
    jumpsUsed: 0,
    maxJumps: 3,
    isGrounded: false,
    velocity: new THREE.Vector3(0, 0, 0),
    keys: {},
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    cameraAngleX: 0,
    cameraAngleY: 0.5,
    gameOver: false
};

class Player {
    constructor() {
        const geometry = new THREE.BoxGeometry(2, 3, 2);
        const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.y = 10;
        scene.add(this.mesh);
        
        this.speed = 0.3;
        this.sprintSpeed = 0.5;
        this.jumpForce = 0.7;
        this.gravity = -0.025;
        this.groundDrag = 0.85;
        this.airDrag = 0.95;
        
        this.cameraOffset = new THREE.Vector3(0, 15, 25);
    }
    
    update() {
        const moveVector = new THREE.Vector3(0, 0, 0);
        const currentSpeed = gameState.keys['Shift'] ? this.sprintSpeed : this.speed;
        
        if (gameState.keys['w'] || gameState.keys['W']) {
            moveVector.z += currentSpeed;
        }
        if (gameState.keys['s'] || gameState.keys['S']) {
            moveVector.z -= currentSpeed;
        }
        if (gameState.keys['a'] || gameState.keys['A']) {
            moveVector.x += currentSpeed;
        }
        if (gameState.keys['d'] || gameState.keys['D']) {
            moveVector.x -= currentSpeed;
        }
        
        gameState.velocity.x = moveVector.x;
        gameState.velocity.z = moveVector.z;
        gameState.velocity.y += this.gravity;
        
        const drag = gameState.isGrounded ? this.groundDrag : this.airDrag;
        gameState.velocity.x *= drag;
        gameState.velocity.z *= drag;
        
        this.mesh.position.add(gameState.velocity);
        
        gameState.isGrounded = false;
        
        checkCollisionsWithPlatforms();
        
        if (this.mesh.position.y < 0.1) {
            this.mesh.position.y = 0.1;
            gameState.velocity.y = 0;
            gameState.isGrounded = true;
            gameState.jumpsUsed = 0;
            document.getElementById('jumpsLeft').textContent = gameState.maxJumps - gameState.jumpsUsed;
        }
        
        if (this.mesh.position.x < -150 || this.mesh.position.x > 150 || 
            this.mesh.position.z < -150 || this.mesh.position.z > 150 ||
            this.mesh.position.y < -30) {
            this.mesh.position.set(5, 10, 5);
            gameState.velocity.set(0, 0, 0);
            gameState.health--;
            if (gameState.health <= 0) {
                gameState.gameOver = true;
            }
        }
    }
    
    jump() {
        if (gameState.jumpsUsed < gameState.maxJumps) {
            gameState.velocity.y = this.jumpForce;
            gameState.jumpsUsed++;
            
            if (gameState.jumpsUsed === 2 || gameState.jumpsUsed === 3) {
                showJumpIndicator();
            }
            
            document.getElementById('jumpsLeft').textContent = gameState.maxJumps - gameState.jumpsUsed;
        }
    }
}

class Coin {
    constructor(x, y, z) {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32);
        const material = new THREE.MeshPhongMaterial({ color: 0xffd700 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(x, y, z);
        scene.add(this.mesh);
        
        this.rotation = 0;
        this.bobOffset = 0;
        this.initialY = y;
    }
    
    update() {
        this.rotation += 0.05;
        this.mesh.rotation.y = this.rotation;
        
        this.bobOffset += 0.03;
        this.mesh.position.y = this.initialY + Math.sin(this.bobOffset) * 0.5;
        
        const dist = player.mesh.position.distanceTo(this.mesh.position);
        if (dist < 2) {
            scene.remove(this.mesh);
            gameState.coins++;
            coins = coins.filter(c => c !== this);
        }
    }
}

class Enemy {
    constructor(x, y, z) {
        const geometry = new THREE.BoxGeometry(1.5, 2, 1.5);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(x, y, z);
        scene.add(this.mesh);
        
        this.speed = 0.15;
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.changeTimer = 0;
        this.damage = 1;
    }
    
    update() {
        const dist = this.mesh.position.distanceTo(player.mesh.position);
        
        if (dist < 30) {
            const direction = player.mesh.position.clone().sub(this.mesh.position).normalize();
            this.mesh.position.add(direction.multiplyScalar(this.speed * 0.3));
        } else {
            this.mesh.position.x += this.direction * this.speed;
            this.changeTimer++;
            if (this.changeTimer > 120) {
                this.direction *= -1;
                this.changeTimer = 0;
            }
        }
        
        this.mesh.position.y = Math.sin(Date.now() * 0.005) * 0.5 + 2;
        
        if (dist < 3) {
            gameState.health--;
            this.mesh.position.set(Math.random() * 100 - 50, 5, Math.random() * 100 - 50);
        }
    }
}

class Star {
    constructor(x, y, z) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(x, y, z);
        scene.add(this.mesh);
        
        this.rotation = 0;
        this.bob = 0;
        this.initialY = y;
    }
    
    update() {
        this.rotation += 0.03;
        this.mesh.rotation.x = this.rotation;
        this.mesh.rotation.y = this.rotation * 1.5;
        
        this.bob += 0.02;
        this.mesh.position.y = this.initialY + Math.sin(this.bob) * 1;
        
        const dist = player.mesh.position.distanceTo(this.mesh.position);
        if (dist < 3) {
            scene.remove(this.mesh);
            gameState.stars++;
            stars = stars.filter(s => s !== this);
        }
    }
}

function createPlatform(x, y, z, width, height, depth, color = 0x8b4513) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshPhongMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
        width,
        height,
        depth
    };
    scene.add(mesh);
    gameState.platforms = gameState.platforms || [];
    gameState.platforms.push(mesh);
    return mesh;
}

function createLevel() {
    createPlatform(0, -5, 0, 200, 10, 200);
    
    createPlatform(0, 5, 30, 30, 1, 30, 0x4169e1);
    createPlatform(50, 10, 50, 30, 1, 30, 0x228b22);
    createPlatform(-50, 10, 50, 30, 1, 30, 0xdc143c);
    createPlatform(30, 15, -30, 30, 1, 30, 0xffa500);
    createPlatform(-30, 15, -30, 30, 1, 30, 0x9932cc);
    
    createPlatform(0, 20, -80, 40, 1, 40, 0xffff00);
    
    createPlatform(60, 15, -50, 20, 1, 20, 0x00ffff);
    createPlatform(-60, 15, -50, 20, 1, 20, 0xff69b4);
    
    // 追加ステージ
    createPlatform(80, 12, 0, 25, 1, 25, 0x00ff00);
    createPlatform(-80, 12, 0, 25, 1, 25, 0xff6347);
    
    // 上昇パス
    createPlatform(20, 8, 0, 20, 1, 20, 0x1e90ff);
    createPlatform(40, 12, 15, 20, 1, 20, 0x32cd32);
    createPlatform(60, 16, 30, 20, 1, 20, 0xdaa520);
    createPlatform(80, 20, 45, 20, 1, 20, 0xff4500);
    
    createPlatform(-20, 8, 0, 20, 1, 20, 0x1e90ff);
    createPlatform(-40, 12, 15, 20, 1, 20, 0x32cd32);
    createPlatform(-60, 16, 30, 20, 1, 20, 0xdaa520);
    createPlatform(-80, 20, 45, 20, 1, 20, 0xff4500);
    
    // 浮遊島
    createPlatform(0, 25, 50, 35, 1, 35, 0x8b008b);
    createPlatform(40, 28, 80, 25, 1, 25, 0x006400);
    createPlatform(-40, 28, 80, 25, 1, 25, 0x008b8b);
    
    // チャレンジエリア
    createPlatform(0, 10, -120, 15, 1, 15, 0xff1493);
    createPlatform(25, 12, -110, 15, 1, 15, 0x00bfff);
    createPlatform(-25, 12, -110, 15, 1, 15, 0xffb6c1);
    createPlatform(45, 14, -100, 15, 1, 15, 0x7b68ee);
    createPlatform(-45, 14, -100, 15, 1, 15, 0xadff2f);
    
    // 細いブリッジ
    createPlatform(0, 8, -40, 10, 1, 50, 0xa9a9a9);
    
    // サイドパス
    createPlatform(90, 8, -30, 20, 1, 20, 0xff6347);
    createPlatform(90, 12, 0, 20, 1, 20, 0xffa500);
    createPlatform(90, 16, 30, 20, 1, 20, 0xffff00);
    
    createPlatform(-90, 8, -30, 20, 1, 20, 0xff6347);
    createPlatform(-90, 12, 0, 20, 1, 20, 0xffa500);
    createPlatform(-90, 16, 30, 20, 1, 20, 0xffff00);
    
    // ボーナスエリア
    createPlatform(0, 30, 100, 40, 1, 40, 0xffd700);
}

function showJumpIndicator() {
    const indicator = document.getElementById('jumpIndicator');
    indicator.classList.remove('show');
    setTimeout(() => {
        indicator.classList.add('show');
    }, 10);
}

function updateUI() {
    document.getElementById('coinCount').textContent = gameState.coins;
    document.getElementById('starCount').textContent = gameState.stars;
    document.getElementById('healthCount').textContent = gameState.health;
}

function checkCollisionsWithPlatforms() {
    if (!gameState.platforms) return;
    
    const playerRadius = 1.5;
    
    gameState.platforms.forEach(platform => {
        const data = platform.userData;
        const platformPos = platform.position;
        
        const closestX = Math.max(platformPos.x - data.width / 2, Math.min(player.mesh.position.x, platformPos.x + data.width / 2));
        const closestY = Math.max(platformPos.y - data.height / 2, Math.min(player.mesh.position.y, platformPos.y + data.height / 2));
        const closestZ = Math.max(platformPos.z - data.depth / 2, Math.min(player.mesh.position.z, platformPos.z + data.depth / 2));
        
        const distX = player.mesh.position.x - closestX;
        const distY = player.mesh.position.y - closestY;
        const distZ = player.mesh.position.z - closestZ;
        
        const distance = Math.sqrt(distX * distX + distY * distY + distZ * distZ);
        
        if (distance < playerRadius) {
            const platformTop = platformPos.y + data.height / 2;
            const platformBottom = platformPos.y - data.height / 2;
            const platformLeft = platformPos.x - data.width / 2;
            const platformRight = platformPos.x + data.width / 2;
            const platformFront = platformPos.z - data.depth / 2;
            const platformBack = platformPos.z + data.depth / 2;
            
            const overlapTop = Math.abs(player.mesh.position.y - platformTop);
            const overlapBottom = Math.abs(player.mesh.position.y - platformBottom);
            const overlapLeft = Math.abs(player.mesh.position.x - platformLeft);
            const overlapRight = Math.abs(player.mesh.position.x - platformRight);
            const overlapFront = Math.abs(player.mesh.position.z - platformFront);
            const overlapBack = Math.abs(player.mesh.position.z - platformBack);
            
            const minOverlap = Math.min(overlapTop, overlapBottom, overlapLeft, overlapRight, overlapFront, overlapBack);
            
            if (minOverlap === overlapTop && gameState.velocity.y <= 0) {
                player.mesh.position.y = platformTop + playerRadius;
                gameState.velocity.y = 0;
                gameState.isGrounded = true;
                gameState.jumpsUsed = 0;
                document.getElementById('jumpsLeft').textContent = gameState.maxJumps - gameState.jumpsUsed;
            } else if (minOverlap === overlapBottom && gameState.velocity.y > 0) {
                player.mesh.position.y = platformBottom - playerRadius;
                gameState.velocity.y = 0;
            } else if (minOverlap === overlapLeft && gameState.velocity.x > 0) {
                player.mesh.position.x = platformLeft - playerRadius;
                gameState.velocity.x = 0;
            } else if (minOverlap === overlapRight && gameState.velocity.x < 0) {
                player.mesh.position.x = platformRight + playerRadius;
                gameState.velocity.x = 0;
            } else if (minOverlap === overlapFront && gameState.velocity.z > 0) {
                player.mesh.position.z = platformFront - playerRadius;
                gameState.velocity.z = 0;
            } else if (minOverlap === overlapBack && gameState.velocity.z < 0) {
                player.mesh.position.z = platformBack + playerRadius;
                gameState.velocity.z = 0;
            }
        }
    });
}

function updateCamera() {
    const targetPos = player.mesh.position.clone().add(
        new THREE.Vector3(
            Math.sin(gameState.cameraAngleY) * 30 * Math.cos(gameState.cameraAngleX),
            15,
            Math.cos(gameState.cameraAngleY) * 30 * Math.cos(gameState.cameraAngleX)
        )
    );
    
    camera.position.lerp(targetPos, 0.1);
    camera.lookAt(player.mesh.position.clone().add(new THREE.Vector3(0, 5, 0)));
}

const player = new Player();
let coins = [];
let enemies = [];
let stars = [];

createLevel();

for (let i = 0; i < 15; i++) {
    coins.push(new Coin(
        Math.random() * 100 - 50,
        10 + Math.random() * 20,
        Math.random() * 100 - 50
    ));
}

for (let i = 0; i < 3; i++) {
    enemies.push(new Enemy(
        Math.random() * 80 - 40,
        5,
        Math.random() * 80 - 40
    ));
}

for (let i = 0; i < 3; i++) {
    stars.push(new Star(
        Math.random() * 100 - 50,
        25 + i * 15,
        Math.random() * 100 - 50
    ));
}

document.addEventListener('keydown', (e) => {
    gameState.keys[e.key] = true;
    
    if (e.key === ' ') {
        e.preventDefault();
        player.jump();
    }
    
    if (e.key === 'c' || e.key === 'C') {
        gameState.cameraAngleX = 0;
        gameState.cameraAngleY = 0.5;
    }
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.key] = false;
});

document.addEventListener('mousemove', (e) => {
    gameState.lastMouseX = gameState.mouseX;
    gameState.lastMouseY = gameState.mouseY;
    gameState.mouseX = e.clientX;
    gameState.mouseY = e.clientY;
    
    const deltaX = gameState.mouseX - gameState.lastMouseX;
    const deltaY = gameState.mouseY - gameState.lastMouseY;
    
    gameState.cameraAngleY += deltaX * 0.005;
    gameState.cameraAngleX += deltaY * 0.005;
    gameState.cameraAngleX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, gameState.cameraAngleX));
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    
    if (!gameState.gameOver) {
        player.update();
        coins.forEach(coin => coin.update());
        enemies.forEach(enemy => enemy.update());
        stars.forEach(star => star.update());
        updateCamera();
        updateUI();
        
        if (gameState.health <= 0) {
            gameState.gameOver = true;
            document.getElementById('gameOverStats').innerHTML = `
                <p>Coins Collected: ${gameState.coins}</p>
                <p>Stars Collected: ${gameState.stars}</p>
            `;
            document.getElementById('gameOver').classList.add('show');
        }
    }
    
    renderer.render(scene, camera);
}

animate();
