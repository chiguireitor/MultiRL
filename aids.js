/*
 * aids.js - Not a disease: The central repository of aids to the player for Ganymede Gate
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
 
var soundManager = require('./soundman.js').getManager()

function Instant(options) {
    this.pix = options.pix
    this.name = options.name
    this.onuse = options.onuse
    this.instant = true
    this.effects = options.effects || []
    this.lightsource = options.lightsource
    this.sndOnUse = options.sndOnUse || 'pickup'
}

Instant.prototype.clone = function() {
    return new Instant({
        pix: this.pix,
        name: this.name,
        onuse: this.onuse,
        effects: this.effects,
        sndOnUse: this.sndOnUse,
        lightsource: this.lightsource
    })
}

Instant.prototype.use = function(level, c) {
    if (typeof(this.onuse) != "undefined") {
        this.onuse(c)
    }
    
    for (var i=0; i < this.effects.length; i++) {
        this.effects[i].applyToSource(level, c.pos.x, c.pos.y)
    }
    
    soundManager.addSound(c.pos.x, c.pos.y, 10, this.sndOnUse, 0)
}

module.exports = {
    Instant: Instant,
}