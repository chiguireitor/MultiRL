/*
 * effects.js - Central repository for weapons and aids effects on Ganymede Gate
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

var PHASE_SOURCE = 0
var PHASE_TARGET = 1
var PHASE_STICKY = 2

function efc(character, cell) {
    return function(subject, phase, x, y, expd, origin) {
        if (typeof(subject.type) != "undefined") {
            // It is a character, either player or npc
            character.call(this, subject, phase, origin)
        } else {
            // It is a cell
            if (cell) {
                cell.call(this, subject, phase, x, y, expd, origin)
            } else if ((typeof(subject.character) != "undefined") && (subject.character != null)) {
                character.call(this, subject.character, phase)
            }
        }
    }
}

var effectFunction = {
    burn: efc(function(character, phase) {
        if ((typeof(this.additional.burnDamage) != "undefined") && (character.attrs.hp.pos > 0)) {
            character.attrs.hp.pos -= this.additional.burnDamage
            
            if (typeof(character.attrs.hp.onchange) != "undefined") {
                character.attrs.hp.onchange.call(character, "burn")
            }
        }
        
        if (phase == PHASE_STICKY) {
            var manager = particles.Singleton()
            
            if (Math.random() < 0.3) {
                manager.spawnParticle(
                    character.pos.x, character.pos.y,
                    character.pos.x + Math.floor(Math.random() * 5 - 2), character.pos.y + Math.floor(Math.random() * 5 - 2),
                    4, "~", "fire", "instant", undefined, 0)
            }
        }
    }),
    freeze: efc(function(character) {
        if (typeof(this.additional.freezeDamage) != "undefined") {
            character.attrs.hp.pos -= this.additional.freezeDamage
            
            if (typeof(character.attrs.hp.onchange) != "undefined") {
                character.attrs.hp.onchange.call(character, "freeze")
            }
        }
        character.wait += 10
        
        if (phase == PHASE_STICKY) {
            var manager = particles.Singleton()
            
            manager.spawnParticle(
                character.pos.x, character.pos.y,
                character.pos.x + Math.floor(Math.random() * 7 - 3), character.pos.y + Math.floor(Math.random() * 7 - 3),
                4, "~", "ice", "instant", undefined, 0)
        }
    }), // TODO: Freeze lava
    acid: efc(function(character, phase) {
        if ((typeof(this.additional.acidDamage) != "undefined") && (character.attrs.hp.pos > 0)) {
            if (phase == PHASE_STICKY) {
                if (character.attrs.armor.pos <= 0) {
                    character.attrs.hp.pos -= this.additional.acidDamage
                } else {
                    character.attrs.armor.pos -= this.additional.acidDamage
                    if (character.attrs.armor.pos < 0) {
                        character.attrs.armor.pos = 0
                    }
                    character.attrs.hp.pos -= Math.ceil(this.additional.acidDamage * 0.1)
                }
            }
            
            var manager = particles.Singleton()
            if (phase == PHASE_STICKY) {
                for (var i=0; i < 3; i++) {
                    manager.spawnParticle(
                        character.pos.x, character.pos.y,
                        character.pos.x + Math.floor(Math.random() * 4 - 2), character.pos.y + Math.floor(Math.random() * 4 - 2),
                        2, "~", "acid", "instant", undefined, 0)
                }
            }
            
            if (typeof(character.attrs.hp.onchange) != "undefined") {
                character.attrs.hp.onchange.call(character, "acid-effect")
            }
        }
        
        if (phase == PHASE_SOURCE) {
            var manager = particles.Singleton()
            for (var i=0; i < 5; i++) {
                manager.spawnParticle(
                    character.pos.x, character.pos.y,
                    character.pos.x + Math.floor(Math.random() * 10 - 5), character.pos.y + Math.floor(Math.random() * 10 - 5),
                    2, "~", "acid", "instant", undefined, 0)
            }
        } else if (phase == PHASE_TARGET) {
            var manager = particles.Singleton()
            for (var i=0; i < 15; i++) {
                manager.spawnParticle(
                    character.pos.x, character.pos.y,
                    character.pos.x + Math.floor(Math.random() * 10 - 5), character.pos.y + Math.floor(Math.random() * 10 - 5),
                    2, "~", "acid", "instant", undefined, 0)
            }
        }
    }),
    smoke: efc(function(character, phase) {
        var manager = particles.Singleton()
        for (var i=0; i < 2; i++) {
            manager.spawnParticle(
                character.pos.x, character.pos.y,
                character.pos.x + Math.floor(Math.random() * 10 - 5), character.pos.y + Math.floor(Math.random() * 10 - 5),
                2, "'", "smoke", "instant", undefined, 0)
        }
    }),
    heal: efc(function(character) {
        if (typeof(this.additional.healAmount) != "undefined") {
            character.attrs.hp.pos += this.additional.healAmount
            character.attrs.hp.pos = Math.min(character.attrs.hp.pos, character.attrs.hp.max)
            var viewClass = "heal"
            var numParts = 15
            var radius = 10
            
            if ((typeof(this.additional.big) != "undefined") && (this.additional.big)) {
                viewClass = "heal-big"
                numParts = 30
                radius = 15
            }
            
            var manager = particles.Singleton()
            for (var i=0; i < numParts; i++) {
                manager.spawnParticle(
                    character.pos.x + Math.floor(Math.random() * radius - radius/2), character.pos.y + Math.floor(Math.random() * radius - radius/2),
                    character.pos.x, character.pos.y,
                    2, "+", viewClass, "instant", undefined, Math.floor(Math.random() * 400))
            }
        }
    }),
    healthDrain: efc(function(character) {
        if (typeof(this.additional.drainAmount) != "undefined") {
            if (typeof(this.additional.drainedTotal) == "undefined") {
                this.additional.drainedTotal = 0
            }
            this.additional.drainedTotal += Math.min(character.attrs.hp.pos, this.additional.drainAmount)
            character.attrs.hp.pos -= this.additional.drainAmount
            
            if (typeof(character.attrs.hp.onchange) != "undefined") {
                character.attrs.hp.onchange.call(character, "healthDrain")
            }
        }
    }),
    damageDrained: efc(function(character) {
        if (typeof(this.additional.drainedTotal) != "undefined") {
            character.attrs.hp.pos -= this.additional.drainedTotal
            
            if (typeof(character.attrs.hp.onchange) != "undefined") {
                character.attrs.hp.onchange.call(character, "healthDrain")
            }
        }
    }),
    healDrained: efc(function(character) {
        if (typeof(this.additional.drainedTotal) != "undefined") {
            character.attrs.hp.pos += this.additional.drainedTotal
            character.attrs.hp.pos = Math.min(character.attrs.hp.pos, character.attrs.hp.max)
        }
    }),
    burnDrained: efc(function(character) {
        if (typeof(this.additional.drainedTotal) != "undefined") {
            character.attrs.hp.pos -= this.additional.drainedTotal
            
            if (typeof(character.attrs.hp.onchange) != "undefined") {
                character.attrs.hp.onchange.call(character, "burn")
            }
        }
    }),
    explosion: efc(function(character, phase, x, y, expd) {
        if (phase == PHASE_TARGET) {
            character.attrs.hp.pos -= 
                this.additional.explosionDamageRange[0] +
                (this.additional.explosionDamageRange[1] - this.additional.explosionDamageRange[0]) * (1.0 - expd)
                
            if (typeof(character.attrs.hp.onchange) != "undefined") {
                character.attrs.hp.onchange.call(character, "direct-explosion")
            }
        }
    }, function(cell, phase, x, y, expd, origin) {
        if (phase == PHASE_TARGET) {
            var manager = particles.Singleton()
            manager.spawnParticle(
                x, y, x + Math.floor(Math.random() * 5 - 3), y + Math.floor(Math.random() * 5 - 3),
                //x, y, x-10, y - 10,
                1/* + Math.floor(Math.random() * 3)*/, "☼", "fire", "instant", undefined, 200 + Math.floor(Math.random() * 300),
                {from: "DDDD00", to: "AA0000", ttl: 200, num: 8, inherit: false, spread: [9, 9], delay: 0})
                
            if ((typeof(cell.character) != "undefined") && (cell.character != null)) {
                cell.character.attrs.hp.pos -= 
                    this.additional.explosionDamageRange[0] +
                    (this.additional.explosionDamageRange[1] - this.additional.explosionDamageRange[0]) * (1.0 - expd)
                    
                var amnt = Math.random() * 4
                if (!cell.character.knockback) {
                    cell.character.knockback = {
                        ox: origin.x,
                        oy: origin.y,
                        amount: amnt
                    }
                } else {
                    if (cell.character.knockback.amount < amnt) {
                        cell.character.knockback.ox = x
                        cell.character.knockback.oy = y
                    }
                    cell.character.knockback.amount += amnt
                }
                    
                if (typeof(cell.character.attrs.hp.onchange) != "undefined") {
                    cell.character.attrs.hp.onchange.call(cell.character, "explosion-radius")
                }
            }
            
            if (expd < 0.5) {
                cell.tile = asciiMapping["."]
            }
        }
    }),
    plasma_explosion: efc(function(character, phase, x, y, expd) {
        if (phase == PHASE_TARGET) {
            character.attrs.hp.pos -= 
                this.additional.explosionDamageRange[0] +
                (this.additional.explosionDamageRange[1] - this.additional.explosionDamageRange[0]) * (1.0 - expd)
                
            if (typeof(character.attrs.hp.onchange) != "undefined") {
                character.attrs.hp.onchange.call(character, "direct-plasma-explosion")
            }
        }
    }, function(cell, phase, x, y, expd) {
        if (phase == PHASE_TARGET) {
            var manager = particles.Singleton()
            manager.spawnParticle(
                x, y, x + Math.floor(Math.random() * 5 - 3), y + Math.floor(Math.random() * 5 - 3),
                //x, y, x-10, y - 10,
                1 + Math.floor(Math.random() * 3), "☼", "plasma", "instant", undefined, 200 + Math.floor(Math.random() * 300))
                
            if ((typeof(cell.character) != "undefined") && (cell.character != null)) {
                cell.character.attrs.hp.pos -= 
                    this.additional.explosionDamageRange[0] +
                    (this.additional.explosionDamageRange[1] - this.additional.explosionDamageRange[0]) * (1.0 - expd)
                    
                if (typeof(cell.character.attrs.hp.onchange) != "undefined") {
                    cell.character.attrs.hp.onchange.call(cell.character, "plasma-explosion-radius")
                }
            }
        }
    }),
}

function Effect(originator, options) {
    this.affectsFriendly = options.affectsFriendly || false
    this.affectsEnemy = options.affectsEnemy || false
    this.isInstant = options.isInstant || false
    this.isSticky = options.isSticky || false
    this.isTargetArea = options.isTargetArea || false
    this.isSourceArea = options.isSourceArea || false
    this.stickyTtl = options.stickyTtl || 0
    this.stickyTtlRandom = options.stickyTtlRandom || 0
    this.targetRadius = options.targetRadius || 0
    this.sourceRadius = options.sourceRadius || 0
    this.originator = originator
    
    this.sourceFn = options.sourceFn || undefined
    this.targetFn = options.targetFn || undefined
    this.stickyFn = options.stickyFn || undefined
    
    this.additional = options.additional || {}
}

Effect.prototype.clone = function(originator) {
    return new Effect(originator || this.originator, {
        affectsFriendly: this.affectsFriendly,
        affectsEnemy: this.affectsEnemy,
        isInstant: this.isInstant,
        isSticky: this.isSticky,
        isTargetArea: this.isTargetArea,
        isSourceArea: this.isSourceArea,
        stickyTtl: this.stickyTtl,
        stickyTtlRandom: this.stickyTtlRandom,
        targetRadius: this.targetRadius,
        sourceRadius: this.sourceRadius,
        sourceFn: this.sourceFn,
        targetFn: this.targetFn,
        stickyFn: this.stickyFn,
        additional: this.additional
    })
}

function applyFnToRadii(effect, level, x, y, r, fn, phase) {
    var r2 = r * r
    
    for (var iy = -r; iy <= r; iy++) {
        var ty = y + iy
        if ((ty >= 0) && (ty < level.length)) {
            var row = level[ty]
            var dy = iy * iy
            
            for (var ix = -r; ix <= r; ix++) {
                var tx = x + ix 
                if ((tx >= 0) && (tx < row.length)) {
                    var dx = ix * ix
                    
                    if ((dy + dx) <= r2) {
                        var cell = row[tx]
                        
                        fn.call(effect, cell, phase, tx, ty, (dy+dx)/r2, {x: x, y: y})
                    }
                }
            }
        }
    }
}

Effect.prototype.applyToSource = function(level, x, y) {
    if (this.sourceFn) {
        applyFnToRadii(this, level, x, y, this.sourceRadius, this.sourceFn, PHASE_SOURCE)
    }
}

Effect.prototype.applyToTarget = function(level, x, y) {
    if (this.targetFn) {
        applyFnToRadii(this, level, x, y, this.targetRadius, this.targetFn, PHASE_TARGET)
    }
}

Effect.prototype.addSticky = function(c) {
    if (this.stickyFn) {
        if (typeof(c.stickyFns) == "undefined") {
            c.stickyFns = []
        }
        
        c.stickyFns.push({
            ttl: Math.floor(this.stickyTtl + Math.random() * this.stickyTtlRandom),
            effect: this
        })
    }
}

function applyAllStickies(c) {
    if (typeof(c.stickyFns) != "undefined") {
        var i = 0
        var processedSomething = false
        while (i < c.stickyFns.length) {
            var fn = c.stickyFns[i]
            if (fn.ttl <= 0) {
                c.stickyFns.splice(i, 1)
            } else {
                fn.ttl--
                fn.effect.stickyFn.call(fn.effect, c, PHASE_STICKY)
                processedSomething = true
                i++
            }
        }
        
        return processedSomething
    } else {
        return false
    }
}

module.exports = {
    Effect: Effect,
    applyAllStickies: applyAllStickies,
    effectFunction: effectFunction
}