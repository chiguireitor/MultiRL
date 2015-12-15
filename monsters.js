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
var soundManager = require('./soundman.js').getManager()
var particles = require('./particles.js')
var aiState = require('./ai.js')

var generator

var squadFsm = fsm.loadStateMachine('./static/squad_ai.fzm', {}, function() { /*console.log(squadFsm.variables)*/ })
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
    
    vars.no_squad = (typeof(vars.squad) === "undefined") || (!vars.squad)
    
    if (vars) {
        var broadcastedPkt = currentAgent.commsQueue.shift() //comms.peek()
        if (broadcastedPkt) {
            // Set to false all packet vars
            if (!(broadcastedPkt.msgNum in vars.pktsSent)) {
                if ('need_backup' in broadcastedPkt.msg) {
                    if (broadcastedPkt.msg.need_backup.squad == vars.squad) {
                        vars.hostile_seen = false
                        vars.hostile_position = {x: broadcastedPkt.msg.need_backup.x, y: broadcastedPkt.msg.need_backup.y}
                        vars.same_hostile_ask_backup = -5
                        vars.is_my_hostile = false
                        vars.hostile_reported = true
                    }
                } else if ('hostile_seen' in broadcastedPkt.msg) {
                    vars.hostile_seen = true
                    vars.hostile_position = {x: broadcastedPkt.msg.hostile_seen.x, y: broadcastedPkt.msg.hostile_seen.y}
                    vars.is_my_hostile = false
                    vars.hostile_reported = true
                } else if (('need_squad' in broadcastedPkt.msg) && (vars.imleader)) {
                    if (!('squad_members' in vars) || (vars.squad_members.length < 4)) {
                        var dx = broadcastedPkt.msg.need_squad.x - currentAgent.pos.x
                        var dy = broadcastedPkt.msg.need_squad.y - currentAgent.pos.y
                        var d2 = dx * dx + dy * dy
                        
                        if (d2 < 10000) {
                            var nonce = broadcastedPkt.msg.need_squad.nonce
                            vars.last_pkt = currentAgent.comms.transmit(currentAgent, currentAgent.pos.x, currentAgent.pos.y, {
                                'have_squad': {x: currentAgent.pos.x, y: currentAgent.pos.y, squad: vars.squad, nonce: nonce, leader_health: currentAgent.attrs.hp}
                            })
                            if (vars.last_pkt) {
                                randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                            }
                        }
                    }
                } else if (('have_squad' in broadcastedPkt.msg) && (!vars.imleader) && 
                           (vars.squad_ask_nonce == broadcastedPkt.msg.have_squad.nonce) &&
                           (!vars.squad)) {
                    vars.squad = broadcastedPkt.msg.have_squad.squad
                    vars.leader_position = {x: broadcastedPkt.msg.have_squad.x, y: broadcastedPkt.msg.have_squad.y}
                    vars.leader_health = broadcastedPkt.msg.have_squad.leader_health
                    vars.squad_found = true
                    vars.no_squad = false
                } else if (('exploring' in broadcastedPkt.msg) && (broadcastedPkt.msg.exploring.squad == vars.squad)) {
                    console.log('Following leader', broadcastedPkt.msg, 'im from', vars.squad)
                    
                    vars.leader_position = {x: broadcastedPkt.msg.exploring.x, y: broadcastedPkt.msg.exploring.y}
                    
                    vars.last_pkt = currentAgent.comms.transmit(currentAgent, currentAgent.pos.x, currentAgent.pos.y, {
                        'joined_squad': {squad: vars.squad, attrs: currentAgent.attrs}
                    })
                    if (vars.last_pkt) {
                        randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                    }
                    
                    //vars.roam_target = {x: broadcastedPkt.msg.exploring.x, y: broadcastedPkt.msg.exploring.y}
                } else if (('joined_squad' in broadcastedPkt.msg) && (vars.imleader) && 
                           (vars.squad == broadcastedPkt.msg.joined_squad.squad)) {
                    if (!('squad_members' in vars)) {
                        vars.squad_members = []
                    }
                    
                    vars.squad_members.push(broadcastedPkt.msg.joined_squad.attrs)
                }
            } else {
                delete vars.pktsSent[broadcastedPkt.msgNum]
            }
        }
        
        if (vars.squad_members) {
            var i=0
            while (i < vars.squad_members.length) {
                var member = vars.squad_members[i]
                
                if (member.hp.pos <= 0) {
                    vars.squad_members.splice(i, 1)
                } else {
                    i++
                }
            }
        }
        
        if (vars.last_pkt) {
            if (currentAgent.comms.pktOk(vars.last_pkt)) {
                vars.pkt_ok = true
                vars.pkt_fail = false
            } else {
                vars.pkt_ok = false
                vars.pkt_fail = true
                vars.last_pkt = false
            }
        }
        
        if (vars.looking_for_squad && (vars.t/10 > (vars.looking_for_squad - 1))) {
            vars.squad_not_found = true
            vars.looking_for_squad = Math.floor(vars.t/10) + 1
        }
        
        vars.out_of_ammo = currentAgent.weapon && (currentAgent.weapon.ammo <= 0)
        
        var aggro = currentAi.findNearestEnemy(currentAgent.pos.x, currentAgent.pos.y, currentAgent.fov, currentAgent.attrs.faction)
        
        if (aggro) {
            vars.hostile_seen = true
            vars.hostile = aggro
            vars.hostile_position = {x: aggro.pos.x, y: aggro.pos.y}
            
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
            if (vars.hostile_seen) {
                vars.hostile_seen = false
                vars.hostile_in_range = false
                vars.hostile_out_of_range = true
            }
            
            if (vars.hostile) {
                if (vars.hostile.attrs.hp.pos <= 0) {
                    vars.hostile_terminated = true
                    vars.hostile_seen = false
                    vars.hostile = undefined
                }
            }
        }
        
        /*if (aggro && (aggro != vars.hostile)) {
            vars.hostile_seen = true
            vars.hostile_position = {x: aggro.pos.x, y: aggro.pos.y}
            vars.hostile = aggro
            vars.last_hostile_reported = false
            vars.hostile_reported = false
            vars.is_my_hostile = true
            vars.pkt_ok = false
            vars.pkt_fail = false
            vars.same_hostile_ask_backup = 0
            vars.t = 0
        } else if (aggro) {
            vars.hostile_seen = true
            vars.hostile_position = {x: aggro.pos.x, y: aggro.pos.y}
            vars.same_hostile_ask_backup = 0
            vars.hostile_reported = false
            vars.is_my_hostile = true
            
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
            if (vars.is_my_hostile) {
                vars.hostile_out_of_range = true
                vars.hostile_seen = false
                vars.hostile_in_range = false
            } else {
                vars.hostile_seen = false
                vars.hostile_out_of_range = true
                vars.hostile_in_range = false
                vars.is_my_hostile = false
                vars.same_hostile_ask_backup = 0
                
                if (vars.hostile) {
                    if (vars.hostile.attrs.hp.pos <= 0) {
                        vars.hostile_terminated = true
                        vars.hostile = undefined
                    }
                }
                
                if (!vars.squad && !vars.no_squad) {
                    if (currentAgent.generator.eventOccurs(0.05)) {
                        vars.no_squad = true
                        vars.t = 0
                        vars.pkt_ok = false
                        vars.pkt_fail = false
                        var lvl = currentAgent.attrs.hp.max <= 22
                        vars.low_level = lvl
                        vars.high_level = !lvl
                    }
                } else if (!vars.squad && vars.no_squad) {
                }
            }
        }*/
        
        vars.hp_low = currentAgent.attrs.hp.pos <= currentAgent.attrs.hp.max*0.1
    }
    
    //console.log(vars)
}

var lastRadioSoundIdx = 0
var numRadioSounds = 4
function randomRadioSound(x, y) {
    soundManager.addSound(x, y, 15, "radio00" + (lastRadioSoundIdx + 1), 0)
    lastRadioSoundIdx = (lastRadioSoundIdx + 1) % numRadioSounds
    particles.Singleton().spawnParticle(
        x, y, x, y+4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x, y-4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x+4, y+4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)    
    particles.Singleton().spawnParticle(
        x, y, x-4, y+4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x+4, y-4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x-4, y-4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x+4, y, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x-4, y, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
}

var squadNamesEnums = [
    "Alpha", "Beta", "Gamma", "Delta", "Epsilon", 
    "Zeta", "Eta", "Theta", "Iota", "Kappa", "Lambda", 
    "Mu", "Nu", "Xi", "Omicron", "Pi", "Rho", "Sigma", 
    "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega"]
var squadNamesAnimals = [
    "Fox", "Lion", "Tiger", "Hawk", "Hyena",
    "Sea Lion", "Racoon", "Boar", "Leopard",
    "Mosquito", "Bear", "Piranha", "Dragon",
    "Crocodile", "Cobra", "Wolf", "Eagle", "Shark",
    "Jellyfish", "Tarantula", "Black Widow",
    "Scorpion", "Orca"]
function randomSquadName(generator) {
    return generator.pickRandom(squadNamesEnums) + " " +
            generator.pickRandom(squadNamesAnimals)
}

/*
Taken from http://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
*/
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h
    }
    i = Math.floor(h * 6)
    f = h * 6 - i
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break
        case 1: r = q, g = v, b = p; break
        case 2: r = p, g = v, b = t; break
        case 3: r = p, g = q, b = v; break
        case 4: r = t, g = p, b = v; break
        case 5: r = v, g = p, b = q; break
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    }
}

function Marine(aiState, name, tx, ty, faction, hue, level) {
    if (typeof(faction) == "undefined") {
        faction = "default"
    }
    
    if (!squadHandlersAdded) {
        var movementStep = function(agent, dx, dy) {
            var tx = agent.pos.x + dx
            var ty = agent.pos.y + dy
            
            var cmd = {}
            if ((tx >= 0) && (tx < currentLevel[0].length) && (ty >= 0) && (ty < currentLevel.length)) {
                var tile = currentLevel[ty][tx]
                
                var friendly = (typeof(tile.character) != "undefined") && 
                    (tile.character != null) &&
                    (typeof(tile.character.attrs.faction) != "undefined") &&
                    (tile.character.attrs.faction == agent.attrs.faction)
                
                // Won't walk purposefully over a damaging tile
                if (((!tile.damage) || (tile.damage <= 0)) && !friendly) {
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
        
        squadFsm.enterState('idle', function(state, fromState, vars) {
            vars.t = 0
            vars.pkt_fail = false
            vars.pkt_ok = false
            
            vars.came_from_roam = (fromState.name == 'roam')
        })
        
        squadFsm.enterState('roam', function(state, fromState, vars) {
            vars.t = 10
            vars.last_roam_target = false
            vars.pkt_fail = false
            vars.pkt_ok = false
            vars.roam_target = {x: currentAgent.pos.x, y: currentAgent.pos.y}
            
            while ((vars.roam_target.x == currentAgent.pos.x) && (vars.roam_target.y == currentAgent.pos.y)) {
                var angle = currentAgent.generator.random() * Math.PI * 2
                vars.roam_target = {x: Math.min(currentLevel[0].length-1, Math.max(0, Math.floor(currentAgent.pos.x + Math.cos(angle) * 10))),
                                    y: Math.min(currentLevel.length-1, Math.max(0, Math.floor(currentAgent.pos.x + Math.sin(angle) * 10)))}
            }
                                
            if (vars.imleader) {
                vars.last_pkt = currentAgent.comms.transmit(currentAgent, currentAgent.pos.x, currentAgent.pos.y, {
                    'exploring': {x: vars.roam_target.x, y: vars.roam_target.y, cx: currentAgent.pos.x, cy: currentAgent.pos.y, squad: vars.squad}
                })
                if (vars.last_pkt) {
                    randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                }
            }
        })
        
        squadFsm.enterState('retreat', function(state, fromState, vars) {
            vars.t = 0
            
            vars.pkt_fail = false
            vars.pkt_ok = false
            
            if (vars.hostile) {
                var hx = vars.hostile.pos.x - currentAgent.pos.x
                var hy = vars.hostile.pos.y - currentAgent.pos.y
                
                var tx = currentAgent.pos.x - hx
                var ty = currentAgent.pos.y - hy
            
                vars.roam_target = {x: Math.min(currentLevel[0].length-1, Math.max(0, tx)),
                                    y: Math.min(currentLevel.length-1, Math.max(0, ty))}
                                    
                if (vars.imleader) {
                    vars.last_pkt = currentAgent.comms.transmit(currentAgent, currentAgent.pos.x, currentAgent.pos.y, {
                        'retreating': {x: vars.roam_target.x, y: vars.roam_target.y, cx: currentAgent.pos.x, cy: currentAgent.pos.y, squad: vars.squad}
                    })
                    if (vars.last_pkt) {
                        randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                    }
                }
            } else {
                vars.t = 10
            }
        })
        
        squadFsm.enterState('report_hostile', function(state, fromState, vars) {
            vars.pkt_fail = false
            vars.pkt_ok = false
            vars.is_my_hostile = true
            vars.same_hostile_ask_backup = 0
        })
        
        squadFsm.enterState('pursue_hostile', function(state, fromState, vars) {
            vars.t = 0
            vars.hostile_reported = false
        })
        
        squadFsm.enterState('ask_backup', function(state, fromState, vars) {
            vars.pkt_fail = false
            vars.pkt_ok = false
            vars.is_my_hostile = true
        })
        
        squadFsm.enterState('squad_need', function(state, fromState, vars) {
            var lvl = currentAgent.attrs.hp.max <= 24
            vars.low_level = lvl
            vars.high_level = !lvl
            vars.squad_found = false
            vars.pkt_ok = currentAgent.comms.pktOk(vars.last_pkt)
        })
        
        squadFsm.exitState('squad_need', function(state, toState, vars) {
            console.log('Squad Need -> ' + toState.name)
            vars.pkt_ok = false
            vars.pkt_fail = false
        })
        
        squadFsm.enterState('search_squad', function(state, fromState, vars) {
            vars.t = 0
            vars.squad_found = false
            vars.squad_not_found = false
            
            vars.last_pkt = false
            vars.pkt_ok = false
        })
        
        squadFsm.exitState('search_squad', function(state, toState, vars) {
            console.log('Search Squad -> ' + toState.name)
        })
        
        squadFsm.enterState('pursue_squad', function(state, fromState, vars) {
            vars.hostile_seen = false
            vars.leader_near = false
        })
        
        squadFsm.enterState('follow_leader', function(state, fromState, vars) {
            vars.t = 0
        })
        
        // Common functions
        var astar_step = function(vars, prop_last, prop_actual, use_formation) { // This one evaluates the next step to get near the target
            if (typeof(use_formation) !== "undefined") {
                use_formation = false
            }
            
            vars.astar_path = 0
            
            var prop_last_in_vars = prop_last in vars
            var last_path_undef = typeof(vars.last_path) === "undefined"
            var last_pos_dif_cur_pos = prop_last_in_vars && ((vars[prop_last].x != vars[prop_actual].x) || (vars[prop_last].y != vars[prop_actual].y))
            var last_path_length = last_path_undef?false:vars.last_path.length
            
            vars.astar_plinv = prop_last_in_vars
            vars.astar_lpu = last_path_undef
            vars.astar_lpdcp = last_pos_dif_cur_pos
            vars.astar_lpl = last_path_length
            
            if (((!prop_last_in_vars) || 
                ((typeof(vars.last_path) === "undefined") || (vars.last_path.length == 0)) || 
                (vars[prop_last].x != vars[prop_actual].x) ||
                (vars[prop_last].y != vars[prop_actual].y)) && (prop_actual in vars)) {
                
                vars.astar_path = 1
                var tx = vars[prop_actual].x
                var ty = vars[prop_actual].y
                
                if (use_formation && vars.formation_position) {
                    tx -= vars.formation_position.x
                    ty -= vars.formation_position.y
                }
                
                vars[prop_last] = {x: vars[prop_actual].x, y: vars[prop_actual].y}
                
                var d = aiState.traverse(currentAgent, {x: tx, y: ty}, currentLevel)
                    
                if (d) {
                    var ns = d.shift()
                    dx = util.sign(ns.x - currentAgent.pos.x)
                    dy = util.sign(ns.y - currentAgent.pos.y)
                    
                    vars.last_path = d
                    
                    return movementStep(currentAgent, dx, dy)
                }
            } else if (vars.last_path) {
                vars.astar_path = 2
                var ns = vars.last_path.shift()
                if (ns) {
                    dx = util.sign(ns.x - currentAgent.pos.x)
                    dy = util.sign(ns.y - currentAgent.pos.y)
                    
                    return movementStep(currentAgent, dx, dy)
                }
            }
            
            return {wait: 10}
        }
        
        squadFsm.setStateProcessors({
            // Default
            'idle': function(vars) {
                vars.t++
            },
            'roam': function(vars) {
                vars.t--
                
                return astar_step(vars, 'last_roam_target', 'roam_target', true)
            },
            'retreat': function(vars) {
                vars.t++
                
                if ((currentAgent.weapon.ammo == 0) && (vars.t >= 10)) {
                    var cmd = {}
                    
                    cmd.reloadWeapon = true
                    cmd.reloadAlternate = false
                    
                    return cmd
                } else {
                    return astar_step(vars, 'last_roam_target', 'roam_target', true)
                }
            },
            'report_hostile': function(vars) {
                if (!vars.last_pkt && !vars.last_hostile_reported) {
                    vars.last_pkt = currentAgent.comms.transmit(currentAgent, currentAgent.pos.x, currentAgent.pos.y, {
                        'hostile_seen': {x: vars.hostile_position.x, y: vars.hostile_position.y}
                    })
                    vars.pktsSent[vars.last_pkt] = true
                    if (vars.last_pkt) {
                        randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                    }
                }
                
                return {wait: 10}
            },
            
            // Hostile Engagement
            'pursue_hostile': function(vars) {
                vars.t++
                
                return astar_step(vars, 'last_hostile_position', 'hostile_position')
            },
            'ask_backup': function(vars) {
                //if (!vars.last_pkt) {
                    if (vars.is_my_hostile) {
                        vars.last_pkt = currentAgent.comms.transmit(currentAgent, currentAgent.pos.x, currentAgent.pos.y, {
                            'need_backup': {x: currentAgent.pos.x, y: currentAgent.pos.y, squad: vars.squad}
                        })
                        vars.pktsSent[vars.last_pkt] = true
                        if (vars.last_pkt) {
                            randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                        }
                    }
                    
                //}
                
                vars.same_hostile_ask_backup++
                
                return {wait: 10}
            },
            'engage_hostile': function(vars) {
                var cmd = {}
                // TODO: Evaluate if there's an explosive tile near the hostile, and target it instead
                if (currentAgent.weapon.ranged && currentAgent.weapon.alternate && (currentAgent.generator.random() < 0.2)) {
                    if (currentAgent.weapon.alternate.ammo == 0) {
                        cmd.reloadWeapon = true
                        cmd.reloadAlternate = true
                        
                        somethingHappened = true
                        vars.out_of_ammo = true
                    } else {
                        cmd.fireWeapon = true
                        cmd.fireAlternate = true
                        cmd.fireTarget = {x: vars.hostile_position.x, y: vars.hostile_position.y}
                    }
                } else if (currentAgent.weapon.ranged) {
                    if (currentAgent.weapon.ammo == 0) {
                        cmd.reloadWeapon = true
                        cmd.reloadAlternate = true
                        
                        vars.out_of_ammo = true
                    } else {
                        cmd.fireWeapon = true
                        cmd.fireTarget = {x: vars.hostile_position.x, y: vars.hostile_position.y}
                    }
                }
                
                return cmd
            },
            
            // Squad management
            'squad_need': function(vars) {
                /*if (!vars.last_pkt) {
                        vars.last_pkt = currentAgent.comms.transmit(currentAgent, currentAgent.pos.x, currentAgent.pos.y, {
                            'need_squad': {x: currentAgent.pos.x, y: currentAgent.pos.y}
                        })
                        vars.pktsSent[vars.last_pkt] = true
                        if (vars.last_pkt) {
                            randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                        }
                }*/
                
                return {wait: 0}
            },
            'create_squad': function(vars) {
                vars.squad = randomSquadName(currentAgent.generator)
                vars.no_squad = false
                
                vars.last_pkt = currentAgent.comms.transmit(currentAgent, currentAgent.pos.x, currentAgent.pos.y, {
                    'new_squad': {x: currentAgent.pos.x, y: currentAgent.pos.y, name: vars.squad}
                })
                vars.pktsSent[vars.last_pkt] = true
                vars.imleader = true
                if (vars.last_pkt) {
                    randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                }
                
                return {wait: 10}
            },
            'search_squad': function(vars) {
                vars.t++
                if (!vars.last_pkt && !vars.pkt_ok) {
                    vars.squad_ask_nonce = Math.floor(Math.random() * 0xFFFFFFFF)  // This random doesn't needs determinist
                    vars.looking_for_squad = 1
                    vars.last_pkt = currentAgent.comms.transmit(currentAgent, currentAgent.pos.x, currentAgent.pos.y, {
                        'need_squad': {x: currentAgent.pos.x, y: currentAgent.pos.y, nonce: vars.squad_ask_nonce}
                    })
                    if (vars.last_pkt) {
                        randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                    }
                }
                
                return {wait: 10}
            },
            'pursue_squad': function(vars) {
                var dx = vars.leader_position.x - currentAgent.pos.x
                var dy = vars.leader_position.y - currentAgent.pos.y
                
                var d2 = dx * dx + dy * dy
                
                vars.leader_near = d2 < 100
                
                if (vars.leader_health.pos <= 0) {
                    vars.no_squad = true
                    vars.squad = false
                } else if (!vars.leader_near) {
                    /*var d = aiState.traverse(currentAgent, vars.leader_position, currentLevel)
                    
                    if (d) {
                        dx = util.sign(d[0].x - currentAgent.pos.x)
                        dy = util.sign(d[0].y - currentAgent.pos.y)
                        
                        return movementStep(currentAgent, dx, dy)
                    } else {
                        return {wait: 1}
                    }*/
                    return astar_step(vars, 'last_leader_position', 'leader_position')
                } else {
                    vars.formation_position = {dx: dx, dy: dy}
                }
            },
            'follow_leader': function(vars) {
                vars.t++
                
                if (vars.leader_health.pos <= 0) {
                    vars.no_squad = true
                    vars.squad = false
                } else {
                    return astar_step(vars, 'last_leader_position', 'leader_position', true)
                }
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
    
    var possibleMarines = []
    
    var mwp = ["9mm Pistol", "Laser Pistol"]
    if (level >=2) {
        mwp.push("xM3 Shotgun")
        mwp.push("9mm Light Machine Gun")
    } else if (level >= 3) {
        mwp.push("Plasma Pistol")
    } else if (level >= 8) {
        mwp.push("Heavy Laser")
    } else if (level >= 10) {
        mwp.push("Plasma Launcher")
    }
    possibleMarines.push({pix: asciiMapping['m'], saturation: 0.24, weapons: mwp})
    
    if (level >= 3) {
        var swp = ["xM50 Rifle"]
        
        if (level >= 4) {
            swp.push("Laser Rifle")
        } else if (level >= 5) {
            swp.push("Plasma Rifle")
        }
        
        possibleMarines.push({pix: asciiMapping['s'], saturation: 0.5, weapons: swp})
    }
    
    if (level >= 6) {
        var hwp = ["Gatling Laser"]
        
        if (level >= 7) {
            hwp.push("Flamethrower")
        } else if (level >= 8) {
            hwp.push("Gatling Plasma")
        }
        
        possibleMarines.push({pix: asciiMapping['h'], saturation: 0.75, weapons: hwp})
    }
    
    if (level >= 8) {
        possibleMarines.push({pix: asciiMapping['e'], saturation: 1.0, weapons: ["H80 RPG Launcher"]})
    }
    
    var selMarine = generator.pickRandom(possibleMarines)
    
    var rgb = HSVtoRGB(hue, selMarine.saturation, 0.85)
    
    var color = '#' + util.fill0s(((rgb.r << 16) | (rgb.g << 8) | rgb.b).toString(16), 6)
    
    var mon = aiState.instantiate(
        tx, ty, name, selMarine.pix, color, 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: 5},
            armor: {pos: 20},
            speed: {pos: 10},
            precision: {pos: 30},
            kind: "organic",
            faction: faction
        },
        {},
        [],
        function(level, ai) {
            currentAgent = this
            currentLevel = level
            currentAi = ai
            
            updateGlobalVars(this.fsmVars)
            
            return squadFsm.process(this.fsmVars)
        })
        
    mon.fsmVars = squadFsm.cloneVars({
        hostile_position: false,
        last_hostile_reported: false,
        hostile: undefined,
        pktsSent: {}
    })
    mon.fsmMemory = {}
    mon.currentSquad = undefined
    mon.generator = generator.child()
    
    mon.commsQueue = []
    mon.comms = comms.findChannel(faction, true, {
        callback: function(msg) {
            mon.commsQueue.push(msg)
        },
        callbackContext: mon
    })
    
    var weapons = selMarine.weapons
    var weap = items.searchWeaponByName(generator.pickRandom(weapons)).clone()
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

function Monsta(aiState, name, tx, ty, faction) {
    var hp = Math.floor(generator.random() * 25 + 5)
    var ai = aiState.instantiate(
        tx, ty, name, asciiMapping['m'], '#f60', 
        {
            hp: {pos: 10, max: 10},
            strength: {pos: 10},
            armor: {pos: 10},
            speed: {pos: 30},
            precision: {pos: 10},
            kind: "organic",
            faction: faction
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

function Drone(aiState, name, tx, ty, faction) {
    var hp = Math.floor(generator.random() * 5) + 1
    var ai = aiState.instantiate(tx, ty, name, asciiMapping['d'], '#ff0', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: Math.floor(generator.random() * 10)},
            armor: {pos: Math.floor(generator.random() * 10)},
            knockbackFactor: 3,
            kind: "robotic",
            faction: faction
        },
        {},
        [])
}

function Tracer(aiState, name, tx, ty, faction) {
    var hp = Math.floor(generator.random() * 10) + 5
    var ai = aiState.instantiate(tx, ty, name, asciiMapping['t'], '#f38', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: 40},
            armor: {pos: 0},
            speed: {pos: 50},
            knockbackFactor: 0.1,
            kind: "robotic",
            faction: faction
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