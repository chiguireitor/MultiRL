/*
 * lightmanager.js - Ganymede Gate Lightmaps
 *
 * Code style:
 * 4 space indents, no semicolons to finish lines, camelCase, opening braces on same line
 *
 * Created by John Villar for the "Ganymede Gate" sci-fi multiplayer roguelike
 * http://ganymedegate.com
 * Twitter: @johnvillarz
 * Reddit: /u/chiguireitor
 * Google Plus: +JohnVillar
 *
 * Like this! Follow me on social networks & send some Bitcoin my way if you want ;)
 *
 * BTC: 1kPp2CNp1xs7hf8umUwdp4HYiZ9AH1NVk
 *
 * // Beginning of license //
 *
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 John Villar
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * // End of license //
 *
 */

var currentLevel
var currentPlayers = []
var currentPlayersAttrs = []

function assignLevel(level) {
    currentLevel = level
    
    for (var y=0; y < level.length; y++) {
        var row = level[y]
        for (var x=0; x < row.length; x++) {
            var tile = row[x]
            
            tile.lightsource = []
        }
    }
}

function newLightSource(position, intensity, color, ttl) {
    var ob = {intensity: intensity, color: color}
    
    if (typeof(ttl) !== "undefined") {
        ob.ttl = ttl
    }
    
    var tile = currentLevel[position.y][position.x]
    
    if (typeof(tile) !== "undefined") {
        /*if (typeof(tile.lightsource) === "undefined") {
            tile.lightsource = ob
        } else {
            tile.lightsource.intensity = Math.max(tile.lightsource.intensity, ob.intensity)
            tile.lightsource.color.map(function(c, i) {
                return (c + ob.color[i]) >> 1
            })
        }*/
        tile.lightsource.push(ob)
    }
}

function newDirectionalLightSource(position, intensity, color, ttl) {
    var ob = {intensity: intensity, color: color}
    
    if (typeof(ttl) !== "undefined") {
        ob.ttl = ttl
    }
    
    ob.direction = position.orientation

    ob.constantAttenuation = 0
    ob.linearAttenuation = 0.05
    ob.quadraticAttenuation = 0.15
    
    var tile = currentLevel[position.y][position.x]
    
    if (typeof(tile) !== "undefined") {
        tile.lightsource.push(ob)
    }
}

function addPlayerPosition(playerPos, attr) {
    currentPlayers.push(playerPos)
    currentPlayersAttrs.push(attr)
}

function removePlayerPosition(playerPos) {
    var p = currentPlayers.indexOf(playerPos)
    
    if (p >= 0) {
        currentPlayers.splice(p, 1)
        currentPlayersAttrs.splice(p, 1)
    }
}

function calculateLighting(nextTurnId) {
    if (currentLevel.length == 0) {
        return
    }

    for (var i=0; i < currentPlayers.length; i++) {
        var player = currentPlayers[i]
        var attrs = currentPlayersAttrs[i]
        newLightSource(player, 10, [255, 255, 235], 1)
        newDirectionalLightSource(player, Math.floor(20 * attrs.battery/100), [255, 255, 255], 1)
    }
    
    //for (var i=0; i < 1; i++) {
        calculateLighting_iteration(nextTurnId)
    //}
}

function calculateLighting_iteration(nextTurnId) {
    var lgt = currentLevel.map(function(row) {
        return row.map(function(tile) {
            var ntl = {lightsource: [], intensity: 0, color: [0, 0, 0]}
            if (tile.lightsource.length > 0) {
                var lti = 0
                
                while (lti < tile.lightsource.length) {
                    var lightsource = tile.lightsource[lti]
                    var hasTtl = typeof(lightsource.ttl) !== "undefined"
                    
                    if (hasTtl && (lightsource.ttl > 0)) {
                        if ((typeof(lightsource.lastTurnId) === "undefined") || (lightsource.lastTurnId != nextTurnId)) {
                            lightsource.ttl--
                            lightsource.lastTurnId = nextTurnId
                        }
                        
                        if (typeof(lightsource.direction) !== "undefined") {
                            ntl.directional = lightsource
                        } else {
                            ntl.lightsource.push(lightsource)
                        }
                        lti++
                    } else if (hasTtl && (lightsource.ttl == 0)) {
                        tile.lightsource.splice(lti, 1)
                    } else {
                        ntl.lightsource.push(lightsource)
                        lti++
                    }
                }
            }
            
            if ((typeof(tile.item) !== "undefined") && (tile.item != null) &&
                (typeof(tile.item.lightsource) !== "undefined")) {
                ntl.lightsource.push(tile.item.lightsource)
            }
            
            ntl.lightsourceavg = ntl.lightsource.reduce(function(prev, cur, idx, arr) {
                return {
                    intensity: Math.max(prev.intensity, cur.intensity),
                    color: [
                        Math.max(prev.color[0], cur.color[0]),
                        Math.max(prev.color[1], cur.color[1]),
                        Math.max(prev.color[2], cur.color[2])
                    ]
                }
            }, {intensity: 0, color: [0, 0, 0]})
            
            return ntl
        })
    })
    
    var mw = lgt[0].length
    var mh = lgt.length
    
    for (var y=0; y < mh; y++) {
        var row = lgt[y]
        
        for (var x=0; x < mw; x++) {
            var tile = row[x]
        
            if (typeof(tile) !== "undefined") {
                if (typeof(tile.lightsourceavg) !== "undefined") {
                    var intensity = Math.round(tile.lightsourceavg.intensity)
                    
                    pointLight(x, y, intensity, mw, mh, lgt, tile)
                }
                
                if (typeof(tile.directional) !== "undefined"){
                    var intensity = Math.round(tile.directional.intensity * 1.2)
                    
                    directionalLight(x, y, intensity, tile.directional, mw, mh, lgt)
                }
            }
            
            if (typeof(tile.light) == "undefined") {
                tile.light = {intensity: 0, color: [0, 0, 0]}
            }
        }
    }
    
    lgt.map(function(row, y) {
        row.map(function(tile, x) {
            currentLevel[y][x].light = tile.light
        })
    })
}

function pointLight(x, y, intensity, mw, mh, lgt, tile) {
    for (var j=-intensity; j <= intensity; j++) {
        var py = y + j
        
        if ((py >= 0) && (py < mh)) {
            var yai2 = j * j
            var nrow = lgt[py]
            
            for (var i=-intensity; i <= intensity; i++) {
                var px = x + i
                if ((px >= 0) && (px < mw)) {
                    var xai2 = i * i
                    
                    var abintensity2 = xai2 + yai2
                    var abintensity = Math.sqrt(abintensity2)
                    
                    var fac
                    if (abintensity == 0) {
                        fac = 1.0
                    } else {
                        fac = 1.0 / abintensity
                    }
                    
                    if (fac > 0) {
                        // TODO: Bresenham's check to see if light hit this spot
                        var otile = nrow[px]
                        var color = [0, 0, 0]
                        if (typeof(otile.light) != "undefined") {
                            color = otile.light.color
                        } else {
                            color = [0, 0, 0]
                        }
                        
                        color[0] = Math.floor(Math.min(color[0] + tile.lightsourceavg.color[0] * fac, 255))
                        color[1] = Math.floor(Math.min(color[1] + tile.lightsourceavg.color[1] * fac, 255))
                        color[2] = Math.floor(Math.min(color[2] + tile.lightsourceavg.color[2] * fac, 255))

                        otile.light = {intensity: 0, color: color}
                    }
                }
            }
        }
    }
}

function directionalLight(x, y, intensity, directional, mw, mh, lgt) {
    var dir = directional.direction
    var px = x
    var py = y
    var conesize = 0
    
    var isDiagonal = Math.abs(dir.x) == Math.abs(dir.y)
    
    var intensityDir = intensity * (isDiagonal?1.2:1)
    
    for (var i=0; i < intensityDir; i++) {
        var inx = px
        var iny = py
        
        var csz = Math.floor(conesize)
        for (var j=-csz; j <= csz; j++) {
            var nx = inx + j * dir.y
            var ny = iny - j * dir.x
            
            if ((nx >= 0) && (nx < mw) && (ny >= 0) && (ny < mh)) {
                var dx = nx - x
                var dy = ny - y
                var d2 = dx * dx + dy * dy
                var d = Math.sqrt(d2)
                
                var fac
                if (d == 0) {
                    fac = 1.0
                } else {
                    var constantAttenuation = 0
                    var linearAttenuation = 1.0
                    var quadraticAttenuation = 0.0
                    
                    if (typeof(directional.constantAttenuation) !== "undefined") {
                        constantAttenuation = directional.constantAttenuation
                    }
                    
                    if (typeof(directional.linearAttenuation) !== "undefined") {
                        linearAttenuation = directional.linearAttenuation
                    }
                    
                    if (typeof(directional.quadraticAttenuation) !== "undefined") {
                        quadraticAttenuation = directional.quadraticAttenuation
                    }
                    
                    quadraticAttenuation = Math.pow(Math.abs(j) / conesize, 12 - (i / intensity) * (12 + (isDiagonal?-1.5:0)))
                    
                    var att = (constantAttenuation + d * linearAttenuation + d2 * quadraticAttenuation) 
                    
                    if (att <= 0) {
                        fac = 1.0
                    } else {
                        fac = 1.0 / att
                    }
                }
                
                if (fac > 0) {
                    // TODO: Bresenham's check to see if light hit this spot
                    var otile = lgt[ny][nx]
                    var color = [0, 0, 0]
                    if (typeof(otile.light) != "undefined") {
                        color = otile.light.color
                    } else {
                        color = [0, 0, 0]
                    }
                    
                    color[0] = Math.floor(Math.min(color[0] + directional.color[0] * fac, 255))
                    color[1] = Math.floor(Math.min(color[1] + directional.color[1] * fac, 255))
                    color[2] = Math.floor(Math.min(color[2] + directional.color[2] * fac, 255))

                    otile.light = {intensity: 0, color: color}
                }
            }
        }
        
        if (isDiagonal) {
            switch (i & 1) {
                case 0:
                    px += dir.x
                    break
                case 1:
                    py += dir.y
                    conesize -= 1
                    break
            }
        } else {
            px += dir.x
            py += dir.y
        }
        conesize++
    }
}

function pulseLight(x, y, intensity, directional, mw, mh, lgt) {
    var dir = directional.direction
    var px = x
    var py = y
    var conesize = 0
    
    var isDiagonal = Math.abs(dir.x) == Math.abs(dir.y)
    
    for (var i=0; i < intensity; i++) {
        var inx = px
        var iny = py
        
        for (var j=-conesize; j <= conesize; j++) {
            var nx = inx + j * dir.y
            var ny = iny - j * dir.x
            
            if ((nx >= 0) && (nx < mw) && (ny >= 0) && (ny < mh)) {
                var dx = nx - x
                var dy = ny - y
                var d2 = dx * dx + dy * dy
                var d = Math.sqrt(d2)
                
                var fac
                if (d == 0) {
                    fac = 1.0
                } else {
                    var constantAttenuation = 0
                    var linearAttenuation = 1.0
                    var quadraticAttenuation = 0.0
                    
                    if (typeof(directional.constantAttenuation) !== "undefined") {
                        constantAttenuation = directional.constantAttenuation
                    }
                    
                    if (typeof(directional.linearAttenuation) !== "undefined") {
                        linearAttenuation = directional.linearAttenuation
                    }
                    
                    if (typeof(directional.quadraticAttenuation) !== "undefined") {
                        quadraticAttenuation = directional.quadraticAttenuation
                    }
                    
                    quadraticAttenuation *= Math.abs(j) / conesize
                    
                    var att = (constantAttenuation + d * linearAttenuation + d2 * quadraticAttenuation) 
                    
                    if (att <= 0) {
                        fac = 1.0
                    } else {
                        fac = 1.0 / att
                    }
                }
                
                if (fac > 0) {
                    // TODO: Bresenham's check to see if light hit this spot
                    var otile = lgt[ny][nx]
                    var color = [0, 0, 0]
                    if (typeof(otile.light) != "undefined") {
                        color = otile.light.color
                    } else {
                        color = [0, 0, 0]
                    }
                    
                    color[0] = Math.floor(Math.min(color[0] + directional.color[0] * fac, 255))
                    color[1] = Math.floor(Math.min(color[1] + directional.color[1] * fac, 255))
                    color[2] = Math.floor(Math.min(color[2] + directional.color[2] * fac, 255))

                    otile.light = {intensity: 0, color: color}
                }
            }
        }
        
        if (isDiagonal) {
            switch (i & 1) {
                case 0:
                    px += dir.x
                    break
                case 1:
                    py += dir.y
                    break
            }
        } else {
            px += dir.x
            py += dir.y
        }
        conesize++
    }
}

module.exports = {
    assignLevel: assignLevel,
    newLightSource: newLightSource,
    addPlayerPosition: addPlayerPosition,
    removePlayerPosition: removePlayerPosition,
    calculateLighting: calculateLighting
}