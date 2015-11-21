/*
 * util.js - Utilitary functions, used everywhere else
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
 
var gameDefs = require('./conf/gamedefs.js')
var particles = require('./particles.js')
var soundManager = require('./soundman.js').getManager()
var asciiMapping = require('./templates/ascii_mapping.js') // Code shared between client and server
var effects = require('./effects.js')
var comms = require('./comms.js')
var generator

function sign(n) {
    if (n == 0) {
        return 0
    } else if (n < 0) {
        return -1
    } else {
        return 1
    }
}

function deltasSquare(x0, y0, xn, yn) {
    var deltas = []
    
    for (var y=y0; y <= yn; y++) {
        for (var x=x0; x <= xn; x++) {
            deltas.push([x, y])
        }
    }
    
    return deltas
}

function dropInventory(agent, level, passableFn, index) {
    if (agent.inventory) {
        var tryDrop = function(item, probability) {
            if (typeof(probability) == "undefined") {
                probability = -3
            }
            var rnd = generator.random()
            var fitted = rnd < probability
            
            if (fitted) {
                var tryDeltas = deltasSquare(-1, -1, 1, 1)
                
                for (var n=0; n < tryDeltas.length; n++) {
                    var dx = agent.pos.x + tryDeltas[n][0]
                    var dy = agent.pos.y + tryDeltas[n][1]
                    
                    if ((dy >= 0) && (dy < level.length)) {
                        var row = level[dy]
                        if ((dx >= 0) && (dx < row.length)) {
                            var tile = row[dx]
                            
                            if (passableFn(tile) == 1) {
                                if ((typeof(tile.item) == "undefined") || (tile.item == null) || !tile.item) {
                                    tile.item = item
                                    fitted = true
                                    
                                    break
                                }
                            }
                        }
                    }
                }
            }
            
            return fitted
        }
        
        if (typeof(index) == "undefined") {
            var itemsArray = agent.inventory
            
            if (agent.weapon && (agent.weapon != null)) {
                itemsArray = itemsArray.concat([agent.weapon])
            }
            
            for (var n=0; n < itemsArray.length; n++) {
                var item = itemsArray[n]
                
                tryDrop(item, gameDefs.dropProbability)
            }
        } else {
            var item = agent.inventory[index]
            var dropped = tryDrop(item)
                
            if (dropped) {
                agent.inventory.splice(index, 1)
            }
            
            return dropped
        }
    }
}

function findInInventory(tp) {
    for (var i=0; i < this.inventory.length; i++) {
        var item = this.inventory[i]
        
        if (item.type == "ammo") {
            if (item.ammoType.indexOf(tp) == 0) {
                return item
            }
        }
    }
}

function removeFromInventory(itm) {
    var i = 0
    while (i < this.inventory.length) {
        if (this.inventory[i] == itm) {
            this.inventory.splice(i, 1)
            
            break
        }
        i++
    }
}

function processKnockback(agent, level, passableFn) {
    if (agent.knockback) {
        var dx = sign(agent.pos.x - agent.knockback.ox)
        var dy = sign(agent.pos.y - agent.knockback.oy)
        
        var x = Math.min(Math.max(0, agent.pos.x + dx), level[0].length-1)
        var y = Math.min(Math.max(0, agent.pos.y + dy), level.length-1)
        
        if (agent.knockback.amount > 0) {
            var psbl = passableFn(level[y][x])
            if (psbl == 1) {
                level[agent.pos.y][agent.pos.x].character = null
                
                agent.pos.x = x
                agent.pos.y = y
                level[agent.pos.y][agent.pos.x].character = agent
            } else if (psbl == 2) {
                // Smashed a character, transfer the energy
                var tile = level[y][x]
                
                if (tile.character) {
                    tile.character.knockback = {
                        ox: agent.pos.x,
                        oy: agent.pos.y,
                        amount: agent.knockback.amount
                    }
                }
                
                processTileHealth(tile, agent.knockback.amount * 10, level, x, y)
            } else {
                // Hit a wall, take some damage
                
                if (gameDefs.knockbackStaticDestroy <= agent.knockback.amount) {
                    level[agent.pos.y][agent.pos.x].character = null
                    
                    // Spawn some particles and crushing sounds based on the kind of tile that was here
                    var debris = "+{;,:.}^\"'"
                    var cnt = Math.floor(generator.random() * 5 + 3)
                    
                    for (var i=0; i < cnt; i++) {
                        var tx = Math.min(Math.max(0, x + Math.round(generator.random() * 7 - 3.5) - dx), level[y].length)
                        var ty = Math.min(Math.max(0, y + Math.round(generator.random() * 7 - 3.5) - dy), level.length)
                        
                        particles.Singleton().spawnParticle(
                            x, y, tx, ty, 1, debris[Math.floor(generator.random() * debris.length)], 
                            "debris", "instant", undefined, Math.floor(generator.random() * 500) + 500)
                    }
                    soundManager.addSound(x, y, 10, "debris", 0)
                
                    agent.pos.x = x
                    agent.pos.y = y
                    level[agent.pos.y][agent.pos.x].tile = asciiMapping['.']
                    level[agent.pos.y][agent.pos.x].character = agent
                }
                
                /*agent.attrs.hp.pos -= agent.knockback.amount
                agent.knockback.amount = 0*/
            }
            
            agent.knockback.amount--
        } 

        if (agent.knockback.amount <= 0) {
            delete agent.knockback
        }
    }
 }
 
function trySurroundMeleeDamage(cx, cy, c, level, inflictMeleeDamage) {
    for (var i=-1; i < 2; i++) {
        var ty = cy + i
        
        if ((ty >= 0) && (ty < level.length) && (ty != cy)) {
            for (var j=-1; j < 2; j++) {
                var tx = cx + j
                
                if ((tx >= 0) && (tx < level[0].length) && (tx != cx)) {
                    var dt = level[ty][tx]
                            
                    if (dt.character) {
                        inflictMeleeDamage(c, dt.character)
                    }
                }
            }
        }
    }
}

function pushCharacterToRandomPassableSpot(level, generator, x, y) {
    var availableSpots = []
    
    for (var i=-1; i < 2; i++) {
        var ty = y + i
        
        if ((ty >= 0) && (ty < level.length) && (ty != y)) {
            for (var j=-1; j < 2; j++) {
                var tx = x + j
                
                if ((tx >= 0) && (tx < level[0].length) && (tx != x)) {
                    var dt = level[ty][tx]
                            
                    if ((typeof(dt.character) == "undefined") || (dt.character == null)) {
                        availableSpots.push([tx, ty])
                    }
                }
            }
        }
    }
    
    if (availableSpots.length > 0) {
        var otile = level[y][x]
        var spot = availableSpots[generator.randomInt(availableSpots.length)]
        var dtile = level[spot[1]][spot[0]]
        
        dtile.character = otile.character
        otile.character = null
        
        dtile.character.pos.x = spot[0]
        dtile.character.pos.y = spot[1]
        
        return true
    } else {
        return false
    }
}

function processSemiturn(params) {
    var cli = params.agent
    var level = params.level
    var passable = params.passable
    var activableTiles = params.activableTiles
    var soundManager = params.soundManager
    var grab = params.grab
    var inflictMeleeDamage = params.inflictMeleeDamage
    var usableTiles = params.usableTiles
    var activable = params.activable
    var generator = params.generator
    
    if ((typeof(cli) == "undefined") || (typeof(cli.player) == "undefined")) {
        return false
    }
    
    processKnockback(cli.player, level, passable)
    var somethingHappened = false

    if (cli.player.wait > 0) {
        cli.player.wait--
        cli.couldMove = false
    } else {
        if (typeof(cli.player.resistance) !== "undefined") {
            cli.player.resistance /= 2
        }
        
        if (cli.player.player_class == 'spy') {
            // The spy has a passive ability that cloaks it
            // The cloaked attribute is the squared radius of the max distance to detection
            cli.player.cloaked = (100.0 - Math.max(0, Math.min(100, cli.player.attrs.suPow)))/0.3
        } else if (cli.player.player_class == 'medic') {
            // The medic regenerates some HP each turn depending on the super power
            cli.player.attrs.hp.pos = Math.min(cli.player.attrs.hp.max, cli.player.attrs.hp.pos + Math.round(Math.max(0, Math.min(100, cli.player.attrs.suPow))/ 25.0))
            cli.player.resistance += Math.round(Math.max(0, Math.min(100, cli.player.attrs.suPow)) / 20.0)
        } else if (cli.player.player_class == 'engy') {
            // The engineer jams communications based on its supow charge
            var radius = Math.round(Math.max(0, Math.min(100, cli.player.attrs.suPow))/ 5.0)
            comms.createInterference(cli.player.pos.x, cli.player.pos.y, radius, 1)
        }
        
        cli.couldMove = true
        
        if (cli.player.attrs.suPow > 0) {
            cli.player.attrs.suPowWait++
            
            if (cli.player.attrs.suPowWait >= gameDefs.suPowWaitMax) {
                //cli.player.attrs.suPowWait = 0
                if (cli.player.attrs.suPow > 0) {
                    cli.player.attrs.suPow = Math.min(100, cli.player.attrs.suPow) - gameDefs.suPowDecayAfterWait
                } else {
                    cli.player.attrs.suPow = 0
                    cli.player.attrs.suPowWait = 0
                }
            }
        }
        
        var playerDefined = (typeof(cli.player) != "undefined")&&(cli.player != null)
        somethingHappened = true // Something could happen, let the player that can do something play
        var waitMultiplier = 1
        
        if (typeof(cli.player.waitMultiplier) != "undefined"){
            waitMultiplier = cli.player.waitMultiplier
        }
        
        if ((typeof(cli.dst) != 'undefined')&&(cli.dst != null)&&
            playerDefined &&
            (typeof(cli.player.pos) != "undefined")) {
            // Gotta move
            if ((cli.player.pos.x != cli.dst.x)||(cli.player.pos.y != cli.dst.y)) {
                var jumpTrample = false
                var canJumpTrample = false
                
                if ((typeof(cli.player.prone) != "undefined") && cli.player.prone) {
                    cli.player.wait = gameDefs.turnsForStep * 3 * waitMultiplier
                } else if ((typeof(cli.player.crouch) != "undefined") && cli.player.crouch) {
                    cli.player.wait = gameDefs.turnsForStep * 2 * waitMultiplier
                } else {
                    cli.player.wait = gameDefs.turnsForStep * waitMultiplier
                    canJumpTrample = true
                }
                
                var jtItersMultiplier = 1
                if (canJumpTrample && (typeof(cli.special_movement) != "undefined") && cli.special_movement) {
                    jumpTrample = true
                    cli.special_movement = false
                    
                    if (!cli.player.attrs.agile) {
                        cli.player.wait *= 2
                    }
                    
                    if (cli.player.player_class == 'swords') {
                        jtItersMultiplier = 1 + Math.max(0, Math.min(100, cli.player.attrs.suPow) / 20.0)
                    } else if (cli.player.player_class == 'melee') {
                        jtItersMultiplier = 1 + Math.max(0, Math.min(100, cli.player.attrs.suPow) / 40.0)
                    }
                }
                
                cli.player.idleCounter = 0
                var dx = cli.dst.x - cli.player.pos.x
                var dy = cli.dst.y - cli.player.pos.y
                
                dx = sign(dx)
                dy = sign(dy)
                
                var jtIters = Math.floor((jumpTrample?2:1)*jtItersMultiplier)
                var jumped = false
                
                for (var jt=0; jt < jtIters; jt++) {
                    var nx = cli.player.pos.x + dx
                    var ny = cli.player.pos.y + dy
                    level[cli.player.pos.y][cli.player.pos.x].character = null
                    
                    if (jumped) {
                        var dsgn = 1
                        if (generator.eventOccurs(0.5)) {
                            dsgn = -1
                        }
                        particles.Singleton().spawnParticle(
                            cli.player.pos.x + dy * dsgn, cli.player.pos.y - dx * dsgn, 
                            cli.player.pos.x - dy * 2 * dsgn, cli.player.pos.y + dx * 2 * dsgn, 1, "@", 
                            "player-shadow", "instant", undefined, Math.floor(generator.random() * 250) + 50 + jt * 50)
                    }
                    
                    var didMove = false
                    if ((ny >= 0) && (ny < level.length) &&
                        (nx >= 0) && (nx < level[0].length)) {
                        var p = passable(level[cli.player.pos.y + dy][cli.player.pos.x + dx])
                        if (p == 1) {
                            // Sum of both is best case, and it is passable, so go with it
                            cli.player.pos.x += dx
                            cli.player.pos.y += dy
                            didMove = true
                            jumped = jumpTrample
                            
                            if ((cli.player.player_class == 'swords') && (cli.player.weapon && cli.player.weapon.melee) && jumped) {
                                trySurroundMeleeDamage(cli.player.pos.x, cli.player.pos.y, cli.player, level, inflictMeleeDamage)
                            }
                        } else if (p == 2) {
                            // Check to see if we can melee attack the character
                            var dt = level[cli.player.pos.y + dy][cli.player.pos.x + dx]
                            
                            if (dt.character) {
                                if (dt.character.attrs.hp.pos <= 0) {
                                    pushCharacterToRandomPassableSpot(level, generator, cli.player.pos.x + dx, cli.player.pos.y + dy)
                                } else {
                                    inflictMeleeDamage(cli, dt.character)
                                    if (jumped) {
                                        if (dt.character.knockback) {
                                            dt.character.knockback += 2
                                        } else {
                                            dt.character.knockback = {
                                                ox: cli.player.pos.x,
                                                oy: cli.player.pos.y,
                                                amount: 2
                                            }
                                        }
                                        dt.character.wait += 20
                                    } else if (jumpTrample) {
                                        if (dt.character.knockback) {
                                            dt.character.knockback += 1
                                        } else {
                                            dt.character.knockback = {
                                                ox: cli.player.pos.x,
                                                oy: cli.player.pos.y,
                                                amount: 1
                                            }
                                        }
                                        dt.character.wait += 10
                                    }
                                }
                            }
                        } else if (activable(level[cli.player.pos.y + dy][cli.player.pos.x + dx])) {
                            var t = level[cli.player.pos.y + dy][cli.player.pos.x + dx]
                            activableTiles[t.tile](t, cli)
                        } else {
                            var dh_x = cli.dst.x - (cli.player.pos.x + dx)
                            var dh_y = cli.dst.y - cli.player.pos.y
                            p = passable(level[cli.player.pos.y][cli.player.pos.x + dx])
                            var dh_pass = p == 1
                            var dh_char = p == 2
                            
                            var dv_x = cli.dst.x - (cli.player.pos.x)
                            var dv_y = cli.dst.y - (cli.player.pos.y + dy)
                            p = passable(level[cli.player.pos.y + dy][cli.player.pos.x])
                            var dv_pass = p == 1
                            var dv_char = p == 2
                            
                            if (dh_pass && dv_pass) {
                                var dh2 = dh_x*dh_x + dh_y*dh_y
                                var dv2 = dv_x*dv_x + dv_y*dv_y
                                
                                if (dh2 < dv2) {
                                    dv_pass = false
                                } else if (dv2 < dh2) {
                                    dh_pass = false
                                } else {
                                    // Both movements are equal, pick at random
                                    if (generator.random() < 0.5) {
                                        dh_pass = false
                                    } else {
                                        dv_pass = false
                                    }
                                }
                            }
                            
                            if (dh_pass) {
                                cli.player.pos.x += dx
                                didMove = true
                            } else if (dv_pass) {
                                cli.player.pos.y += dy
                                didMove = true
                            } else {
                                // Check if we can attack
                            }
                        }
                    }
                }
                
                var ctl = level[cli.player.pos.y][cli.player.pos.x]
                ctl.character = cli.player
                if (ctl.tile in activableTiles) {
                    activableTiles[ctl.tile](ctl, cli)
                }
                
                if (ctl.damage) {
                    // Walking over damaging tile
                    if (cli.player.attrs.hp.pos > 0) {
                        cli.player.attrs.hp.pos -= ctl.damage
                        
                        if (typeof(cli.player.attrs.hp.onchange) != "undefined") {
                            cli.player.attrs.hp.onchange.call(cli.player, "floor-hazard", ctl.damage)
                        }
                    }                                
                }
                
                if (didMove) {
                    if (jumped) {
                        soundManager.addSound(cli.player.pos.x, cli.player.pos.y, 5, "jump", 0)
                    } else {
                        soundManager.addSound(cli.player.pos.x, cli.player.pos.y, 5, "dirt_step", 0)
                    }
                }
                
                cli.standingOrder = false
                cli.dst = null
            } else {
                cli.player.wait = gameDefs.turnsForStep
            }
        } else if ((typeof(cli.useTile) != "undefined") && (cli.useTile)) {
            cli.useTile = false
            
            var t = level[cli.player.pos.y][cli.player.pos.x]
            if (t.tile in usableTiles) {
                usableTiles[t.tile](t, cli)
            }
        } else if ((typeof(cli.grabTile) != "undefined") && (cli.grabTile)) {
            cli.grabTile = false
            var t = level[cli.player.pos.y][cli.player.pos.x]
            
            if ((typeof(t.item) != "undefined") && (t.item != null)) {
                if (grab(cli.player, t.item)) {
                    t.item = null
                }
            }
        } else if ((typeof(cli.fireWeapon) != "undefined") && (cli.fireWeapon)) {
            cli.fireWeapon = false
            
            if ((typeof(cli.player.weapon) != "undefined") && 
                (typeof(cli.player.weapon.fire) != "undefined")) {
                var precisionFact = 1.0
                
                if (cli.player.prone) {
                    precisionFact = gameDefs.pronePrecisionFact
                } else if (cli.player.crouch) {
                    precisionFact = gameDefs.crouchPrecisionFact
                }
                
                cli.player.weapon.fire(cli.fireTarget.x, cli.fireTarget.y, cli.player, {
                    precision: precisionFact,
                    useAlternate: cli.fireAlternate
                })
            }
            cli.fireAlternate = false
        } else if (typeof(cli.reloadWeapon) != "undefined" && cli.reloadWeapon) {
            cli.reloadWeapon = false
            if ((typeof(cli.player.weapon) != "undefined") && 
                cli.player.weapon != null) {
                cli.player.weapon.reload(cli.player, cli.reloadAlternate)
            }
            cli.reloadAlternate = false
        } else if (typeof(cli.goProne) != "undefined" && cli.goProne) {
            if ((typeof(cli.player.prone) != "undefined")) {
                cli.player.prone = !cli.player.prone
                cli.player.crouch = false
            } else {
                cli.player.prone = true
                cli.player.crouch = false
            }
            
            if (cli.player.prone) {
                cli.player.color = '#00B'
            } else {
                cli.player.color = '#44F'
            }
        } else if (typeof(cli.goCrouch) != "undefined" && cli.goCrouch) {
            if ((typeof(cli.player.crouch) != "undefined")) {
                cli.player.crouch = !cli.player.crouch
                cli.player.prone = false
            } else {
                cli.player.crouch = true
                cli.player.prone = false
            }
            
            if (cli.player.crouch) {
                cli.player.color = '#22D'
            } else {
                cli.player.color = '#44F'
            }
        } else if ((typeof(cli.useSuPow) != "undefined") && cli.useSuPow) {
            cli.useSuPow = false
            cli.player.attrs.suPowWait = 0
            cli.player.attrs.suPow = 0
            somethingHappened = true
        } else if ((typeof(cli.useSuPowAlternate) != "undefined") && cli.useSuPowAlternate) {
            cli.useSuPowAlternate = false
            cli.player.attrs.suPowWait = 0
            cli.player.attrs.suPow = 0
            somethingHappened = true
        } else if (playerDefined) {
            var ctl = level[cli.player.pos.y][cli.player.pos.x]
            cli.player.idleCounter++
            
            if (ctl.tile in activableTiles) {
                activableTiles[ctl.tile](ctl, cli)
            } else if ((cli.player.idleCounter > gameDefs.spyIdleCounter) && (cli.player.player_class == 'spy')) {
                //ctl.character = null // TODO: Poor way to go stealth
            }
        }
        
        if (playerDefined) {
            // Do all player based processing required
            //cli
            if (effects.applyAllStickies(cli.player)) {
                somethingHappened = true
            }
        }
        
        //cli.wait += 10 * waitMultiplier
    }
    
    processKnockback(cli.player, level, passable)
    
    return somethingHappened
}

function watchableStat(pos, max, defaultObserver) {
    var ret = {
        pos: pos,
        max: max,
        _observers_: [],
        change: function(agent, deathType, amnt, originator) {
            this.pos += amnt
            
            for (var i=0; i < this._observers_.count; i++) {
                this._observers_[i].call(agent, deathType, amnt, originator)
            }
        }
    }
    
    if (typeof(defaultObserver) != "undefined") {
        ret._observers_push(defaultObserver)
    }
    
    return ret
}

function processTileHealth(tile, dmg, level, tx, ty) {
    if (!tile.tileHealth) {
        tile.tileHealth = 0
    }
    
    tile.tileHealth = tile.tileHealth - dmg
                                
    if (tile.tileHealth <= 0) {
        delete tile.tileHealth
        tile.tile = asciiMapping['.']

        if (tile.damageRadius) {
            var explosion = new effects.Effect(tile, {
                affectsFriendly: true,
                affectsEnemy: true,
                isSticky: false,
                isTargetArea: true,
                isSourceArea: true,
                targetRadius: tile.damageRadius,
                sourceRadius: 0,
                sourceFn: effects.effectFunction.smoke,
                targetFn: effects.effectFunction.explosion,
                additional: {
                    explosionDamageRange: [Math.floor(tile.damageExplode * 0.1), tile.damageExplode]
                }
            })
            
            explosion.applyToSource(level, tx, ty)
            explosion.applyToTarget(level, tx, ty)
        }
    }
}

function registerGenerator(gen) {
    generator = gen
}

function fill0s(str, num) {
    while (str.length < num) {
        str = '0' + str
    }
    
    return str
}

module.exports = {
    dropInventory: dropInventory,
    processKnockback: processKnockback,
    findInInventory: findInInventory,
    removeFromInventory: removeFromInventory,
    processSemiturn: processSemiturn,
    watchableStat: watchableStat,
    processTileHealth: processTileHealth,
    sign: sign,
    registerGenerator: registerGenerator,
    fill0s: fill0s
}