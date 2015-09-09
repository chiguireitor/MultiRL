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

var fs = require('fs')
var rex = require('./rex_sprite.js')
var determinist = require('./determinist.js')

var zlib = require('zlib')

var onecolor = require('onecolor')

var items = []

var defaultNameStructure = {
    'fn': 'concatenate', 
    val: [{"var": "subaspect"}, {"var": "aspect"}, {"var": "category"}, {"var": "parent"}]
}

var itemDefs = require('./conf/itemDefs.js')
var categories = itemDefs.categories
var templates = itemDefs.templates

function camelCase(name) {
    var words = name.split(' ')
    return words.map(function(x) {
        if (x.length > 3) {
            return  x[0].toUpperCase() + x.slice(1)
        } else {
            return x
        }
    }).join(' ')
}

var currentRandomGen
var generatorFunctions = {
    "random-pick": function(array, context) {
        var val = array[currentRandomGen.randomIntRange(0, array.length)] //Math.floor(Math.random() * array.length)]
        
        if (typeof(val) == "object") {
            if (('score' in val) && ('aspect' in val)) {
                context.addAspect(val.aspect, val.score)
            }
            
            if (('subscore' in val) && ('subaspect' in val)) {
                context.addSubAspect(val.subaspect, val.subscore)
            }
            
            if ('additional' in val) {
                context.addProperties(val.additional)
            }
            
            return val.val
        } else {
            return val
        }
    },
    "concatenate": function(array, context) {
        var joinChar = " "
        if ((typeof(array) == "object") && !(Array.isArray(array))) {
            if (array.nospace) {
                joinChar = ""
            }
            
            array = array.array
        }
        
        return array.map(function(x) {
            if ((typeof(x) === "object") && ('var' in x)) {
                if (x['var'] in context) {
                    return context[x['var']]
                } else {
                    return ''
                }
            } else {
                return x
            }
        }).reduce(function(p, x) { if (x != "") { return p.concat([x]) } else { return p } }, [])
          .join(joinChar)
          .trim()
    },
    "random": function(params, context) {
        var v = currentRandomGen.random()//Math.random()
        
        if ('aspects' in params) {
            var asps = params.aspects[Math.round(v * (params.aspects.length-1))]
            context.addAspect(asps.name, asps.score)
        }
		
        if ('subaspects' in params) {
            var subs = params.subaspects[Math.round(v * (params.subaspects.length-1))]
            context.addSubAspect(subs.name, subs.score)
        }
        return v * (params.range[1] - params.range[0]) + params.range[0]
    },
	// {fn: "random-null", "subaspect": "grenade launcher", "score": 50, "probability": 0.1, "val": {"ammoType": "M2 grenades", "ammoMax": 1, "volume": 5}, "precisionFactor": 0.4, "sndOnFire": "smg_grenade"},
	"random-null": function(params, context) {
		if (currentRandomGen.random() <= params.probability) { //Math.random() <= params.probability) {
			if ('aspect' in params) {
				context.addAspect(params.aspect, params.score)
			}
			
			if ('subaspect' in params) {
				context.addSubAspect(params.subaspect, params.score)
			}
			
			return params.val
		}
	},
    "random-int": function(range) {
        return currentRandomGen.randomIntRange(range[0], range[1]) //Math.floor(Math.random() * (range[1] - range[0])) + range[1]
    }
}

function matchesRanges(ranges, pix) {
	var fg = onecolor([pix.fg.r, pix.fg.g, pix.fg.b, 255])
	var bg = onecolor([pix.bg.r, pix.bg.g, pix.bg.b, 255])
	
	var matchesFg = false
	var matchesBg = false
	for (var i=0; i < ranges.length; i++) {
		var range = ranges[i]
		var fgSM = false
		var fgVM = false
		var bgSM = false
		var bgVM = false
		
		if ('s' in range) {
			var s0 = range.s[0]/255.0
			var s1 = range.s[1]/255.0
			
			if ((s0 <= fg.saturation()) && (fg.saturation() <= s1)) {
				fgSM = true
			}
			
			if ((s0 <= bg.saturation()) && (bg.saturation() <= s1)) {
				bgSM = true
			}
		}
		
		if ('v' in range) {
			var v0 = range.v[0]/255.0
			var v1 = range.v[1]/255.0
			
			if ((v0 <= fg.value()) && (fg.value() <= v1)) {
				fgVM = true
			}
			
			if ((v0 <= bg.value()) && (bg.value() <= v1)) {
				bgVM = true
			}
		}
		
		matchesFg |= fgSM && fgVM
		matchesBg |= bgSM && bgVM
	}
	
	return [matchesFg, matchesBg]
}

function toneMap(map, tex, r, g, b) {
	var col = onecolor([r, g, b, 255])
	var colO = {
		h: col.hue(),
		s: col.saturation(),
		v: col.value()
	}
	var colD = {
		h: tex.hue(),
		s: tex.saturation(),
		v: tex.value() * colO.v
	}
	
	for (var i=0; i < map.length; i++) {
		var rule = map[i]
		
		colD[rule.destination] = colO[rule.origin] * rule.factor + colD[rule.destination]
	}
	
	col = onecolor([0,0,0, 255])
		.hue(colD.h)
		.saturation(colD.s)
		.value(colD.v)
	
	return [Math.floor(col.red() * 255),
		Math.floor(col.green() * 255),
		Math.floor(col.blue() * 255)]
}

var toneTextures
function loadToneTextures() {
	toneTextures = []
	
	var files = fs.readdirSync('./rex_sprites/item_gen/tone_textures')
	
	for (var i=0; i < files.length; i++) {
		var fn = files[i]
		
		var name = fn.split('.').slice(0, -1).join('.')
		var data = fs.readFileSync('./rex_sprites/item_gen/tone_textures/' + fn)
		var ret = new rex.RexSprite(data)
		toneTextures.push(ret)
	}
}

function generate(spath, params, id) {
	if (!toneTextures) {
		loadToneTextures()
	}
    var path = spath.split("/")
	
    var nd = templates
    var parent = ''
    var const_fn
	
	var rndGeni = new determinist.IdRandomizer(id)
    
    // Walk the tree and find the to-be-generated template
    while (!(nd && ('isleaf' in nd) && (nd.isleaf)) && path.length > 0) {
        var evnn = path[0]
        
        if (evnn == '*') {
            var possel = []
            for (x in nd) {
                if (nd.hasOwnProperty(x) && (x != "_const_fn")) {
                    possel.push(x)
                }
            }
            
            parent = possel[rndGeni.randomIntRange(0, possel.length)]
            nd = nd[parent]
        } else {
            parent = evnn
            nd = nd[evnn]
        }
        
        if (nd && ('_const_fn' in nd)) {
            const_fn = nd['_const_fn']
        }
        
        path = path.slice(1)
    }
    
	if (!nd) {
		throw "Couldn't generate path: " + spath
	}
	
    var meetsParams = false
    var iterations = 0
	var imageGenParams = nd.image_generator
    var constItem
	
    while ((iterations < 100) && !meetsParams) {
        iterations += 1
		
		var rndGen = rndGeni.clone()
		currentRandomGen = rndGen
	
        // Now process and generate the item
        var cat
        var result = {}
        var aspects = []
        var subaspects = []
        var context = {
            'category': '', 
            'parent': parent,
            'aspect': '',
            'subaspect': '',
            'score': 0,
            addAspect: function(name, score) {
                var i = 0
                while ((i < aspects.length)&&(aspects[i].score < score)) {
                    i++
                }
                aspects = aspects.slice(0, i).concat([{name: name, score: score}]).concat(aspects.slice(i))
                context.aspect = aspects[aspects.length - 1].name
                context.score += score
            },
            addSubAspect: function(name, score) {
                var i = 0
                while ((i < subaspects.length)&&(subaspects[i].score < score)) {
                    i++
                }
                subaspects = subaspects.slice(0, i).concat([{name: name, score: score}]).concat(subaspects.slice(i))
                context.subaspect = subaspects[subaspects.length - 1].name
                context.score += score
            },
            addProperties: function(obj) {
                for (x in obj) {
                    if (obj.hasOwnProperty(x)) {
                        result[x] = obj[x]
                    }
                }
            }
        }
        
        if ('category' in nd) {
            cat = categories[nd.category]
            cat = cat[rndGen.randomIntRange(0, cat.length)] //Math.floor(Math.random() * cat.length)]
            
            if (typeof(cat) == 'object') {
                for (x in cat.overrides) {
                    if (cat.overrides.hasOwnProperty(x)) {
                        nd[x] = cat.overrides[x]
                    }
                }
                
                if ('score' in cat) {
                    context.score += cat.score
                }
                
                cat = cat.name
            }
            
            context.category = cat
        }
        
        for (x in nd) {
            if ((x != 'isleaf') && (x != 'category') && (x != 'image_generator') && nd.hasOwnProperty(x)) {
                var val = nd[x]
                
                if (typeof(val) === "object") {
					if (('fn' in val) && ('val' in val)) {
						result[x] = generatorFunctions[val.fn](val.val, context)
					/*} else if ('clone' in val) {
						result[x] = val.clone()*/
					} else {
						result[x] = val
					}
                } else {
                    result[x] = val
                }
            }
        }
        
        // Fix values and fill in defaults
        if ('pix' in result) {
            result.pix = asciiMapping[result.pix]
        }
        
        if (!('name' in result)) {
            result.identifiedName = camelCase(generatorFunctions[defaultNameStructure.fn](defaultNameStructure.val, context))
            result.name = camelCase(generatorFunctions[defaultNameStructure.fn](defaultNameStructure.val, {
                'category': cat, 
                'parent': parent,
                'aspect': '',
                'subaspect': ''
            }))
            
            if (result.identifiedName != result.name) {
                result.name = 'Unidentified ' + result.name
                result.identified = false
            } else {
                result.identified = true
            }
        }
        
        if (params && ('score' in params)) {
            if (context.score <= params.score) {
                meetsParams = true
            }
        } else if (!params) {
            meetsParams = true
        }
        
        if (meetsParams) {
			result.id = spath.split('/').pop() + '_' + rndGen.id
			//console.log('gen_id: ' + result.id)
            constItem = new const_fn(result)
			
			var imgen = nd.image_generator
			
			if (imgen) {
				var layers = new Array(imgen.layers.length)
				var loadNum = 0
				
				var finishSpriteProc = function() {
					var w = layers[0].layers[0].width
					var h = layers[0].layers[0].height
					
					var buf = new Array(w*h)
					
					layers[0].rawDraw(buf, 0, 0, 0)
					
					var itemNameLC = result.identifiedName.toLocaleLowerCase()
					
					for (var i=0; i < imgen.features.length; i++) {
						if (itemNameLC.indexOf(imgen.features[i].toLocaleLowerCase()) >= 0) {
							var spriteNum = Math.floor((i + 1)/4.0)
							var layerNum = i + 1 - spriteNum * 4
							
							//console.log(i + ' ' + spriteNum)
							buf = layers[spriteNum].rawDraw(buf, layerNum)
						}
					}
					
					var toneMapping = imgen["tone-mapping"]
					var j = rndGen.randomIntRange(-1, toneTextures.length)
					if (j >= 0) {
						var toneTex = toneTextures[j]
						
						for (var i=0; i < buf.length; i++) {
							var pix = buf[i]
							var rgbDest
							var hsvDest
							
							var rgbDest = toneTex.layers[0].raster[i].bg
							var hsvDest = onecolor([rgbDest.r, rgbDest.g, rgbDest.b, 255])
							var mtch = matchesRanges(toneMapping.ranges, pix)
							
							if (mtch[0]) {
								var col = toneMap(toneMapping.map, hsvDest, pix.fg.r, pix.fg.g, pix.fg.b)
								buf[i].fg.r = col[0]
								buf[i].fg.g = col[1]
								buf[i].fg.b = col[2]
							}
							
							if (mtch[1]) {
								var col = toneMap(toneMapping.map, hsvDest, pix.bg.r, pix.bg.g, pix.bg.b)
								buf[i].bg.r = col[0]
								buf[i].bg.g = col[1]
								buf[i].bg.b = col[2]
							}
						}
					}
					
                    zlib.gzip(rex.saveLayerAsXPBuffer(layers[0].version, w, h, buf), function (error, resBuf) {
                        if (!error) {
                            var tmpDir = process.env.OPENSHIFT_TMP_DIR || "./"
                            
                            fs.writeFile(tmpDir + 'rex_sprites/generated/' + result.id + '.xp', resBuf, function(err) {
                                if (err) {
                                    console.log("Couldn't save file: " + err)
                                }
                            })
                        } else {
                            console.log(error)
                        }
                    })
				}
				
				for (var x=0; x < imgen.layers.length; x++) {
					(function(nm, idx) {
						fs.readFile('./rex_sprites/item_gen/' + nm + '.xp', function (errrf, data) {
							if (!errrf) {
								var ret = new rex.RexSprite(data, false, function() {
										loadNum++
										
										if (loadNum == layers.length) {
											finishSpriteProc()
										}
									})
									
								layers[idx] = ret
							} else {
								console.log('Couldn\'t load sprite: ' + nm)
							}
						})
					})(imgen.layers[x], x)
				}
			}
        }
    }
        
    if (meetsParams) {
        return constItem
    } else {
        throw "Couldn't create an item with the specified params: " + spath + " " + JSON.stringify(params)
    }
}
items.generate = generate

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
    sndOnFire: 'shotgun',
    knockback: 0.85
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
    cssClass: 'health-powerup',
    onuse: function(c) {
        c.attrs.hp.max += 10
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♦'],
    name: '+10 Armor',
    cssClass: 'armor-powerup',
    onuse: function(c) {
        c.attrs.armor.pos = Math.min(c.attrs.armor.pos + 10, c.attrs.armor.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♣'],
    name: '+10 Strength',
    cssClass: 'strength-powerup',
    onuse: function(c) {
        c.attrs.strength.pos = Math.min(c.attrs.strength.pos + 10, c.attrs.strength.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♠'],
    name: '+10 Precision',
    cssClass: 'precision-powerup',
    onuse: function(c) {
        c.attrs.precision.pos = Math.min(c.attrs.precision.pos + 10, c.attrs.precision.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♪'],
    name: '+10 Speed',
    cssClass: 'speed-powerup',
    onuse: function(c) {
        c.attrs.speed.pos = Math.min(c.attrs.speed.pos + 10, c.attrs.speed.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['♫'],
    name: '+30 Speed',
    cssClass: 'speed-powerup-plus',
    onuse: function(c) {
        c.attrs.speed.pos = Math.min(c.attrs.speed.pos + 30, c.attrs.speed.max)
    }
}))

items.push(new aids.Instant({
    pix: asciiMapping['•'],
    name: '+10 Health',
    cssClass: 'heal-powerup',
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
    cssClass: 'heal-powerup-plus',
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

items.generate = generate

module.exports = items