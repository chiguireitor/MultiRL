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
 
var particles = require('./particles.js')
var soundManager = require('./soundman.js').getManager()
var asciiMapping = require('./templates/ascii_mapping.js') // Code shared between client and server
var effects = require('./effects.js')
var util = require('./util.js')
var gameDefs = require('./conf/gamedefs.js')
var fsm = require('./fsm.js')
var comms = require('./comms.js')

var AI = function(params) {
    this.level = params.level
    this.traceable = params.traceable
    this.passable = params.passable
    this.activable = params.activable
    this.activableTiles = params.activableTiles
    this.meleeDamage = params.inflictMeleeDamage
    this.spawnGibs = params.spawnGibs
    this.usableTiles = params.usableTiles
    this.grab = params.grab
    this.soundManager = params.soundManager
    this.generator = params.generator
    
    this.agents = []
    
    this.factions = {}
    
    this.purge = function() {
        this.agents = []
    }
    
    this.resetFactions = function() {
        this.factions = {}
    }
    
    this.newFaction = function(name) {
        if (!(name in this.factions)) {
            this.factions[name] = {}
        }
    }
    
    this.factionAggro = function(own, other, aggroLvl) {
        if (own in this.factions) {
            var ownFactions = this.factions[own]
            
            if (other in ownFactions) {
                ownFactions[other] += aggroLvl
            } else {
                ownFactions[other] = aggroLvl
            }
        } else {
            this.factions[own] = {}
            this.factions[own][other] = aggroLvl
        }
    }
    
    this.factionScore = function(own, other) {
        if (own in this.factions) {
            var ownFactions = this.factions[own]
            
            if (other in ownFactions) {
                return ownFactions[other]
            }
        }
        
        return 0
    }
    
    this.instantiate = function(x, y, name, pix, color, attrs, weapon, inventory, customDecision, faction) {
        if (!attrs.speed) {
            attrs.speed = {pos: 0}
        }
        
        if ((typeof(attrs.hp) != "undefined") && (typeof(attrs.hp.onchange) == "undefined")) {
            attrs.hp.onchange = function(changeType, dmg, c) {
                if (typeof(c) != "undefined") {
                    if (typeof(c.attrs) != "undefined") {
                        if (typeof(c.attrs.suPow) != "undefined") {
                            c.attrs.suPow += (this.pts || 1) * gameDefs.suPowGainMultiplier
                            c.attrs.suPowWait = 0
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
            wait: this.generator.randomInt(0, 10),
            customDecision: customDecision,
            findInInventory: util.findInInventory,
            waitMultiplier: gameDefs.enemiesWaitMultiplier,
            removeFromInventory: util.removeFromInventory,
            faction: faction
        }
        
        chr.pts = Math.ceil(attrs.hp.pos / 5)
        
        this.agents.push(chr)
        this.level[y][x].character = chr
        
        return chr
    }
    
    this.findNearestEnemy = function(x, y, r, usingFaction) {
        var r2 = r * r
        var character = undefined
        var charFactionPoints = 0
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
                            && (cell.character.attrs.faction != usingFaction) && (d2 <= d2char)
                            && (cell.character.attrs.hp.pos > 0)) {
                            
                            if ((typeof(cell.character.cloaked) === "undefined") || 
                                (d2 < cell.character.cloaked)){
                                    
                                var fs = this.factionScore(usingFaction, cell.character.attrs.faction)
                                
                                if (fs > charFactionPoints) {
                                    charFactionPoints = fs
                                    var line_of_sight = this.traceable(x, y, tx, ty)
                                    
                                    if (line_of_sight && ((d2 < d2char) || (d2 == d2char) && (this.generator.random() < 0.5))) {
                                        character = cell.character
                                        d2char = d2
                                    }
                                }
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
            var cmd = {player: agent, wait: 0}
            
            if (agent) {
                if (agent.attrs.hp.pos <= 0) {
                    this.level[agent.pos.y][agent.pos.x].character = null
                    
                    if (!(agent.knockback && (agent.knockback.amount > 0))) {
                        this.agents.splice(i, 1)
                    } else {
                        somethingHappened = true
                    }
                    
                    var bloodSplats = "+-{};\"^%&()|º<>"
                    var cnt = Math.floor(this.generator.random() * 12) + 6
                    
                    if (agent.knockback && (agent.knockback.amount > 0)) {
                        cnt /= agent.knockback.amount
                    }
                    
                    for (var sb=0; sb < cnt; sb++) {
                        particles.Singleton().spawnParticle(
                            agent.pos.x, agent.pos.y, 
                            agent.pos.x + Math.round(this.generator.random() * 7 - 3),
                            agent.pos.y + Math.round(this.generator.random() * 7 - 3), 1, bloodSplats[Math.floor(this.generator.random() * bloodSplats.length)], 
                            "blood",  
                            "instant", undefined, Math.round((this.generator.random() * 100) + 100), undefined)
                    }
                    
                    if (!(agent.knockback && (agent.knockback.amount > 0))) {
                        var gmul = (agent.attrs.hp.pos < -agent.attrs.hp.max)?2:1
                        var options = {spread: gmul*2}
                        
                        this.spawnGibs(agent.pos.x, agent.pos.y, agent.pix, Math.round(this.generator.random() * 4) * gmul, 2 * gmul, "#A00", "#600", agent.gibs, options)
                        
                        util.dropInventory(agent, this.level, this.passable)
                        agent = undefined
                        i--
                    }
                }
            }
            
            if (agent && (agent.wait <= 0)) {
                // Process the agent state and take a decision accordingly
                var tx, ty
                if (agent.customDecision) {
                    var ret = agent.customDecision.call(agent, this.level, this)
                    
                    for (p in ret) {
                        if (p == 'wait') {
                            cmd.wait += ret.wait
                        } else if (ret.hasOwnProperty(p)) {
                            cmd[p] = ret[p]
                        }
                    }
                    
                    /*tx = agent.pos.x + ret.x
                    ty = agent.pos.y + ret.y*/
                } else {
                    var character = this.findNearestEnemy(agent.pos.x, agent.pos.y, agent.fov, agent.attrs.faction)
                    var dx = 0
                    var dy = 0
                    
                    if (character) {
                        if ((typeof(agent.weapon) != "undefined")
                            && (agent.weapon != null)
                            && (this.generator.random() < 0.2)) {
                            
                            if (agent.weapon.ranged && agent.weapon.alternate && (this.generator.random() < 0.2)) {
                                if (agent.weapon.alternate.ammo == 0) {
                                    //agent.weapon.reload(agent, true)
                                    cmd.reloadWeapon = true
                                    cmd.reloadAlternate = true
                                    
                                    somethingHappened = true
                                } else {
                                    //agent.weapon.fire(character.pos.x, character.pos.y, agent, {useAlternate: true})
                                    
                                    cmd.fireWeapon = true
                                    cmd.fireAlternate = true
                                    cmd.fireTarget = {x: character.pos.x, y: character.pos.y}
                                    
                                    somethingHappened = true
                                }
                            } else if (agent.weapon.ranged) {
                                if (agent.weapon.ammo == 0) {
                                    //agent.weapon.reload(agent)
                                    cmd.reloadWeapon = true
                                    cmd.reloadAlternate = true
                                    
                                    somethingHappened = true
                                } else {
                                    //agent.weapon.fire(character.pos.x, character.pos.y, agent)
                                    cmd.fireWeapon = true
                                    cmd.fireTarget = {x: character.pos.x, y: character.pos.y}
                                    
                                    somethingHappened = true
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
                        var nm = Math.floor(this.generator.random() * 8)
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
                            cmd.dst = {x: tx, y: ty}
                            somethingHappened = true
                        } else if (p == 2) {
                            if (((agent.pos.x != tx) && (agent.pos.y != ty))) {
                                cmd.dst = {x: tx, y: ty}
                                somethingHappened = true
                            }
                        }
                    }
                }
                
                /*agent.wait += cmd.wait
                cmd.wait = agent.wait*/
                
                agent.wait += cmd.wait
                
                /*if (!isNaN(cmd.wait) && (cmd.wait != 0)) {
                    agent.wait = cmd.wait
                }*/
                
                /*if (isNaN(agent.wait)) {
                    agent.wait = cmd.wait
                } else if (!isNaN(cmd.wait)){
                    agent.wait = Math.max(agent.wait + (cmd.wait - agent.wait), 0)
                }*/
            }
            
            somethingHappened |= util.processSemiturn({
                agent: cmd,
                level: this.level,
                passable: this.passable,
                activableTiles: this.activableTiles,
                soundManager: this.soundManager,
                grab: this.grab,
                inflictMeleeDamage: this.meleeDamage,
                usableTiles: this.usableTiles,
                activable: this.activable,
                generator: this.generator
            })

            i++
        }
        
        return somethingHappened
    }
    
    var astarIteration = 1
    var numAstarTraverse = 0
    this.getNumAstarTraverse = function() {
        return numAstarTraverse
    }
    
    this.traverse = function(agent, target, level, scores) {
        numAstarTraverse++
        var openSet = []
        var pss = this.passable
        astarIteration++
        
        var includeOnOpenSet = function(item) {
            var i = 0
            while (i < openSet.length) {
                if (openSet[i].carriedCost > item.carriedCost) {
                    var tail = openSet.splice(i)
                    openSet = openSet.concat([item], tail)
                    return
                }
                i++
            }
            
            openSet = openSet.concat([item])
        }
        
        var expand = function(elem, level) {
            for (var dy=-1; dy <= 1; dy++) {
                var ny = elem.y + dy
                if ((ny >= 0) && (ny < level.length)) {
                    var row = level[ny]
                    for (var dx=-1; dx <= 1; dx++) {
                        var nx = elem.x + dx
                        if (!((dx == 0) && (dy == 0)) && (nx >= 0) && (nx < row.length)) {
                            var tile = row[nx]
                            
                            if (!('astarIteration' in tile) || (tile.astarIteration < astarIteration)) {
                                tile.astarIteration = astarIteration
                                var p = pss(tile)
                                
                                // TODO: Change heuristic for ambush mechanics
                                var difX = nx - target.x
                                var difY = ny - target.y
                                var euclideanCost = Math.sqrt(difX * difX + difY * difY)
                                
                                var newCost = elem.carriedCost + euclideanCost
                                var discard = false
                                
                                if (p == 1) {
                                    if (tile.damage) {
                                        if (tile.damage <= agent.attrs.hp.pos) {
                                            newCost += tile.damage * 10
                                        } else {
                                            discard = true
                                        }
                                    }
                                } else if (p == 2) {
                                    if ((typeof(tile.character) != "undefined") && (tile.character != null)) {
                                        if ((tile.character.attrs) && (tile.character.attrs.faction != agent.attrs.faction)) {
                                            if ((typeof(scores) !== "undefined") && ('enemy' in scores)) {
                                                newCost += scores.enemy(tile.character)
                                            } else {
                                                discard = true
                                            }
                                        } else {
                                            discard = true
                                        }
                                    }
                                } else if (p == 0) {
                                    discard = true
                                } else if ((typeof(tile.item) != "undefined") && (tile.item != null)) {
                                    if ((typeof(scores) !== "undefined") && ('item' in scores)) {
                                        newCost += scores.item(tile.item)
                                    }
                                }
                                
                                if (!discard) {
                                    includeOnOpenSet({x: nx, y: ny, carriedCost: newCost, history: elem.history.concat([elem])})
                                }
                            }
                        }
                    }
                }
            }
        }
        
        var path
        expand({x: agent.pos.x, y: agent.pos.y, carriedCost: 0, history: []}, level)
        while (openSet.length > 0) {
            var nextElement = openSet.shift()
            
            if ((nextElement.x == target.x) && (nextElement.y == target.y)) {
                path = nextElement.history.concat([nextElement])
                break
            } else {
                expand(nextElement, level)
            }
        }
        
        if (path) {
            path.shift()
            return path.map(function(e) { return {x: e.x, y: e.y} })
        }
    }
}

module.exports = AI