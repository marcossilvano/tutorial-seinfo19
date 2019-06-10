'use strict'

var VALUES = {
    PLAYER_ACCELERATION:    1300,   PLAYER_MAX_VELOCITY:    400,
    PLAYER_SHOT_VELOCITY:   900,    PLAYER_SHOT_RATE:       3,
    PLAYER_SHIELD:          5,      PLAYER_HIT_DELAY:       90,
    ENEMY_VELOCITY:         80,     ENEMY_SHOT_RATE:        180,
    ENEMY_SHOT_VELOCITY:    250,    ENEMY_HEALTH:           7,
    SHIELD_RECT_WIDTH:      200,    LEVEL_INC_DELAY:        5*60
}

var config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        parent: 'game-container',
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280, height: 720
    },
    physics: {
        default: 'arcade', arcade: { debug: false }
    },
    scene: {
        preload: preload, create: create, update: update
    }    
}

/* GAME OBJECTS */
var ship
var cannon
var target
var bg1

var bullets
var enemies
var enemyBullets
var explosions

var cursors
var keyEnter

var state
var launchCounter, launchTime
var levelCounter,  level
var score, scoreText
var gameover, gameoverText

var game = new Phaser.Game(config)

function preload () {
    this.load.image('target', 'assets/target.png')
    this.load.image('cannon', 'assets/cannon.png')
    this.load.image('bg1', 'assets/background.jpg')
    this.load.image('gameover', 'assets/game_over.png')
    this.load.spritesheet('ship', 'assets/ship_124x48.png', { frameWidth: 124, frameHeight: 48 })
    this.load.spritesheet('bullet', 'assets/bullet_20x21.png', { frameWidth: 20, frameHeight: 21 })    
    this.load.spritesheet('bullet-enemy', 'assets/bullet-enemy_20x21.png', { frameWidth: 20, frameHeight: 21 })    
    this.load.spritesheet('enemy', 'assets/enemy2_64x73.png', { frameWidth: 64, frameHeight: 73 })    
    this.load.spritesheet('explosion', 'assets/explosion_31x31.png', { frameWidth: 31, frameHeight: 31 })    
}

function create () {
    state = 'game'
    score = 0
    launchCounter = 0
    launchTime = 120
    level = 0
    levelCounter = 0

    // backgrounds
    bg1 = this.add.tileSprite(game.renderer.width/2, game.renderer.height/2, 0, 0, 'bg1')
    bg1.setScale(game.renderer.width/bg1.width, game.renderer.height/bg1.height)
    bg1.scrollSpeed = 5

    ship = this.physics.add.sprite(game.config.width/2, game.config.height/2, 'ship')
    ship.setDrag(VALUES.PLAYER_ACCELERATION)
    ship.setMaxVelocity(VALUES.PLAYER_MAX_VELOCITY)
    ship.setScale(0.75)
    ship.setSize(ship.width-40, ship.height-30)
    ship.setOffset(30, 20)

    gameover = this.add.sprite(game.config.width/2, game.config.height*1/3, 'gameover')
    gameover.visible = false
    gameover.setScale(2.5)

    cannon = this.physics.add.sprite(ship.x, ship.y, 'cannon')
    cannon.isShooting = false
    cannon.shotCounter = 0
    cannon.shotRate = VALUES.PLAYER_SHOT_RATE
    target = this.physics.add.sprite(ship.x, ship.y, 'target')

    bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 20 })
    enemyBullets = this.physics.add.group({ defaultKey: 'bullet-enemy', maxSize: 10 })
    enemies = this.physics.add.group({ defaultKey: 'enemy', maxSize: 30 })
    explosions = this.physics.add.group({ defaultKey: 'explosion', maxSize: 30 })
    
    this.input.on('pointermove', function (pointer) {
        target.x = pointer.x, target.y = pointer.y
    }, this)    

    this.input.on('pointerdown', function (pointer) {
        cannon.isShooting = true
    }, this)

    this.input.on('pointerup', function (pointer) {
        cannon.isShooting = false
    }, this)    

    this.anims.create({
        key: 'ship-anim', frameRate: 20, repeat: -1,
        frames: this.anims.generateFrameNumbers('ship')
    })
    ship.anims.play('ship-anim', true)

    this.anims.create({
        key: 'bullet-enemy-anim', frameRate: 30, repeat: -1, yoyo: true, 
        frames: this.anims.generateFrameNumbers('bullet-enemy', { start: 0, end: 3 })
    })

    this.anims.create({
        key: 'bullet-anim', frameRate: 30, repeat: -1, yoyo: true, 
        frames: this.anims.generateFrameNumbers('bullet', { start: 0, end: 3 })
    })

    this.anims.create({
        key: 'enemy-anim', frameRate: 20, repeat: -1,
        frames: this.anims.generateFrameNumbers('enemy')
    })
    
    this.anims.create({
        key: 'explosion-anim', frameRate: 20,
        frames: this.anims.generateFrameNumbers('explosion')
    })

    //  Input Events
    cursors = this.input.keyboard.createCursorKeys()
    keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)

    gameoverText = this.add.text(game.renderer.width/2, game.renderer.height*2/3, 
                                'press [ENTER] to restart', { fontSize: '32px', fill: '#ffffff' })
    gameoverText.setOrigin(0.5)
    gameoverText.visible = false

    scoreText = this.add.text(16, 16, 'score: 0', { fontSize: '32px', fill: '#ffffff' })
}

function fireEnemyBullet(context, enemy) {
    var rotation = Phaser.Math.Angle.BetweenPoints(enemy, ship)
    fireBullet(context, enemyBullets, enemy.x, enemy.y,
                rotation, VALUES.ENEMY_SHOT_VELOCITY, 'bullet-enemy-anim')
}

function firePlayerBullet(context) {
    fireBullet(context, bullets, cannon.x, cannon.y, 
                cannon.rotation, VALUES.PLAYER_SHOT_VELOCITY, 'bullet-anim')
}

function fireBullet(context, group, x, y, rotation, speed, anim) {
    var bul = group.get()
    if (!bul)  // if there is no bullet available, don't shoot
        return
    bul.enableBody(true, x, y, true, true)
    var velocity = new Phaser.Math.Vector2()
    context.physics.velocityFromRotation(rotation, speed, velocity)
    bul.setVelocity(velocity.x, velocity.y)
    bul.rotation = rotation
    bul.anims.play(anim, true)
}

function createExplosion(x, y, scale=1) {
    var exp = explosions.get()
    if (!exp)
        return
    exp.enableBody(true, x, y, true, true)
    exp.setScale(scale)
    exp.on('animationcomplete', function(anim, frame, target) {
        target.disableBody(true, true)
    }, this)
    exp.anims.play('explosion-anim', true)
}

function launchEnemy(context) {
    launchCounter++
    if (launchCounter < launchTime) 
        return
    launchCounter = 0

    var posX = Phaser.Math.Between(1, game.renderer.width-1)
    var posY = Phaser.Math.Between(1, game.renderer.height-1)

    var emy = enemies.get()
    if (!emy) // if there is no enemy available, don't shoot
        return
    
    //function onCompleteHandler (tween, targets, myImage)
    emy.enableBody(true, posX, posY, true, true)
    emy.body.enable = false // disable collisions for a while
    emy.anims.play('enemy-anim', true)
    emy.setScale(2)
    // custom properties
    emy.alpha = 0
    emy.health = VALUES.ENEMY_HEALTH
    emy.attackCounter = 0
    var velocity = new Phaser.Math.Vector2()
    var rotation = Phaser.Math.Between(-180, 180) * Phaser.Math.DEG_TO_RAD
    context.physics.velocityFromRotation(rotation, VALUES.ENEMY_VELOCITY, velocity)
    emy.targetVelocity = velocity

    // rising tween goes here!
    var tween = context.tweens.add({
        targets: emy,  scaleX: 1,  scaleY: 1,
        alpha: 0.5, ease: 'Power1', duration: 3000,
        onComplete: onEnemyStart, onCompleteScope: this
    })
}

function onEnemyStart(tween, targets) {
    var emy = targets[0]
    emy.alpha = 1
    emy.body.enable = true
    emy.setVelocity(emy.targetVelocity.x, emy.targetVelocity.y)
}

function updateEnemy(context, emy) {
    if (!emy.active) 
        return

    // attack
    emy.attackCounter++
    if (emy.attackCounter >= VALUES.ENEMY_SHOT_RATE) {
        emy.attackCounter = 0
        fireEnemyBullet(context, emy)
    } 
    context.physics.world.wrap(emy, emy.width/2)
}

function updateMouseAimAndShoot(context) {
    cannon.shotCounter++
    if (cannon.isShooting && cannon.shotCounter > cannon.shotRate) {
        cannon.shotCounter = 0
        firePlayerBullet(context)
    }
    cannon.x = ship.x
    cannon.y = ship.y
    cannon.rotation = Phaser.Math.Angle.BetweenPoints(cannon, target)
}

function updatePlayer(context) {
    if (!ship.active)
        return

    if (cursors.left.isDown) {
        ship.setAccelerationX(-VALUES.PLAYER_ACCELERATION)
    } else 
    if (cursors.right.isDown) {
        ship.setAccelerationX(VALUES.PLAYER_ACCELERATION)
    } else {        
        ship.setAccelerationX(0)
    }

    if (cursors.up.isDown) {
        ship.setAccelerationY(-VALUES.PLAYER_ACCELERATION)
    } else 
    if (cursors.down.isDown) {
        ship.setAccelerationY(VALUES.PLAYER_ACCELERATION)
    } else {
        ship.setAccelerationY(0)
    }
    context.physics.world.wrap(ship)
    updateMouseAimAndShoot(context)
}

function updateBullet(context, bullet) {
    if (!bullet.active) 
        return

    if (!Phaser.Geom.Rectangle.Overlaps(context.physics.world.bounds, bullet.getBounds()))
        bullet.disableBody(true, true) // destroy bullet when outside screen
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
        if (keyEnter.isDown)
            this.scene.restart()
        return
    }
    // game logic
    increaseLevel()
    updatePlayer(this)
    launchEnemy(this)
    bg1.tilePositionX +=  bg1.scrollSpeed

    for (var bul of bullets.getChildren()) 
        updateBullet(this, bul)
    for (var bul of enemyBullets.getChildren())
        updateBullet(this, bul)
    for (var emy of enemies.getChildren())
        updateEnemy(this, emy)
    
    // collisions
    this.physics.world.overlap(ship, enemies, hitPlayer, null, this)
    this.physics.world.overlap(ship, enemyBullets, hitPlayer, null, this)
    this.physics.world.overlap(bullets, enemies, hitEnemy, null, this)
}

function hitPlayer(ship, other) {
    createExplosion(other.x, other.y, 2)
    other.disableBody(true, true)

    ship.disableBody(true, true)
    cannon.disableBody(true, true)
    createExplosion(ship.x, ship.y, 3)
    state = 'gameover'
    gameoverText.visible = true   
    gameover.visible = true   
}

function hitEnemy(bullet, enemy) {
    createExplosion(bullet.x, bullet.y)
    bullet.disableBody(true, true)

    score += 10
    scoreText.setText('score: ' + score)

    enemy.health--
    if (enemy.health <= 0) {
        createExplosion(enemy.x, enemy.y, 2)
        enemy.disableBody(true, true)
    }
}