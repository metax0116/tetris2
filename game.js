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
    gameOver: false,
    keys: {},
    keyPressDuration: {},
    mouseX: 0,
    mouseY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    cameraAngleX: 0,
    cameraAngleY: 0.5
};

class Player {
    constructor() {
        // プレイヤー全体のグループ
        this.mesh = new THREE.Group();
        
        // マテリアル定義
        const redMat = new THREE.MeshPhongMaterial({ color: 0xff0000 }); // 帽子・シャツ
        const blueMat = new THREE.MeshPhongMaterial({ color: 0x0000ff }); // オーバーオール
        const skinMat = new THREE.MeshPhongMaterial({ color: 0xffdbac }); // 肌
        const blackMat = new THREE.MeshPhongMaterial({ color: 0x222222 }); // 靴・髪
        
        // 1. 胴体 (Torso)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.8), blueMat);
        torso.position.y = 1.75;
        torso.castShadow = true;
        this.mesh.add(torso);
        
        // 2. 頭 (Head)
        const head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), skinMat);
        head.position.y = 3.0;
        head.castShadow = true;
        this.mesh.add(head);
        
        // 帽子 (Hat)
        const hat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.3), redMat);
        hat.position.y = 3.5;
        hat.position.z = 0.1;
        this.mesh.add(hat);
        
        // 鼻 (Nose)
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
        nose.position.y = 2.9;
        nose.position.z = 0.6;
        this.mesh.add(nose);
        
        // 3. 腕 (Arms)
        const armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
        
        this.leftArm = new THREE.Mesh(armGeo, redMat);
        this.leftArm.position.set(0.8, 2.0, 0);
        this.mesh.add(this.leftArm);
        
        this.rightArm = new THREE.Mesh(armGeo, redMat);
        this.rightArm.position.set(-0.8, 2.0, 0);
        this.mesh.add(this.rightArm);
        
        // 4. 足 (Legs)
        const legGeo = new THREE.BoxGeometry(0.5, 1.0, 0.5);
        
        this.leftLeg = new THREE.Mesh(legGeo, blueMat);
        this.leftLeg.position.set(0.35, 0.5, 0);
        this.mesh.add(this.leftLeg);
        
        this.rightLeg = new THREE.Mesh(legGeo, blueMat);
        this.rightLeg.position.set(-0.35, 0.5, 0);
        this.mesh.add(this.rightLeg);
        
        // 靴 (Shoes)
        const shoeGeo = new THREE.BoxGeometry(0.6, 0.3, 0.8);
        const leftShoe = new THREE.Mesh(shoeGeo, blackMat);
        leftShoe.position.y = -0.5;
        leftShoe.position.z = 0.1;
        this.leftLeg.add(leftShoe);
        
        const rightShoe = new THREE.Mesh(shoeGeo, blackMat);
        rightShoe.position.y = -0.5;
        rightShoe.position.z = 0.1;
        this.rightLeg.add(rightShoe);

        this.mesh.position.y = 10;
        scene.add(this.mesh);
        
        // 移動・ジャンプのパラメータ
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.direction = 0;
        this.targetDirection = 0;
        this.currentSpeed = 0;
        this.targetSpeed = 0;
        
        this.walkSpeed = 0.2;
        this.runSpeed = 0.5;
        this.maxAirSpeed = 0.4;
        this.speedLerpSpeed = 0.1;
        this.directionLerpSpeed = 0.15;
        
        this.jumpForce = 0.7;
        this.maxJumpForce = 1.0;
        this.gravity = -0.025;
        this.groundDrag = 0.88;
        this.airDrag = 0.98;
        
        // 状態管理
        this.isGrounded = false;
        this.jumpsUsed = 0;
        this.maxJumps = 3;
        this.groundedFrames = 0;
        this.lastJumpInput = false;
        this.jumpButtonHeld = false;
        this.jumpStartVelocity = 0;
        
        // ジャンプ系のアクション追跡
        this.consecutiveJumps = 0;
        this.lastJumpWasGround = false;
        this.canWallKick = false;
        this.wallNormal = new THREE.Vector3(0, 0, 0);
        
        // アニメーション用タイマー
        this.animTimer = 0;
    }
    
    update() {
        this.handleInput();
        this.isGrounded = false;
        this.updateMovement();
        this.updateGravity();
        this.updatePosition();
        this.updateGroundedState();
        this.updateAnimation();
    }
    
    updateAnimation() {
        if (this.currentSpeed > 0.05 && this.isGrounded) {
            // 走り・歩きアニメーション（手足を振る）
            this.animTimer += this.currentSpeed * 0.5;
            const angle = Math.sin(this.animTimer * 10) * 0.5;
            
            this.leftArm.rotation.x = angle;
            this.rightArm.rotation.x = -angle;
            this.leftLeg.rotation.x = -angle;
            this.rightLeg.rotation.x = angle;
        } else if (!this.isGrounded) {
            // ジャンプ中のポーズ
            this.leftArm.rotation.x = -Math.PI / 4;
            this.rightArm.rotation.x = -Math.PI / 4;
            this.leftLeg.rotation.x = 0.2;
            this.rightLeg.rotation.x = -0.2;
        } else {
            // 直立不動ポーズ
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = 0;
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
        }
    }
    
    handleInput() {
        // 入力ベクトル（WASD/矢印キー）
        let inputX = 0;
        let inputZ = 0;
        
        // e.code を優先的に使用して、Shiftキー等の影響を排除する
        if (gameState.keys['KeyW'] || gameState.keys['ArrowUp'] || gameState.keys['w'] || gameState.keys['W']) inputZ -= 1;
        if (gameState.keys['KeyS'] || gameState.keys['ArrowDown'] || gameState.keys['s'] || gameState.keys['S']) inputZ += 1;
        if (gameState.keys['KeyA'] || gameState.keys['ArrowLeft'] || gameState.keys['a'] || gameState.keys['A']) inputX -= 1;
        if (gameState.keys['KeyD'] || gameState.keys['ArrowRight'] || gameState.keys['d'] || gameState.keys['D']) inputX += 1;
        
        const moveLength = Math.sqrt(inputX * inputX + inputZ * inputZ);
        
        if (moveLength > 0) {
            // 1. カメラの水平方向の向きを取得
            const cameraForward = new THREE.Vector3();
            camera.getWorldDirection(cameraForward);
            cameraForward.y = 0;
            cameraForward.normalize();
            
            // normalizeの結果がNaNになるのを防ぐ（念のため）
            if (cameraForward.lengthSq() < 0.01) {
                cameraForward.set(0, 0, -1);
            }
            
            const cameraRight = new THREE.Vector3();
            cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraForward).negate().normalize();
            
            // 2. 入力ベクトルをカメラの向きに合わせて回転
            const moveDir = new THREE.Vector3()
                .addScaledVector(cameraForward, -inputZ) // 前後
                .addScaledVector(cameraRight, inputX)    // 左右
                .normalize();
            
            this.targetDirection = Math.atan2(moveDir.x, moveDir.z);
            
            // Shiftで走り、通常は歩き
            const holdingShift = gameState.keys['Shift'] || gameState.keys['ShiftLeft'] || gameState.keys['ShiftRight'];
            this.targetSpeed = holdingShift ? this.runSpeed : this.walkSpeed;
        } else {
            this.targetSpeed = 0;
        }
        
        // ジャンプ入力
        const jumpPressed = gameState.keys['Space'] || gameState.keys[' '];
        if (jumpPressed && !this.lastJumpInput) {
            const jumpMoveDir = moveLength > 0 ? 1 : 0; 
            this.initiateJump(jumpMoveDir);
        }
        this.lastJumpInput = jumpPressed;
        
        // ジャンプボタン長押しで高く跳ぶ
        if (jumpPressed && this.jumpButtonHeld && this.velocity.y > 0) {
            const jumpDuration = (gameState.keyPressDuration['Space'] || gameState.keyPressDuration[' ']) || 0;
            const jumpInfluence = Math.min(jumpDuration / 20, 0.5);
            this.velocity.y += jumpInfluence * 0.03;
        }
        this.jumpButtonHeld = jumpPressed;
        
        // スムーズに方向を更新
        if (moveLength > 0) {
            let angleDiff = this.targetDirection - this.direction;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            this.direction += angleDiff * this.directionLerpSpeed;
        }
        
        // スムーズに速度を更新
        this.currentSpeed += (this.targetSpeed - this.currentSpeed) * this.speedLerpSpeed;
        
        // 微小な速度はカットして完全に停止させる
        if (this.targetSpeed === 0 && this.currentSpeed < 0.01) {
            this.currentSpeed = 0;
        }
    }
    
    initiateJump(moveLength) {
        if (this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.jumpsUsed = 1;
            this.jumpStartVelocity = this.velocity.y;
            this.consecutiveJumps += 1;
            this.lastJumpWasGround = true;
            this.groundedFrames = 0;
            
            // 三段跳び：3回目のジャンプで高く跳ぶ
            if (this.consecutiveJumps >= 3) {
                this.velocity.y = this.maxJumpForce;
                this.jumpStartVelocity = this.velocity.y;
            }
        } else if (this.jumpsUsed < this.maxJumps) {
            // 空中ジャンプ
            this.velocity.y = this.jumpForce;
            this.jumpsUsed += 1;
            this.jumpStartVelocity = this.velocity.y;
            
            // 幅跳び的な挙動の簡易版（移動中なら少しブースト）
            if (this.currentSpeed > 0.3 && moveLength > 0) {
                this.velocity.y = this.maxJumpForce * 0.8;
                this.jumpStartVelocity = this.velocity.y;
            }
        }
    }
    
    updateMovement() {
        // プレイヤーの向きを更新（モデルの回転）
        this.mesh.rotation.y = this.direction;
        
        // 移動方向（現在のモデルの向き）に基づいて速度ベクトルを生成
        const cos = Math.cos(this.direction);
        const sin = Math.sin(this.direction);
        
        // 空中の場合は制限速度を適用
        const speedLimit = this.isGrounded ? this.currentSpeed : Math.min(this.currentSpeed, this.maxAirSpeed);
        
        this.velocity.x = sin * speedLimit;
        this.velocity.z = cos * speedLimit;
    }
    
    updateGravity() {
        this.velocity.y += this.gravity;
        
        // ドラッグ適用
        const drag = this.isGrounded ? this.groundDrag : this.airDrag;
        this.velocity.x *= drag;
        this.velocity.z *= drag;
    }
    
    updatePosition() {
        this.mesh.position.add(this.velocity);
        
        // プラットフォームとの衝突判定
        checkCollisionsWithPlatforms(this);
        
        // マップ外チェック
        if (this.mesh.position.x < -150 || this.mesh.position.x > 150 || 
            this.mesh.position.z < -150 || this.mesh.position.z > 150 ||
            this.mesh.position.y < -30) {
            this.mesh.position.set(5, 10, 5);
            this.velocity.set(0, 0, 0);
            gameState.health--;
            if (gameState.health <= 0) {
                gameState.gameOver = true;
            }
        }
    }
    
    updateGroundedState() {
        // 床（y=0付近）の判定
        if (this.mesh.position.y < 0.5) {
            this.mesh.position.y = 0.5;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        if (this.isGrounded) {
            this.jumpsUsed = 0;
            this.groundedFrames++;
            
            // 接地フレーム数で三段跳び用のジャンプカウントをリセット
            if (this.groundedFrames > 5) {
                this.consecutiveJumps = 0;
            }
        } else {
            this.groundedFrames = 0;
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
    
    createPlatform(80, 12, 0, 25, 1, 25, 0x00ff00);
    createPlatform(-80, 12, 0, 25, 1, 25, 0xff6347);
    
    createPlatform(20, 8, 0, 20, 1, 20, 0x1e90ff);
    createPlatform(40, 12, 15, 20, 1, 20, 0x32cd32);
    createPlatform(60, 16, 30, 20, 1, 20, 0xdaa520);
    createPlatform(80, 20, 45, 20, 1, 20, 0xff4500);
    
    createPlatform(-20, 8, 0, 20, 1, 20, 0x1e90ff);
    createPlatform(-40, 12, 15, 20, 1, 20, 0x32cd32);
    createPlatform(-60, 16, 30, 20, 1, 20, 0xdaa520);
    createPlatform(-80, 20, 45, 20, 1, 20, 0xff4500);
    
    createPlatform(0, 25, 50, 35, 1, 35, 0x8b008b);
    createPlatform(40, 28, 80, 25, 1, 25, 0x006400);
    createPlatform(-40, 28, 80, 25, 1, 25, 0x008b8b);
    
    createPlatform(0, 10, -120, 15, 1, 15, 0xff1493);
    createPlatform(25, 12, -110, 15, 1, 15, 0x00bfff);
    createPlatform(-25, 12, -110, 15, 1, 15, 0xffb6c1);
    createPlatform(45, 14, -100, 15, 1, 15, 0x7b68ee);
    createPlatform(-45, 14, -100, 15, 1, 15, 0xadff2f);
    
    createPlatform(0, 8, -40, 10, 1, 50, 0xa9a9a9);
    
    createPlatform(90, 8, -30, 20, 1, 20, 0xff6347);
    createPlatform(90, 12, 0, 20, 1, 20, 0xffa500);
    createPlatform(90, 16, 30, 20, 1, 20, 0xffff00);
    
    createPlatform(-90, 8, -30, 20, 1, 20, 0xff6347);
    createPlatform(-90, 12, 0, 20, 1, 20, 0xffa500);
    createPlatform(-90, 16, 30, 20, 1, 20, 0xffff00);
    
    createPlatform(0, 30, 100, 40, 1, 40, 0xffd700);
}

function updateUI() {
    document.getElementById('coinCount').textContent = gameState.coins;
    document.getElementById('starCount').textContent = gameState.stars;
    document.getElementById('healthCount').textContent = gameState.health;
}

function checkCollisionsWithPlatforms(player) {
    if (!gameState.platforms) return;
    
    const playerRadius = 1.0;
    
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
            
            if (minOverlap === overlapTop && player.velocity.y <= 0) {
                player.mesh.position.y = platformTop + playerRadius;
                player.velocity.y = 0;
                player.isGrounded = true;
                player.jumpsUsed = 0;
            } else if (minOverlap === overlapBottom && player.velocity.y > 0) {
                player.mesh.position.y = platformBottom - playerRadius;
                player.velocity.y = 0;
            } else if (minOverlap === overlapLeft && player.velocity.x > 0) {
                player.mesh.position.x = platformLeft - playerRadius;
                player.velocity.x = 0;
            } else if (minOverlap === overlapRight && player.velocity.x < 0) {
                player.mesh.position.x = platformRight + playerRadius;
                player.velocity.x = 0;
            } else if (minOverlap === overlapFront && player.velocity.z > 0) {
                player.mesh.position.z = platformFront - playerRadius;
                player.velocity.z = 0;
            } else if (minOverlap === overlapBack && player.velocity.z < 0) {
                player.mesh.position.z = platformBack + playerRadius;
                player.velocity.z = 0;
            }
        }
    });
}

function updateCamera() {
    // マリオの背後に追従するカメラ
    const cameraDistance = 35;
    const cameraHeight = 20;
    
    const targetPos = player.mesh.position.clone().add(
        new THREE.Vector3(
            Math.sin(gameState.cameraAngleY) * cameraDistance * Math.cos(gameState.cameraAngleX),
            cameraHeight + gameState.cameraAngleX * 15,
            Math.cos(gameState.cameraAngleY) * cameraDistance * Math.cos(gameState.cameraAngleX)
        )
    );
    
    camera.position.lerp(targetPos, 0.08);
    camera.lookAt(player.mesh.position.clone().add(new THREE.Vector3(0, 7, 0)));
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
    gameState.keys[e.code] = true;
    
    // キー押下時間の追跡を開始
    if (!gameState.keyPressDuration[e.code]) {
        gameState.keyPressDuration[e.code] = 0;
    }
    if (!gameState.keyPressDuration[e.key]) {
        gameState.keyPressDuration[e.key] = 0;
    }
    
    if (e.key === ' ') {
        e.preventDefault();
    }
    
    if (e.key === 'c' || e.key === 'C') {
        gameState.cameraAngleX = 0;
        gameState.cameraAngleY = 0.5;
    }

    // 矢印キーでの操作も維持
    if (e.key === 'ArrowLeft') {
        gameState.cameraAngleY += 0.1;
    }
    if (e.key === 'ArrowRight') {
        gameState.cameraAngleY -= 0.1;
    }
    if (e.key === 'ArrowUp') {
        gameState.cameraAngleX = Math.max(-Math.PI / 3, gameState.cameraAngleX - 0.1);
    }
    if (e.key === 'ArrowDown') {
        gameState.cameraAngleX = Math.min(Math.PI / 3, gameState.cameraAngleX + 0.1);
    }
});

// マウス移動によるカメラ操作
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
        const sensitivity = 0.002;
        gameState.cameraAngleY -= e.movementX * sensitivity;
        gameState.cameraAngleX += e.movementY * sensitivity;
        
        // 垂直方向の回転制限
        gameState.cameraAngleX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, gameState.cameraAngleX));
    }
});

// クリックでポインターロック（画面内にマウスを固定）
renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.key] = false;
    gameState.keys[e.code] = false;
    gameState.keyPressDuration[e.key] = 0;
    gameState.keyPressDuration[e.code] = 0;
});

// ウィンドウがフォーカスを失った時にキー入力をリセット（キーの押しっぱなし防止）
window.addEventListener('blur', () => {
    gameState.keys = {};
    Object.keys(gameState.keyPressDuration).forEach(key => {
        gameState.keyPressDuration[key] = 0;
    });
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    
    // キー押下時間を更新
    Object.keys(gameState.keyPressDuration).forEach(key => {
        if (gameState.keys[key]) {
            gameState.keyPressDuration[key]++;
        }
    });
    
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
