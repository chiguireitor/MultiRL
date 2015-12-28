/*
 * soundman.js - Sound manager for Ganymede Gate
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

function SoundManager() {
    this.lastTurnId = -1
    this.soundsList = []
    
}

SoundManager.prototype.endTurn = function(id) {
    this.lastTurnId = id
    this.soundsList = []
}

SoundManager.prototype.addSound = function(x, y, radius, sound, delay, pitchShift) {
    if (sound.length > 0) {
        var ps = 0
        if (Number.isFinite(pitchShift)) {
            ps = (Math.random() * 2 - 1) * pitchShift + 1
        }
        this.soundsList.push({
            x: x,
            y: y,
            r: radius,
            r2: radius * radius,
            s: sound,
            d: delay,
            ps: ps
        })
    }
}

SoundManager.prototype.collectSounds = function(x, y) {
    var col = []
    
    for (var i = 0; i < this.soundsList.length; i++) {
        var snd = this.soundsList[i]
        var dx = snd.x - x
        var dy = snd.y - y
        var d2 = dx * dx + dy * dy
        
        if (d2 <= snd.r2) {
            col.push({
                v: Math.floor((1.0 - d2 / snd.r2) * 128),
                p: Math.floor((dx * (1.0 + (Math.random()*0.2 - 0.1))) / snd.r * 128), // This needs to be determinist?
                s: snd.s,
                d: snd.d,
                ps: snd.ps
            })
        }
    }
    
    return col
}

function diffuseAmbientSound(level, xc, yc, r2, nextTurnId, snd) {
    var x0 = Math.max(0, xc - r2)
    var xn = Math.min(level[0].length, xc + r2)
    
    var y0 = Math.max(0, yc - r2)
    var yn = Math.min(level.length, yc + r2)
    
    for (var y=y0; y < yn; y++) {
        var row = level[y]
        
        for (var x=x0; x < xn; x++) {
            var tile = row[x]
            var dx = x - xc
            var dy = y - yc
            var d2 = dx * dx + dy * dy
            
            if (d2 <= r2) {
                if (typeof(tile.asnd) === "undefined") {
                    tile.asnd = {}
                }
                
                var d2_d_r2 = d2/r2
                if (!(snd in tile.asnd) || (tile.asnd[snd].dst2 > d2_d_r2)) {
                    tile.asnd[snd] = {dst2: d2_d_r2, snd: snd}
                }
            }
        }
    }
}

SoundManager.prototype.calculateAmbientSounds = function(level, nextTurnId, classWhitelist) {
    for (var y=0; y < level.length; y++) {
        var row = level[y]
        
        for (var x=0; x < row.length; x++) {
            var tile = row[x]
            
            if ((typeof(tile.cssClass) !== "undefined") && (classWhitelist.indexOf(tile.cssClass) >= 0)) {
                var radiisq = 16
                diffuseAmbientSound(level, x, y, radiisq, nextTurnId, tile.cssClass)
            }
        }
    }
}

var singletonManager = new SoundManager()

module.exports = {
    getManager: function() {
        return singletonManager
    }
}