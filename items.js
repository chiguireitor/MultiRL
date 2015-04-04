/*
 * items.js - Central items repository for Ganymede Gate
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
 
var weapons = require('./weapons.js')
var aids = require('./aids.js')
var asciiMapping = require('./templates/ascii_mapping.js') // Code shared between client and server
var effects = require('./effects.js')

var items = []

items.push(new weapons.Ranged({
    name: "9mm Pistol",
    description: "Standard issue 9mm pistol",
    ammo: 12,
    ammoMax: 12,
    ammoType: "9mm bullets",
    precisionFactor: 0.1,
    cssClass: 'standard-weapon',
    pix: asciiMapping['⌐'],
    sndOnFire: '9mmpistol'
}))

items.push(new weapons.Ranged({
    name: "xM3 Shotgun",
    description: "Standard issue shotgun",
    ammo: 6,
    ammoMax: 6,
    minDamage: 5,
    maxDamage: 10,
    ammoType: "12ga",
    cssClass: 'standard-weapon',
    precisionFactor: 0.65,
    maxPrecision: 50,
    pix: asciiMapping['╒'],
    sndOnFire: 'shotgun'
}))

items.push(new weapons.Ranged({
    name: "9mm Light Machine Gun",
    description: "Marine's choice weapon",
    ammo: 30,
    ammoMax: 30,
    ammoType: "9mm bullets",
    precisionFactor: 0.25,
    burstLength: 3,
    repeatDelay: 100,
    cssClass: 'good-weapon',
    pix: asciiMapping['╓'],
    sndOnFire: '9mmpistol'
}))

items.push(new weapons.Ranged({
    name: "Flamethrower",
    description: "Anyone up for a barbecue?",
    ammo: 100,
    ammoMax: 100,
    ammoType: "Gasoline tank",
    precisionFactor: 1.0,
    maxPrecision: 20,
    burstLength: 20,
    repeatDelay: 15,
    cssClass: 'good-weapon',
    pix: asciiMapping['σ'],
    sndOnFire: 'flamethrower'
}))

items.push(new weapons.Ranged({
    name: "xM50 Rifle",
    description: "Standard issue for snipers",
    ammo: 16,
    ammoMax: 16,
    ammoType: "7.62x54mm bullets",
    minDamage: 10,
    maxDamage: 35,
    precisionFactor: 0.1,
    cssClass: 'good-weapon',
    pix: asciiMapping['⌠'],
    sndOnFire: 'sniper'
}))

items.push(new weapons.Ranged({
    name: "H80 RPG Launcher",
    description: "Short range Rocket launcher",
    ammo: 1,
    ammoMax: 1,
    ammoType: "H80 RPG",
    minDamage: 40,
    maxDamage: 80,
    precisionFactor: 0.3,
    cssClass: 'dangerous-weapon',
    pix: asciiMapping['{'],
    sndOnFire: 'rpg',
    trail: {from: "DDDDDD", to: "222222", ttl: 500, num: 3, inherit: false, spread: [5, 5], delay: 100}
}))

items.push(new weapons.Ranged({
    name: "Laser Pistol",
    description: "One handed laser weapon",
    ammo: 24,
    ammoMax: 24,
    ammoType: "Energy cell",
    minDamage: 5,
    maxDamage: 15,
    precisionFactor: 0.7,
    cssClass: 'standard-weapon',
    pix: asciiMapping['/'],
    sndOnFire: 'laserPistol',
    trail: {from: "DD0000", to: "220000", ttl: 100, num: 1, inherit: false, spread: [5, 5], delay: 100}
}))

items.push(new weapons.Ranged({
    name: "Laser Rifle",
    description: "Long range laser weapon",
    ammo: 12,
    ammoMax: 12,
    ammoType: "Energy cell",
    minDamage: 15,
    maxDamage: 25,
    precisionFactor: 0.15,
    cssClass: 'good-weapon',
    pix: asciiMapping['\\'],
    sndOnFire: 'laserRifle',
    trail: {from: "DD0000", to: "220000", ttl: 100, num: 1, inherit: false, spread: [5, 5], delay: 100}
}))

items.push(new weapons.Ranged({
    name: "Heavy Laser",
    description: "Semi automatic laser weapon",
    ammo: 24,
    ammoMax: 24,
    ammoType: "Energy cell",
    minDamage: 15,
    maxDamage: 25,
    precisionFactor: 0.4,
    burstLength: 3,
    repeatDelay: 100,
    cssClass: 'good-weapon',
    pix: asciiMapping['%'],
    sndOnFire: 'laserHeavy',
    trail: {from: "DD0000", to: "220000", ttl: 100, num: 1, inherit: false, spread: [5, 5], delay: 100}
}))

items.push(new weapons.Ranged({
    name: "Gatling Laser",
    description: "Gatling laser weapon",
    ammo: 48,
    ammoMax: 48,
    ammoType: "Energy cell",
    minDamage: 15,
    maxDamage: 25,
    precisionFactor: 0.4,
    burstLength: 8,
    repeatDelay: 60,
    cssClass: 'dangerous-weapon',
    pix: asciiMapping['&'],
    sndOnFire: 'laserGatling',
    trail: {from: "DD0000", to: "220000", ttl: 100, num: 1, inherit: false, spread: [5, 5], delay: 100}
}))

items.push(new weapons.Ranged({
    name: "Plasma Pistol",
    description: "One handed plasma weapon",
    ammo: 24,
    ammoMax: 24,
    ammoUse: 2,
    ammoType: "Energy cell",
    minDamage: 10,
    maxDamage: 20,
    precisionFactor: 0.8,
    cssClass: 'standard-weapon',
    pix: asciiMapping['['],
    sndOnFire: 'plasmaPistol',
    trail: {from: "DD00DD", to: "220022", ttl: 200, num: 2, inherit: false, spread: [9, 9], delay: 200}
}))

items.push(new weapons.Ranged({
    name: "Plasma Rifle",
    description: "Long range plasma weapon",
    ammo: 12,
    ammoMax: 12,
    ammoUse: 2,
    ammoType: "Energy cell",
    minDamage: 20,
    maxDamage: 30,
    precisionFactor: 0.3,
    cssClass: 'good-weapon',
    pix: asciiMapping[']'],
    sndOnFire: 'plasmaRifle',
    trail: {from: "DD00DD", to: "220022", ttl: 200, num: 2, inherit: false, spread: [9, 9], delay: 200}
}))

items.push(new weapons.Ranged({
    name: "Plasma Launcher",
    description: "Semi automatic plasma weapon",
    ammo: 24,
    ammoMax: 24,
    ammoUse: 2,
    ammoType: "Energy cell",
    minDamage: 20,
    maxDamage: 30,
    precisionFactor: 0.5,
    burstLength: 3,
    repeatDelay: 100,
    cssClass: 'good-weapon',
    pix: asciiMapping[')'],
    sndOnFire: 'plasmaLauncher',
    trail: {from: "DD00DD", to: "220022", ttl: 200, num: 2, inherit: false, spread: [9, 9], delay: 200}
}))

items.push(new weapons.Ranged({
    name: "Gatling Plasma",
    description: "Gatling plasma weapon",
    ammo: 48,
    ammoMax: 48,
    ammoUse: 2,
    ammoType: "Energy cell",
    minDamage: 20,
    maxDamage: 30,
    precisionFactor: 0.5,
    burstLength: 8,
    repeatDelay: 60,
    cssClass: 'dangerous-weapon',
    pix: asciiMapping['('],
    sndOnFire: 'plasmaGatling',
    trail: {from: "DD00DD", to: "220022", ttl: 200, num: 2, inherit: false, spread: [9, 9], delay: 200}
}))

items.push(new weapons.Charger({
    ammoType: "9mm bullets",
    amount: 30,
    cssClass: 'low-level-ammo',
    stacksInventory: true,
    maxStackInventory: 60,
    damageDecorators: [],
    pix: asciiMapping['‼']
}))

items.push(new weapons.Charger({
    ammoType: "9mm bullets FMJ",
    amount: 30,
    cssClass: 'mid-level-ammo',
    stacksInventory: true,
    maxStackInventory: 60,
    damageDecorators: [
        function(dmgVals) {
            dmgVals.minDamage *= 4
            dmgVals.maxDamage *= 4
            dmgVals.criticalChance += 0.15
            dmgVals.criticalMultiplier *= 4
            
            return dmgVals
        }
    ],
    pix: asciiMapping['‼']
}))

items.push(new weapons.Charger({
    ammoType: "9mm bullets AP",
    amount: 30,
    cssClass: 'mid-level-ammo',
    stacksInventory: true,
    maxStackInventory: 60,
    damageDecorators: [
        function(dmgVals) {
            dmgVals.maxDamage *= 2
            dmgVals.criticalChance += 0.15
            dmgVals.armorMultiplier *= 0.1
            
            return dmgVals
        }
    ],
    pix: asciiMapping['‼']
}))

items.push(new weapons.Charger({
    ammoType: "9mm bullets HP",
    amount: 30,
    cssClass: 'mid-level-ammo',
    stacksInventory: true,
    maxStackInventory: 60,
    damageDecorators: [
        function(dmgVals) {
            dmgVals.maxDamage *= 3
            dmgVals.maxDamage *= 4
            dmgVals.criticalChance += 0.25
            dmgVals.armorMultiplier *= 3
            
            return dmgVals
        }
    ],
    pix: asciiMapping['‼']
}))

items.push(new weapons.Charger({
    ammoType: "9mm bullets Corrosive",
    amount: 30,
    cssClass: 'high-level-ammo',
    stacksInventory: true,
    maxStackInventory: 60,
    damageDecorators: [
        function(dmgVals) {
            dmgVals.maxDamage *= 1
            dmgVals.maxDamage *= 5
            dmgVals.criticalChance += 0.35
            dmgVals.armorMultiplier *= -5
            
            return dmgVals
        }
    ],
    effects: [new effects.Effect(undefined, {
        affectsFriendly: true,
        affectsEnemy: true,
        isSticky: true,
        isTargetArea: true,
        isSourceArea: true,
        targetRadius: 0,
        sourceRadius: 0,
        stickyTtl: 30,
        stickyTtlRandom: 30,
        sourceFn: effects.effectFunction.acid,
        targetFn: effects.effectFunction.acid,
        stickyFn: effects.effectFunction.acid,
        additional: {
            acidDamage: 1
        }
    })],
    pix: asciiMapping['‼']
}))

items.push(new weapons.Charger({
    ammoType: "12ga shells",
    amount: 6,
    fragmentation: 12,
    cssClass: 'low-level-ammo',
    stacksInventory: true,
    maxStackInventory: 60,
    damageDecorators: [],
    pix: asciiMapping['φ']
}))

items.push(new weapons.Charger({
    ammoType: "Gasoline tank",
    amount: 100,
    cssClass: 'low-level-ammo',
    stacksInventory: true,
    maxStackInventory: 500,
    damageDecorators: [],
    effects: [new effects.Effect(undefined, {
        affectsFriendly: true,
        affectsEnemy: true,
        isSticky: true,
        isTargetArea: true,
        isSourceArea: true,
        targetRadius: 1,
        sourceRadius: 0,
        stickyTtl: 30,
        stickyTtlRandom: 10,
        sourceFn: effects.effectFunction.smoke,
        targetFn: effects.effectFunction.burn,
        stickyFn: effects.effectFunction.burn,
        additional: {
            burnDamage: 3
        }
    })],
    pix: asciiMapping['ô']
}))

items.push(new weapons.Charger({
    ammoType: "H80 RPG",
    amount: 1,
    cssClass: 'mid-level-ammo',
    stacksInventory: true,
    maxStackInventory: 12,
    damageDecorators: [],
    effects: [new effects.Effect(undefined, {
        affectsFriendly: true,
        affectsEnemy: true,
        isSticky: false,
        isTargetArea: true,
        isSourceArea: true,
        targetRadius: 5,
        sourceRadius: 0,
        sourceFn: effects.effectFunction.smoke,
        targetFn: effects.effectFunction.explosion,
        additional: {
            explosionDamageRange: [5, 30]
        }
    })],
    pix: asciiMapping['-']
}))

items.push(new weapons.Charger({
    ammoType: "7.62x54mm bullets",
    amount: 16,
    cssClass: 'low-level-ammo',
    stacksInventory: true,
    maxStackInventory: 48,
    damageDecorators: [],
    pix: asciiMapping['╥']
}))

items.push(new weapons.Charger({
    ammoType: "7.62x54mm bullets AP",
    amount: 16,
    cssClass: 'mid-level-ammo',
    stacksInventory: true,
    maxStackInventory: 48,
        damageDecorators: [
        function(dmgVals) {
            dmgVals.maxDamage *= 2
            dmgVals.criticalChance += 0.15
            dmgVals.armorMultiplier *= 0.1
            
            return dmgVals
        }
    ],
    pix: asciiMapping['╥']
}))

items.push(new weapons.Charger({
    ammoType: "Energy cell",
    amount: 24,
    cssClass: 'low-level-ammo',
    stacksInventory: true,
    maxStackInventory: 72,
    damageDecorators: [],
    pix: asciiMapping['∩'],
    effects: [new effects.Effect(undefined, {
        affectsFriendly: true,
        affectsEnemy: true,
        isSticky: false,
        isTargetArea: true,
        isSourceArea: true,
        targetRadius: 2,
        sourceRadius: 0,
        sourceFn: effects.effectFunction.smoke,
        targetFn: effects.effectFunction.plasma_explosion,
        additional: {
            explosionDamageRange: [2, 10]
        }
    })],
}))

items.push(new aids.Instant({
    pix: asciiMapping['♥'],
    name: '+10 Max Health',
    onuse: function(c) {
        c.attrs.hp.max += 10
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♦'],
    name: '+10 Armor',
    onuse: function(c) {
        c.attrs.armor.pos = Math.min(c.attrs.armor.pos + 10, c.attrs.armor.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♣'],
    name: '+10 Strength',
    onuse: function(c) {
        c.attrs.strength.pos = Math.min(c.attrs.strength.pos + 10, c.attrs.strength.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♠'],
    name: '+10 Precision',
    onuse: function(c) {
        c.attrs.precision.pos = Math.min(c.attrs.precision.pos + 10, c.attrs.precision.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♪'],
    name: '+10 Speed',
    onuse: function(c) {
        c.attrs.speed.pos = Math.min(c.attrs.speed.pos + 10, c.attrs.speed.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♫'],
    name: '+30 Speed',
    onuse: function(c) {
        c.attrs.speed.pos = Math.min(c.attrs.speed.pos + 30, c.attrs.speed.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['•'],
    name: '+10 Health',
    onuse: function(c) {
        c.attrs.hp.pos = Math.min(c.attrs.hp.pos + 10, c.attrs.hp.max)
    },
    effects: [new effects.Effect(undefined, {
        affectsFriendly: true,
        isSourceArea: true,
        sourceRadius: 0,
        sourceFn: effects.effectFunction.heal,
        additional: {
            healAmount: 0 // Healing was granted already by the onuse handler
        }
    })],
}))

items.push(new aids.Instant({
    pix: asciiMapping['◘'],
    name: '+50 Health',
    onuse: function(c) {
        c.attrs.hp.pos = Math.min(c.attrs.hp.pos + 50, c.attrs.hp.max)
    },
    effects: [new effects.Effect(undefined, {
        affectsFriendly: true,
        isSourceArea: true,
        sourceRadius: 0,
        sourceFn: effects.effectFunction.heal,
        additional: {
            healAmount: 0, // Healing was granted already by the onuse handler
            big: true
        }
    })]
}))
    
/*items.push(new aids.Instant({
    pix: asciiMapping['♂'],
    name: 'Berserk pack',
    onuse: function(c) {
        c.attrs.berserk = {
            ttl: 25, // 25 turns
            attrs: {
                strength: 50
            }
        }
    }
}))*/

items.searchAmmoType = function(atype) {
    for (var i=0; i < items.length; i++) {
        var itm = items[i]
        if (itm.type == "ammo") {
            if (itm.ammoType == atype) {
                return itm
            }
        }
    }
}

items.searchWeaponByName = function(name) {
    for (var i=0; i < items.length; i++) {
        var itm = items[i]
        if (itm.type == "weapon") {
            if (itm.name == name) {
                return itm
            }
        }
    }
}

module.exports = items