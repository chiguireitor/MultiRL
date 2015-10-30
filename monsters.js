/*
 * monsters.js - Central monsters repository for Ganymede Gate
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
var items = require('./items.js')
var fsm = require('./fsm.js')
var comms = require('./comms.js')
var util = require('./util.js')

var generator

var squadFsm = fsm.loadStateMachine('./static/squad_ai.fzm', {}, function() { console.log(squadFsm.variables) })
var squadHandlersAdded = false

function registerGenerator(gen) {
    generator = gen
}

var currentAgent
var currentLevel
var currentAi

var updateGlobalVars = function(state) {
    /*hostile_seen: false,
    pkt_fail: false,
    pkt_ok: false,
    no_squad: false,
    high_level: false,
    low_level: false,
    squad_not_found: false,
    squad_found: false,
    leader_near: false,
    hp_low: false,
    hostile_in_range: false,
    hostile_out_of_range: false,
    hostile_reported: false,
    hostile_terminated: false,
    loot_spotted: false,
    above_loot: false,
    inventory_full: false,
    better_weapon_inventory: false*/
    
    var vars = state.variables
    
    if (vars) {
        var aggro = currentAi.findNearestPlayer(currentAgent.pos.x, currentAgent.pos.y, currentAgent.fov)
        
        if (aggro && (aggro != vars.hostile)) {
            vars.hostile_seen = true
            vars.hostile_position = aggro.pos
            vars.hostile = aggro
            vars.last_hostile_reported = false
            vars.pkt_ok = false
            vars.pkt_fail = false
        } else if (aggro) {
            vars.hostile_seen = true
            vars.hostile_position = aggro.pos
            
            var dx = aggro.pos.x - currentAgent.pos.x
            var dy = aggro.pos.y - currentAgent.pos.y
            var d2 = dx * dx + dy * dy
            var wd2 = currentAgent.weapon.range * currentAgent.weapon.range
            
            if (d2 <= wd2) {
                vars.hostile_in_range = true
                vars.hostile_out_of_range = false
            } else {
                vars.hostile_in_range = false
                vars.hostile_out_of_range = true
            }
        } else {
            vars.hostile_seen = false
            vars.hostile_out_of_range = true
            vars.hostile_in_range = false
            
            if (vars.hostile) {
                if (vars.hostile.attrs.hp.pos <= 0) {
                    vars.hostile_terminated = true
                    vars.hostile = undefined
                }
            }
        }
        
        vars.hp_low = currentAgent.attrs.hp.pos <= currentAgent.attrs.hp.max*0.1
    }
}

function Marine(aiState, name, tx, ty) {
    if (!squadHandlersAdded) {
        var movementStep = function(agent, dx, dy) {
            var tx = agent.pos.x + dx
            var ty = agent.pos.y + dy
            
            var cmd = {}
            if ((tx >= 0) && (tx < currentLevel[0].length) && (ty >= 0) && (ty < currentLevel.length)) {
                var tile = currentLevel[ty][tx]
                
                // Won't walk purposefully over a damaging tile
                if ((!tile.damage) || (tile.damage <= 0)) {
                    var p = currentAi.passable(tile)
                    if (p == 1) {
                        cmd.dst = {x: tx, y: ty}
                    } else if (p == 2) {
                        if (((agent.pos.x != tx) && (agent.pos.y != ty))) {
                            cmd.dst = {x: tx, y: ty}
                        }
                    }
                }
            }
            
            return cmd
        }
        
        squadFsm.setStateProcessors({
            // Default
            'idle': function(vars) {
                vars.t++
            },
            'roam': function(vars) {
                vars.t--
                
                var nm = Math.floor(currentAgent.generator.random() * 8)
                var dx = [-1, 0, 1, -1, 1, -1, 0, 1][nm]
                var dy = [-1, -1, -1, 0, 0, 1, 1, 1][nm]

                return movementStep(currentAgent, dx, dy)
            },
            'retreat': function(vars) {
                vars.t++
                
                var dx = -util.sign(vars.hostile_position.x - currentAgent.pos.x)
                var dy = -util.sign(vars.hostile_position.y - currentAgent.pos.y)
                
                return movementStep(currentAgent, dx, dy)
            },
            'report_hostile': function(vars) {
                if (!vars.last_hostile_reported) {
                    vars.last_hostile_reported = currentAgent.comms.transmit(currentAgent.pos.x, currentAgent.pos.y, {
                        'hostile_seen': {x: vars.hostile_position.x, y: vars.hostile_position.y}
                    })
                } else {
                    if (currentAgent.comms.pktOk(vars.last_hostile_reported)) {
                        vars.pkt_ok = true
                        vars.t = 0
                    } else {
                        vars.pkt_fail = true
                        vars.t = 0
                    }
                }
                
                return {wait: 10}
            },
            
            // Hostile Engagement
            'pursue_hostile': function(vars) {
                vars.t++
                
                var dx = util.sign(vars.hostile_position.x - currentAgent.pos.x)
                var dy = util.sign(vars.hostile_position.y - currentAgent.pos.y)
                
                return movementStep(currentAgent, dx, dy)
            },
            'ask_backup': function(vars) {
                if (!vars.backup_asked) {
                    vars.backup_asked = currentAgent.comms.transmit(currentAgent.pos.x, currentAgent.pos.y, {
                        'need_backup': {x: currentAgent.pos.x, y: currentAgent.pos.y}
                    })
                } else {
                    if (currentAgent.comms.pktOk(vars.backup_asked)) {
                        vars.pkt_ok = true
                        vars.t = 0
                    } else {
                        vars.pkt_fail = true
                        vars.t = 0
                    }
                }
                
                return {wait: 10}
            },
            'engage_hostile': function(vars) {
                var cmd = {}
                if (currentAgent.weapon.ranged && currentAgent.weapon.alternate && (currentAgent.generator.random() < 0.2)) {
                    if (currentAgent.weapon.alternate.ammo == 0) {
                        cmd.reloadWeapon = true
                        cmd.reloadAlternate = true
                        
                        somethingHappened = true
                    } else {
                        cmd.fireWeapon = true
                        cmd.fireAlternate = true
                        cmd.fireTarget = {x: vars.hostile_position.x, y: vars.hostile_position.y}
                    }
                } else if (currentAgent.weapon.ranged) {
                    if (currentAgent.weapon.ammo == 0) {
                        cmd.reloadWeapon = true
                        cmd.reloadAlternate = true
                    } else {
                        cmd.fireWeapon = true
                        cmd.fireTarget = {x: vars.hostile_position.x, y: vars.hostile_position.y}
                    }
                }
                
                return cmd
            },
            
            // Squad management
            'squad_need': function(vars) {
            },
            'create_squad': function(vars) {
            },
            'search_squad': function(vars) {
            },
            'pursue_squad': function(vars) {
            },
            'follow_leader': function(vars) {
            },
            
            // Loot picking
            'move_towards_loot': function(vars) {
            },
            'pickup_loot': function(vars) {
            },
            'drop_inventory': function(vars) {
            },
            'change_weapon': function(vars) {
            },
        })
        squadHandlersAdded = true
    }
    var hp = Math.floor(generator.random() * 15 + 15)
    var mon = aiState.instantiate(
        tx, ty, name, asciiMapping['m'], '#0C3', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: 5},
            armor: {pos: 20},
            speed: {pos: 10},
            precision: {pos: 30},
            kind: "organic"
        },
        {},
        [],
        function(level, ai) {
            currentAgent = this
            currentLevel = level
            currentAi = ai
            
            updateGlobalVars(this.fsmVars)
            
            if (this.fsmVars.currentState) {
                console.log(this.fsmVars.currentState.name)
            }
            
            return squadFsm.process(this.fsmVars)
        })
        
    mon.fsmVars = squadFsm.cloneVars({
        hostile_position: false,
        last_hostile_reported: false,
        hostile: undefined
    })
    mon.fsmMemory = {}
    mon.currentSquad = undefined
    mon.generator = generator.child()
    mon.comms = comms.findChannel('default', true)
    
    var weapons = ["9mm Pistol", "xM3 Shotgun", "xM50 Rifle", "Plasma Pistol", "Laser Pistol"]
    var weap = items.searchWeaponByName(weapons[Math.floor(generator.random() * weapons.length)]).clone()
    var chargerOrig = weap.findChargerAndAssign(items)
    weap.assignCharger(chargerOrig.clone())
    
    var numChrgrs = Math.floor(Math.pow(generator.random(), 2) * 6) + 2
    
    for (var i=0; i < numChrgrs; i++) {
        mon.inventory.push(chargerOrig.clone())
    }
    mon.weapon = weap
    
    if (generator.random() < 0.1) {
        mon.inventory.push(items.itemByName("+10 Health"))
    }
    
    if (generator.random() < 0.01) {
        mon.inventory.push(items.itemByName("+50 Health"))
    }
        
    return mon
}

function Monsta(aiState, name, tx, ty) {
    var hp = Math.floor(generator.random() * 25 + 5)
    var ai = aiState.instantiate(
        tx, ty, name, asciiMapping['m'], '#f60', 
        {
            hp: {pos: 10, max: 10},
            strength: {pos: 10},
            armor: {pos: 10},
            speed: {pos: 30},
            precision: {pos: 10},
            kind: "organic"
        },
        {},
        [])
        
    var weapons = ["9mm Pistol", "xM3 Shotgun", "Flamethrower", "xM50 Rifle", "H80 RPG Launcher"]
    var weap = items.searchWeaponByName(weapons[Math.floor(generator.random() * weapons.length)]).clone()
    var chargerOrig = weap.findChargerAndAssign(items)
    weap.assignCharger(chargerOrig.clone())
    
    var numChrgrs = Math.floor(Math.pow(generator.random(), 2) * 6) + 2
    
    for (var i=0; i < numChrgrs; i++) {
        ai.inventory.push(chargerOrig.clone())
    }
    ai.weapon = weap
    
    if (generator.random() < 0.1) {
        ai.inventory.push(items.itemByName("+10 Health"))
    }
    
    if (generator.random() < 0.01) {
        ai.inventory.push(items.itemByName("+50 Health"))
    }
        
    return ai
}

function Drone(aiState, name, tx, ty) {
    var hp = Math.floor(generator.random() * 5) + 1
    var ai = aiState.instantiate(tx, ty, name, asciiMapping['d'], '#ff0', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: Math.floor(generator.random() * 10)},
            armor: {pos: Math.floor(generator.random() * 10)},
            knockbackFactor: 3,
            kind: "robotic"
        },
        {},
        [])
}

function Tracer(aiState, name, tx, ty) {
    var hp = Math.floor(generator.random() * 10) + 5
    var ai = aiState.instantiate(tx, ty, name, asciiMapping['t'], '#f38', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: 40},
            armor: {pos: 0},
            speed: {pos: 50},
            knockbackFactor: 0.1,
            kind: "robotic"
        },
        {},
        [],
        function (level) {
            var ret = {x: 0, y: 0}
            if (this.ndir > 0) {
                this.ndir--
                ret.x = this.tdir.x
                ret.y = this.tdir.y
            } else {
                this.ndir = Math.floor(generator.random() * 15) + 5
                var nm = Math.floor(generator.random() * 8)
                var dx = [-1, 0, 1, -1, 1, -1, 0, 1][nm]
                var dy = [-1, -1, -1, 0, 0, 1, 1, 1][nm]
                this.tdir = {
                    x: dx,
                    y: dy
                }
            }
            
            return ret
        })
    ai.ndir = 0
    ai.tdir = {x: 0, y: 0}
    
    return ai
}

module.exports = {
    spawners: {
        Monsta: Monsta,
        Drone: Drone,
        Tracer: Tracer,
        Marine: Marine
    },
    registerGenerator: registerGenerator
}