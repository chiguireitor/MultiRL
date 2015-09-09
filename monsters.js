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

function Monsta(aiState, name, tx, ty) {
    var hp = Math.floor(Math.random() * 25 + 5)
    var ai = aiState.instantiate(
        tx, ty, name, asciiMapping['m'], '#f60', 
        {
            hp: {pos: 10, max: 10},
            strength: {pos: 10},
            armor: {pos: 10},
            speed: {pos: 30},
            precision: {pos: 10}
        },
        {},
        [])
        
    var pistol = items.searchWeaponByName("9mm Pistol").clone()
    var chargerOrig = pistol.findChargerAndAssign(items)
    pistol.assignCharger(chargerOrig.clone())
    ai.inventory.push(chargerOrig.clone())
    ai.inventory.push(chargerOrig.clone())
    ai.weapon = pistol
        
    return ai
}

function Drone(aiState, name, tx, ty) {
    var hp = Math.floor(Math.random() * 5) + 1
    var ai = aiState.instantiate(tx, ty, name, asciiMapping['d'], '#ff0', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: Math.floor(Math.random() * 10)},
            armor: {pos: Math.floor(Math.random() * 10)}
        },
        {},
        [])
}

function Tracer(aiState, name, tx, ty) {
    var hp = Math.floor(Math.random() * 10) + 5
    var ai = aiState.instantiate(tx, ty, name, asciiMapping['t'], '#f38', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: 40},
            armor: {pos: 0},
            speed: {pos: 50}
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
                this.ndir = Math.floor(Math.random() * 15) + 5
                var nm = Math.floor(Math.random() * 8)
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
    Monsta: Monsta,
    Drone: Drone,
    Tracer: Tracer
}