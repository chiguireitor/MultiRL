/*
 * itemDefs.js - Sci-fi items definitions for Ganymede Gate
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
 
var weapons = require('../weapons.js')

var categories = {
    "small-firearms": ["9mm", 
        {"name": "10mm", "score": 5},
        {"name": "12mm", "score": 10},
        {"name": ".460", "score": 20},
        {"name": ".45", "score": 30}, 
        {"name": "Laser", "score": 40, "overrides": {"ammoType": "Energy cell", "trail": {"from": "DD0000", "to": "220000", "ttl": 100, "num": 1, "inherit": false, "spread": [5, 5], "delay": 100} }}, 
        {"name": "Plasma", "score": 50, "overrides": {"ammoType": "Energy cell", "ammoUse": 2, "trail": {"from": "DD00DD", "to": "220022", "ttl": 200, "num": 2, "inherit": false, "spread": [9, 9], "delay": 200}}}],
    "large-firearms": ["7.62x54mm",
    {"name": "Laser", "overrides": {"ammoType": "Energy cell", "trail": {"from": "DD0000", "to": "220000", "ttl": 100, "num": 1, "inherit": false, "spread": [5, 5], "delay": 100}}}, 
        {"name": "Plasma", "overrides": {"ammoType": "Energy cell", "ammoUse": 2, "trail": {"from": "DD00DD", "to": "220022", "ttl": 200, "num": 2, "inherit": false, "spread": [9, 9], "delay": 200}}}],
    "heavy-firearms": ["9mm", "10mm", "12mm", ".460", ".45",
        {"name": "Laser", "overrides": {"ammoType": "Energy cell", "trail": {"from": "DD0000", "to": "220000", "ttl": 100, "num": 1, "inherit": false, "spread": [5, 5], "delay": 100}}}, 
        {"name": "Plasma", "overrides": {"ammoType": "Energy cell", "ammoUse": 2, "trail": {"from": "DD00DD", "to": "220022", "ttl": 200, "num": 2, "inherit": false, "spread": [9, 9], "delay": 200}}}],
    "cone-firearms": ["12ga", "20ga",
        {"name": "Laser", "overrides": {"ammoType": "Energy cell", "trail": {"from": "DD0000", "to": "220000", "ttl": 100, "num": 1, "inherit": false, "spread": [5, 5], "delay": 100}}}, 
        {"name": "Plasma", "overrides": {"ammoType": "Energy cell", "ammoUse": 2, "trail": {"from": "DD00DD", "to": "220022", "ttl": 200, "num": 2, "inherit": false, "spread": [9, 9], "delay": 200}}}],
    "flame-throwers": ["Gasoline", "Gas", "Ionic"],
    "rpg-launcher": ["H80", "Stinger"]
}

var templates = {
    "weapons": {
        "ranged": {
            "_const_fn": weapons.Ranged,
            "pistol": {
                "isleaf": true,
                "category": "small-firearms",
                "ammoMax": {fn: "random-int", val: [8, 12]},
                "ammoType": {fn: "concatenate", val: [{"var": "category"}, "bullets"]},
                "precisionFactor": {fn: "random", val: {"range": [0.1, 0.3], "subaspects": [{"name": "scoped", "score": 30}, {"name": "", "score": 15}, {"name": "short barreled", "score": 0}]}},
                "pix": '⌐',
                "sndOnFire": {fn: "concatenate", val: {array: [{"var": "category"}, "pistol"], nospace: true} }
            },
            "rifle": {
                "isleaf": true,
                "category": "large-firearms",
                "ammoMax": {fn: "random-pick", val: [1, {"aspect": "mag.", "val": 6, "score": 20}, {"aspect": "extended mag.", "val": 12, "score": 40}]},
                "ammoType": {fn: "concatenate", val: [{"var": "category"}, "bullets"]},
                "precisionFactor": 0.1,
                "pix": '⌠',
                "sndOnFire": 'sniper'
            },
            "shotgun": {
                "isleaf": true,
                "category": "cone-firearms",
                "ammoMax": {fn: "random-pick", val: [1, {"aspect": "double", "val": 2, "score": 20}, {"aspect": "combat", "val": 6, "score": 40}, {"aspect": "super", "val": 12, "score": 80}]},
                "ammoType": {fn: "concatenate", val: [{"var": "category"}, "bullets"]},
                "precisionFactor": {fn: "random", val: {"range": [0.5, 0.75], "subaspects": [{"name": "long barreled", "score": 30}, {"name": "", "score": 15}, {"name": "sawed off", "score": 0}]}},
                "maxPrecision": 50,
                "pix": '╒',
                "sndOnFire": 'shotgun'
            },
            "MP9": {
                "isleaf": true,
				"image_generator": {
					"layers": ["mp9", "mp9_2"],
					"features": ["extended", "scoped", "silenced", "tripod mounted", "stocked", "grenade launcher", "accelerated"],
					"tone-mapping": {"ranges": [{"s": [0,0], "v": [1,255]}], "map": [{"origin": "v", "destination": "s", "factor": 1.0}, {"origin": "v", "destination": "v", "factor": 1.0}]}
				},
                "category": "small-firearms",
                "ammoMax": {fn: "random-pick", val: [15, {"aspect": "extended", "score": 20, "val": 30}]},
                "ammoType": {fn: "concatenate", val: [{"var": "category"}, "bullets"]},
                "precisionFactor": {fn: "random", val: {"range": [0.2, 0.35], "subaspects": [{"name": "scoped", "score": 30}, {"name": "stocked", "score": 15}, {"name": "", "score": 0}]}},
				"range": {fn: "random", val: {"range": [4, 10], "subaspects": [{"name": "", "score": 0}, {"name": "accelerated", "score": 25}]}},
				"volume": {fn: "random", val: {"range": [1, 10], "aspects": [{"name": "silenced", "score": 20}, {"name": "", "score": 0}, {"name": "noisy", "score": -20}]}},
                "burstLength": 3,
				"alternate": {fn: "random-null", val: {"subaspect": "grenade launcher", "score": 50, "probability": 0.5, "val": {"ammoType": "M2 grenades", "ammoMax": 1, "volume": 5}, "precisionFactor": 0.4, "sndOnFire": "smg_grenade"}},
                "repeatDelay": 100,
                "pix": '╓',
                "sndOnFire": 'pistol'
            },
			
            "LMG": {
                "isleaf": true,
                "category": "small-firearms",
                "ammoMax": {fn: "random-pick", val: [15, {"aspect": "extended", "score": 20, "val": 30}, {"aspect": "drum loaded", "score": 40, "val": 45}, {"aspect": "chained", "score": 60, "val": 60}]},
                "ammoType": {fn: "concatenate", val: [{"var": "category"}, "bullets"]},
                "precisionFactor": {fn: "random", val: {"range": [0.2, 0.35], "subaspects": [{"name": "scoped", "score": 30}, {"name": "", "score": 15}, {"name": "short barreled", "score": 0}]}},
                "burstLength": 3,
                "repeatDelay": 100,
                "pix": '╓',
                "sndOnFire": 'pistol'
            },
            "heavy rifle": {
                "isleaf": true,
            },
            "gatling gun": {
                "isleaf": true,
                "category": "small-firearms",
                "ammoMax": {fn: "random-pick", val: [48, {"aspect": "mini", "score": -10, "val": 24}, {"aspect": "chained", "score": 30, "val": 64}, {"aspect": "continuous feed", "score": 60, "val": 160}]},
                "ammoType": {fn: "concatenate", val: [{"var": "category"}, "bullets"]},
                "minDamage": 15,
                "maxDamage": 25,
                "precisionFactor": {fn: "random", val: {"range": [0.2, 0.6], "subaspects": [{"name": "soft recoil", "score": 20}, {"name": "", "score": 15}, {"name": "high recoil", "score": -15}]}},
                "burstLength": {fn: "random-pick", val: [8, {"subaspect": "rusted", "subscore": -10, "val": 4}, {"aspect": "servo controlled", "score": 15, "val": 16}]},
                "repeatDelay": 60,
                "pix": '&'
            },
            "launcher": {
                "isleaf": true,
                
                "minDamage": 30,
                "maxDamage": 90,
                "category": "rpg-launcher",
                "ammoMax": {fn: "random-pick", val: [1, {"aspect": "double", "score": 20, "val": 2}, {"aspect": "swarming", "score": 50, "val": 12, "additional": {"burstLength": 3, "repeatDelay": 100}}]},
                "ammoType": {fn: "concatenate", val: [{"var": "category"}, "RPG"]},
                "precisionFactor": {fn: "random", val: {"range": [0.2, 0.45], "subaspects": [{"name": "of nuking", "score": 30}, {"name": "of demolition", "score": 15}, {"name": "", "score": 0}]}},
                
                "pix": '{',
                "sndOnFire": 'rpg',
                "trail": {"from": "DDDDDD", "to": "222222", "ttl": 500, "num": 3, "inherit": false, "spread": [5, 5], "delay": 100}
            },
            "flamethrower": {
                "isleaf": true,
                "category": "flame-throwers",
                "ammoMax": 100,
                "ammoType": {fn: "concatenate", val: [{"var": "category"}, "tank"]},
                "precisionFactor": {fn: "random", val: {"range": [0.75, 1.0]}},
                "maxPrecision": 20,
                "burstLength": 20,
                "repeatDelay": 15,
                "pix": 'σ',
                "sndOnFire": 'flamethrower'
            }
        },
        "melee": {
            "combat knife": {
            },
            "pipe": {
            },
            "chainsaw": {
            },
            "electric rod": {
            },
            "power fist": {
            },
            "impact hammer": {
            }
        }
    },
    "ammo": {
        "_const_fn": weapons.Charger,
        "9mm bullets": {
            /*ammoType: "9mm bullets Corrosive",
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
            pix: asciiMapping['‼']*/
        },
        "12ga shells": {
        },
        "7.62x54mm bullets": {
        },
        "H80 RPG": {
        },
        "Energy cell": {
        },
        "Gasoline tank": {
        }
    }
}

module.exports = {
    categories: categories,
    templates: templates
}