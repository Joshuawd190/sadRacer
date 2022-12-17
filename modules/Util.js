const Util = {

  timestamp:        function()                  { return new Date().getTime();                                    },
  toInt:            function(obj, def)          { if (obj !== null) { var x = parseInt(obj, 10); if (!isNaN(x)) return x; } return Util.toInt(def, 0); },
  toFloat:          function(obj, def)          { if (obj !== null) { var x = parseFloat(obj);   if (!isNaN(x)) return x; } return Util.toFloat(def, 0.0); },
  limit:            function(value, min, max)   { return Math.max(min, Math.min(value, max));                     },
  randomInt:        function(min, max)          { return Math.round(Util.interpolate(min, max, Math.random()));   },
  randomChoice:     function(options)           { return options[Util.randomInt(0, options.length-1)];            },
  percentRemaining: function(n, total)          { return (n%total)/total;                                         },
  accelerate:       function(v, accel, dt)      { return v + (accel * dt);                                        },
  interpolate:      function(a,b,percent)       { return a + (b-a)*percent                                        },
  easeIn:           function(a,b,percent)       { return a + (b-a)*Math.pow(percent,2);                           },
  easeOut:          function(a,b,percent)       { return a + (b-a)*(1-Math.pow(1-percent,2));                     },
  easeInOut:        function(a,b,percent)       { return a + (b-a)*((-Math.cos(percent*Math.PI)/2) + 0.5);        },
  exponentialFog:   function(distance, density) { return 1 / (Math.pow(Math.E, (distance * distance * density))); },
  normalizeRotation: function(angle)            { return angle % 360},

  increase:  function(start, increment, max) { // with looping
    var result = start + increment;
    while (result >= max)
      result -= max;
    while (result < 0)
      result += max;
    return result;
  },

  project: function(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {

    // Changes to p.camera change the camera position
    // Setting the position of the camera in the world to the exact center of the camera
    // Too tired (or dumb) to remember why or how that works

    // p.camera.x     = (p.world.x || 0 - width/2) - cameraX
    p.camera.x     = (width/2) - cameraX
    // p.camera.y     = (p.world.y || 0 - height/2) - cameraY
    p.camera.y     = (height/2) - cameraY
    p.camera.z     = (p.world.z || 0) - cameraZ


    //insert rotation math here?


    p.screen.scale = cameraDepth/p.camera.z

    // Changes to the p.screen.x recenter the car
    // Before change was weirdly offset
    // Not sure why the p.screen.y offset is so weird 
    // If you change it, it become perfectly inline with the road
    // Which causes the road not to render
    // Also, the car does not have a sprite looking perfectly from the rear
    // Which, duh, it's a flat sprite sheet, not a 3d object

    // p.screen.x     = Math.round((width/2)  + (p.screen.scale * p.camera.x  * width/2))
    p.screen.x     = Math.round((width/2)  + (p.screen.scale * p.camera.x))
    // This does the same as the line above, without testing on curved roads
    // p.screen.x     = Math.round(width/2)

    p.screen.y     = Math.round((height/2) - (p.screen.scale * p.camera.y  * height/2))
    // p.screen.y     = Math.round((height/2))
    p.screen.w     = Math.round(             (p.screen.scale * roadWidth   * width/2))
  },

  // moreDifferentProject: function(p, cameraDepth, rotation){
  //   p.camera.x
  // },

  rotate2d: function(x, y, angle){
    x = Math.round(
      Math.cos((angle * (Math.PI/180))) *
      x -
      Math.sin((angle * (Math.PI/180))) *
      y
      )
    y = Math.round(
      Math.sin((angle * (Math.PI/180))) *
      x +
      Math.cos((angle * (Math.PI/180)))*
      y
    )
    // console.log('X:' + p.screen.x + 'Y:' + p.screen.y);
  },
  translate: function (p, amountX, amountY) {
    p.screen.x += amountX,
    p.screen.y += amountY
  },
  rotateProjection: function(p, angle, width, height){
    p.screen.x =
    Math.round(
      Math.cos((angle * (Math.PI/180))) *
      p.screen.x -
      Math.sin((angle * (Math.PI/180))) *
      p.screen.y
      )
    p.screen.y =
    Math.round(
      Math.sin((angle * (Math.PI/180))) *
      p.screen.x +
      Math.cos((angle * (Math.PI/180)))*
      p.screen.y 
      )
  },
  rotateProjectionHori: function(p, angle){
    p.screen.x = 
      Math.round(
        Math.cos((angle * (Math.PI/180))) *
        p.screen.x -
        Math.sin((angle * (Math.PI/180))) *
        p.screen.y
        )
        
    p.screen.y = 
      Math.round(
        Math.sin((angle * (Math.PI/180))) *
        p.screen.x +
        Math.cos((angle * (Math.PI/180)))*
        p.screen.y
        )
        
  },


  overlap: function(x1, w1, x2, w2, percent) {
    var half = (percent || 1)/2
    var min1 = x1 - (w1*half)
    var max1 = x1 + (w1*half)
    var min2 = x2 - (w2*half)
    var max2 = x2 + (w2*half)
    return ! ((max1 < min2) || (min1 > max2))
  }

}

export default Util