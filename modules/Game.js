import Util from './Util.js'

export default class Game extends Phaser.Scene
{
  constructor ()
  {
    super('game')

    this.fps           = 60   // how many 'update' frames per second
    this.step          = 1/this.fps  // how long is each frame (in seconds)
    this.segments      = []   // array of road segments
    this.background    = null // our background image
    this.sprites       = null // our spritesheet
    this.width         = 1920
    this.height        = 1080
    this.resolution    = null // scaling factor to provide resolution independence (computed)
    this.roadWidth     = 2000 // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
    this.segmentLength = 200  // length of a single segment
    this.rumbleLength  = 3    // number of segments per red/white rumble strip
    this.trackLength   = null // z length of entire track (computed)
    this.lanes         = 3    // number of lanes
    this.fieldOfView   = 100  // angle (degrees) for field of view
    this.cameraHeight  = 1000 // z height of camera
    this.cameraDepth   = 1 / Math.tan((this.fieldOfView/2) * Math.PI/180) // z distance camera is from screen (computed)
    this.drawDistance  = 500  // number of segments to draw
    this.playerX       = 0    // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
    this.playerY       = 0
    this.playerZ       = null // player relative z distance from camera (computed)
    this.fogDensity    = 5    // exponential fog density
    this.position      = 0    // current camera Z position (add playerZ to get player's absolute Z position)
    this.speed         = 0    // current speed
    this.maxSpeed      = this.segmentLength/this.step // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
    this.accel         =  this.maxSpeed/5  // acceleration rate - tuned until it 'felt' right
    this.breaking      = -this.maxSpeed    // deceleration rate when braking
    this.decel         = -this.maxSpeed/5  // 'natural' deceleration rate when neither accelerating, nor braking
    this.offRoadDecel  = -this.maxSpeed/2  // off road deceleration is somewhere in between
    this.offRoadLimit  =  this.maxSpeed/4  // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)
    this.centrifugal    = 0//0.3 // centrifugal force multiplier when going around curves
    
    this.debugMaxY    = 0

    this.debugOn      = false

    this.autoDrive    = true

    this.keyFaster    = false
    this.keySlower    = false
    this.keyLeft      = false
    this.keyRight     = false

    this.last         = Util.timestamp()
    this.gdt          = 0

    this.ctx          = null

    this.cX           = this.width/2
    this.cY           = this.height/2

    this.bg_sky
    this.bg_clouds
    this.bg_hills
    this.bg_trees

    this.cloudSpeed  = 0.001 // background cloud layer scroll speed when going around curve (or up hill)
    this.hillSpeed   = 0.002 // background hill layer scroll speed when going around curve (or up hill)
    this.treeSpeed   = 0.003 // background tree layer scroll speed when going around curve (or up hill)
    this.cloudOffset = 0   // current sky scroll offset
    this.hillOffset  = 0   // current hill scroll offset
    this.treeOffset  = 0   // current tree scroll offset

    this.allSprites = []

    this.sprites      = {
      TREE:                   { x:    5, y:  555, w:  135, h:  333 },
      PLAYER_UPHILL_LEFT:     { x: 1383, y:  961, w:   80, h:   45 },
      PLAYER_UPHILL_STRAIGHT: { x: 1295, y: 1018, w:   80, h:   45 },
      PLAYER_UPHILL_RIGHT:    { x: 1385, y: 1018, w:   80, h:   45 },
      PLAYER_LEFT:            { x:  995, y:  480, w:   80, h:   41 },
      PLAYER_STRAIGHT:        { x: 1085, y:  480, w:   80, h:   41 },
      PLAYER_RIGHT:           { x:  995, y:  531, w:   80, h:   41 }
    }

    this.sprites.scale = 0.3 * (1/this.sprites.PLAYER_STRAIGHT.w) // the reference sprite width should be 1/3rd the (half-)roadWidth

    this.colors       = {
      SKY:  0x72D7EE,
      TREE: 0x0051080,
      FOG:  0x005108,
      LIGHT:  { road: 0x6B6B6B, grass: 0x10AA10, rumble: 0x555555, lane: 0xCCCCCC  },
      DARK:   { road: 0x696969, grass: 0x009A00, rumble: 0xBBBBBB                   },
      START:  { road: 0xFFFFFF,   grass: 0xFFFFFF,   rumble: 0xFFFFFF                     },
      FINISH: { road: 0x000000,   grass: 0x000000,   rumble: 0x000000                     }
    }

    this.road         = {
      LENGTH: { NONE: 0, SHORT:  25, MEDIUM:  50, LONG:  100 },
      HILL:   { NONE: 0, LOW:    20, MEDIUM:  40, HIGH:   60 },
      CURVE:  { NONE: 0, EASY:    2, MEDIUM:   4, HARD:    6 }
    }
    
  }

  create ()
  {
    this.bg_sky = this.add.image(this.cX, this.cY, 'sky')
    this.bg_clouds = this.add.tileSprite(0, 0, this.width, this.height, 'clouds').setOrigin(0)
    this.bg_hills = this.add.tileSprite(0, 0, this.width, this.height, 'hills').setOrigin(0)
    this.bg_trees = this.add.tileSprite(0, 0, this.width, this.height, 'trees').setOrigin(0)

    this.cursors = this.input.keyboard.createCursorKeys()

    if (this.debugOn)
    {
      this.debugShade = this.add.text(41, 41, 'DEBUG', { color: '#000000', fontSize: '20px' }).setDepth(1999)
      this.debug = this.add.text(40, 40, 'DEBUG', { color: '#ff0000', fontSize: '20px' }).setDepth(2000)
    }

    this.ctx = this.add.graphics()

    this.player = this.add.image(this.cX, this.height, 'car')
    this.player.y -= this.player.height/2

    this.resetRoad()
    this.resetSprites()

    // delay drive start
    if (this.autoDrive)
    {
      this.time.addEvent({
        delay: 1000,
        callback: () => {
          this.overrideFaster = true
        },
        callbackScope: this,
        loop: false
      })
    }
  }

  update (timestep, delta)
  {

    this.keyLeft    = this.cursors.left.isDown
    this.keyRight   = this.cursors.right.isDown
    this.keyFaster  = this.cursors.up.isDown
    if (this.overrideFaster)
    {
      this.keyFaster = true
    }
    this.keySlower  = this.cursors.down.isDown

    let now = Util.timestamp()
    let dt = Math.min(1, (now - this.last) / 1000)
    this.gdt = this.gdt + dt
    while (this.gdt > this.step) {
      this.gdt = this.gdt - this.step
      // this.ctx.destroy()
      this.ctx.clear()
      this.clearSprites()
      this.render()
      this.playerUpdate(dt)
    }

    this.last = now

    if (this.debugOn)
    {
      const debugText = [
        'last: ' + this.last,
        'now: ' + now,
        'timestep: ' + timestep,
        'delta: ' + delta,
        'step: ' + this.step,
        'dt: ' + dt,
        'gdt: ' + this.gdt,
        'this.keyLeft: ' + this.keyLeft,
        'this.keyRight: ' + this.keyRight,
        'this.keyFaster: ' + this.keyFaster,
        'this.keySlower: ' + this.keySlower,
        'this.position: ' + this.position,
        'this.trackLength: ' + this.trackLength,
        'this.playerX: ' + this.playerX,
        'this.playerY: ' + this.playerY,
        'this.speed: ' + this.speed,
        'this.debugMaxY: ' + this.debugMaxY,
        'this.bg_clouds.tilePositionX: ' + this.bg_clouds.tilePositionX,
        'this.bg_hills.tilePositionX: ' + this.bg_hills.tilePositionX,
        'this.bg_trees.tilePositionX: ' + this.bg_trees.tilePositionX,
        'this.bg_clouds.y: ' + this.bg_clouds.y,
        'this.bg_hills.y: ' + this.bg_hills.y,
        'this.bg_trees.y: ' + this.bg_trees.y
      ]
      this.debugShade.setText(debugText)
      this.debug.setText(debugText)
    }

  }

  clearSprites ()
  {
    this.allSprites.forEach((sprite) => {
      sprite.destroy()
    })
    this.allSprites = []
  }

  resetRoad ()
  { 
    this.segments = []

    // this.addStraight(this.road.LENGTH.SHORT/2)
    // this.addHill(this.road.LENGTH.SHORT, this.road.HILL.LOW)
    // this.addStraight(this.road.LENGTH.SHORT/2)
    // this.addDownhillToEnd(0)

    this.addLowRollingHills()
    this.addCurve(this.road.LENGTH.MEDIUM, this.road.CURVE.MEDIUM, this.road.HILL.LOW)
    this.addLowRollingHills()
    this.addCurve(this.road.LENGTH.LONG, this.road.CURVE.MEDIUM, this.road.HILL.MEDIUM)
    this.addStraight()
    this.addCurve(this.road.LENGTH.LONG, -this.road.CURVE.MEDIUM, this.road.HILL.MEDIUM)
    this.addHill(this.road.LENGTH.LONG, this.road.HILL.HIGH)
    this.addCurve(this.road.LENGTH.LONG, this.road.CURVE.MEDIUM, -this.road.HILL.LOW)
    this.addHill(this.road.LENGTH.LONG, -this.road.HILL.MEDIUM)
    this.addStraight()
    this.addHill(this.road.LENGTH.LONG, this.road.HILL.HIGH)
    this.addDownhillToEnd(0)
    this.addStraight()

    this.segments[this.findSegment(this.playerZ).index + 2].color = this.colors.START
    this.segments[this.findSegment(this.playerZ).index + 3].color = this.colors.START
    for(var n = 0 ; n < this.rumbleLength ; n++)
    {
      this.segments[this.segments.length-1-n].color = this.colors.FINISH
    }

    this.trackLength = this.segments.length * this.segmentLength

  }

  addRoad (enter, hold, leave, curve, y)
  {
    let startY  = this.lastY()
    let endY    = startY + (Util.toInt(y, 0) * this.segmentLength)
    let n
    let total   = enter + hold + leave

    for(n = 0 ; n < enter ; n++)
    {
      this.addSegment(Util.easeIn(0, curve, n/enter), Util.easeInOut(startY, endY, n/total))
    }

    for(n = 0 ; n < hold  ; n++)
    {
      this.addSegment(curve, Util.easeInOut(startY, endY, (enter+n)/total))
    }

    for(n = 0 ; n < leave ; n++)
    {
      this.addSegment(Util.easeInOut(curve, 0, n/leave), Util.easeInOut(startY, endY, (enter+hold+n)/total))
    }
  }

  addSegment (curve, y)
  {
    let n = this.segments.length
    this.segments.push({
       index: n,
          p1: { world: { y: this.lastY(), z:  n   *this.segmentLength }, camera: {}, screen: {} },
          p2: { world: { y: y,  z: (n+1)*this.segmentLength }, camera: {}, screen: {} },
       curve: curve,
       sprites: [],
       color: Math.floor(n/this.rumbleLength)%2 ? this.colors.DARK : this.colors.LIGHT
    })
  }

  lastY ()
  {
    return (this.segments.length == 0) ? 0 : this.segments[this.segments.length-1].p2.world.y
  }

  addSprite (n, sprite, offset)
  {
    this.segments[n].sprites.push({ source: sprite, offset: offset })
  }

  resetSprites()
  {

    // this.addSprite(20,  'tree', -1)
    // this.addSprite(40,  'tree', -1)
    // this.addSprite(60,  'tree', -1)
    // this.addSprite(80,  'tree', -1)
    // this.addSprite(100, 'tree', -1)
    // this.addSprite(120, 'tree', -1)
    // this.addSprite(140, 'tree', -1)
    // this.addSprite(160, 'tree', -1)
    // this.addSprite(180, 'tree', -1)
  
    // this.addSprite(240, 'tree', -1.2)
    // this.addSprite(240, 'tree',  1.2)
  
    let n
    for(n = 0 ; n < this.segments.length ; n += 5) {
      // this.addSprite(n, 'tree', 1.1)
      // this.addSprite(n, 'tree', -1.1)
      this.addSprite(n + Util.randomInt(0,5), 'tree', 2.1 + (Math.random() * 25))
      this.addSprite(n + Util.randomInt(0,5), 'tree', -2.1 - (Math.random() * 25))
      this.addSprite(n + Util.randomInt(0,5), 'tree', 1.1 + (Math.random() * 5))
      this.addSprite(n + Util.randomInt(0,5), 'tree', -1.1 - (Math.random() * 5))
    }
  
  }

  addHill (num, height)
  {
    num    = num    || this.road.LENGTH.MEDIUM
    height = height || this.road.HILL.MEDIUM
    this.addRoad(num, num, num, 0, height)
  }

  addLowRollingHills (num, height)
  {
    num    = num    || this.road.LENGTH.SHORT
    height = height || this.road.HILL.LOW
    this.addRoad(num, num, num,  0,  height/2)
    this.addRoad(num, num, num,  0, -height)
    this.addRoad(num, num, num,  0,  height)
    this.addRoad(num, num, num,  0,  0)
    this.addRoad(num, num, num,  0,  height/2)
    this.addRoad(num, num, num,  0,  0)
  }

  addDownhillToEnd (num)
  {
    num = num || 200
    this.addRoad(num, num, num, -this.road.CURVE.EASY, -this.lastY()/this.segmentLength);
  }

  addStraight (num)
  {
    num = num || this.road.LENGTH.MEDIUM
    this.addRoad(num, num, num, 0)
  }

  addCurve (num, curve)
  {
    num    = num    || this.road.LENGTH.MEDIUM;
    curve  = curve  || this.road.CURVE.MEDIUM;
    this.addRoad(num, num, num, curve);
  }
  
  addSCurves ()
  {
    this.addRoad(this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM,  -this.road.CURVE.EASY);
    this.addRoad(this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM,   this.road.CURVE.MEDIUM);
    this.addRoad(this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM,   this.road.CURVE.EASY);
    this.addRoad(this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM,  -this.road.CURVE.EASY);
    this.addRoad(this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM, this.road.LENGTH.MEDIUM,  -this.road.CURVE.MEDIUM);
  }

  playerUpdate (dt)
  {

    let playerSegment = this.findSegment(this.position+this.playerZ)
    let speedPercent  = this.speed/this.maxSpeed
    let dx            = dt * 2 * speedPercent // at top speed, should be able to cross from left to right (-1 to +1) in 1 second

    this.position = Util.increase(this.position, dt * this.speed, this.trackLength)
  
    if (this.keyLeft)
    {
      this.playerX = this.playerX - dx
    }
    else if (this.keyRight)
    {
      this.playerX = this.playerX + dx
    }

    this.bg_clouds.tilePositionX += this.cloudSpeed * 100
    this.bg_clouds.tilePositionX += (dx * 10000 * speedPercent * playerSegment.curve * this.cloudSpeed)
    this.bg_hills.tilePositionX += (dx * 10000 * speedPercent * playerSegment.curve * this.hillSpeed)
    this.bg_trees.tilePositionX += (dx * 10000 * speedPercent * playerSegment.curve * this.treeSpeed)

    this.bg_clouds.tilePositionY = this.playerY * this.cloudSpeed * -2
    this.bg_hills.tilePositionY = this.playerY * this.hillSpeed * -2
    this.bg_trees.tilePositionY = this.playerY * this.treeSpeed * -2

    this.playerX = this.playerX - (dx * speedPercent * playerSegment.curve * this.centrifugal)
  
    if (this.keyFaster)
      this.speed = Util.accelerate(this.speed, this.accel, dt)
    else if (this.keySlower)
      this.speed = Util.accelerate(this.speed, this.breaking, dt)
    else
      this.speed = Util.accelerate(this.speed, this.decel, dt)
  
    if (((this.playerX < -1) || (this.playerX > 1)) && (this.speed > this.offRoadLimit))
      this.speed = Util.accelerate(this.speed, this.offRoadDecel, dt)
  
    this.playerX = Util.limit(this.playerX, -2, 2) // dont ever let player go too far out of bounds
    this.speed   = Util.limit(this.speed, 0, this.maxSpeed) // or exceed maxSpeed
  
  }

  render ()
  {
    let baseSegment = this.findSegment(this.position)
    let basePercent = Util.percentRemaining(this.position, this.segmentLength)
    let playerSegment = this.findSegment(this.position+this.playerZ)
    let playerPercent = Util.percentRemaining(this.position+this.playerZ, this.segmentLength)
    this.playerY      = Util.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent)
    
    let dx          = - (baseSegment.curve * basePercent)
    let x           = 0
    let maxy        = this.height

    let n
    let segment
    for(n = 0 ; n < this.drawDistance ; n++) {
  
      segment = this.segments[(baseSegment.index + n) % this.segments.length];
      segment.looped = segment.index < baseSegment.index
      segment.clip = maxy
  
      Util.project(segment.p1, (this.playerX * this.roadWidth) - x, this.playerY + this.cameraHeight, this.position - (segment.looped ? this.trackLength : 0), this.cameraDepth, this.width, this.height, this.roadWidth)
      Util.project(segment.p2, (this.playerX * this.roadWidth) - x - dx, this.playerY + this.cameraHeight, this.position - (segment.looped ? this.trackLength : 0), this.cameraDepth, this.width, this.height, this.roadWidth)

      x = x + dx
      dx = dx + segment.curve

      if ((segment.p1.camera.z <= this.cameraDepth)         || // behind us
          (segment.p2.screen.y >= segment.p1.screen.y) || // back face cull
          (segment.p2.screen.y >= maxy))                  // clip by (already rendered) hill
        continue
  
      this.renderSegment(this.ctx, this.width,
                      segment.p1.screen.x,
                      segment.p1.screen.y,
                      segment.p1.screen.w,
                      segment.p2.screen.x,
                      segment.p2.screen.y,
                      segment.p2.screen.w,
                      segment.color)
  
      maxy = segment.p1.screen.y
      this.debugMaxY = maxy
    }

    for(n = (this.drawDistance-1) ; n > 0 ; n--) {
      segment = this.segments[(baseSegment.index + n) % this.segments.length]
    
      // render roadside sprites
      let i
      for(i = 0 ; i < segment.sprites.length ; i++) {
        let sprite      = segment.sprites[i]
        let spriteScale = segment.p1.screen.scale
        let spriteX     = segment.p1.screen.x + (spriteScale * sprite.offset * this.roadWidth * this.width/2)
        let spriteY     = segment.p1.screen.y

        this.renderSprite(sprite.source, spriteScale, spriteX, spriteY, (sprite.offset < 0 ? -1 : 0), -1, segment.clip)
      }
    
    }
  }

  renderSprite (sprite, scale, destX, destY, offsetX, offsetY, clipY)
  {
    // console.log(`sprite: ${sprite}, offsetX: ${offsetX}, offsetY: ${offsetY}`)

    // 135 x 333

    //  scale for projection AND relative to roadWidth (for tweakUI)
    let destW  = (135 * scale * this.width/2) * (this.sprites.scale * this.roadWidth)
    let destH  = (333 * scale * this.width/2) * (this.sprites.scale * this.roadWidth)
    // console.log(`destW: ${destW}, destH: ${destH}`)


    // console.log(`destY: ${destY}`)
    destX = destX + (destW * (offsetX || 0))
    destY = destY + (destH * (offsetY || 0))
    // console.log(`destX: ${destX}, destY: ${destY}`)

    let clipH = clipY ? Math.max(0, destY+destH-clipY) : 0
    // console.log(`destY: ${destY}, clipY: ${clipY}, clipH: ${clipH}`)

    if (clipH < destH)
    {
      // console.log(`destX: ${destX}, destY: ${destY}, destW: ${destW}, destH: ${destH}`)
      // console.log(`clipY: ${clipY}, clipH: ${clipH}`)

      // ctx.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH)

      let thisSprite = this.add.image(destX, destY, 'tree')
      thisSprite.setOrigin(0, 0)
      thisSprite.displayWidth = destW
      thisSprite.displayHeight = destH// - clipH
      thisSprite.setCrop(0, 0, 135, 333 - (333*clipH/destH))
      // thisSprite.y += 200
      this.allSprites.push(thisSprite)
    }

  }

  renderBG (bg, rotation, offset)
  {
    // console.log(`---------------------------`)
    rotation = rotation || 0
    offset   = offset   || 0

    // console.log(`rotation: ${rotation}, offset: ${offset}`)

    var imageW = bg.width/2
    var imageH = bg.height

    // console.log(`bg.width: ${bg.width}, bg.h: ${bg.height}, bg.x: ${bg.x}, bg.y: ${bg.y}`)

    var sourceX = bg.tilePositionX + Math.floor(bg.width * rotation)
    var sourceY = bg.y
    var sourceW = Math.min(imageW, bg.x+bg.width-sourceX)
    var sourceH = imageH
    // console.log(`sourceX: ${sourceX}, sourceY: ${sourceY}, sourceW: ${sourceW}, sourceH: ${sourceH}`)
    
    var destX = 0
    var destY = offset
    var destW = Math.floor(this.width * (sourceW/imageW))
    var destH = this.height
    // console.log(`destX: ${destX}, destY: ${destY}, destW: ${destW}, destH: ${destH}`)

    // bg.tilePositionX = sourceW
    //bg.y = destY
    // console.log(`---------------------------`)
  }

  renderSegment (ctx, width, x1, y1, w1, x2, y2, w2, color)
  {
    var r1 = this.rumbleWidth(w1, this.lanes),
        r2 = this.rumbleWidth(w2, this.lanes),
        l1 = this.laneMarkerWidth(w1, this.lanes),
        l2 = this.laneMarkerWidth(w2, this.lanes),
        lanew1, lanew2, lanex1, lanex2, lane;
    
    ctx.fillStyle(color.grass, 1);
    ctx.fillRect(0, y2, width, y1 - y2); 
    
    this.polygon(ctx, x1-w1-r1, y1, x1-w1, y1, x2-w2, y2, x2-w2-r2, y2, color.rumble);
    this.polygon(ctx, x1+w1+r1, y1, x1+w1, y1, x2+w2, y2, x2+w2+r2, y2, color.rumble);
    this.polygon(ctx, x1-w1,    y1, x1+w1, y1, x2+w2, y2, x2-w2,    y2, color.road);
    
    if (color.lane) {
      lanew1 = w1*2/this.lanes;
      lanew2 = w2*2/this.lanes;
      lanex1 = x1 - w1 + lanew1;
      lanex2 = x2 - w2 + lanew2;
      for(lane = 1 ; lane < this.lanes ; lanex1 += lanew1, lanex2 += lanew2, lane++)
        this.polygon(ctx, lanex1 - l1/2, y1, lanex1 + l1/2, y1, lanex2 + l2/2, y2, lanex2 - l2/2, y2, color.lane);
    }
    
    // Render.fog(ctx, 0, y1, width, y2-y1, fog);
  }

  polygon (ctx, x1, y1, x2, y2, x3, y3, x4, y4, color)
  {
    ctx.fillStyle(color, 1)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.lineTo(x3, y3)
    ctx.lineTo(x4, y4)
    ctx.fill()
    ctx.closePath()
  }

  rumbleWidth (projectedRoadWidth, lanes)
  {
    return projectedRoadWidth/Math.max(6,  2*lanes);
  }

  laneMarkerWidth (projectedRoadWidth, lanes)
  {
    return projectedRoadWidth/Math.max(32, 8*lanes);
  }

  findSegment(z)
  {
    return this.segments[Math.floor(z/this.segmentLength) % this.segments.length];
  }
  
}