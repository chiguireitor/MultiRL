/*
 * mrl.js - Main entry point for Ganymede Gate
 *
 * Launch with 'node mrl.js'
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
 
var ws = require('ws')
var http = require('http')
var net = require('net')
var url = require('url')
var colors = require('colors')
var fs = require('fs')
var pako = require('pako')

var rs = require('./rex_sprite.js')
var ai = require('./ai.js')
var weapons = require('./weapons.js')
var aids = require('./aids.js')
var particles = require('./particles.js')
var generators = require('./generators.js')
var monsters = require('./monsters.js')
var asciiMapping = require('./templates/ascii_mapping.js') // Code shared between client and server
var effects = require('./effects.js')
var comms = require('./comms.js')
var soundManager = require('./soundman.js').getManager()
var determinist = require('./determinist.js')
var lightmanager = require('./lightmanager.js')

var util = require('./util.js')

var gameDefs = require('./conf/gamedefs.js')

var indexPage, cssPage = {}

var gameStarted = false
var hasBeenInited = false
var particleManager
var startXPos
var startYPos
var minimumPlayers = gameDefs.minPlayers // The required number of players to start the game
var nextTurnId = 0 // This is needed to know if all players have already set their commands
var continuousTurns = gameDefs.continuousTurns // Continuous turns allows players to play without waiting for others
var contTurnsTimeThreshold = gameDefs.continuousThresholdMillis // Milliseconds before a continuous turn ends, must be increments of 100ms, 0 for "instantaneous" turns
var currentLevel = 0
var passableTiles = [
    asciiMapping["."],
    asciiMapping[","],
    asciiMapping["·"],
    asciiMapping["_"],
    asciiMapping["↑"],
    asciiMapping["↓"],
    asciiMapping["≈"],
    asciiMapping["~"],
    asciiMapping["|"]
    ] // Tiles that don't block the players or NPCs
var activableTiles = {} // Dictionary of functions called for tiles that are activated on contact
var usableTiles = {} // Dictionary of functions called for tiles that are activated by use

var items = require('./items.js')

/**
 * The following vars are reset on every new game
 */
var level = []
var levelTileset = ""
var aiState
var lastTurnTime = 0 // Date.now() of the last turn that was completed
var sessionRandom

function grab(c, itm) {
    var pickedUp = false
    
    if (itm.type == "weapon") {
        if ((typeof(c.weapon) == "undefined") || (c.weapon == null)) {
            c.weapon = itm
            c.messages.push("You equip the " + itm.name)
            pickedUp = true
        } else {
            if (c.inventory.length >= gameDefs.maxInventoryItems) {
                c.messages.push("Your inventory is full")
            } else {
                c.inventory.push(itm)
                c.messages.push("You grab the " + itm.name)
                pickedUp = true
            }
        }
        
        if (pickedUp && (typeof(itm.sndOnPickup) != "undefined")) {
            soundManager.addSound(c.pos.x, c.pos.y, 5, itm.sndOnPickup, 0)
        }
    } else if (itm.instant){
        itm.use(level, c)
        c.messages.push("You use the " + itm.name)
        pickedUp = true
    } else {
        if (c.inventory.length >= gameDefs.maxInventoryItems) {
            c.messages.push("Your inventory is full")
        } else {
            c.inventory.push(itm)
            c.messages.push("You grab the " + (itm.name || itm.ammoType))
            pickedUp = true
            
            if (typeof(itm.sndOnPickup) != "undefined") {
                soundManager.addSound(c.pos.x, c.pos.y, 5, itm.sndOnPickup, 0)
            }
        }
    }
    
    return pickedUp
}

function tryToUseInventory(ws, index) {
    if ((index >= 0)&&(index < ws.player.inventory.length)) {
        var item = ws.player.inventory[index]
        
        if (item.type == "weapon") {
            // Swap current weapon with this one
            if ((typeof(ws.player.weapon) != "undefined") && (ws.player.weapon != null)) {
                var oldWeapon = ws.player.weapon
                ws.player.weapon = item
                ws.player.inventory[index] = oldWeapon
                
                return true
            } else {
                ws.player.weapon = item
                return true
            }
        } else if (item.type == "ammo") {
            // Check the current weapon is compatible with this type of ammo and, if so, use it
            if ((typeof(ws.player.weapon) != "undefined") && (ws.player.weapon != null)) {
                if (ws.player.weapon.isChargerCompatible(item)) {
                    ws.player.weapon.reloadWithCharger(ws.player, item)
                }
            }
        }
    }
    return false
}

function tryToDropInventory(ws, index) {
    if ((index >= 0)&&(index < ws.player.inventory.length)) {
        var item = ws.player.inventory[index]
        if (util.dropInventory(ws.player, level, passable, index)) {
            ws.player.messages.push("You drop " + (item.name || item.ammoType))
            return true
        } else {
            ws.player.messages.push("Seems the floor is full")
        }
    } else {
        ws.player.messages.push("Invalid item")
    }
    
    return false
}

function tryToUnloadInventory(ws, index) {
    if ((index >= 0)&&(index < ws.player.inventory.length)) {
        var item = ws.player.inventory[index]
        
        if (item.type == "weapon") {
            // TODO: Check if there's space to unload the friggen weapon
            if (ws.player.inventory.length < gameDefs.maxInventoryItems) {
                if (!sessionRandom.eventOccurs(gameDefs.jamOnUnloadProbability)) {
                    // Create a charger, assign the amount of armor and add it to the inventory
                    // TODO: Create the charger mofo
                    
                    item.ammo = 0
                    
                    if (item.alternate && (ws.player.inventory.length < gameDefs.maxInventoryItems)) {
                        // Once again, but for the alternate weapon
                        item.alternate.ammo = 0
                    }
                    
                    
                    ws.player.messages.push("You unload the weapon")
                    return true
                } else {
                    ws.player.messages.push("You suck so much, that you jam the weapon and destroy it")
                    ws.player.inventory.splice(index, 1)
                }
            } else {
                ws.player.messages.push("Inventory full")
            }
            return false
        } else {
            ws.player.messages.push("This isn't a chargeable item")
        }
    } else {
        ws.player.messages.push("Invalid item")
    }
    
    return false
}

function tryToInspectInventory(ws, index) {
    if ((index >= 0)&&(index < ws.player.inventory.length)) {
        var item = ws.player.inventory[index]
        
        // TODO: Do a "inspect" check, and if it passes, the item gets identified. There's also a posibility to destroy the weapon
        if (typeof(item.identified) == "undefined") {
            ws.player.messages.push("Item doesn't need identification")
        } else if (!item.identified) {
            // TODO: Check precision
            ws.player.messages.push("You suck so much at identifying, you have destroyed it")
        } else {
            ws.player.messages.push("Item already identified")
        }
    } else {
        ws.player.messages.push("Invalid item")
    }
    
    return false
}

/**
 * Events that can be triggered by a usable tile
 * Functions must have the prototype function(tile, client)
 */
var poolSpawnEventConstructor = function(pix, radiusmax, cssClass, specialCellAttrs) {
    return function() { // Yeah, we're nesting two function returns here... yay functional design
        var radius = Math.ceil(sessionRandom.child('events').random() * radiusmax) + 1
        var poolGen = sessionRandom.child()
        
        return function (t, c) {
            
            var r2 = radius * radius
            var rndr = r2 / 3
            
            var particle = "a"
            if ("aeiouAEIOU".indexOf(cssClass[0]) >= 0) {
                particle = "an"
            }
            
            c.player.messages.push("You spawn " + particle + " " + cssClass + " pool")
            for (var y=-radius; y < radius; y++) {
                var ty = c.player.pos.y + y
                if ((ty > 0)&&(ty < level.length-1)) {
                    var row = level[ty]
                    
                    for (var x=-radius; x < radius; x++) {
                        var tx = c.player.pos.x + x
                        
                        if ((tx > 0)&&(tx < row.length-1)) {
                            var d2 = (x*x + y*y)
                            d2 = d2 + (poolGen.random() * rndr - rndr/2)
                            if (d2 < r2) {
                                row[tx].tile = pix
                                row[tx].cssClass = cssClass
                                
                                for (var n in specialCellAttrs) {
                                    row[tx][n] = specialCellAttrs[n]
                                }
                            }
                        }
                    }
                }
            }
            
            return true
        }
    }
}

function wallExplosionEventConstructor() {
    var radius = Math.round(sessionRandom.child('events').random()*5 + 10)
    
    return function (t, c) {
        var r2 = radius * radius
        c.player.messages.push("The walls explode around you")
        for (var y=-radius; y < radius; y++) {
            var ty = c.player.pos.y + y
            if ((ty > 0)&&(ty < level.length-1)) {
                var row = level[ty]
                
                for (var x=-radius; x < radius; x++) {
                    var tx = c.player.pos.x + x
                    
                    if ((tx > 0)&&(tx < row.length-1)) {
                        if ((x*x + y*y) < r2) {
                        
                            if (!passable(row[tx])) {
                                row[tx].tile = asciiMapping['.']
                                row[tx].cssClass = ''
                            }
                        }
                    }
                }
            }
        }
        return true
    }
}

function monsterSpawnEventConstructor() {
    var radius = Math.round(sessionRandom.child('events').random()*10 + 5)
    var prob = sessionRandom.child('events').random()*0.25 + 0.1
    var monstaGen = sessionRandom.child()
    return function (t, c) {
        var r2 = radius * radius
        var mn = 1
        for (var y=-radius; y < radius; y++) {
            var ty = c.player.pos.y + y
            if ((ty > 0)&&(ty < level.length-1)) {
                var row = level[ty]
                
                for (var x=-radius; x < radius; x++) {
                    var tx = c.player.pos.x + x
                    
                    if ((tx > 0)&&(tx < row.length-1)) {
                        if ((x*x + y*y) < r2) {
                        
                            if ((passable(row[tx])==1) && (monstaGen.random() < prob)) {
                                monsters.spawners.Monsta(aiState, 'Monsta ' + mn, tx, ty, 'Demons')
                                mn++
                            }
                        }
                    }
                }
            }
        }
        
        c.player.messages.push("A horde of demons spawn around you!")
        
        return true
    }
}

function blinkEventConstructor() {
    var pickGen = sessionRandom.child()
    
    return function (t, c) {
        var freeTile = false
        var x = c.player.pos.x
        var y = c.player.pos.y
        
        while (!freeTile) {
            x = pickGen.randomInt(level[0].length)
            y = pickGen.randomInt(level.length)
            
            freeTile = passable(level[y][x], true) == 1
        }
        
        c.player.pos.x = x
        c.player.pos.y = y
        t.character = null
        level[y][x].character = c
        c.player.messages.push("You get yanked to another place")
        
        return true
    }
}

var leverEvents = [
        poolSpawnEventConstructor(asciiMapping["≈"], gameDefs.spawnPoolMaxRadius, "lava", {damage: gameDefs.lavaDamage, lightsource: [{intensity: 2, color: [255, 128, 0]}]}),
        poolSpawnEventConstructor(asciiMapping["≈"], gameDefs.spawnPoolMaxRadius, "acid", {damage: gameDefs.acidDamage, lightsource: [{intensity: 2, color: [0, 255, 0]}]}),
        poolSpawnEventConstructor(asciiMapping["≈"], gameDefs.spawnPoolMaxRadius, "plasma", {damage: gameDefs.plasmaDamage, lightsource: [{intensity: 3, color: [255, 0, 255]}]}),
        poolSpawnEventConstructor(asciiMapping["~"], gameDefs.spawnPoolMaxRadius, "water"),
        wallExplosionEventConstructor,
        monsterSpawnEventConstructor,
        function () {
            return function (t, c) {
                if (c.player.attrs.hp.pos < c.player.attrs.hp.max) {
                    c.player.messages.push("You feel restored!")
                    c.player.attrs.hp.pos = Math.min(c.player.attrs.hp.pos + 50, c.player.attrs.hp.max)
                } else {
                    c.player.messages.push("Health station: No need to heal")
                    return false
                }
            }
        },
        blinkEventConstructor
    ]

/**
 * This functions decorates "fn" marking it as a valid function that can be invoked by the client
 */
function saferpc(fn) {
    fn.isSafeRpc = true
    return fn
}

var handlers = { // These are the RPC handlers that the client can invoke
    start: saferpc(function(ws, obj) {
        var dx = ws.clientnum % 4
        var dy = Math.floor(ws.clientnum / 4)
        
        ws.player = {pix: asciiMapping['@'],
                color: '#44F',
                pos: {x: startXPos + dx, y: startYPos + dy},
                gibs: [{pix: asciiMapping["~"], gibType: "severed extremity"}, {pix: asciiMapping["∞"], gibType: "brain piece"}, {pix: asciiMapping["≈"], gibType: "blood pool"}, {pix: asciiMapping["·"], gibType: "internal organ"}, {pix: asciiMapping["%"], gibType: "intestine"}],
                username: obj.username,
                player_class: obj.player_class,
                type: "player",
                idleCounter: 0,
                chartype: obj.chartype,
                attrs: {
                    suPow: 100,
                    suPowWait: 0,
                    battery: 100,
                    hp: {pos: 100, max: 100, onchange: function(deathType, amnt, originator) {
						this.attrs.hp.pos = Math.round(this.attrs.hp.pos)
                        if (this.attrs.hp.pos <= 0) {
                            level[this.pos.y][this.pos.x].character = null
                            
                            util.dropInventory(this, level, passable)
                            
                            if (typeof(deathType) != undefined) {
                                if (deathType == "lava") {
                                    wss.broadcast(JSON.stringify({type: 'player_died', username: this.username, reason: 'lava'}))
                                    spawnGibs(this.pos.x, this.pos.y, this.pix,
                                        Math.round(sessionRandom.child('misc').random() * 2), 2, "#A84", "#862", this.gibs)
                                } else if (deathType == "acid") {
                                    wss.broadcast(JSON.stringify({type: 'player_died', username: this.username, reason: 'acid'}))
                                    spawnGibs(this.pos.x, this.pos.y, this.pix,
                                        Math.round(sessionRandom.child('misc').random() * 2), 2, "#4A4", "#272", this.gibs)
                                } else if (deathType == "ammo-9mm") {
                                    wss.broadcast(JSON.stringify({type: 'player_died', username: this.username, reason: '9mm'}))
                                    spawnGibs(this.pos.x, this.pos.y, this.pix,
                                        Math.round(sessionRandom.child('misc').random() * 2), 2, "#A00", "#600", this.gibs)
                                } else if (deathType == "ammo-12ga.") {
                                    wss.broadcast(JSON.stringify({type: 'player_died', username: this.username, reason: '12ga'}))
                                    spawnGibs(this.pos.x, this.pos.y, this.pix,
                                        Math.round(sessionRandom.child('misc').random() * 6), 2, "#A00", "#600", this.gibs)
                                } else {
                                    wss.broadcast(JSON.stringify({type: 'player_died', username: this.username, reason: deathType}))
                                    console.log('Unhandled player death type: ' + deathType)
                                    spawnGibs(this.pos.x, this.pos.y, this.pix,
                                        Math.round(sessionRandom.child('misc').random() * 6), Math.ceil(-this.attrs.hp.pos/5), "#A00", "#600", this.gibs)
                                }
                            } else {
                                wss.broadcast(JSON.stringify({type: 'player_died', username: this.username}))
                                spawnGibs(this.pos.x, this.pos.y, this.pix,
                                    Math.round(sessionRandom.child('misc').random() * 4), 3, "#A00", "#600", this.gibs)
                            }
                        } else if (amnt > 0) {
                            this.damaged = true
                        }
                    }},
                    armor: {pos: 0, max: 100},
                    strength: {pos: 0, max: 100},
                    precision: {pos: 0, max: 100},
                    speed: {pos: 0, max: 100},
                    wait: 0,
                    kind: "organic",
                    faction: "players"
                },
                weapon: null,
                inventory: [],
                messages: [],
                findInInventory: util.findInInventory,
                removeFromInventory: util.removeFromInventory
            }
        ws.turn = 0
        ws.standingOrder = false
        ws.player.fov = gameDefs.playerBaseFov
        ws.player.fov_sq = ws.player.fov * ws.player.fov

        lightmanager.addPlayerPosition(ws.player.pos, ws.player.attrs)
        applyPlayerClassBonusesAndPenalties(ws.player)
        
        wss.broadcast(JSON.stringify({type: 'new_player', username: obj.username, player_class: ws.player.player_class}))
        
        level[ws.player.pos.y][ws.player.pos.x].character = ws.player
        
        return {
            type: 'init',
            pos: ws.player.pos,
            canCheat: gameDefs.allowCheating,
            levelTileset: levelTileset,
            dim: {w: level[0].length, h: level.length},
            player_list: wss.clients.map(function(x) { if (x.player) { return {username: x.player.username}} } )
        }
    }),
    pos: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if ((ws.player.attrs.hp.pos > 0) && (!ws.player.readyForNextLevel)) {
                if (typeof(obj.pos) != "undefined") {
                    ws.dst = obj.pos
                    ws.special_movement = obj.special
                }
                ws.turn = nextTurnId
                ws.standingOrder = false
                processTurnIfAvailable()
            }
        }
    }),
    describe: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if ((obj.pos.y >= 0) && (obj.pos.y < level.length)) {
                var row = level[obj.pos.y]
                
                if ((obj.pos.x >= 0) && (obj.pos.x < row.length)) {
                    var tile = row[obj.pos.x]
                    
                    //console.log(tile) // TODO: Remote the description
                }
            }
        }
    }),
    use: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if (ws.player.attrs.hp.pos > 0) {
                ws.turn = nextTurnId
                ws.useTile = true
                processTurnIfAvailable()
            }
        }
    }),
    grab: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if (ws.player.attrs.hp.pos > 0) {
            
                ws.turn = nextTurnId
                ws.grabTile = true
                processTurnIfAvailable()
            }
        }
    }),
    fire: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if ((ws.player.attrs.hp.pos > 0) && 
                (typeof(ws.player.weapon) != "undefined") && (ws.player.weapon != null) &&
                (typeof(ws.player.weapon.fire) != "undefined")) {
				if (obj.alt) {
					if (ws.player.weapon.alternate) {
						ws.turn = nextTurnId
						ws.fireWeapon = true
						ws.fireAlternate = true
						ws.fireTarget = {x: obj.tgt.x, y: obj.tgt.y}
					} else {
						ws.player.messages.push("This weapon doesn't has alternate fire mode")
					}
				} else {
					ws.turn = nextTurnId
					ws.fireWeapon = true
					ws.fireTarget = {x: obj.tgt.x, y: obj.tgt.y}
				}
				
                processTurnIfAvailable()
            }
        }
    }),
    supow: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if (ws.player.attrs.hp.pos > 0) {
                if (obj.alt) {
                    ws.useSuPowAlternate = true
                } else {
                    ws.useSuPow = true
                }
                
                ws.turn = nextTurnId
                processTurnIfAvailable()
            }
        }
    }),
    reload: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if ((ws.player.attrs.hp.pos > 0) && 
                (typeof(ws.player.weapon) != "undefined")) {
                ws.turn = nextTurnId
                ws.reloadWeapon = true
				ws.reloadAlternate = obj.alt
                
                if (!continuousTurns) {
                    processTurnIfAvailable()
                }
            }
        }
    }),
    inventory: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if (ws.player.attrs.hp.pos > 0) {
                ws.turn = nextTurnId
                ws.sendInventory = true
                
                if (!continuousTurns) {
                    processTurnIfAvailable()
                }
            }
        }
    }),
    useInventory: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if (ws.player.attrs.hp.pos > 0) {
                
                ws.turn = nextTurnId
                ws.useInventory = obj.index
                
                if (!continuousTurns) {
                    processTurnIfAvailable()
                }
            }
        }
    }),
    dropInventory: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if (ws.player.attrs.hp.pos > 0) {
                
                ws.turn = nextTurnId
                ws.dropInventory = obj.index
                
                if (!continuousTurns) {
                    processTurnIfAvailable()
                }
            }
        }
    }),
    unloadInventory: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if (ws.player.attrs.hp.pos > 0) {
                
                ws.turn = nextTurnId
                ws.unloadInventory = obj.index
                
                if (!continuousTurns) {
                    processTurnIfAvailable()
                }
            }
        }
    }),
    inspectInventory: saferpc(function(ws, obj) {
        if (typeof(ws.player) != "undefined") {
            if (ws.player.attrs.hp.pos > 0) {
                
                ws.turn = nextTurnId
                ws.inspectInventory = obj.index
                
                if (!continuousTurns) {
                    processTurnIfAvailable()
                }
            }
        }
    }),
    
    cheat: saferpc(function(ws, obj) {
        if (gameDefs.allowCheating) {
            if (obj.fn == 'nextlevel') {
                nextLevel()
            } else if (obj.fn == 'megafov') {
                ws.player.fov = ws.player.fov * 20
                ws.player.fov_sq = ws.player.fov * ws.player.fov
            } else if (obj.fn == 'supow') {
                ws.player.attrs.suPow = 100
                ws.player.attrs.suPowWait = 0
            } else if (obj.fn == 'god') {
                ws.player.attrs.hp.pos = 100000
                ws.player.attrs.suPow = 100
                ws.player.attrs.suPowWait = -10000
                ws.player.fov = 64
                ws.player.fov_sq = ws.player.fov * ws.player.fov
                ws.player.attrs.clairvoyanceRadius = 100
                ws.player.weapon.ammo = 100000
                ws.player.override_commsSense = 60
            } else if (obj.fn == 'showfsm') {
                var tile = level[obj.data.y][obj.data.x]
                if (tile.character && tile.character.fsmVars) {
                    if (typeof(ws.fsms) === "undefined") {
                        ws.fsms = {}
                    }
                    ws.fsms[obj.data.id] = tile.character.fsmVars
                    ws.sendPako(JSON.stringify({
                        type: "fsm_vars",
                        pos: {x: obj.data.x, y: obj.data.y},
                        vars: tile.character.fsmVars
                    }))
                }
            } else if (obj.fn == 'updatefsms') {
                if (ws.fsms) {
                    var nobj = {
                        type: "fsms_updates",
                        fsms: ws.fsms
                    }
                    
                    var cache = []
                    var stnobj = JSON.stringify(nobj, function(key, value) {
                        if (typeof value === 'object' && value !== null) {
                            if (cache.indexOf(value) !== -1) {
                                // Circular reference found, discard key
                                return "[Circular]"
                            }
                            // Store value in our collection
                            cache.push(value)
                        }
                        return value
                    })
                    cache = null
                    
                    ws.sendPako(stnobj)
                }
            }
        }
    }),
	prone: saferpc(function (ws, obj) {
		ws.turn = nextTurnId
		ws.goProne = true
		
		if (!continuousTurns) {
			processTurnIfAvailable()
		}
	}),
	crouch: saferpc(function (ws, obj) {
		ws.turn = nextTurnId
		ws.goCrouch = true
		
		if (!continuousTurns) {
			processTurnIfAvailable()
		}
	}),
}

function initObjects() {
    activableTiles[asciiMapping['=']] = function(t, c) {
        t.tile = asciiMapping['_']
        soundManager.addSound(c.player.pos.x, c.player.pos.y, 15, "open_door", 0)
        
        if (typeof(c.player.messages) !== "undefined") {
            c.player.messages.push("You open the door")
        }
    }

    activableTiles[asciiMapping['≈']] = function(t, c) {
        if (typeof(c.player) != "undefined") {
            c = c.player
        }
        if (c.attrs.hp.pos > 0) {
            c.attrs.hp.pos -= t.damage
            
            if (typeof(c.attrs.hp.onchange) != "undefined") {
                c.attrs.hp.onchange.call(c, t.cssClass, t.damage)
            }
        }
    }

    usableTiles[asciiMapping['↑']] = function(t, c) {
        if (typeof(c.player.messages) !== "undefined") {
            c.player.messages.push("You pull down the lever")
        }
        
        if (t.linkedEvent(t, c)) {
            t.tile = asciiMapping['↓']
            soundManager.addSound(c.player.pos.x, c.player.pos.y, 15, "switch", 0)
        }
    }
    
    usableTiles[asciiMapping['>']] = function(t, c) {
        t.character = null
        c.player.readyForNextLevel = true
        
        wss.broadcast(JSON.stringify({type: 'player_downstairs', username: c.player.username}))
        c.player.messages.push("You exit the level")
    }
}

var enemyTally = false
var enemyTypes = []
function spawnRandomEnemy() {
    if (!enemyTally) {
        aiState.newFaction('Lefty')
        aiState.newFaction('Rigthy')
        aiState.newFaction('Savages')
        aiState.newFaction('Demons')
        
        aiState.factionAggro('Lefty', 'Righty', 20)
        aiState.factionAggro('Lefty', 'Savages', 10)
        aiState.factionAggro('Lefty', 'Demons', 30)
        aiState.factionAggro('Lefty', 'players', 1)
        
        aiState.factionAggro('Righty', 'Lefty', 30)
        aiState.factionAggro('Righty', 'Savages', 10)
        aiState.factionAggro('Righty', 'Demons', 20)
        aiState.factionAggro('Righty', 'players', 1)
        
        aiState.factionAggro('Savages', 'Lefty', 10)
        aiState.factionAggro('Savages', 'Righty', 9)
        aiState.factionAggro('Savages', 'Demons', 1)
        aiState.factionAggro('Savages', 'players', 1)
        
        aiState.factionAggro('Demons', 'Lefty', 10)
        aiState.factionAggro('Demons', 'Righty', 10)
        aiState.factionAggro('Demons', 'Savages', 1)
        aiState.factionAggro('Demons', 'players', 50)
        
        enemyTally = {}
        for (x in monsters.spawners) {
            if (monsters.spawners.hasOwnProperty(x)) {
                enemyTally[x] = 0
                enemyTypes.push(x)
            }
        }
    }
    
    var spawned = false
    var monsterGen = sessionRandom.child('level').child('monsters')
    while (!spawned) {
        
        var rndX = ((monsterGen.random() * 2 - 1) - 0.5) * 2
        
        rndX = 1 - (rndX * rndX)
        
        var tx = Math.floor(rndX*(level[0].length - 2) + 1)
        var ty = Math.floor(monsterGen.random()*(level.length - 2) + 1)
        if (passable(level[ty][tx])) {
            var type = enemyTypes[Math.floor(monsterGen.random() * enemyTypes.length)]
            
            var left = tx <= level[0].length/2
            
            if (type == 'Marine') {
                monsters.spawners[type](aiState, type + ' Nº' + enemyTally[type], tx, ty, left?"Lefty":"Righty", left?0.1:0.85, currentLevel)
            } else {
                monsters.spawners[type](aiState, type + ' Nº' + enemyTally[type], tx, ty, "Savages", 0.5, currentLevel)
            }
            spawned = true
            enemyTally[type]++
        }
    }
}

function applyPlayerClassBonusesAndPenalties(player) {
    var defaultWeapon = "9mm Pistol"
    var defaultCharger = "9mm bullets"
    var spareChargerCount = 2
	var useGenerator = false
    if (player.player_class == 'marine') {
        /*defaultWeapon = "9mm Light Machine Gun"
        defaultCharger = "9mm bullets"*/
		defaultWeapon = "weapons/ranged/MP9"
        defaultCharger = "ammo/charger/"
		useGenerator = true
        
        player.attrs.hp.pos += 30
        player.attrs.hp.max += 30
    } else if (player.player_class == 'heavy') {
        defaultWeapon = "Flamethrower"
        defaultCharger = "Gasoline tank"
        
        player.attrs.hp.pos += 20
        player.attrs.hp.max += 20
        
        player.attrs.armor.pos = 50
        player.attrs.armor.max = 200
        player.attrs.strength.pos = 30
        player.attrs.precision.max = 50
        player.attrs.speed.max = 30
    } else if (player.player_class == 'swords') {
        player.attrs.armor.pos = 25
        player.attrs.armor.max = 50
        player.attrs.strength.pos = 30
        player.attrs.precision.max = 30
        player.attrs.speed.pos = 50
        player.attrs.speed.max = 200
        player.attrs.agile = true
        defaultWeapon = "Katana"
        defaultCharger = false
    } else if (player.player_class == 'melee') {
        player.attrs.armor.pos = 60
        player.attrs.armor.max = 200
        player.attrs.strength.pos = 50
        player.attrs.strength.max = 200
        player.attrs.precision.max = 20
        player.attrs.speed.max = 50
        player.attrs.agile = true
        player.attrs.extraMelee = true
    } else if (player.player_class == 'tech') {
        defaultWeapon = "Gatling Laser"
        defaultCharger = "Energy cell"
        
        player.attrs.hp.pos -= 20
        player.attrs.hp.max -= 20
        
        player.attrs.armor.max = 80
        player.attrs.strength.max = 80
    } else if (player.player_class == 'engy') {
        defaultWeapon = "xM3 Shotgun"
        defaultCharger = "12ga shells"
        
        player.attrs.hp.pos -= 20
        player.attrs.hp.max -= 20
        
        player.attrs.armor.max = 80
        player.attrs.strength.max = 80
    } else if (player.player_class == 'medic') {
        player.attrs.hp.pos -= 20
        player.attrs.hp.max -= 20
        
        player.attrs.armor.pos = 100
        player.attrs.armor.max = 200
        player.attrs.strength.max = 50
    } else if (player.player_class == 'spy') {
        player.fov = Math.ceil(player.fov * 1.2)
        player.fov_sq = player.fov * player.fov
        player.attrs.hp.pos -= 20
        player.attrs.hp.max -= 20
        
        player.attrs.armor.max = 50
        player.attrs.precision.max = 50
        player.attrs.speed.max = 200
        player.attrs.agile = true
    } else if (player.player_class == 'explo') {
        defaultWeapon = "H80 RPG Launcher"
        defaultCharger = "H80 RPG"
        spareChargerCount = 12
        
        player.attrs.hp.pos += 10
        player.attrs.hp.max += 10
        
        player.attrs.armor.pos = 50
        player.attrs.armor.max = 200
        player.attrs.strength.pos = 50
        player.attrs.precision.max = 30
        player.attrs.speed.max = 80
    } else if (player.player_class == 'sniper') {
        defaultWeapon = "xM50 Rifle"
        defaultCharger = "7.62x54mm bullets"
        
        player.fov = Math.ceil(player.fov * 1.6)
        player.fov_sq = player.fov * player.fov
        player.attrs.hp.pos -= 20
        player.attrs.hp.max -= 20
        
        player.attrs.precision.pos = 75
        player.attrs.precision.max = 200
        player.attrs.speed.max = 50
    } else if (player.player_class == 'psychic') {
        player.attrs.hp.pos -= 30
        player.attrs.hp.max -= 30
        
        player.attrs.armor.max = 50
        player.attrs.precision.max = 200
        player.attrs.speed.max = 200
    } else if (player.player_class == 'civil') {
        player.attrs.hp.pos = 50
        player.attrs.hp.max = 50
        player.fov = Math.ceil(player.fov / 1.5)
        player.fov_sq = player.fov * player.fov

        player.attrs.armor.max = 25
        player.attrs.strength.max = 25
        player.attrs.precision.max = 25
        player.attrs.speed.max = 25
    }
    
    // Default Weapon
	if (useGenerator) {
		var weapon = items.generate(defaultWeapon)
		var charger = items.generate(defaultCharger + weapon.ammoType)
		weapon.assignCharger(charger.clone())
		
		for (var i=0; i < spareChargerCount; i++) {
			player.inventory.push(charger.clone())
		}
		
		if (weapon.alternate) {
			var charger = items.generate(weapon.alternate.ammoPath)
			weapon.assignCharger(charger.clone())
			
			for (var i=0; i < spareChargerCount; i++) {
				player.inventory.push(charger.clone())
			}
		}
		
		player.weapon = weapon
	} else {
		var weapon = items.searchWeaponByName(defaultWeapon).clone()
        
        if (defaultCharger) {
            var chargerOrig = items.searchAmmoType(defaultCharger)
            weapon.assignCharger(chargerOrig.clone())
            for (var i=0; i < spareChargerCount; i++) {
                player.inventory.push(chargerOrig.clone())
            }
        }
		player.weapon = weapon
	}
}

function init(session) {
    var w = gameDefs.level.width
    var h = gameDefs.level.height
    sessionRandom = new determinist.IdRandomizer(session /*|| "0ed385e0bf8dbba5"*/)
    sessionRandom.reserve(['level-session', 'level', 'items', 'particles', 'weapons', 'ai', 'monsters', 'effects', 'player', 'util', 'misc'])
    sessionRandom.child('level').reserve(['item-placement', 'river-placement', 'lever-placement', 'sprite-placement', 'start-placement', 'monsters', 'items'])
    
    console.log("Session: " + ("" + sessionRandom.id).yellow)
    
    particleManager = particles.Singleton(w, h)
    
    initObjects()
    
    weapons.registerPassableFn(passable)
    weapons.registerLevel(level)
    weapons.registerGenerator(sessionRandom.child('weapons'))
    util.registerGenerator(sessionRandom.child('util'))
    effects.registerGenerator(sessionRandom.child('effects'))
    items.registerGenerator(sessionRandom.child('level').child('items'))
    monsters.registerGenerator(sessionRandom.child('level').child('monsters'))
    
    resetLevel()
    
    console.log("Game " + "READY".green)
}
 
function resetLevel() { 
    var w = gameDefs.level.width
    var h = gameDefs.level.height
    
    while (level.length > 0) {
        level.pop()
    }
    
    for (var y=0; y < h; y++) {
        var row = Array.apply(null, new Array(w)).map(function(){return ((y==0)||(y==(h-1)))?{tile: asciiMapping['#']}:{tile: asciiMapping['.']}})
        row[0].tile = asciiMapping['#']
        row[w-1].tile = asciiMapping['#']
        level.push(row)
    }

    lightmanager.assignLevel(level)
    
    var levelType = sessionRandom.child('level-session').randomIntRange(3)
    if (levelType == -1) {
        levelTileset = "base"
        generators.testLevel(sessionRandom.child('level'), level,
            asciiMapping['.'], asciiMapping['#'], asciiMapping['='])
            
        level.map(function(row){ row.map(function(tile){
            if (typeof(tile.lightsource) !== "undefined") {
                while (tile.lightsource.length > 0) {
                    tile.lightsource.shift()
                }
            }
        })})
    } else if (levelType == 0) {
        levelTileset = "base"
        generators.bspSquares(sessionRandom.child('level'), level, 
            gameDefs.level.minRoomArea,
            gameDefs.level.randomAcceptRoom,
            asciiMapping['.'], asciiMapping['#'], asciiMapping['='],
            gameDefs.level.roomAcceptProbability,
            gameDefs.level.roomConvertCaveProbability)
    } else if (levelType == 1) {
        levelTileset = "cave"
        generators.caveLevel(sessionRandom.child('level'), level, 
            gameDefs.level.minRoomArea,
            gameDefs.level.randomAcceptRoom,
            asciiMapping['.'], asciiMapping['#'], asciiMapping['='],
            gameDefs.level.roomAcceptProbability,
            gameDefs.level.roomConvertCaveProbability)
    } else if (levelType == 2) {
        levelTileset = "lava"
        generators.lavaLevel(sessionRandom.child('level'), level, 
            gameDefs.level.minRoomArea,
            gameDefs.level.randomAcceptRoom,
            asciiMapping['.'], asciiMapping['#'], asciiMapping['='],
            asciiMapping['≈'], 5,
            gameDefs.level.roomAcceptProbability,
            gameDefs.level.roomConvertCaveProbability)
    }
    console.log("Finished generating level")
    var riverTiles = [
        [asciiMapping['~'], 'water', null, undefined],
        [asciiMapping['≈'], 'acid', 1, {intensity: 2, color: [53, 168, 46]}],
        [asciiMapping['≈'], 'lava', 5, {intensity: 3, color: [202, 96, 34]}]]
    
    var levelGen = sessionRandom.child('level')
    var riverGen = levelGen.child('river-placement')
    var leverGen = levelGen.child('lever-placement')
    var itemGen = levelGen.child('item-placement')
    var spriteGen = levelGen.child('sprite-placement')
    var startGen = levelGen.child('start-placement')
    
    startXPos = Math.floor((startGen.random() * 0.25 + 0.15) * w)
    startYPos = Math.floor((startGen.random() * 0.2 + 0.2) * h )
    
    if (startGen.random() < 0.5) {
        startXPos = w - startXPos
    }
    
    if (startGen.random() < 0.5) {
        startYPos = h - startYPos
    }
    
    if (levelType >= 0) {
        var nRivers = riverGen.random() 
        nRivers = Math.floor(nRivers * nRivers * gameDefs.level.maxRivers)
        
        for (var i=0; i < nRivers; i++) {
            var nRiverTile = Math.floor(riverGen.random() * riverTiles.length)
            generators.river(riverGen, level, 
                (riverGen.random()<0.5)?'horizontal':'vertical', 
                riverTiles[nRiverTile][0], 
                riverTiles[nRiverTile][1], 
                asciiMapping['|'], 'wood', 
                riverTiles[nRiverTile][2],
                riverTiles[nRiverTile][3])
        }
        
        var numLevers = leverGen.random()*gameDefs.level.randomLevers + gameDefs.level.minLevers
        for (var n=0; n < numLevers; n++) {
            var x0 = Math.floor(leverGen.random() * (level[0].length - 2) + 1)
            var y0 = Math.floor(leverGen.random() * (level.length - 2) + 1)
            
            var t = level[y0][x0]
            if (passable(t)) {
                t.tile = asciiMapping['↑']
                t.linkedEvent = leverEvents[Math.floor(leverGen.random() * leverEvents.length)]()
            }
        }
        
        var numItems = itemGen.random()*gameDefs.level.randomNumberItems*currentLevel + gameDefs.level.minNumberItems
        while (numItems > 0) {
            var x0 = Math.floor(itemGen.random() * level[0].length)
            var y0 = Math.floor(itemGen.random() * level.length)
            
            var t = level[y0][x0]
            if (passable(t)) {
                t.item = items[Math.floor(itemGen.random() * items.length)].clone()
                if (t.item.type == 'weapon') {
                    t.item.findChargerAndAssign(items)
                }
                numItems--
            }
        }
        
        var numSprites = gameDefs.level.numSpritesToTryFit
        var availableSprites = []
        for (x in sprites) { if (!(x in Object.prototype)) { availableSprites.push(sprites[x]) } }
        
        for (var n=0; n < numSprites; n++) {
            var i = Math.floor(spriteGen.random() * availableSprites.length)
            var spr = availableSprites[i]
            
            var x = Math.floor(spriteGen.random() * (level[0].length-10) + 5)
            var y = Math.floor(spriteGen.random() * (level.length-10) + 5)
            
            spr.drawIfFree(level, x, y)
        }
        
        if (currentLevel == 0) {
            sprites["deployship"].draw(level, startXPos - 2, startYPos - 5)
            sprites["baseentry"].draw(level, w - (startXPos - 2), h - (startYPos - 5))
        } else {
            startXPos = Math.floor(startGen.random() * (w - 8) + 4)
            startYPos = Math.floor(startGen.random() * (h - 8) + 4)
            
            for (var j=-5; j <= 5; j++) {
                var py = startYPos + j
                
                if ((py >= 0) && (py < level.length)) {
                    var row = level[py]
                    for (var i=-5; i <= 5; i++) {
                        var px = startXPos + i
                        
                        if ((px >= 0) && (px < row.length)) {
                            if ((i*i + j*j) < 25) {
                                var tile = row[px]
                                
                                tile.tile = asciiMapping['.']
                                
                                if ('damage' in tile) {
                                    delete tile.damage
                                }
                                
                                if ('cssClass' in tile) {
                                    delete tile.cssClass
                                }
                            }
                        }
                    }
                }
            }
            
            var exitX = w - (startXPos - 2)
            var exitY = h - (startYPos - 5)
            sprites["baseentry"].draw(level, exitX, exitY)
            
            if (itemGen.random() < gameDefs.batteryNearExitProbability) {
                // Add a battery //
                var itm = items.itemByName("Flashlight Battery").clone()
                
                var batteryPut = false
                while (!batteryPut) {
                    
                    var bx = itemGen.randomInt(exitX-2, exitX + 10)
                    var by = itemGen.randomInt(exitY-2, exitY + 10)
                    
                    if ((by >= 0) && (by < level.length) && (bx >= 0) && (bx < level[0].length)) {
                        var t = level[y0][x0]
                        
                        if (passable(t)) {
                            t.item = itm
                            batteryPut = true
                        }
                    }
                }
            }
        }
    }
    
    if (aiState) {
        aiState.purge()
    } else {
        aiState = new ai({
            level: level, 
            traceable: traceable, 
            passable: passable, 
            activable: activable,
            activableTiles: activableTiles,
            inflictMeleeDamage: inflictMeleeDamage, 
            spawnGibs: spawnGibs,
            usableTiles: usableTiles,
            grab: grab,
            soundManager: soundManager,
            generator: sessionRandom.child('player')
        })
    }
    
    var numEnemies = gameDefs.level.numEnemies
    while (numEnemies > 0) {
        spawnRandomEnemy()
        numEnemies--
    }
    
    lightmanager.calculateLighting(nextTurnId)
}

function sign(n) {
    if (n == 0) {
        return 0
    } else if (n < 0) {
        return -1
    } else {
        return 1
    }
}

function passable(t, considerCharacters) {
    if (typeof(t) == "undefined") {
        return false
    }
    
    if (typeof(considerCharacters) == "undefined") {
        considerCharacters = true
    }
    
    var validTile = (passableTiles.indexOf(t.tile) >= 0)
    var character = (considerCharacters) && (typeof(t.character) != 'undefined') && (t.character != null)
    
    if (character) {
        return 2
    } else if (validTile) {
        return 1
    } else if (t.forcePassable) {
        return t.forcePassable
    } else {
        return 0
    }
}

function activable(t) {
    if (typeof(t) == "undefined") {
        return false
    }
    return t.tile in activableTiles
}

function inflictMeleeDamage(org, chr) {
    if (!chr) {
        return
    }
    
    if (typeof(chr.player) != "undefined") {
        chr = chr.player
    }
    
    if (typeof(org.player) != "undefined") {
        org = org.player
    }
    
    if (chr.attrs.hp.pos > 0) {
        if ((typeof(org.weapon) != "undefined") &&
            (typeof(org.weapon.melee) != "undefined") &&
            (org.weapon.melee && org.weapon.doMelee)) {
            org.weapon.doMelee(chr.pos.x, chr.pos.y, org)
        } else {
            var c_armor
            var c_strength
            var o_armor
            var o_strength
            var ox
            var oy
            
            c_armor = chr.attrs.armor.pos
            c_strength = chr.attrs.strength.pos
            
            o_armor = org.attrs.armor.pos
            o_strength = org.attrs.strength.pos
            
            ox = org.pos.x
            oy = org.pos.y
            
            var dmg = Math.round(Math.max(1, (o_strength - c_armor) / 10))
            var knk = Math.round(Math.max(0, (o_armor - c_strength) / 10))
            
            if (typeof(org.attrs.knockbackFactor) != "undefined") {
                knk *= org.attrs.knockbackFactor
            }
            
            if (org.attrs.extraMelee) {
                if (org.attrs.suPow) {
                    knk *= Math.round(6 * Math.pow(org.attrs.suPow / 100.0, 4))
                }
            }
            
            chr.attrs.hp.pos -= dmg
            
            if (!chr.knockback) {
                chr.knockback = {
                    ox: ox,
                    oy: oy,
                    amount: knk
                }
            } else {
                if (chr.knockback.amount < knk) {
                    chr.knockback.ox = ox
                    chr.knockback.oy = oy
                }
                
                chr.knockback.amount += knk
            }
            
            if (typeof(chr.attrs.hp.onchange) != "undefined") {
                chr.attrs.hp.onchange.call(chr, "melee", dmg, org)
            }
            
            console.log(org.weapon)
            if (org.weapon && org.weapon.melee) {
                soundManager.addSound(chr.pos.x, chr.pos.y, 10, org.weapon.sndOnFire, 0)
            } else {
                soundManager.addSound(chr.pos.x, chr.pos.y, 10, "hit", 0)
            }
        }
    }
}

function spawnGibs(x, y, pix, n, nmin, colorLight, colorDark, gibs, options) {
    if (!options) {
        options = {}
    }
    
    var ndebris = Math.round(sessionRandom.child('misc').random() * n) + nmin
    var spread = options.spread || 2
    var spread2 = spread / 2
    
    for (var i=0; i < n; i++) {
        var dx = Math.round(sessionRandom.child('misc').random()*spread-spread2)
        var dy = Math.round(sessionRandom.child('misc').random()*spread-spread2)
        
        var tx = x+dx
        var ty = y+dy
        
        var gibType = "gib"
        var gibPix = gibs[Math.floor(sessionRandom.child('misc').random()*gibs.length)]
        if (typeof(gibPix.gibType) != "undefined") {
            gibType = gibPix.gibType
            gibPix = gibPix.pix
        }
        
        if ((ty >= 0) && (ty < level.length) &&
            (tx >= 0) && (tx < level[ty].length)) {
            level[ty][tx].debris = {
                pix: gibPix, 
                color: (sessionRandom.child('misc').random() < 0.5)?colorLight:colorDark,
                type: gibType
            }
        }
    }
    
    soundManager.addSound(x, y, 10, "gibs", 0)
    
    level[y][x].debris = {
        pix: pix, 
        color: colorDark,
        type: "corpse"
    }
}

function processTurnIfAvailable() {
	var keepProcessing = wss.clients.length > 0
    
	while (keepProcessing) {
		_processTurnIfAvailable_priv_()
		
		// First, let's see if there's players waiting
		for (var i in wss.clients) {
            var ws = wss.clients[i]
			
			if ((typeof(ws.player) == 'undefined') || (typeof(ws.player.wait) == 'undefined') || (ws.player.wait <= 0)) {
				keepProcessing = false
				break
			}
		}
		
		if (keepProcessing) {
			// It seems peeps are waiting, let's process another turn
			for (var i in wss.clients) {
				var ws = wss.clients[i]
				ws.turn = nextTurnId
			}
		}
	}
}

function _processTurnIfAvailable_priv_() {
    if (!hasBeenInited) {
        init()
        hasBeenInited = true
    }
    if (!gameStarted) {
        return
    }

    if (continuousTurns) {
        if ((Date.now() - lastTurnTime) < contTurnsTimeThreshold) {
            return
        }
    } else {
        for (var i in wss.clients) {
            var cli = wss.clients[i]
			var isWaiting = false
			
            if (isWaiting || (cli.turn != nextTurnId) && (!cli.standingOrder)) {
				if (isWaiting) {
					cli.player.wait--
				}
				
				for (var i in wss.clients) {
					var ws = wss.clients[i]
					
					if (ws.player && ws.player.messages && (ws.player.messages.length > 0)) {
						var msg = {
							msgs: ws.player.messages
						}
						ws.player.messages = []
						
						ws.sendPako(JSON.stringify(msg))
					}
				}
				
                return
            }
        }
    }

    if (aiState.agents.length < gameDefs.level.numEnemies) {
        spawnRandomEnemy()
    }
    
    // Process Movement
    var waitingForPlayer = false
    var playerSomethingHappened = false
    var nturns = 0
    var aiSomethingHappened = false
    var somethingHappened = false
    
    //while (!waitingForPlayer) {
        while ((!somethingHappened) && (nturns < 10)) { // Only wait 10 turns before bailing out
            for (var i in wss.clients) {
                var ws = wss.clients[i]
                playerSomethingHappened |= util.processSemiturn({
                    agent: ws,
                    level: level,
                    passable: passable,
                    activableTiles: activableTiles,
                    soundManager: soundManager,
                    grab: grab,
                    inflictMeleeDamage: inflictMeleeDamage,
                    usableTiles: usableTiles,
                    activable: activable,
                    generator: sessionRandom.child('player')
                })
            }
            aiSomethingHappened |= aiState.process()
            
            somethingHappened = aiSomethingHappened | playerSomethingHappened
            nturns++
        }
        
        if (playerSomethingHappened) {
            lightmanager.calculateLighting(nextTurnId)
        }
        
        // Send new info to clients
        if (playerSomethingHappened) {
            waitingForPlayer = true
            for (var i in wss.clients) {
                var ws = wss.clients[i]
                var scope = sendScopeToClient(ws)
                try {
                    ws.sendPako(JSON.stringify(scope))
                } catch(err) {
                    console.log(scope)
                    
                    throw err
                }
            }
        }
        
        if (wss.clients.length > 0) {
            for (var i in wss.clients) {
                var ws = wss.clients[i]
                
                if (ws.player.wait <= 0) {
                    waitingForPlayer = true
                }
            }
        } else {
            waitingForPlayer = true
        }
    //}

    soundManager.endTurn(nextTurnId)
    comms.tick()
    particleManager.processTurn()
    var nd = Date.now()
    nextTurnId++
    lastTurnTime = nd
    
    if (wss.clients.length == 0) {
        console.log('Stopping game ' + 'NOW!'.red)
        stopGameAndRestart()
    } else {
        checkLevelRestart()
    }
}

function checkLevelRestart() {
    var everyoneReady = true
    
    for (var i=0; i < wss.clients.length; i++) {
        var c = wss.clients[i]
        if (typeof(c.player) != "undefined") {
            everyoneReady &= c.player.readyForNextLevel
        } else {
            everyoneReady = false
        }
    }
    
    if (everyoneReady) {
        nextLevel()
    }
}

function nextLevel() {
    currentLevel++
    resetLevel()
 
    wss.broadcast(JSON.stringify({type: 'new_level'}))
 
    for (var i=0; i < wss.clients.length; i++) {
        var c = wss.clients[i]

        c.player.readyForNextLevel = false
        
        var dx = c.clientnum % 4
        var dy = Math.floor(c.clientnum / 4)
        c.player.pos.x = startXPos + dx
        c.player.pos.y = startYPos + dy
        
        level[c.player.pos.y][c.player.pos.x].character = c.player
        
        var msg = {
            type: 'init',
            pos: c.player.pos,
            dim: {w: level[0].length, h: level.length},
            player_list: wss.clients.map(function(x) { if (x.player) { return {username: x.player.username}} } )
        }
    
        c.sendPako(JSON.stringify(msg))
    }
}

function traceable(x0, y0, x1, y1) {
    /*util.bresenhamsEvaluate(level, x0, y0, x1, y1, undefined,
        function(tile, x, y) {
            if (!(passable(tile) >= 1)) {
                return false
            }
        })
    return true*/
    var dx = x1 - x0
    var dy = y1 - y0

    if ((dx == 0) && (dy == 0)) {
        return true
    } else if (dy == 0) {
        // Horizontal line, easiest
        var row = level[Math.floor(y0)]
        var ix = (dx > 0)?1:-1
        dx = Math.abs(dx)
        
        var x = x0
        for (var i = 1; i < dx; i++) {
            x += ix
            if (passable(row[Math.floor(x)]) == 0) {
                return false
            }
        }
    } else if (dx == 0) {
        // Vertical line, easy
        var iy = (dy > 0)?1:-1
        dy = Math.abs(dy)
        
        var y = y0
        for (var i = 1; i < dy; i++) {
            y += iy
            if (!(passable(level[Math.floor(y)][Math.floor(x0)]) >= 1)) {
                return false
            }
        }
    } else {
        // Run the algorithm
        var ix = (dx > 0)?1:-1
        var iy = (dy > 0)?1:-1
        var error = 0
        
        if (Math.abs(dx) > Math.abs(dy)) {
            var derror = Math.abs(dy/dx)
            var y = y0
            
            var originPassable = passable(level[Math.floor(y)][Math.floor(x0)]) >= 1
            
            for (var x=x0+ix; x != x1; x+=ix) {
                error += derror
                if (error > 0.5) {
                    y += iy
                    error -= 1.0
                }

                // Why this? Adjacent walls shouldn't block sight
                var currentPassable = passable(level[Math.floor(y)][Math.floor(x)]) >= 1
                var errPassable = false
                if (((y + iy) >= 0)&&((y + iy) < level.length)) {
                    errPassable = passable(level[Math.floor(y + iy)][Math.floor(x)]) >= 1
                }
                if (((y != y0) && !(currentPassable)) || 
                    (originPassable && !currentPassable) ||
                    (!errPassable && !currentPassable)) {
                    return false
                }
            }
        } else if (Math.abs(dx) < Math.abs(dy)) {
            var derror = Math.abs(dx/dy)
            var x = x0
            
            var originPassable = passable(level[Math.floor(y0)][Math.floor(x)]) >= 1
            for (var y=y0+iy; y != y1; y+=iy) {
                error += derror
                if (error > 0.5) {
                    x += ix
                    error -= 1.0
                }
                
                // Why this? Adjacent walls shouldn't block sight
                var currentPassable = passable(level[Math.floor(y)][Math.floor(x)]) >= 1
                var errPassable = false
                if (((x + ix) >= 0)&&((x + ix) < level[0].length)) {
                    errPassable = passable(level[Math.floor(y)][Math.floor(x + ix)]) >= 1
                }
                if (((x != x0) && !(currentPassable)) || 
                    (originPassable && !currentPassable) ||
                    (!errPassable && !currentPassable)) {
                    return false
                }
            }
        } else if (Math.abs(dx) == Math.abs(dy)) {
            var x = x0+ix
            var y = y0+iy
            while ((y != y1) && (x != x1)) {
                if (!(passable(level[Math.floor(y)][Math.floor(x)]) >= 1)) {
                    return false
                }
                x += ix
                y += iy
            }
        }
    }
    
    return true
}

var trimTileProperties = ["astarIteration", "forcePassable", "lightsource"]
function tidyTile(tl) {
    var o = {}
    for (k in tl) {
        if (tl.hasOwnProperty(k) && (trimTileProperties.indexOf(k) < 0)) {
            v = tl[k]
            
            if ((v != null)&&(!(v instanceof Function))) {
                if (k == "character") {
                    // Don't reveal everything to the client about characters
                    o[k] = {
                        pix: v.pix,
                        color: v.color,
                        username: v.username,
                        type: v.type
                    }
                } else {
                    o[k] = v
                }
            }
        }
    }
    
    return o
}

function mapInventory(x, player) {
    return x.map(function(x) { return x.rpcRepr(player) })
}

function sendScopeToClient(ws) {
    if ((typeof(ws.player) == 'undefined') || (typeof(ws.player.pos) == 'undefined')) {
        return {}
    }
    
	var tfov = ws.player.fov
	var tfov_sq = ws.player.fov_sq
	
	if (ws.player.prone) {
		tfov *= gameDefs.proneFovMult
		tfov_sq = tfov * tfov
	} else if (ws.player.crouch) {
		tfov *= gameDefs.crouchFovMult
		tfov_sq = tfov * tfov
	}
    
    if (ws.player.player_class == 'sniper') {
        var suPowFovMult = Math.max(0, Math.min(100, ws.player.attrs.suPow)/60.0) + 1.0
        
        tfov *= suPowFovMult
        tfov_sq = tfov*tfov
    } else if (ws.player.player_class == 'spy') {
        var suPowFovMult = Math.max(0, Math.min(100, ws.player.attrs.suPow)/80.0) + 1.0
        
        tfov *= suPowFovMult
        tfov_sq = tfov*tfov
    }
    
    tfov = Math.round(tfov)
    tfov_sq = Math.round(tfov_sq)

    var clairvoyanceDistSq = 0
    
    if (ws.player.player_class == 'psychic') {
        clairvoyanceDistSq = Math.max(0, Math.min(100, ws.player.attrs.suPow))/0.5
    } else if (ws.player.attrs.clairvoyanceRadius) {
        clairvoyanceDistSq = ws.player.attrs.clairvoyanceRadius * ws.player.attrs.clairvoyanceRadius
    }

    var organicSense = 0
    if (ws.player.player_class == 'psychic') {
        organicSense = tfov_sq + Math.max(0, Math.min(100, ws.player.attrs.suPow))/0.2
        tfov = Math.ceil(Math.sqrt(organicSense))
    }
    
    var roboticSense = 0
    if (ws.player.player_class == 'engy') {
        roboticSense = tfov_sq + Math.max(0, Math.min(100, ws.player.attrs.suPow))/0.2
        tfov = Math.ceil(Math.sqrt(roboticSense))
    }
	
    var msg = {type: 'pos', pos: {x: ws.player.pos.x - tfov, y: Math.max(0, ws.player.pos.y - tfov)}}
    var scope = []
    
    // This gets processed before scanning the scope because it can turn into an item around the player
    if ((typeof(ws.dropInventory) != "undefined")&&(ws.dropInventory >= 0)) {
        ws.sendInventory |= tryToDropInventory(ws, ws.dropInventory)
        ws.dropInventory = -1
    }
    
    var commsSense = 0
    if (ws.player.player_class == 'tech') {
        commsSense = Math.max(0, Math.min(100, ws.player.attrs.suPow))/5
    }
    
    if (ws.player.override_commsSense) {
        commsSense = ws.player.override_commsSense
    }
    
    if (commsSense > 0) {
        msg.pkts = comms.collectAllMessages(ws.player.pos.x, ws.player.pos.y, commsSense)
    }
    
    for (var y=Math.max(0, ws.player.pos.y - tfov); y <= Math.min(ws.player.pos.y + tfov, level.length-1); y++) {
        var row = Array.apply(null, new Array(tfov*2+1)).map(function(){return null})
        
        for (var x=Math.max(0, ws.player.pos.x - tfov); x <= Math.min(ws.player.pos.x + tfov, level[y].length-1); x++) {
            dx = ws.player.pos.x - x
            dy = ws.player.pos.y - y
            dx = dx * dx
            dy = dy * dy
            
            var dd = dx + dy
            var tile = level[y][x]
            
            if (dd <= tfov_sq) {
                if ((dd <= clairvoyanceDistSq) || traceable(x, y, ws.player.pos.x, ws.player.pos.y)) {
                    row[x - (ws.player.pos.x - tfov)] = tidyTile(tile)
                }
            } else if ((dd <= organicSense) && (typeof(tile.character) !== "undefined") && (tile.character != null) && (tile.character.attrs.kind == "organic")) {
                row[x - (ws.player.pos.x - tfov)] = tidyTile(tile)
            } else if ((dd <= roboticSense) && (typeof(tile.character) !== "undefined") && (tile.character != null) && (tile.character.attrs.kind == "robotic")) {
                row[x - (ws.player.pos.x - tfov)] = tidyTile(tile)
            }
        }
        
        scope.push(row)
    }
    msg.scope = scope
    msg.plyr_pos = ws.player.pos
    msg.fov = tfov
    msg.attrs = ws.player.attrs
    if (ws.player.weapon != null) {
        msg.weapon = ws.player.weapon.rpcRepr(ws.player)
    }
    msg.particles = particleManager.getParticlesInScope(ws.player.pos.x, ws.player.pos.y, tfov, ws.player.username)
    msg.couldMove = ws.couldMove
    
    if ((typeof(ws.player.damaged) != "undefined") && (ws.player.damaged)) {
        msg.damaged = true
        ws.player.damaged = false
    }

    msg.crouch = ws.player.crouch
    msg.prone = ws.player.prone
    
    if ((typeof(ws.useInventory) != "undefined")&&(ws.useInventory >= 0)) {
        ws.sendInventory |= tryToUseInventory(ws, ws.useInventory)
        ws.useInventory = -1
    }
    
    if ((typeof(ws.unloadInventory) != "undefined")&&(ws.unloadInventory >= 0)) {
        ws.sendInventory |= tryToUnloadInventory(ws, ws.unloadInventory)
        ws.unloadInventory = -1
    }
    
    if ((typeof(ws.inspectInventory) != "undefined")&&(ws.inspectInventory >= 0)) {
        ws.sendInventory |= tryToInspectInventory(ws, ws.inspectInventory)
        ws.inspectInventory = -1
    }
    
    if ((typeof(ws.sendInventory) != "undefined")&&(ws.sendInventory)) {
        ws.sendInventory = false
        msg.inventory = mapInventory(ws.player.inventory, ws.player)
    }
	
	if ((typeof(ws.goProne) != "undefined")&&(ws.goProne)) {
        ws.goProne = false
    }
	
	if ((typeof(ws.goCrouch) != "undefined")&&(ws.goCrouch)) {
        ws.goCrouch = false
    }
    
    msg.snds = soundManager.collectSounds(ws.player.pos.x, ws.player.pos.y)
    
    msg.msgs = ws.player.messages
    ws.player.messages = []
    
    return msg
}

// Cache things for speed
var cachedJs = {}
var staticFiles = {}
var sprites = {}
var sounds = {}

var genericFiles = {}

function loadCachedFiles() {
    fs.readFile('templates/index.html', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache index page!")
        }
        
        indexPage = data
    })

    fs.readFile('templates/style.css', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache css page!")
        }
        
        cssPage['style'] = data
    })

    fs.readFile('templates/pako_inflate.min.js', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache js page!")
        }
        
        cachedJs["pako_inflate.min"] = data
    })

    fs.readFile('templates/jquery-2.1.1.min.js', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache js page!")
        }
        
        cachedJs["jquery"] = data
    })

    fs.readFile('templates/ASCIITerminal.js', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache js!")
        }
        
        cachedJs["ASCIITerminal"] = data
    })

    fs.readFile('templates/gl-matrix.js', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache js!")
        }
        
        cachedJs["gl-matrix"] = data
    })

    fs.readFile('templates/ascii_mapping.js', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache js!")
        }
        
        cachedJs["ascii_mapping"] = data
    })

    fs.readFile('templates/traceline.js', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache js!")
        }
        
        cachedJs["traceline"] = data
    })

    fs.readFile('templates/soundjs-0.6.0.min.js', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache js!")
        }
        
        cachedJs["soundjs"] = data
    })
    
    fs.readFile('templates/RexSprite.js', 'utf-8', function (err,data) {
        if (err) {
            return console.log("ERROR: ".red + "Couldn't cache js!")
        }
        
        cachedJs["rexsprite"] = data
    })
    
    fs.readdir('./templates', function (err, files) {
        if (!err) {
            for (var i=0; i < files.length; i++) {
                (function (fn) {
                    console.log(fn)
                    fs.readFile('./templates/' + fn, function (errrf, data) {
                        if (!errrf) {
                            genericFiles['/templates/' + fn] = [data, 'text/plain'] // TODO: Set correct mime type
                        } else {
                            console.log('Couldn\'t load static file: ' + name)
                        }
                    })
                })(files[i])
            }
        } else {
            console.log('Error reading static files: ' + err)
        }
    })
    
    fs.readdir('./static', function (err, files) {
        if (!err) {
            for (var i=0; i < files.length; i++) {
                (function (fn) {
                    var name = fn //fn.split('.').slice(0, -1).join('.')
                    fs.readFile('./static/' + fn, function (errrf, data) {
                        if (!errrf) {
                            if (name.indexOf('.xp') >= 0) {
                                staticFiles[name] = [data.toString('base64'), "application/octet-stream"]
                                genericFiles['/static/' + fn] = [data, 'application/octet-stream']
                            } else {
                                staticFiles[name] = [data, "image/png"]
                                genericFiles['/static/' + fn] = [data, 'image/png']
                            }
                        } else {
                            console.log('Couldn\'t load static file: ' + name)
                        }
                    })
                })(files[i])
            }
        } else {
            console.log('Error reading static files: ' + err)
        }
    })
    
    fs.readdir('./rex_sprites', function (err, files) {
        if (!err) {
            for (var i=0; i < files.length; i++) {
                (function (fn) {
                    var name = fn.split('.').slice(0, -1).join('.')
                    fs.readFile('./rex_sprites/' + fn, function (errrf, data) {
                        if (!errrf) {
                            var ret = new rs.RexSprite(data)
                            sprites[name] = ret
                            genericFiles['/rex_sprites/' + name] = [data, 'application/binary']
                        } else {
                            console.log('Couldn\'t load sprite: ' + name)
                        }
                    })
                })(files[i])
            }
        } else {
            console.log('Error reading REX Sprites: ' + err)
        }
    })

    fs.readdir('./sounds', function (err, files) {
        if (!err) {
            for (var i=0; i < files.length; i++) {
                (function (fn) {
                    var name = fn
                    fs.readFile('./sounds/' + fn, function (errrf, data) {
                        if (!errrf) {
                            sounds[name] = [data, 'audio/wav']
                            genericFiles['/sounds/' + name] = [data, 'audio/wav']
                        } else {
                            console.log('Couldn\'t load sound: ' + name)
                        }
                    })
                })(files[i])
            }
        } else {
            console.log('Error reading Wav sound: ' + err)
        }
    })
}

loadCachedFiles()
    
var htServer = http.createServer(function (req, res) {
    var urlp = url.parse(req.url)
    var uri = urlp.pathname
    
    if (uri in genericFiles) {
        res.writeHead(200, {"Content-Type": genericFiles[uri][1]})
        res.write(genericFiles[uri][0])
    } else if (uri == '/') {
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"})
        res.write(indexPage)
    } else if (uri.indexOf('/css') == 0) {
        var file = uri.split("/").reverse()[0]
        if (file in cssPage) {
            res.writeHead(200, {"Content-Type": "text/css; charset=utf-8"})
            res.write(cssPage[file])
        } else {
            res.writeHead(404, {"Content-Type": "text/html; charset=utf-8"})
            res.write(uri + " doesn't exist")
        }
    } else if (uri.indexOf('/js/') == 0) {
        var file = uri.split("/").reverse()[0]
        if (file in cachedJs) {
            res.writeHead(200, {"Content-Type": "text/css; charset=utf-8"})
            res.write(cachedJs[file])
        } else {
            res.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"})
            res.write("Bah! Humbug!")
        }
    } else if (uri.indexOf('/static/') == 0) {
        var file = uri.split("/").reverse()[0]
        if (file in staticFiles) {
            res.writeHead(200, {"Content-Type": staticFiles[file][1]})
            res.write(staticFiles[file][0])
        } else {
            res.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"})
        }
	} else if (uri.indexOf('/generated/') == 0) {
        var tmpDir = process.env.OPENSHIFT_TMP_DIR || "./"
        var file = tmpDir + 'rex_sprites/generated/' + uri.split("/").reverse()[0]
		
		var respondFile = function(f) {
			res.writeHead(200, {"Content-Type": "application/octet-stream"})
			res.write(fs.readFileSync(f).toString('base64'))
		}
		
		if (fs.existsSync(file)) {
			respondFile(file)
		} else {
			res.writeHead(404, {"Content-Type": "text/plain"})
			res.write("")
		}
    } else if (uri.indexOf('/wav/') == 0) {
        var file = uri.split("/").reverse()[0]
        if (file in sounds) {
            res.writeHead(200, {"Content-Type": sounds[file][1]})
            res.write(sounds[file][0])
        } else {
            res.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"})
        }
    } else {
        res.writeHead(404, {"Content-Type": "text/html; charset=utf-8"})
        res.write(uri + " doesn't exist")
    }
    res.end()
})

function lazyRequire(mdl) {
    try {
        return require(mdl)
    } catch(e) {
        // Nothing
    }
}

var gui = lazyRequire('nw.gui')
var ipaddress, port

if (typeof(gui) === "undefined") {
    ipaddress = process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0"
    port = process.env.OPENSHIFT_NODEJS_PORT || 8080
} else {
    ipaddress = '127.0.0.1'
    port = 8080
}
htServer.listen(port, ipaddress)
console.log("HTTP Server " + "READY".green + " on " + ipaddress + ":" + port)

function permaLog(s) {
    console.log("#PMLOG#;" + s)
}

var wss = new ws.Server({server: htServer})
wss.on('connection', function(ws) {
    ws.clientnum = this.clients.length
    permaLog("connect;" + Date.now() + ";" + ws.clientnum + ";" + ws.upgradeReq.headers["user-agent"])
    
    ws.sendPako = function(data, fn) {
        if (this.readyState == ws.OPEN) {
            var pkg = pako.deflate(data, { to: 'string', level: 9 })
            if (this.readyState == ws.OPEN) {
                this.send(pkg, fn)
            }
        }
    }
    
    ws.on('message', function(message) {
        var obj = JSON.parse(message)
        if ((typeof(obj.type) != "undefined")&&
            (typeof(handlers[obj.type]) != "undefined")&&
            (typeof(handlers[obj.type].isSafeRpc) != "undefined")&&
            handlers[obj.type].isSafeRpc) {
            var ret = handlers[obj.type](this, obj)
            
            if (ret) {
                ws.sendPako(JSON.stringify(ret))
            }
        }
    })
    
    ws.on('error', function(error) {
        console.log('WS Error: ' + error)
    })
    
    ws.on('close', function(code, message) {
        if (typeof(this.player) != "undefined") {
            lightmanager.removePlayerPosition(this.player.pos)
            level[this.player.pos.y][this.player.pos.x].character = null
            spawnGibs(this.player.pos.x, this.player.pos.y, this.player.pix,
                        Math.round(sessionRandom.child('misc').random() * 4), 3, "#069", "#036", this.player.gibs)
            wss.broadcast(JSON.stringify({type: 'player_left', username: this.player.username}))
        }
        
        if (wss.clients.length == 0) {
            console.log('Stopping game ' + 'NOW!'.red)
            stopGameAndRestart()
        }
        
        permaLog("disconnect;" + Date.now() + ";" + this.clientnum + ";")
    })
    
    gameStarted = wss.clients.length >= minimumPlayers
    if (gameStarted) {
        if (continuousTurns) {
            if (typeof(intervalContinuousTurns) == "undefined") {
                intervalContinuousTurns = setInterval(processTurnIfAvailable, 100)
            }
        } else {
            processTurnIfAvailable()
        }
    }
})

function stopGameAndRestart() {
    if (typeof(intervalContinuousTurns) != "undefined") {
        clearInterval(intervalContinuousTurns)
        delete intervalContinuousTurns
    }
    gameStarted = false
    hasBeenInited = false
    currentLevel = 0
    
    level = []
    enemyTally = false
    aiState = null
    lastTurnTime = 0
}

wss.on('error', function(err) {
    console.log("ERROR Server: " + err)
})

wss.broadcast = function(data) {
    for(var i in this.clients) {
        
        try {
            this.clients[i].sendPako(data, function(error) {
                if (error) {
                    console.log("Error sending data to client " + i + ": " + error)
                }
            })
        } catch (e) {
            console.log(e)
        }
    }
}

console.log("WS Server " + "READY".green)

console.log("Press R to reload static files")

try {
    var stdin = process.openStdin()
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding( 'utf8' )

    stdin.on( 'data', function( key ){
        // ctrl-c ( end of text )
        if ( key === '\u0003' ) {
            process.exit()
        } else if (key == 'r') {
            console.log("Reloading!")
            loadCachedFiles()
        }
    })
} catch (ex) {
    console.log("Couldn't start server console")
}