/*
 * weapons.js - Weapons manager for Ganymede Gate
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
var gameDefs = require('./conf/gamedefs.js')
var asciiMapping = require('./templates/ascii_mapping.js') // Code shared between client and server
var effects = require('./effects.js')
var util = require('./util.js')
var passable
var level
var generator

function rayhit(x0, y0, x1, y1) {
    var dx = x1 - x0
    var dy = y1 - y0

    if ((dx == 0) && (dy == 0)) {
        return {x: x1, y: y1}
    } else if (dy == 0) {
        // Horizontal line, easiest
        var row = level[Math.floor(y0)]
        var ix = (dx > 0)?1:-1
        dx = Math.abs(dx)
        
        var x = x0
        for (var i = 1; i < dx; i++) {
            x += ix
            if (passable(row[Math.floor(x)]) == 0) {
                return {x: x, y: y0}
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
                return {x: x0, y: y}
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
            for (var x=x0+ix; x != x1; x+=ix) {
                error += derror
                if (error > 0.5) {
                    y += iy
                    error -= 1.0
                }
                
                if (!(passable(level[Math.floor(y)][Math.floor(x)]) >= 1)) {
                    return {x: x, y: y}
                }
            }
        } else if (Math.abs(dx) < Math.abs(dy)) {
            var derror = Math.abs(dx/dy)
            var x = x0
            for (var y=y0+iy; y != y1; y+=iy) {
                error += derror
                if (error > 0.5) {
                    x += ix
                    error -= 1.0
                }
                
                if (!(passable(level[Math.floor(y)][Math.floor(x)]) >= 1)) {
                    return {x: x, y: y}
                }
            }
        } else if (Math.abs(dx) == Math.abs(dy)) {
            var x = x0+ix
            var y = y0+iy
            while ((y != y1) && (x != x1)) {
                if (!(passable(level[Math.floor(y)][Math.floor(x)]) >= 1)) {
                    return {x: x, y: y}
                }
                x += ix
                y += iy
            }
        }
    }
    
    return {x: x1, y: y1}
}

/*
 * This function is the same as Rayhit except that it continues tracing after reaching the target
 */
/*function rayhitThrough(x0, y0, x1, y1, energy) {
    var initialEnergy = energy
	if (!energy) {
		energy = 1000
	}
	
    if (x0 < 0) {
        x0 = 0
    } else if (x0 >= level[0].length) {
        x0 = level[0].length - 1
    }
    
    if (x1 < 0) {
        x1 = 0
    } else if (x1 >= level[0].length) {
        x1 = level[0].length - 1
    }
    
    if (y0 < 0) {
        y0 = 0
    } else if (y0 >= level.length) {
        y0 = level.length - 1
    }
    
    if (y1 < 0) {
        y1 = 0
    } else if (y1 >= level.length) {
        y1 = level.length - 1
    }

    var dx = x1 - x0
    var dy = y1 - y0
    var lx, ly
    var path = 0
    
    //throw "Not tracing paths correctly"
    
    if ((dx == 0) && (dy == 0)) {
        return {x: x1, y: y1}
    } else if (dy == 0) {
        // Horizontal line, easiest
        path = 1
        var row = level[Math.floor(y0)]
        var ix = (dx > 0)?1:-1
        dx = Math.abs(dx)
        
        var x = x0 + ix
        while ((x >= 0) && (x < row.length) && (energy > 0)) {
            path = 1001
            lx = x
            ly = y0
            
			var tile = row[Math.floor(x)]
			var pa = passable(tile)
            if (pa != 1) {
				if (pa == 2) {
					var ch = tile.character
					var rn = generator.random()
					if (ch && ((ch.prone && (rn < gameDefs.proneToHit)) ||
					    (ch.crouch && (rn < gameDefs.crouchToHit)))) {
						continue
					}
				}
                
                if (isNaN(x) || isNaN(y0)) {
                    console.log("NaN on horizontal tracing " + x + " " + y0)
                }
                
                return {x: x, y: y0}
            }
            x += ix
			energy--
        }
    } else if (dx == 0) {
        // Vertical line, easy
        path = 2
        
        var iy = (dy > 0)?1:-1
        dy = Math.abs(dy)
        
        var y = y0 + iy
        while ((y >= 0) && (y < level.length) && (energy > 0)) {
            lx = x0
            ly = y
            
			var tile = level[Math.floor(y)][Math.floor(x0)]
			var pa = passable(tile)
            if (pa != 1) {
				if (pa == 2) {
					var ch = tile.character
					var rn = generator.random()
					if (ch && ((ch.prone && (rn < gameDefs.proneToHit)) ||
					    (ch.crouch && (rn < gameDefs.crouchToHit)))) {
						continue
					}
				}
				
                if (isNaN(x0) || isNaN(y)) {
                    console.log("NaN on vertical tracing " + x0 + " " + y)
                }
                
                return {x: x0, y: y}
            }
            y += iy
			energy--
        }
    } else {
        // Run the algorithm
        path = 3
        
        var ix = (dx > 0)?1:-1
        var iy = (dy > 0)?1:-1
        var error = 0
        
        if (Math.abs(dx) > Math.abs(dy)) {
            var derror = Math.abs(dy/dx)
            var y = y0
            var x=x0+ix
            
            while ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length) && (energy > 0)) {
                lx = x
                ly = y
                
                error += derror
                if (error > 0.5) {
                    y += iy
                    error -= 1.0
                }
                
                if ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length)) {
					var tile = level[Math.floor(y)][Math.floor(x)]
					var pa = passable(tile)
					if (pa != 1) {
						if (pa == 2) {
							var ch = tile.character
							var rn = generator.random()
							if (ch && ((ch.prone && (rn < gameDefs.proneToHit)) ||
								(ch.crouch && (rn < gameDefs.crouchToHit)))) {
								continue
							}
						}
                        
                        if (isNaN(x) || isNaN(y)) {
                            console.log("NaN on slanted tracing " + x + " " + y)
                        }
                
                        return {x: x, y: y}
                    }
                }
                
                x+=ix
				energy--
            }
        } else if (Math.abs(dx) < Math.abs(dy)) {
            var derror = Math.abs(dx/dy)
            var x = x0
            var y=y0+iy
            while ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length) && (energy > 0)) {
                error += derror
                if (error > 0.5) {
                    x += ix
                    error -= 1.0
                }
                
                lx = x
                ly = y
                
                if ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length)) {
					var tile = level[Math.floor(y)][Math.floor(x)]
					var pa = passable(tile)
					
                    if (pa != 1) {
						if (pa == 2) {
							var ch = tile.character
							var rn = generator.random()
							if (ch && ((ch.prone && (rn < gameDefs.proneToHit)) ||
								(ch.crouch && (rn < gameDefs.crouchToHit)))) {
								continue
							}
						}
						
                        if (isNaN(x) || isNaN(y)) {
                            console.log("NaN on slanted2 tracing " + x + " " + y)
                        }
                        
                        return {x: x, y: y}
                    }
                }
                
                y+=iy
				energy--
            }
        } else if (Math.abs(dx) == Math.abs(dy)) {
            var x = x0+ix
            var y = y0+iy
            while ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length) && (energy > 0)) {
				var tile = level[Math.floor(y)][Math.floor(x)]
				var pa = passable(tile)
				
                lx = x
                ly = y
                
                if (pa != 1) {
					if (pa == 2) {
						var ch = tile.character
						var rn = generator.random()
						if (ch && ((ch.prone && (rn < gameDefs.proneToHit)) ||
							(ch.crouch && (rn < gameDefs.crouchToHit)))) {
							continue
						}
					}
					
                    if (isNaN(x) || isNaN(y)) {
                        console.log("NaN on diagonal tracing " + x0 + " " + y)
                    }
                    return {x: x, y: y}
                }
                
                x += ix
                y += iy
				energy--
            }
        }
    }
    
    if (isNaN(lx) || isNaN(ly)) {
        console.log("NaN on failover tracing " + lx + " " + ly + "; Path: " + path + "; NRG: " + initialEnergy)
    }
    return {x: lx, y: ly}
}*/

function rayhitThrough(x0, y0, x1, y1, energy) {
    var initialEnergy = energy
	if (!energy) {
		energy = 1000
	}
	
    if (x0 < 0) {
        x0 = 0
    } else if (x0 >= level[0].length) {
        x0 = level[0].length - 1
    }
    
    if (x1 < 0) {
        x1 = 0
    } else if (x1 >= level[0].length) {
        x1 = level[0].length - 1
    }
    
    if (y0 < 0) {
        y0 = 0
    } else if (y0 >= level.length) {
        y0 = level.length - 1
    }
    
    if (y1 < 0) {
        y1 = 0
    } else if (y1 >= level.length) {
        y1 = level.length - 1
    }

    var dx = x1 - x0
    var dy = y1 - y0
    var lx, ly
    var path = 0
    
    //throw "Not tracing paths correctly"
    
    var evaluateTile = function(tile, px, py) {
        var pa = passable(tile)
        if (pa != 1) {
            if (pa == 2) {
                var ch = tile.character
                var rn = generator.random()
                if (ch && ((ch.prone && (rn < gameDefs.proneToHit)) ||
                    (ch.crouch && (rn < gameDefs.crouchToHit)))) {
                    return
                }
            }
            
            return {x: px, y: py}
        } else if ((pa == 1) && (typeof(tile.item) != "undefined") && (tile.item != null)) {
            if (generator.random() < 0.8) {
                // TODO: Fix this, it should use information from the weapon if it can hit items or not
                return {x: px, y: py}
            }
        }
    }
    
    if ((dx == 0) && (dy == 0)) {
        return {x: x1, y: y1}
    } else if (dy == 0) {
        // Horizontal line, easiest
        path = 1
        var row = level[Math.floor(y0)]
        var ix = (dx > 0)?1:-1
        dx = Math.abs(dx)
        
        var x = x0 + ix
        while ((x >= 0) && (x < row.length) && (energy > 0)) {
            path = 1001
            lx = x
            ly = y0
            
			var tile = row[Math.floor(x)]
			var ret = evaluateTile(tile, x, y0)
            if (typeof(ret) == "object") {
                return ret
            }
            
            x += ix
			energy--
        }
    } else if (dx == 0) {
        // Vertical line, easy
        path = 2
        
        var iy = (dy > 0)?1:-1
        dy = Math.abs(dy)
        
        var y = y0 + iy
        while ((y >= 0) && (y < level.length) && (energy > 0)) {
            lx = x0
            ly = y
            
			var tile = level[Math.floor(y)][Math.floor(x0)]
			var ret = evaluateTile(tile, x0, y)
            if (typeof(ret) == "object") {
                return ret
            }
            y += iy
			energy--
        }
    } else {
        // Run the algorithm
        path = 3
        
        var ix = (dx > 0)?1:-1
        var iy = (dy > 0)?1:-1
        var error = 0
        
        if (Math.abs(dx) > Math.abs(dy)) {
            var derror = Math.abs(dy/dx)
            var y = y0
            var x=x0+ix
            
            while ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length) && (energy > 0)) {
                lx = x
                ly = y
                
                error += derror
                if (error > 0.5) {
                    y += iy
                    error -= 1.0
                }
                
                if ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length)) {
					var tile = level[Math.floor(y)][Math.floor(x)]
					var ret = evaluateTile(tile, x, y)
                    if (typeof(ret) == "object") {
                        return ret
                    }
                }
                
                x+=ix
				energy--
            }
        } else if (Math.abs(dx) < Math.abs(dy)) {
            var derror = Math.abs(dx/dy)
            var x = x0
            var y=y0+iy
            while ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length) && (energy > 0)) {
                error += derror
                if (error > 0.5) {
                    x += ix
                    error -= 1.0
                }
                
                lx = x
                ly = y
                
                if ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length)) {
					var tile = level[Math.floor(y)][Math.floor(x)]
					var ret = evaluateTile(tile, x, y)
                    if (typeof(ret) == "object") {
                        return ret
                    }
                }
                
                y+=iy
				energy--
            }
        } else if (Math.abs(dx) == Math.abs(dy)) {
            var x = x0+ix
            var y = y0+iy
            while ((x >= 0) && (x < level[0].length) && (y >= 0) && (y < level.length) && (energy > 0)) {
				var tile = level[Math.floor(y)][Math.floor(x)]
				
                lx = x
                ly = y
                
                var ret = evaluateTile(tile, x, y)
                if (typeof(ret) == "object") {
                    return ret
                }
                
                x += ix
                y += iy
				energy--
            }
        }
    }
    
    if (isNaN(lx) || isNaN(ly)) {
        console.log("NaN on failover tracing " + lx + " " + ly + "; Path: " + path + "; NRG: " + initialEnergy)
    }
    return {x: lx, y: ly}
}

function Weapon(options) {
    this.name = options.name || 'No name'
	this.id = options.id || '------'
    this.description = options.description || 'No description'
    this.type = options.type || 'weapon'
    this.cssClass = options.cssClass || 'low-level-item'
    this.color = options.color || 0xFFFFFF
    this.ammo = options.ammo || 0
    this.ammoMax = (options.ammoMax === undefined)?6:options.ammoMax
    this.ammoUse = options.ammoUse || 1
    this.ammoType = (options.ammoType === undefined)?'standard':options.ammoType
    this.health = options.health || 5
    this.chargerAmmoType = (options.ammoType === undefined)?'standard':options.ammoType
    this.minDamage = options.minDamage || 1
    this.maxDamage = options.maxDamage || 3
    this.criticalChance = options.criticalChance || 0.01
    this.criticalMultiplier = options.criticalMultiplier || 2
    this.waitOnUse = options.waitOnUse || 5
    this.waitSubstractSpeedDivider = options.waitSubstractSpeedDivider || 25.0
    this.ammoUse = options.ammoUse || 1
    this.pix = options.pix || '?'
    this.precisionFactor = options.precisionFactor || 0.2
    this.maxPrecision = options.maxPrecision || 0
    this.burstLength = options.burstLength || 1
    this.repeatDelay = options.repeatDelay || 25
    this.armorMultiplier = options.armorMultiplier || 1
    this.trail = options.trail || {}
    this.sndOnFire = options.sndOnFire || ''
    this.sndOnReload = options.sndOnReload || 'reload'
    this.sndOnEmpty = options.sndOnEmpty || 'empty_gun'
    this.identifiedName = options.identifiedName || ''
	this.volume = options.volume || 1
	this.alternate = options.alternate
    this.identified = options.identified || (options.identifiedName == '')
	this.range = options.range || 5
    this.knockback = options.knockback || 0
    
    if (!('ranged' in options)) {
        options.ranged = true
    }
    
    this.ranged = options.ranged
    this.melee = options.melee || false
    this.meleeRange = options.meleeRange || 0
    this.identifyPercent = 0
    
    this.speedDecorators = []
    this.precisionDecorators = []
    this.damageDecorators = []
    this.ammoDecorators = {}
    this.ammoEffects = []
    
    this.effects = options.effects || []
	
	if (this.alternate) {
		if (!this.alternate.burstLength) {
			this.alternate.burstLength = 1
		}
		
		if (!this.alternate.fragmentation) {
			this.alternate.fragmentation = 1
		}
		
		if (!this.alternate.ammoUse) {
			this.alternate.ammoUse = 1
		}
	}
}

Weapon.prototype.clone = function() {
    return new Weapon({
        name: this.name,
		id: this.id,
        description: this.description,
        type: this.type,
        cssClass: this.cssClass,
        color: this.color,
        ammo: this.ammo,
        ammoMax: this.ammoMax,
        ammoUse: this.ammoUse,
        ammoType: this.ammoType,
        health: this.health,
        minDamage: this.minDamage,
        maxDamage: this.maxDamage,
        criticalChance: this.criticalChance,
        criticalMultiplier: this.criticalMultiplier,
        waitOnUse: this.waitOnUse,
        waitSubstractSpeedDivider: this.waitSubstractSpeedDivider,
        ammoUse: this.ammoUse,
        pix: this.pix,
        precisionFactor: this.precisionFactor,
        maxPrecision: this.maxPrecision,
        burstLength: this.burstLength,
        repeatDelay: this.repeatDelay,
        armorMultiplier: this.armorMultiplier,
        trail: this.trail,
        effects: this.effects,
        sndOnFire: this.sndOnFire,
        sndOnReload: this.sndOnReload,
        sndOnEmpty: this.sndOnEmpty,
        identifiedName: this.identifiedName,
        identified: this.identified,
		volume: this.volume,
		alternate: this.alternate,
		range: this.range,
        knockback: this.knockback,
        ranged: this.ranged,
        melee: this.melee,
        meleeRange: this.meleeRange
    })
}

Weapon.prototype.rpcRepr = function(c) {
    var dmgVals = {
        minDamage: this.minDamage,
        maxDamage: this.maxDamage,
        criticalChance: this.criticalChance,
        criticalMultiplier: this.criticalMultiplier,
        knockback: this.knockback
    }
    
    if (c) {
        decorators = this.damageDecorators.concat(c.damageDecorators)
        if (c.weapon) {
            decorators = decorators.concat(c.weapon.ammoDecorators.damage)
        }
    } else {
        decorators = this.damageDecorators
    }
    for (var i=0; i < decorators.length; i++) {
        if (decorators[i]) {
            dmgVals = decorators[i].call(c, dmgVals)
        }
    }
                    
    var res = {
        name: (this.identified && (this.identifiedName != ''))?this.identifiedName:this.name,
		id: this.id,
        description: this.description,
        type: this.type,
        cssClass: this.cssClass,
        color: this.color,
        ammo: this.ammo,
        ammoMax: this.ammoMax,
        ammoType: this.ammoType,
        identified: (this.identified || (this.identifiedName == '')),
        chargerAmmoType: this.chargerAmmoType,
        damage: [dmgVals.minDamage, dmgVals.maxDamage],
        knockback: dmgVals.knockback
    }
	
	if (this.alternate) {
		res.alternate = {
			ammo: this.alternate.ammo,
			ammoMax: this.alternate.ammoMax,
			ammoType: this.alternate.chargerAmmoType,
		}
	}
    
    if (this.ranged) {
        res.ranged = true
    }
	
	return res
}

Weapon.prototype.fire = function(x, y, c, options) {
    if (!((y >= 0) && (y < level.length)&&
        (x >= 0) && (x < level[y].length))) {
        return false
    }

	var weapon = c.weapon
	if (options && (options.useAlternate)) {
		weapon = c.weapon.alternate
	}
    
    var burst = 0
    var firedSomething = false
    
    var pushPlayerMessage = function(msg) {
        if (typeof(c.messages) != "undefined") {
            c.messages.push(msg)
        }
    }

    while ((burst < Math.min(weapon.burstLength, weapon.ammo))&&(weapon.ammo >= 0)) {
        if ((weapon.ammo - weapon.ammoUse) >= 0) {
            firedSomething = true
            weapon.ammo -= weapon.ammoUse
            
            for (var bn=0; bn < weapon.fragmentation; bn++) {
                var speed = {
                    speed: c.attrs.speed.pos,
                    waitOnUse: this.waitOnUse,
                    waitSubstractSpeedDivider: this.waitSubstractSpeedDivider
                }
                var decorators = this.speedDecorators.concat(c.speedDecorators || []).concat(weapon.ammoDecorators.speed || [])
                for (var i=0; i < decorators.length; i++) {
                    speed = decorators[i].call(c, speed)
                }
                c.wait += Math.max(speed.waitOnUse - Math.floor(speed.speed / speed.waitSubstractSpeedDivider), 1)
                
                var dx = c.pos.x - x
                var dy = c.pos.y - y
                var d2 = dx*dx + dy*dy
                
                var precision = c.attrs.precision.pos
                var rangeMultiplier = 1.0
                
                if (c.player_class == "sniper") {
                    precision = precision * 2 + 30
                    
                    precision *= Math.max(0, Math.min(100, c.attrs.suPow) / 35.0) + 1.0
                    rangeMultiplier *= Math.max(0, Math.min(100, c.attrs.suPow) / 50.0) + 1.0
                }
                
                decorators = this.precisionDecorators.concat(c.precisionDecorators || []).concat(weapon.ammoDecorators.precision || [])
                for (var i=0; i < decorators.length; i++) {
                    precision = decorators[i].call(c, precision)
                }
                
                precision = Math.min(precision, this.maxPrecision)
                
				if (options && (options.precision)) {
					precision *= options.precision
				}
				
                var p = Math.max(0, d2 - precision)
                var difx = 0
                var dify = 0
                var ndifx = 0
                var ndify = 0
                var difl = 0
                if (p < 0) {
                    p = 0
                } else {
                    p = Math.ceil(Math.sqrt(p) * this.precisionFactor)
                    
                    difx = x - c.pos.x
                    dify = y - c.pos.y
                    
                    var difl = Math.sqrt(difx * difx + dify * dify)
                    if (difl != 0) {
                        ndifx = difx / difl
                        ndify = dify / difl
                    } else {
                        ndifx = 0
                        ndify = 0
                    }
                }
                
                var currentEffects = []
				if (weapon.effects) {
					for (var ei=0; ei < weapon.effects.length; ei++) {
						var eff = weapon.effects[ei].clone(c)
						eff.applyToSource(level, c.pos.x, c.pos.y)
						currentEffects.push(eff)
					}
				}
                
				if (weapon.ammoEffects) {
					for (var ei=0; ei < weapon.ammoEffects.length; ei++) {
						var eff = weapon.ammoEffects[ei].clone(c)
						eff.applyToSource(level, c.pos.x, c.pos.y)
						currentEffects.push(eff)
					}
				}
                
                var validTarget = false
                
                var tries = 0
				while ((!validTarget) && (tries < 10)) {
                    tries++ // Protect code from looping forever
                    /*var ty = Math.floor(y + generator.random()*p - p/2)
                    var tx = Math.floor(x + generator.random()*p - p/2)*/
                    
                    /*
                     * We're going to calculate a random position in the cone
                     * defined by the precision:
                     * 
                     *      difl  |
                     *  c --------|
                     *            |
                     *            p
                     *
                     *
                     *       (ndify, -ndifx)
                     *             ^
                     *             |
                     *             |
                     *  ----------> (ndifx, ndify)
                     *
                     *
                     */
                    
                    //console.log("dl: " + difl + " | p: " + p + " | ndx: " + ndifx + " | ndy: " + ndify )
                    var tx = Math.round(x + ndify * p * (generator.random() - 0.5))
                    var ty = Math.round(y - ndifx * p * (generator.random() - 0.5))
                    
                    // The path tracer handles all the clipping now, so no need to protect for it
                    /*if (((ty >= 0) && (ty < level.length)&&
                        (tx >= 0) && (tx < level[ty].length))) {*/
                        
                        var ntgt = rayhitThrough(c.pos.x, c.pos.y, tx, ty, Math.round(this.range * rangeMultiplier))
						
                        if (ntgt && (!isNaN(ntgt.x)) && (!isNaN(ntgt.y))) {
                            tx = ntgt.x
                            ty = ntgt.y
                            
                            if (tx < 0) {
                                tx = 0
                            } else if (tx >= level[0].length) {
                                tx = level[0].length - 1
                            }
                            
                            if (ty < 0) {
                                ty = 0
                            } else if (ty >= level.length) {
                                ty = level.length - 1
                            }
                            
                            validTarget = true
                            
                            var tgt = level[ty][tx]
                            
                            var dmgVals = {
                                minDamage: this.minDamage,
                                maxDamage: this.maxDamage,
                                criticalChance: this.criticalChance,
                                criticalMultiplier: this.criticalMultiplier,
                                armorMultiplier: this.armorMultiplier,
                                knockback: this.knockback
                            }
                            decorators = this.damageDecorators.concat(c.damageDecorators || []).concat(weapon.ammoDecorators.damage || [])
                            
                            for (var i=0; i < decorators.length; i++) {
                                dmgVals = decorators[i].call(c, dmgVals)
                            }

                            var dmg = Math.round(generator.random()*(dmgVals.maxDamage - dmgVals.minDamage) + dmgVals.minDamage)
                            var critical = generator.random() < dmgVals.criticalChance
                            
                            if (critical) {
                                dmg = dmg * dmgVals.criticalMultiplier
                            }
                            
                            for (var ei=0; ei < currentEffects.length; ei++) {
                                currentEffects[ei].applyToTarget(level, tx, ty)
                            }

                            if ((typeof(tgt.character) != "undefined") && (tgt.character != null)) {
                                if (typeof(tgt.character.armor) != "undefined") {
                                    var armor = tgt.character.armor.pos * dmgVals.armorMultiplier
                                    var negate = armor/20
                                    negate = (negate <= 10)?negate:10
                                    
                                    tgt.character.armor.pos -= Math.abs(negate) // Negative "negation" makes more damage on more armor
                                        
                                    if (tgt.character.armor.pos < 0) {
                                        tgt.character.armor.pos = 0
                                    }
                                    
                                    dmg -= negate
                                    if (dmg <= 0) {
                                        dmg = 1 // Always do a little damage
                                    }
                                }
                                tgt.character.attrs.hp.pos -= dmg
                                
                                if (dmgVals.knockback > 0) {
                                    if (!tgt.character.knockback) {
                                        tgt.character.knockback = {
                                            ox: c.pos.x,
                                            oy: c.pos.y,
                                            amount: dmgVals.knockback
                                        }
                                    } else {
                                        if (tgt.character.knockback.amount < dmgVals.knockback) {
                                            tgt.character.knockback.ox = c.pos.x
                                            tgt.character.knockback.oy = c.pos.y
                                        }
                                        tgt.character.knockback.amount += dmgVals.knockback
                                    }
                                }
                                
                                if (tgt.character.type == "player") {
                                    pushPlayerMessage("You damage player " + tgt.character.username + " with " + dmg + " damage")
                                } else {
                                    pushPlayerMessage("You damage the " + tgt.character.username +  " with " + dmg + " damage")
                                }
                                
                                for (var ei=0; ei < currentEffects.length; ei++) {
                                    currentEffects[ei].addSticky(tgt.character)
                                }
                                
                                if (typeof(tgt.character.attrs.hp.onchange) != "undefined") {
                                    tgt.character.attrs.hp.onchange.call(tgt.character, "ammo-" + weapon.ammoType, dmg, c)
                                }
                            } else if ((typeof(tgt.item) != "undefined") && (tgt.item != null)) {
                                if (typeof(tgt.item.health) == "undefined") {
                                    tgt.item.health = 1
                                }
                                
                                tgt.item.health = tgt.item.health - dmg
                                
                                if (tgt.item.health <= 0) {
                                    pushPlayerMessage("You destroy a " + (tgt.item.name || tgt.item.ammoType))
                                    tgt.item = null
                                } else {
                                    pushPlayerMessage("You hit a " + (tgt.item.name || tgt.item.ammoType) + " with " + dmg + " damage")
                                }
                            } else if (typeof(tgt.tileHealth) != "undefined") {
                                util.processTileHealth(tgt, dmg, level, tx, ty)
                            }
                            
                            particles.Singleton().spawnParticle(
                                c.pos.x, c.pos.y, tx, ty, 1, "•", 
                                "particle-ammo-" + weapon.ammoType.replace(/ /g, '-'),  
                                "instant", undefined, burst * weapon.repeatDelay, weapon.trail)
                            soundManager.addSound(c.pos.x, c.pos.y, 15, weapon.sndOnFire, burst * weapon.repeatDelay)
                        } else {
                            console.log("Couldn't trace a target")
                            break
                        }
                    //}
                }
            }
        }
        burst++
    }
    
    if (!firedSomething) { // Empty
        soundManager.addSound(c.pos.x, c.pos.y, 5, this.sndOnEmpty, 0)
    }
    
    return validTarget
}

Weapon.prototype.doMelee = function(x, y, c, options) {
    var speed = {
        speed: c.attrs.speed.pos,
        waitOnUse: this.waitOnUse,
        waitSubstractSpeedDivider: this.waitSubstractSpeedDivider
    }
    
    var pushPlayerMessage = function(msg) {
        if (typeof(c.messages) != "undefined") {
            c.messages.push(msg)
        }
    }
    
    var weapon = this
    var decorators = this.speedDecorators.concat(c.speedDecorators || []).concat(weapon.ammoDecorators.speed || [])
    for (var i=0; i < decorators.length; i++) {
        speed = decorators[i].call(c, speed)
    }
    c.wait += Math.max(speed.waitOnUse - Math.floor(speed.speed / speed.waitSubstractSpeedDivider), 1)

    var dx = c.pos.x - x
    var dy = c.pos.y - y
    var d2 = dx*dx + dy*dy

    var precision = c.attrs.precision.pos

    decorators = this.precisionDecorators.concat(c.precisionDecorators || []).concat(weapon.ammoDecorators.precision || [])
    for (var i=0; i < decorators.length; i++) {
        precision = decorators[i].call(c, precision)
    }

    precision = Math.min(precision, this.maxPrecision)

    if (options && (options.precision)) {
        precision *= options.precision
    }
    
    var dmgVals = {
        minDamage: this.minDamage,
        maxDamage: this.maxDamage,
        criticalChance: this.criticalChance,
        criticalMultiplier: this.criticalMultiplier,
        armorMultiplier: this.armorMultiplier,
        knockback: this.knockback
    }
    decorators = this.damageDecorators.concat(c.damageDecorators || []).concat(weapon.ammoDecorators.damage || [])
    
    for (var i=0; i < decorators.length; i++) {
        dmgVals = decorators[i].call(c, dmgVals)
    }

    var dmg = Math.round(generator.random()*(dmgVals.maxDamage - dmgVals.minDamage) + dmgVals.minDamage)
    var critical = generator.random() < dmgVals.criticalChance
    
    if (critical) {
        dmg = dmg * dmgVals.criticalMultiplier
    }
    
    var currentEffects = []
    if (weapon.effects) {
        for (var ei=0; ei < weapon.effects.length; ei++) {
            var eff = weapon.effects[ei].clone(c)
            eff.applyToSource(level, c.pos.x, c.pos.y)
            currentEffects.push(eff)
        }
    }
    
    for (var ei=0; ei < currentEffects.length; ei++) {
        currentEffects[ei].applyToTarget(level, x, y)
    }
    
    var tgt = level[y][x]
    
    if ((typeof(tgt.character) != "undefined") && (tgt.character != null)) {
        if (typeof(tgt.character.armor) != "undefined") {
            var armor = tgt.character.armor.pos * dmgVals.armorMultiplier
            var negate = armor/20
            negate = (negate <= 10)?negate:10
            
            tgt.character.armor.pos -= Math.abs(negate) // Negative "negation" makes more damage on more armor
                
            if (tgt.character.armor.pos < 0) {
                tgt.character.armor.pos = 0
            }
            
            dmg -= negate
            if (dmg <= 0) {
                dmg = 1 // Always do a little damage
            }
        }
        tgt.character.attrs.hp.pos -= dmg
        
        if (dmgVals.knockback > 0) {
            if (!tgt.character.knockback) {
                tgt.character.knockback = {
                    ox: c.pos.x,
                    oy: c.pos.y,
                    amount: dmgVals.knockback
                }
            } else {
                if (tgt.character.knockback.amount < dmgVals.knockback) {
                    tgt.character.knockback.ox = c.pos.x
                    tgt.character.knockback.oy = c.pos.y
                }
                tgt.character.knockback.amount += dmgVals.knockback
            }
        }
        
        if (tgt.character.type == "player") {
            pushPlayerMessage("You damage player " + tgt.character.username + " with " + dmg + " damage")
        } else {
            pushPlayerMessage("You damage the " + tgt.character.username +  " with " + dmg + " damage")
        }
        
        for (var ei=0; ei < currentEffects.length; ei++) {
            currentEffects[ei].addSticky(tgt.character)
        }
        
        if (typeof(tgt.character.attrs.hp.onchange) != "undefined") {
            tgt.character.attrs.hp.onchange.call(tgt.character, weapon.name, dmg, c)
        }
    } else if ((typeof(tgt.item) != "undefined") && (tgt.item != null)) {
        if (typeof(tgt.item.health) == "undefined") {
            tgt.item.health = 1
        }
        
        tgt.item.health = tgt.item.health - dmg
        
        if (tgt.item.health <= 0) {
            pushPlayerMessage("You destroy a " + (tgt.item.name || tgt.item.ammoType))
            tgt.item = null
        } else {
            pushPlayerMessage("You hit a " + (tgt.item.name || tgt.item.ammoType) + " with " + dmg + " damage")
        }
    } else if (typeof(tgt.tileHealth) != "undefined") {
        util.processTileHealth(tgt, dmg, level, tx, ty)
    }
    
    var prt
    var dfx, dfy
    
    switch (generator.randomInt(5)) {
        case 0: {
            prt = "\\"
            dfx = -1
            dfy = -1
            break
        }
        case 1: {
            prt = "/"
            dfx = 1
            dfy = -1
            break
        }
        case 2: {
            prt = "-"
            dfx = generator.eventOccurs(0.5)?-1:1
            dfy = 0
            break
        }
        case 3: {
            prt = "|"
            dfx = 0
            dfy = generator.eventOccurs(0.5)?-1:1
            break
        }
        default: {
            prt = "*"
            dfx = 0
            dfy = 0
        }
    }
    
    particles.Singleton().spawnParticle(
        x + dfx, y + dfy, x - dfx, y - dfy, 1, prt, 
        "blade",  
        "instant", undefined, generator.randomInt(50, 150))
    soundManager.addSound(c.pos.x, c.pos.y, 15, weapon.sndOnFire, 0)
}

Weapon.prototype.reload = function(c, alternate) {
	var weapon = c.weapon
	if (alternate) {
		weapon = c.weapon.alternate
	}
    
    if (!weapon) {
        return
    }
	
    var charger = c.findInInventory(weapon.ammoType)
    
    this.reloadWithCharger(c, charger, alternate)
    soundManager.addSound(c.pos.x, c.pos.y, 5, this.sndOnReload, 0)
}

Weapon.prototype.reloadWithCharger = function(c, charger, alternate) {
    if (!c.weapon) {
        return
    }
    
    if ((typeof(charger) != "undefined")) {
		var weapon = c.weapon
		if (alternate) {
			weapon = c.weapon.alternate
		}
		
        var needAmmo = weapon.ammoMax - weapon.ammo
        weapon.ammo += Math.min(charger.amount, needAmmo)
        weapon.chargerAmmoType = charger.ammoType
        weapon.ammoDecorators = charger.decorators || {}
        weapon.ammoEffects = charger.effects
        weapon.fragmentation = charger.fragmentation
        
        charger.amount -= Math.min(charger.amount, needAmmo)
        
        if (charger.amount <= 0) {
            c.removeFromInventory(charger)
        }
        
        c.wait += 3
        if (c.messages) {
			if (alternate) {
				c.messages.push("You finished reloading the alternate weapon")
			} else {
				c.messages.push("You finished reloading")
			}
        }
    }
}

Weapon.prototype.isChargerCompatible = function(item) {
    if (item.type == "ammo") {
        if (item.ammoType.indexOf(this.ammoType) == 0) {
            return true
        }
    }
    
    return false
}

Weapon.prototype.findChargerAndAssign = function(defs) {
    var possibleChargers = []
    for (var i=0; i < defs.length; i++) {
        var item = defs[i]
        
        /*if (item.type == "ammo") {
            if (item.ammoType.indexOf(this.ammoType) == 0) {
                possibleChargers.push(item)
            }
        }*/
        if (this.isChargerCompatible(item)) {
            possibleChargers.push(item)
        }
    }
    
    if (possibleChargers.length > 0) {
        var charger = possibleChargers[Math.floor(generator.random() * possibleChargers.length)]
        
        this.assignCharger(charger)
        
        return charger
    } else {
        return false
    }
}

Weapon.prototype.assignCharger = function(charger) {
	if (charger.ammoType.indexOf(this.ammoType) >= 0) {
		this.ammo = this.ammoMax
		this.ammoEffects = charger.effects
		this.chargerAmmoType = charger.ammoType
		this.ammoDecorators = charger.decorators || {}
		this.fragmentation = charger.fragmentation
	} else if (this.alternate && (charger.ammoType.indexOf(this.alternate.ammoType) >= 0)) {
		this.alternate.ammo = this.alternate.ammoMax
		this.alternate.ammoEffects = charger.effects
		this.alternate.chargerAmmoType = charger.ammoType
		this.alternate.ammoDecorators = charger.decorators || {}
		this.alternate.fragmentation = charger.fragmentation
	}
}

function Charger(options) {
    this.type = "ammo"
    this.pix = options.pix || '?'
    this.ammoType = options.ammoType || options.identifiedName || options.name
    this.amount = options.amount || 1
    this.stacksInventory = options.stacksInventory || true
    this.maxStackInventory = options.maxStackInventory || options.amount*5
    this.cssClass = options.cssClass || ""
    this.fragmentation = options.fragmentation || 1
    this.decorators = {
        speed: options.speedDecorators || [],
        precision: options.precisionDecorators || [],
        damage: options.damageDecorators || []
    }
    this.effects = options.effects || []
    this.sndOnPickup = options.sndOnPickup || 'pickup'
}

Charger.prototype.clone = function() {
    return new Charger({
        pix: this.pix,
        ammoType: this.ammoType,
        amount: this.amount,
        stacksInventory: this.stacksInventory,
        maxStackInventory: this.maxStackInventory,
        cssClass: this.cssClass,
        fragmentation: this.fragmentation,
        speedDecorators: this.decorators.speed,
        precisionDecorators: this.decorators.precision,
        damageDecorators: this.decorators.damage,
        effects: this.effects,
        sndOnPickup: this.sndOnPickup
    })
}

Charger.prototype.rpcRepr = function(c) {
    var dmgVals = {
        minDamage: 1,
        maxDamage: 1,
        criticalChance: 0,
        criticalMultiplier: 1
    }
    
    var decorators = this.decorators.damage || []
    for (var i=0; i < decorators.length; i++) {
        dmgVals = decorators[i].call(c, dmgVals)
    }
    
    return {
        pix: this.pix,
        ammoType: this.ammoType,
        amount: this.amount,
        cssClass: this.cssClass,
        type: this.type,
        stacksInventory: this.stacksInventory,
        maxStackInventory: this.maxStackInventory,
        fragmentation: this.fragmentation,
        minDamageMult: dmgVals.minDamage,
        maxDamageMult: dmgVals.maxDamage,
        criticalChance: dmgVals.criticalChance,
        criticalMult: dmgVals.criticalMultiplier
    }
}

function registerPassableFn(fn) {
    passable = fn
}

function registerLevel(lv) {
    level = lv
}

function registerGenerator(gen) {
    generator = gen
}

module.exports = {
    Weapon: Weapon,
    Charger: Charger,
    registerPassableFn: registerPassableFn,
    registerLevel: registerLevel,
    registerGenerator: registerGenerator
}