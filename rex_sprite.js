/*
 * rex_spite.js - Node.js module to load and draw REXPaint sprites
 *
 * Code style:
 * 4 space indents, no semicolons to finish lines, camelCase, opening braces on same line
 *
 * Created by John Villar for the "Ganymede Gate" sci-fi multiplayer roguelike
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
 * TODO LIST:
 *
 * - Create a mechanism to support different drawing methods (search #DRAW)
 * - Test this thing with browserify
 * - Allow modification and saving of the file
 *
 */
var zlib = require('zlib')
var sb = require('singlebyte')
var cp437 = sb.getEncodingTable('cp437')
var Buffer = require('buffer/').Buffer
var natBuffer = require('buffer').Buffer

function rgbObj2cssHex(o) {
    var r = o.r.toString(16)
    var g = o.g.toString(16)
    var b = o.b.toString(16)
    
    if (r.length < 2) {
        r = '0' + r
    }
    
    if (g.length < 2) {
        g = '0' + g
    }
    
    if (b.length < 2) {
        b = '0' + b
    }
    
    return r + g + b
}

function RexSprite(buf, encode, onfinish) {
    this.version = 0
    this.numLayers = 0
    this.layers = []
    this.encode = encode
    
    if (buf) {
        if (typeof(buf.alreadyDecompressed) != "undefined") {
            this.loadInflatedBuffer(new Buffer(buf))
        } else {
            zlib.unzip(buf, (function(rs) {
                return function(err, buffer) {
                    if (!err) {
                        rs.loadInflatedBuffer(buffer)
						if (onfinish) {
							onfinish()
						}
                    } else {
                        console.log(err)
                    }
                }
            })(this))
        }
    }
}

RexSprite.prototype.loadInflatedBuffer = function(buffer) {
    buffer.readInt32 = buffer.readInt32LE
    buffer.fixedReadUint8 = function(offset) {
        // There's a bug in readUint8 that damages the buffer, so
        // we read the two's complement and then clear the sign
        // with this terrible, terrible hack
        var v = this.readInt8(offset)
        var nv = (v<0)?256+v:v //(v >>> 0) && 0xFF
        
        return nv
    }
    this.version = buffer.readInt32(0)
    this.numLayers = buffer.readInt32(4)
    
    var curOffset = 8
    for (var i=0; i < this.numLayers; i++) {
        var layer = {}
        layer.width = buffer.readInt32(curOffset)
        curOffset += 4
        layer.height = buffer.readInt32(curOffset)
        curOffset += 4
        
        var raster = Array(layer.height * layer.width)
        var rasterIdx = 0
        for (var y=0; y < layer.height; y++) {
            //var py = layer.width * y
            for (var x=0; x < layer.width; x++) {
                var pix = {}
                var val = buffer.readInt32(curOffset)
                curOffset += 4
                if (this.encode) {
                    pix.asciiCode = String.fromCharCode(cp437[val])
                } else {
                    pix.asciiCode = val
                }
                pix.fg = {}

                pix.fg.r = buffer.fixedReadUint8(curOffset++)
                pix.fg.g = buffer.fixedReadUint8(curOffset++)
                pix.fg.b = buffer.fixedReadUint8(curOffset++)
                
                pix.bg = {}
                pix.bg.r = buffer.fixedReadUint8(curOffset++)
                pix.bg.g = buffer.fixedReadUint8(curOffset++)
                pix.bg.b = buffer.fixedReadUint8(curOffset++)
                
                //raster[x * layer.height + y] = pix // REX Paint stores tiles in column major format, go figure
                raster[rasterIdx++] = pix
            }
        }
        
        layer.raster = raster
        this.layers.push(layer)
    }
}

RexSprite.prototype.drawIfFree = function(level, x, y) {
    var layer = (this.layers.length > 0)?this.layers[this.layers.length-1]:undefined
    var isFree = true
    
    for (var iy=0; iy < layer.height; iy++) {
        var ty = y + iy
        if ((ty >= 0) && (ty < level.length)) {
            var row = level[ty]
            
            for (var ix=0; ix < layer.width; ix++) {
                var tx = x + ix
                
                var rasterIdx = ix * layer.height + iy
                
                if ((tx >= 0) && (tx < row.length)) {
                    levelPixel = row[tx]
                    
                    isFree &= (levelPixel.tile == 46)
                }
                
                if (!isFree) {
                    break
                }
            }
        }
        
        if (!isFree) {
            break
        }
    }
    
    if (isFree) {
        this.draw(level, x, y)
    }
    
    return isFree
}

RexSprite.prototype.draw = function(level, x, y) {
    var blockLayer = (this.layers.length > 1)?this.layers[this.layers.length-2]:undefined
    var logicLayer = (this.layers.length > 2)?this.layers[this.layers.length-3]:undefined
    var tilesLayer = (this.layers.length > 0)?this.layers[this.layers.length-1]:undefined
    
    if (tilesLayer) {
        var layer = tilesLayer
    
        for (var iy=0; iy < layer.height; iy++) {
            var ty = y + iy
            if ((ty >= 0) && (ty < level.length)) {
                var row = level[ty]
                var py = iy * layer.width
                
                for (var ix=0; ix < layer.width; ix++) {
                    var tx = x + ix
                    
                    var rasterIdx = ix * layer.height + iy
                    
                    if ((tx >= 0) && (tx < row.length)) {
                        levelPixel = row[tx]
                        
                        var pix = layer.raster[rasterIdx]
                        
                        if (!((pix.bg.r == 255)&&(pix.bg.g == 0)&&(pix.bg.b == 255))) {
                            var fg = rgbObj2cssHex(pix.fg)
                            var bg = rgbObj2cssHex(pix.bg)
                            
                            // #DRAW TODO: Change this to your level format
                            levelPixel.tile = pix.asciiCode
                            levelPixel.fg = fg
                            levelPixel.bg = bg
                            
                            if ("damage" in levelPixel) {
                                delete levelPixel.damage
                            }
                            
                            if (blockLayer) {
                                levelPixel.forcePassable = blockLayer.raster[rasterIdx].asciiCode
                            }
                            
                            if (logicLayer) {
                                var logicBrick = logicLayer.raster[rasterIdx]
                                if (logicBrick.asciiCode == 61) { // 61 == =
                                    delete levelPixel.forcePassable // we don't want to force it, use the common tile passability
                                } else if (logicBrick.asciiCode == 247) { // 247 == ≈
                                    levelPixel.damage = logicBrick.fg.r // Red channel determines the damage dealt
                                } else if (logicBrick.asciiCode == 233) { // 233 == Θ
                                    levelPixel.damageExplode = 255-logicBrick.fg.g // FG Green channel determines the damage dealt when exploding
                                    levelPixel.damageRadius = 255-logicBrick.fg.r // FG Red channel determines the explosion radius
                                    levelPixel.tileHealth = 255-logicBrick.fg.b // FG Blue channel determines the tile health
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

RexSprite.prototype.rawDraw = function(buf, layerNum) {
    var layer = this.layers[layerNum]
	
	for (var i=0; i < layer.raster.length; i++) {
		var pix = layer.raster[i]
		
		if (!((pix.bg.r == 255)&&(pix.bg.g == 0)&&(pix.bg.b == 255))) {
			buf[i] = pix
		}
	}
	
	return buf
}

function saveLayerAsXPBuffer(version, width, height, layer) {
	var buffer = new natBuffer(16 + width * height * 10)
	
	buffer.writeInt32LE(version, 0)
	buffer.writeInt32LE(1, 4)
	
	buffer.writeInt32LE(width, 8)
	buffer.writeInt32LE(height, 12)
	
	var offs = 16
	for (var i=0; i < layer.length; i++) {
		var pix = layer[i]
		
		buffer.writeInt32LE(pix.asciiCode, offs)
		offs += 4
		
		buffer.writeUInt8(pix.fg.r, offs++)
		buffer.writeUInt8(pix.fg.g, offs++)
		buffer.writeUInt8(pix.fg.b, offs++)
		
		buffer.writeUInt8(pix.bg.r, offs++)
		buffer.writeUInt8(pix.bg.g, offs++)
		buffer.writeUInt8(pix.bg.b, offs++)
	}
	
	return buffer
}

module.exports = {
    RexSprite: RexSprite,
	saveLayerAsXPBuffer: saveLayerAsXPBuffer
}

/*if (typeof(window) != "undefined") {
    window.RexSprite = RexSprite
}*/