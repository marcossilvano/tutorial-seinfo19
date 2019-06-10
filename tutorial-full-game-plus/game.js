'use strict'

/* Código do jogo vai aqui! */

var VALUES = {
    SHIP_ACCELERATION:      1300,
    SHIP_MAX_VELOCITY:      400,
    PLAYER_SHOT_VELOCITY:   900,
    PLAYER_SHOT_RATE:       3,
    PLAYER_SHIELD:          5,
    PLAYER_HIT_DELAY:       90,
    ENEMY_VELOCITY:         80,
    ENEMY_CHANGE_RATE:      45,
    ENEMY_SHOT_RATE:        180,
    ENEMY_SHOT_VELOCITY:    250,
    ENEMY_HEALTH:           3,
    SHIELD_RECT_WIDTH:      200,
    LEVEL_INC_DELAY:        5*60 // 5 seconds to increase a level
}

var config = {
    type: Phaser.AUTO,  // the rendered to use (AUTO means 'try WebGL')
    scale: {            // how the game DIV container will be aligned and scaled
        mode: Phaser.Scale.FIT,
        parent: 'game-container',
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720
    },
    physics: {          // we will use the ARCADE physcis engine
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {            // our scene will be accessed by three life cycle funtions
        preload: preload,
        create: create,
        update: update
    }    
}

var game = new Phaser.Game(config);

// single game objects
var ship
var cannon
var target
// groups (lists) of game objects
var bullets
var enemies
var enemyBullets
var launchCounter
var launchTime
var explosions
var asteroids
// game objects for backgrounds
var bg1
var parallax = []

var cursors
var keyEnter

var state
var level
var levelCounter
var score
var shield
var scoreText
var shieldRect
var graphics
var gameover
var gameoverText

function preload () {
    this.load.image('target', 'assets/target.png');
    this.load.image('cannon', 'assets/cannon.png');
    this.load.image('bg1', 'assets/background1.png');
    this.load.image('parallax', 'assets/background0.png');
    this.load.image('meteor', 'assets/meteor.png');
    this.load.image('gameover', 'assets/game_over.png');
    this.load.spritesheet('ship', 'assets/ship_124x48.png', { frameWidth: 124, frameHeight: 48 });
    this.load.spritesheet('bullet', 'assets/bullet_20x21.png', { frameWidth: 20, frameHeight: 21 });    
    this.load.spritesheet('bullet-enemy', 'assets/bullet-enemy_20x21.png', { frameWidth: 20, frameHeight: 21 });    
    this.load.spritesheet('enemy', 'assets/enemy2_64x73.png', { frameWidth: 64, frameHeight: 73 });    
    this.load.spritesheet('explosion', 'assets/explosion_31x31.png', { frameWidth: 31, frameHeight: 31 });    
}

function createScrollingBackground(context, speed, scale, tint) {
    var bg = context.add.tileSprite(game.config.width/2, game.config.height-240/2*scale, game.config.width, 240*scale, 'parallax');
    bg.scrollSpeed = speed
    bg.tileScaleY = scale
    bg.setTint(tint)
    return bg
}

function create () {
    state = 'game'
    score = 0
    shield = VALUES.PLAYER_SHIELD
    launchCounter = 0
    launchTime = 120
    level = 0
    levelCounter = 0

    // backgrounds
    bg1 = this.add.tileSprite(game.renderer.width/2, game.renderer.height/2, 
                              game.renderer.width, game.renderer.height, 'bg1');
    bg1.counter = 0

    parallax[0] = createScrollingBackground(this, 5, 2.4, 0xAAAAAA)
    parallax[1] = createScrollingBackground(this, 15, 1.5, 0xFFFFFF)
    parallax[2] = createScrollingBackground(this, 20, 0.3, 0x888888)

    //  The platforms group contains the ground and the 2 ledges we can jump on
    asteroids = this.physics.add.group();
    for (var i = 0; i < 6; i++) {
        var ast = asteroids.create(
            Phaser.Math.Between(100, game.renderer.width-100), 
            Phaser.Math.Between(100, game.renderer.height-100), 'meteor');
        ast.setVelocity(Phaser.Math.Between(-90, -30), Phaser.Math.Between(-50, 50))
        ast.setScale(Phaser.Math.FloatBetween(0.5, 0.8))
        ast.setAngle(Phaser.Math.FloatBetween(-180, 180))
        ast.setSize(130, 130)
        ast.setOffset(35, 35)
        ast.setImmovable(true)
    }

    ship = this.physics.add.sprite(game.config.width/2, game.config.height/2, 'ship')
    ship.setDrag(VALUES.SHIP_ACCELERATION)
    ship.setMaxVelocity(VALUES.SHIP_MAX_VELOCITY)
    ship.setScale(0.75)
    ship.setSize(ship.width-40, ship.height-30)
    ship.setOffset(30, 20)
    ship.hitCounter = 0

    gameover = this.add.sprite(game.config.width/2, game.config.height*1/3, 'gameover')
    gameover.setScale(0)

    cannon = this.physics.add.sprite(ship.x, ship.y, 'cannon');
    cannon.isShooting = false
    cannon.shotCounter = 0
    cannon.shotRate = VALUES.PLAYER_SHOT_RATE
    target = this.physics.add.sprite(ship.x, ship.y, 'target');
    //lockMouseAndUpdateTarget(this)

    // The player and its settings
    bullets = this.physics.add.group({
        maxSize: 20,
        defaultKey: 'bullet'
    });

    enemyBullets = this.physics.add.group({
        maxSize: 10,
        defaultKey: 'bullet-enemy'
    });

    enemies = this.physics.add.group({
        maxSize: 30,
        defaultKey: 'enemy'
    });

    explosions = this.physics.add.group({
        maxSize: 30,
        defaultKey: 'explosion'
    });
    
    this.input.on('pointermove', function (pointer) {
        target.x = pointer.x;
        target.y = pointer.y;
    }, this);    

    this.input.on('pointerdown', function (pointer) {
        cannon.isShooting = true
    }, this);

    this.input.on('pointerup', function (pointer) {
        cannon.isShooting = false
    }, this);    

    this.anims.create({
        key: 'ship-idle',
        frames: this.anims.generateFrameNumbers('ship'),
        frameRate: 20,
        repeat: -1
    });
    ship.anims.play('ship-idle', true);

    this.anims.create({
        key: 'bullet-enemy-idle',
        frames: this.anims.generateFrameNumbers('bullet-enemy', { start: 0, end: 3 }),
        frameRate: 30,
        yoyo: true, 
        repeat: -1
    });

    this.anims.create({
        key: 'bullet-idle',
        frames: this.anims.generateFrameNumbers('bullet', { start: 0, end: 3 }),
        frameRate: 30,
        yoyo: true, 
        repeat: -1
    });

    this.anims.create({
        key: 'enemy-idle',
        frames: this.anims.generateFrameNumbers('enemy'),
        frameRate: 20,
        repeat: -1
    });

    this.anims.create({
        key: 'explosion-idle',
        frames: this.anims.generateFrameNumbers('explosion'),
        frameRate: 20
    });

    //  Input Events
    cursors = this.input.keyboard.createCursorKeys();
    keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    gameoverText = this.add.text(game.renderer.width/2, game.renderer.height*2/3, 
                                'press [ENTER] to restart', { fontSize: '32px', fill: '#ffffff' });
    gameoverText.setOrigin(0.5)
    gameoverText.visible = false

    // UI: Score and Shield
    scoreText = this.add.text(16, 16, 'score: 0', { fontSize: '32px', fill: '#ffffff' });
    shieldRect = new Phaser.Geom.Rectangle(0, 0, VALUES.SHIELD_RECT_WIDTH, 20);
    shieldRect.setPosition(game.renderer.width - VALUES.SHIELD_RECT_WIDTH - 20, 20)
    graphics = this.add.graphics()
    updateShieldUI()
}

function fireEnemyBullet(context, enemy) {
    var rotation = Phaser.Math.Angle.BetweenPoints(enemy, ship)
    fireBullet(context, enemyBullets, enemy.x, enemy.y,
                rotation, VALUES.ENEMY_SHOT_VELOCITY, 'bullet-enemy-idle')
}

function firePlayerBullet(context) {
    fireBullet(context, bullets, cannon.x, cannon.y, 
                cannon.rotation, VALUES.PLAYER_SHOT_VELOCITY, 'bullet-idle')
}

function fireBullet(context, group, x, y, rotation, speed, anim) {
    var bul = group.get();
    if (!bul) { // if there is no bullet available, don't shoot
        return
    }
    bul.enableBody(true, x, y, true, true)
    var velocity = new Phaser.Math.Vector2();
    context.physics.velocityFromRotation(rotation, speed, velocity);
    bul.setVelocity(velocity.x, velocity.y)
    bul.rotation = rotation
    bul.anims.play(anim, true);
}

function createExplosion(x, y, scale=1) {
    var exp = explosions.get();
    if (!exp) {
        return
    }
    exp.enableBody(true, x, y, true, true)
    exp.setScale(scale)
    exp.on('animationcomplete', function(anim, frame, target) {
        target.disableBody(true, true)
    }, this);
    exp.anims.play('explosion-idle', true)
}

function launchEnemy(context) {
    launchCounter++
    if (launchCounter < launchTime) 
        return
    launchCounter = 0

    var posX = Phaser.Math.RND.between(1, game.renderer.width-1);
    var posY = Phaser.Math.RND.between(1, game.renderer.height-1);

    var emy = enemies.get();
    if (!emy) { // if there is no enemy available, don't shoot
        return
    }
    
    // rising tween goes here!
    context.tweens.add({
        targets: emy,
        scaleX: 1,
        scaleY: 1,
        alpha: 0.5,
        ease: 'Power1',
        duration: 3000,
        onComplete: onEnemyStart
        //onCompleteParams: [ emy ]
    });
    
    //function onCompleteHandler (tween, targets, myImage)
    emy.enableBody(true, posX, posY, true, true)
    emy.body.enable = false // disable collisions for a while
    emy.anims.play('enemy-idle', true);
    emy.setTint(0xffffff)
    emy.scaleX = 2
    emy.scaleY = 2
    emy.alpha = 0
    emy.dirCounter = VALUES.ENEMY_CHANGE_RATE
    emy.ready = false
    emy.health = VALUES.ENEMY_HEALTH
    emy.hitCounter = 0
    emy.attackCounter = 0
}

function onEnemyStart(tween, targets) {
    var emy = targets[0]
    emy.alpha = 1
    emy.ready = true
    emy.body.enable = true
}

function updateEnemy(context, emy) {
    if (!emy.active || !emy.ready) 
        return

    // enemy hit counter
    emy.hitCounter--
    if (emy.hitCounter <= 0) {
        emy.setTint(0xffffff)
    }

    // attack
    emy.attackCounter++
    if (emy.attackCounter >= VALUES.ENEMY_SHOT_RATE) {
        emy.attackCounter = 0
        fireEnemyBullet(context, emy)
    } 

    // change enemy direction at a regular interval
    emy.dirCounter++
    if (emy.dirCounter >= VALUES.ENEMY_CHANGE_RATE) {
        emy.dirCounter = 0
        var velocity = new Phaser.Math.Vector2();
        var rotation = Phaser.Math.Between(-180, 180) * Phaser.Math.DEG_TO_RAD
        context.physics.velocityFromRotation(rotation, VALUES.ENEMY_VELOCITY, velocity);
        emy.setVelocity(velocity.x, velocity.y)
    }
    context.physics.world.wrap(emy, emy.width/2);
}

function updateBackgrounds() {
    //bg1.tilePositionX +=  1;
    bg1.tileScaleX =  2 + Math.cos(bg1.counter) * 0.2;
    bg1.tileScaleY =  2 + Math.sin(bg1.counter) * 0.2;
    bg1.counter += 0.01

    for (let bg of parallax) {
        bg.tilePositionX += bg.scrollSpeed
    }
}

function updatePlayer(context) {
    if (!ship.active)
        return

    if (cursors.left.isDown) {
        ship.setAccelerationX(-VALUES.SHIP_ACCELERATION)
    } else 
    if (cursors.right.isDown) {
        ship.setAccelerationX(VALUES.SHIP_ACCELERATION)
    } else {        
        ship.setAccelerationX(0)
    }
    
    if (cursors.up.isDown) {
        ship.setAccelerationY(-VALUES.SHIP_ACCELERATION);
    } else 
    if (cursors.down.isDown) {
        ship.setAccelerationY(VALUES.SHIP_ACCELERATION);
    } else {
        ship.setAccelerationY(0);
    }

    context.physics.world.wrap(ship);

    cannon.shotCounter++
    if (cannon.isShooting && cannon.shotCounter > cannon.shotRate) {
        cannon.shotCounter = 0
        firePlayerBullet(context)
    }

    cannon.x = ship.x
    cannon.y = ship.y
    cannon.rotation = Phaser.Math.Angle.BetweenPoints(cannon, target)

    ship.hitCounter--
    if (ship.hitCounter > 0) {
        ship.visible = !ship.visible
        cannon.visible = !cannon.visible
    } else {
        ship.visible = true
        cannon.visible = true
    }
}

function updateBullet(context, bullet) {
    if (!bullet.active) 
        return

    if (!Phaser.Geom.Rectangle.Overlaps(context.physics.world.bounds, bullet.getBounds())) {
        // destroy bullet
        bullet.disableBody(true, true)
    }
}

function increaseLevel() {
    levelCounter++
    if (levelCounter > VALUES.LEVEL_INC_DELAY) {
        levelCounter = 0
        level++
        // decrease enemy launch delay
        launchTime = Math.max(launchTime - 10, 30)
    }
}

function update() {
    if (state == 'gameover') {
        if (keyEnter.isDown) {
            this.scene.restart()
        }
        return;
    }
    // game logic
    increaseLevel()
    updateBackgrounds()
    updatePlayer(this)
    launchEnemy(this)

    for (var bul of bullets.getChildren())
        updateBullet(this, bul)
    for (var bul of enemyBullets.getChildren())
        updateBullet(this, bul)
    for (var emy of enemies.getChildren())
        updateEnemy(this, emy)
    
    this.physics.world.wrap(asteroids, 50);
    // collisions
    this.physics.world.collide(ship, asteroids)
    this.physics.world.collide(enemies, asteroids)

    this.physics.world.overlap(ship, enemies, hitPlayer, null, this)
    this.physics.world.overlap(ship, enemyBullets, hitPlayer, null, this)
    this.physics.world.overlap(bullets, enemies, hitEnemy, null, this)
    this.physics.world.overlap(bullets, asteroids, hitAsteroid, null, this)
    this.physics.world.overlap(enemyBullets, asteroids, hitAsteroid, null, this)
}

function hitAsteroid(bullet, asteroid) {
    createExplosion(bullet.x, bullet.y)
    bullet.disableBody(true, true)
}

function hitPlayer(ship, other) {
    if (ship.hitCounter > 0)
        return
    createExplosion(other.x, other.y, 2)
    other.disableBody(true, true)
    shield--
    ship.hitCounter = VALUES.PLAYER_HIT_DELAY
    if (shield <= 0) {
        ship.disableBody(true, true)
        cannon.disableBody(true, true)
        createExplosion(ship.x, ship.y, 3)
        state = 'gameover'
        gameoverText.visible = true
        this.tweens.add({
            targets: gameover,
            scaleX: 2.5,
            scaleY: 2.5,
            ease: 'Power1',
            duration: 500
        });        
    } 
    updateShieldUI()
}

function hitEnemy(bullet, enemy) {
    createExplosion(bullet.x, bullet.y)
    bullet.disableBody(true, true)

    score += 10
    scoreText.setText('score: ' + score)

    enemy.hitCounter = 7
    enemy.setTint(0xff0000)
    enemy.health--
    if (enemy.health <= 0) {
        createExplosion(enemy.x, enemy.y, 2)
        enemy.disableBody(true, true)
    }
}

function updateShieldUI() {
    graphics.clear()

    shieldRect.width = shield / VALUES.PLAYER_SHIELD * VALUES.SHIELD_RECT_WIDTH
    graphics.fillStyle(0x0000ff)
    graphics.fillRectShape(shieldRect)

    shieldRect.width = VALUES.SHIELD_RECT_WIDTH
    graphics.lineStyle(2, 0x00ff00)
    graphics.fillStyle(0x555555)
    graphics.strokeRectShape(shieldRect)
}