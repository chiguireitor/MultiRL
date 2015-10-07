/*
 * AI.js - Ganymede Gate ai controllers
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
 
var asciiMapping = require('./templates/ascii_mapping.js') // Code shared between client and server
var effects = require('./effects.js')
var util = require('./util.js')
var gameDefs = require('./conf/gamedefs.js')

var AI = function(level, traceableFn, passableFn, activableFn, activablesDict, meleeDamageFn, spawnGibsFn) {
    this.level = level
    this.traceable = traceableFn
    this.passable = passableFn
    this.activable = activableFn
    this.activableTiles = activablesDict
    this.meleeDamage = meleeDamageFn
    this.spawnGibs = spawnGibsFn
    
    this.agents = []
    
    this.purge = function() {
        this.agents = []
    }
    
    this.instantiate = function(x, y, name, pix, color, attrs, weapon, inventory, customDecision) {
        if (!attrs.speed) {
            attrs.speed = {pos: 0}
        }
        
        if ((typeof(attrs.hp) != "undefined") && (typeof(attrs.hp.onchange) == "undefined")) {
            attrs.hp.onchange = function(changeType, dmg, c) {
                if (typeof(c) != "undefined") {
                    if (typeof(c.attrs) != "undefined") {
                        if (typeof(c.attrs.suPow) != "undefined") {
                            c.attrs.suPow += (this.pts || 1) * gameDefs.suPowGainMultiplier
                        }
                        
                        if (typeof(c.attrs.pts) != "undefined") {
                            c.attrs.pts += this.pts || 1
                        }
                    }
                }
            }
        }
        
        var chr = {
            pix: pix,
            pos: {x: x, y: y},
            gibs: [{pix: asciiMapping["~"], gibType: "severed extremity"}, {pix: asciiMapping["∞"], gibType: "brain piece"}, {pix: asciiMapping["≈"], gibType: "blood pool"}, {pix: asciiMapping["·"], gibType: "internal organ"}, {pix: asciiMapping["%"], gibType: "intestine"}],
            color: color,
            username: name,
            type: 'ai',
            attrs: attrs,
            weapon: weapon,
            fov: gameDefs.enemyBaseFov,
            inventory: inventory,
            wait: Math.random(10) - 5,
            customDecision: customDecision,
            findInInventory: util.findInInventory,
            removeFromInventory: util.removeFromInventory
        }
        
        chr.pts = Math.ceil(attrs.hp.pos / 5)
        
        this.agents.push(chr)
        level[y][x].character = chr
        
        return chr
    }
    
    this.findNearestPlayer = function(x, y, r) {
        var r2 = r * r
        var character = undefined
        var d2char = r2 * 2
        
        for (var iy=-r; iy <= r; iy++) {
            var ty = iy + y
            
            if ((ty >= 0) && (ty < this.level.length)) {
                var row = this.level[ty]
                var dy = iy * iy
                
                for (var ix=-r; ix <= r; ix++) {
                    var tx = ix + x
                    if ((tx >= 0) && (tx < row.length)) {
                        var d2 = ix * ix + dy
                        var cell = row[tx]
                        
                        if ((d2 < r2) && (typeof(cell.character) != "undefined")
                            && (cell.character != null)
                            && (typeof(cell.character.type) != "undefined")
                            && (cell.character.type == "player") && (d2 <= d2char)
                            && (cell.character.attrs.hp.pos > 0)) {
                            
                            var line_of_sight = this.traceable(x, y, tx, ty)
                            
                            if (line_of_sight && ((d2 < d2char) || (d2 == d2char) && (Math.random() < 0.5))) {
                                character = cell.character
                                d2char = d2
                            }
                        }
                    }
                }
            }
        }
        
        return character
    }
    
    this.process = function() {
        var somethingHappened = false
        
        var i = 0
        while (i < this.agents.length) {
            var agent = this.agents[i]
            
            util.processKnockback(agent, this.level, this.passable)
            
            if (agent.attrs.hp.pos <= 0) {
                this.level[agent.pos.y][agent.pos.x].character = null
                this.agents.splice(i, 1)
                
                var gmul = (agent.attrs.hp.pos < -agent.attrs.hp.max)?2:1
                var options = {spread: gmul*2}
                
                this.spawnGibs(agent.pos.x, agent.pos.y, agent.pix, Math.round(Math.random() * 4) * gmul, 2 * gmul, "#A00", "#600", agent.gibs, options)
                
                util.dropInventory(agent, level, this.passable)
                
                i--
            } else if (agent.wait > 0) {
                agent.wait--
            } else if (agent) {
                // Process the agent state and take a decision accordingly
                var tx, ty
                if (agent.customDecision) {
                    var ret = agent.customDecision.call(agent, level, this)
                    tx = agent.pos.x + ret.x
                    ty = agent.pos.y + ret.y
                } else {
                    var character = this.findNearestPlayer(agent.pos.x, agent.pos.y, agent.fov)
                    var dx = 0
                    var dy = 0
                    
                    if (character) {
                        if ((typeof(agent.weapon) != "undefined")
                            && (agent.weapon != null)
                            && (Math.random() < 0.2)) {
                            
                            if (agent.weapon.ranged && agent.weapon.alternate && (Math.random() < 0.2)) {
                                if (agent.weapon.alternate.ammo == 0) {
                                    agent.weapon.reload(agent, true)
                                } else {
                                    agent.weapon.fire(character.pos.x, character.pos.y, agent, {useAlternate: true})
                                }
                            } else if (agent.weapon.ranged) {
                                if (agent.weapon.ammo == 0) {
                                    agent.weapon.reload(agent)
                                } else {
                                    agent.weapon.fire(character.pos.x, character.pos.y, agent)
                                }
                            }
                            
                        }
                    
                        if (character.pos.x < agent.pos.x) {
                            dx = -1
                        } else if (character.pos.x > agent.pos.x) {
                            dx = 1
                        }
                        
                        if (character.pos.y < agent.pos.y) {
                            dy = -1
                        } else if (character.pos.y > agent.pos.y) {
                            dy = 1
                        }
                    } else {
                        var nm = Math.floor(Math.random() * 8)
                        dx = [-1, 0, 1, -1, 1, -1, 0, 1][nm]
                        dy = [-1, -1, -1, 0, 0, 1, 1, 1][nm]
                    }
                    
                    tx = agent.pos.x + dx
                    ty = agent.pos.y + dy
                }
                    
                if ((tx >= 0) && (tx < this.level[0].length) && (ty >= 0) && (ty < this.level.length)) {
                    var tile = this.level[ty][tx]
                    
                    // Won't walk purposefully over a damaging tile
                    if ((!tile.damage) || (tile.damage <= 0)) {
                        var p = this.passable(tile)
                        if (p == 1) {
                            agent.wait += 10 - Math.floor(agent.attrs.speed.pos/10)
                            
                            this.level[agent.pos.y][agent.pos.x].character = null
                            agent.pos.x = tx
                            agent.pos.y = ty
                            var t = this.level[ty][tx]
                            t.character = agent
                            if (this.activable(t)) {
                                this.activableTiles[t.tile](t, agent)
                            }
                            somethingHappened = true
                        } else if (p == 2) {
                            if (((agent.pos.x != tx) && (agent.pos.y != ty))) {
                                agent.wait += 20
                                this.meleeDamage(agent, this.level[ty][tx].character)
                                somethingHappened = true
                            }
                        }
                    }
                }
                
                var ctl = level[agent.pos.y][agent.pos.x]
                /*if (ctl.tile in activableTiles) {
                    activableTiles[ctl.tile](ctl, ws)
                }*/
                
                if (ctl.damage) {
                    // Walking over damaging tile
                    if (agent.attrs.hp.pos > 0) {
                        agent.attrs.hp.pos -= ctl.damage
                        
                        if (typeof(agent.attrs.hp.onchange) != "undefined") {
                            agent.attrs.hp.onchange.call(agent, "floor-hazard", ctl.damage)
                        }
                    }                                
                }
                
            }
            effects.applyAllStickies(agent)
            i++
        }
        
        return somethingHappened
    }
}

module.exports = AI