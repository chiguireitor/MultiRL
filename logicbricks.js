/*
 * logicbricks.js - Level logic for Ganymede Gate
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
 
var passable
var items = require('./items.js')
 
var brickFuncs = {
    "button": function(level, x, y, tile, turn) {
        /*if ((tile.brick.status == "on") && (tile.brick.powerturn >= turn-1) && (typeof(tile.brick.generator) !== "undefined") && (tile.brick.generator.status === "on")) {
            tile.brick.status = "off"
            return [
                {type: "addpower", x: x-1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x+1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y-1, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y+1, generator: tile.brick.generator}
            ]
        }*/
        var ret = [
            {type: "switch", x: x-1, y: y, status: tile.brick.status},
            {type: "switch", x: x+1, y: y, status: tile.brick.status},
            {type: "switch", x: x, y: y-1, status: tile.brick.status},
            {type: "switch", x: x, y: y+1, status: tile.brick.status}
        ]
        
        tile.brick.status = "off"
        
        return ret
    },
    "compactor": function(level, x, y, tile, turn) {
        if ((tile.brick.powerturn >= turn-1) && (typeof(tile.brick.generator) !== "undefined") && (tile.brick.generator.status === "on")) {
            return [
                {type: "movecompactor", x: x + tile.brick.dx, y: y + tile.brick.dy, origin: {x: x, y: y}, generator: tile.brick.generator, pix: tile.brick.replacementPix},
                {type: "addpower", x: x-1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x+1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y-1, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y+1, generator: tile.brick.generator}
            ]
        }
    },
    "spikes": function(level, x, y, tile, turn) {
        if (tile.brick.powerturn >= turn-1) {
            tile.tile = 208
            tile.fg = "ff0000"
            tile.damage = 20
            
            return [
                {type: "addpower", x: x-1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x+1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y-1, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y+1, generator: tile.brick.generator}
            ]
        }
    },
    "conveyor": function(level, x, y, tile, turn) {
        if ((tile.brick.powerturn >= turn-1) && (typeof(tile.brick.generator) !== "undefined") && (tile.brick.generator.status === "on")) {
            return [
                {type: "displace", x: x, y: y, dx: tile.brick.dx, dy: tile.brick.dy},
                {type: "addpower", x: x-1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x+1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y-1, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y+1, generator: tile.brick.generator}
            ]
        }
    },
    "itemdisp": function(level, x, y, tile, turn) {
    },
    "recycler": function(level, x, y, tile, turn) {
        if ((tile.brick.powerturn >= turn-1) && (typeof(tile.brick.generator) !== "undefined") && (tile.brick.generator.status === "on")) {
            if ((typeof(tile.debris) !== "undefined") && (tile.debris != null)) {
                tile.debris = null
            }
            
            if ((typeof(tile.item) !== "undefined") && (tile.item != null)) {
                tile.item = null
            }
            
            return [
                {type: "addpower", x: x-1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x+1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y-1, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y+1, generator: tile.brick.generator}
            ]
        }
    },
    "terminal": function(level, x, y, tile, turn) {
    },
    "itemopt": function(level, x, y, tile, turn) {
    },
    "wire": function(level, x, y, tile, turn) {
        if ((tile.brick.powerturn >= turn-1) && (typeof(tile.brick.generator) !== "undefined") && (tile.brick.generator.status === "on")) {
            return [
                {type: "addpower", x: x-1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x+1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y-1, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y+1, generator: tile.brick.generator}
            ]
        }
    },
    "timer": function(level, x, y, tile, turn) {
        if (tile.brick.status == "on") {
            tile.brick.startturn = turn
            tile.brick.status = "counting"
            tile.brick.powered = true
        } else if (tile.brick.status == "counting") {
            if ((turn - tile.brick.startturn) >= tile.brick.delay) {
                tile.brick.status = "finished"
                tile.brick.startturn = turn
                tile.brick.powered = false
            }
        } else if (tile.brick.status == "finished") {
            if ((tile.brick.repeat > 0) && ((turn - tile.brick.startturn) >= tile.brick.repeat)) {
                tile.brick.status = "on"
                tile.brick.startturn = turn
            }
        }
        
        if ((tile.brick.powerturn >= turn-1) && tile.brick.powered) {
            return [
                {type: "addpower", x: x-1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x+1, y: y, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y-1, generator: tile.brick.generator},
                {type: "addpower", x: x, y: y+1, generator: tile.brick.generator}
            ]
        }
    },
    "power": function(level, x, y, tile, turn) {
        if (tile.brick.status == "on") {
            return [
                {type: "addpower", x: x-1, y: y, generator: tile.brick},
                {type: "addpower", x: x+1, y: y, generator: tile.brick},
                {type: "addpower", x: x, y: y-1, generator: tile.brick},
                {type: "addpower", x: x, y: y+1, generator: tile.brick}
            ]
        }
    },
    "switch": function(level, x, y, tile, turn) {
        if ((tile.brick.onlyon && (tile.brick.status == "on")) ||
            (tile.brick.onlyoff && (tile.brick.status == "off")) ||
            ((typeof(tile.brick.onlyon) === "undefined") &&
             (typeof(tile.brick.onlyoff) === "undefined"))) {
            return [
                {type: "switch", x: x-1, y: y, status: tile.brick.status},
                {type: "switch", x: x+1, y: y, status: tile.brick.status},
                {type: "switch", x: x, y: y-1, status: tile.brick.status},
                {type: "switch", x: x, y: y+1, status: tile.brick.status}
            ]
        }
    },
    "fire": function(level, x, y, tile, turn) {
        if (typeof(tile.brick.weaponInstance) === "undefined") {
            // Instantiate the weapon
            var w = items.searchWeaponByName(tile.brick.weapon)
            w.findChargerAndAssign(items)
            
            tile.brick.weaponInstance = w
        }
        
        if ((tile.brick.powerturn >= turn-1) && (tile.brick.generator.status === "on")) {
            if ((typeof(tile.brick.wait) !== "undefined") && (tile.brick.wait > 0)) {
                tile.brick.wait--
            } else {
                var proxyAgent = {
                    weapon: tile.brick.weaponInstance,
                    pos: {x: x, y: y},
                    attrs: {
                        precision: {pos: 0},
                        speed: {pos: 0}
                    }
                }
                
                tile.brick.weaponInstance.fire(x + tile.brick.dx * 3, y + tile.brick.dy * 3, proxyAgent, {})
                tile.brick.wait = tile.brick.cooldown
                
                if (tile.brick.ammo === "infinite") {
                    tile.brick.weaponInstance.ammo = tile.brick.weaponInstance.ammoUse * 3
                }
            }
        }
    }
}

var actionFuncs = {
    "addpower": function (level, turn, spec) {
        if ((spec.y >= 0) && (spec.y < level.length)) {
            var row = level[spec.y]
            
            if ((spec.x >= 0) && (spec.x < row.length)) {
                var tile = row[spec.x]
                
                if ((typeof(tile.brick) !== "undefined") && (spec.generator !== tile.brick)) {
                    if (tile.brick.type === "power") {
                        tile.brick.status = "on"
                    } else {
                        tile.brick.powerturn = turn
                        tile.brick.generator = spec.generator
                    }
                }
            }
        }
    },
    "switch": function (level, turn, spec) {
        if ((spec.y >= 0) && (spec.y < level.length)) {
            var row = level[spec.y]
            
            if ((spec.x >= 0) && (spec.x < row.length)) {
                var tile = row[spec.x]
                
                if (typeof(tile.brick) !== "undefined") {
                    if (tile.brick.powerable) {
                        tile.brick.status = spec.status
                    } else if (tile.brick.type == "switch") {
                        if ((spec.status == "on") && (tile.brick.onlyon)) {
                            tile.brick.status = "on"
                        } else if ((spec.status == "off") && (tile.brick.onlyoff)) {
                            tile.brick.status = "off"
                        } else {
                            tile.brick.status = spec.status
                        }
                    }
                }
            }
        }
    },
    "displace": function (level, turn, spec) {
        var origin
        var dest
        if ((spec.y >= 0) && (spec.y < level.length)) {
            var row = level[spec.y]
            
            if ((spec.x >= 0) && (spec.x < row.length)) {
                origin = row[spec.x]
            }
        }
        
        var ty = spec.y + spec.dy
        var tx = spec.x + spec.dx
        if ((ty >= 0) && (ty < level.length)) {
            var row = level[ty]
            
            if ((tx >= 0) && (tx < row.length)) {
                dest = row[tx]
            }
        }
        
        var tbg = origin.bg
        origin.bg = origin.fg
        origin.fg = tbg
        
        if ((typeof(origin) !== "undefined") && (typeof(dest) !== "undefined") && (passable(dest) == 1)) {
            if ((typeof(origin.character) !== "undefined") && (origin.character != null) &&
                ((typeof(dest.character) === "undefined") || (origin.character == null))) {
                origin.character.pos.x = tx
                origin.character.pos.y = ty
                
                dest.character = origin.character
                origin.character = null
            }
            
            if ((typeof(origin.item) !== "undefined") && (origin.item != null) &&
                ((typeof(dest.item) === "undefined") || (origin.item == null))) {
                dest.item = origin.item
                origin.item = null
            }
            
            if ((typeof(origin.debris) !== "undefined") && (origin.debris != null) &&
                ((typeof(dest.debris) === "undefined") || (origin.debris == null))) {
                dest.debris = origin.debris
                origin.debris = null
            }
        }
    },
    "movecompactor": function (level, turn, spec) {
        var origin
        var dest
        if ((spec.origin.y >= 0) && (spec.origin.y < level.length)) {
            var row = level[spec.origin.y]
            
            if ((spec.origin.x >= 0) && (spec.origin.x < row.length)) {
                origin = row[spec.origin.x]
            }
        }
        
        var ty = spec.y
        var tx = spec.x
        if ((ty >= 0) && (ty < level.length)) {
            var row = level[ty]
            
            if ((tx >= 0) && (tx < row.length)) {
                dest = row[tx]
            }
        }

        if (typeof(origin.brick.returning) === "undefined") {
            origin.brick.returning = false
            origin.brick.startpos = spec.origin
        }
        
        if (typeof(origin.brick.lastTurnProcessed) === "undefined") {
            origin.brick.lastTurnProcessed = -1
        }
        
        if (origin.brick.lastTurnProcessed != turn) {
            origin.brick.lastTurnProcessed = turn
            if (origin.brick.returning && (typeof(origin.brick.savedTiles) !== "undefined")) {
                if (origin.brick.savedTiles.length > 0) {
                    var oldTile = origin.brick.savedTiles.pop()
                    level[oldTile.y][oldTile.x] = oldTile.tile
                    
                    var lastTile
                    if (origin.brick.savedTiles.length > 0) {
                        lastTile = origin.brick.savedTiles[origin.brick.savedTiles.length - 1]
                    } else {
                        lastTile = {x: origin.brick.startpos.x, y: origin.brick.startpos.y}
                    }
                    
                    level[lastTile.y][lastTile.x] = origin
                } else {
                    origin.brick.returning = false
                }
            } else {
                if ((typeof(origin) !== "undefined") && (typeof(dest) !== "undefined") && (passable(dest) > 0)) {
                    // TODO: Push characters, items and debris, and if against non-passable, compact
                    
                    var nextDest        
                    var nty = ty + spec.y - spec.origin.y
                    var ntx = tx + spec.x - spec.origin.x
                    if ((nty >= 0) && (nty < level.length)) {
                        var row = level[nty]
                        
                        if ((ntx >= 0) && (ntx < row.length)) {
                            nextDest = row[ntx]
                        }
                    }
                    
                    if (typeof(nextDest) !== "undefined") {
                        var pss = passable(nextDest)
                        if (pss == 0) {
                            // Kill agent, transform debris, destroy items
                            
                            if ((typeof(dest.character) !== "undefined") && (dest.character != null)) {
                                var agent = dest.character
                                var dmg = agent.attrs.hp.pos * 2
                                agent.attrs.hp.pos -= dmg
                            
                                if (typeof(agent.attrs.hp.onchange) != "undefined") {
                                    agent.attrs.hp.onchange.call(agent, "compactor", dmg)
                                }
                            }
                            
                            if ((typeof(dest.debris) !== "undefined") && (dest.debris != null)) {
                                dest.debris = {
                                    pix: 7, 
                                    color: [128, 128, 128],
                                    type: 'compacted-material'
                                }
                            }
                            
                            if ((typeof(dest.item) !== "undefined") && (dest.item != null)) {
                                dest.item = null
                                dest.debris = {
                                    pix: 7, 
                                    color: [128, 128, 128],
                                    type: 'compacted-material'
                                }
                            }
                        } else if (pss == 1) {
                            if ((typeof(dest.character) !== "undefined") && (dest.character != null)) {
                                nextDest.character = dest.character
                                dest.character = null
                                
                                nextDest.character.pos.x = ntx
                                nextDest.character.pos.y = nty
                            }
                            
                            if ((typeof(nextDest.debris) === "undefined") || (nextDest.debris == null)) {
                                nextDest.debris = dest.debris
                                dest.debris = null
                            }
                            
                            if ((typeof(nextDest.item) === "undefined") || (nextDest.item == null)) {
                                nextDest.item = dest.item
                                dest.item = null
                            }
                        } else if (pss == 2) {
                            // Damage both
                            console.log("TODO: Kill agents, logicbricks:331")
                        }
                    }
                    
                    level[ty][tx] = origin
                    level[spec.origin.y][spec.origin.x] = {
                        tile: spec.pix,
                        fg: origin.fg,
                        bg: origin.bg,
                        cssClass: origin.cssClass,
                        lightsource: []
                    }
                    
                    if (typeof(origin.brick.savedTiles) === "undefined") {
                        origin.brick.savedTiles = []
                    }
                    
                    origin.brick.savedTiles.push({x: tx, y: ty, tile: dest})
                } else {
                    origin.brick.returning = true
                }
            }
        }
    }
}

function processBrick(level, x, y, tile, turn) {
    if (tile.brick.type in brickFuncs) {
        var ret = brickFuncs[tile.brick.type](level, x, y, tile, turn)
        
        if (typeof(ret) !== "undefined") {
            return ret
        } else {
            return []
        }
    } else {
        return []
    }
}

var actionPriorities = {
    "switch": 0,
    "addpower": 1,
    "displace": 2,
    "movecompactor": 3
}

function processLevel(level, turn) {
    var actionList = []
    for (var y=0; y < level.length; y++) {
        var row = level[y]
        
        for (var x=0; x < row.length; x++) {
            var tile = row[x]
            
            if (typeof(tile.brick) !== "undefined") {
                actionList = actionList.concat(processBrick(level, x, y, tile, turn))
            }
        }
    }
    
    actionList.sort(function (a, b) {
        return actionPriorities[a.type] - actionPriorities[b.type]
    })
    
    for (var i=0; i < actionList.length; i++) {
        var action = actionList[i]
        if (action.type in actionFuncs) {
            actionFuncs[action.type](level, turn, action)
        }
    }
}

function registerPassableFn(fnc) {
    passable = fnc
}

module.exports = {
    processLevel: processLevel,
    registerPassableFn: registerPassableFn
}