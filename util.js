/*
 * util.js - Utilitary functions, used everywhere else
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
 
 var gameDefs = require('./conf/gameDefs.js')

function sign(n) {
    if (n == 0) {
        return 0
    } else if (n < 0) {
        return -1
    } else {
        return 1
    }
}

function deltasSquare(x0, y0, xn, yn) {
    var deltas = []
    
    for (var y=y0; y <= yn; y++) {
        for (var x=x0; x <= xn; x++) {
            deltas.push([x, y])
        }
    }
    
    return deltas
}

function dropInventory(agent, level, passableFn, index) {
    if (agent.inventory) {
        var tryDrop = function(item, probability) {
            if (typeof(probability) == "undefined") {
                probability = -3
            }
            var fitted = Math.random() < probability
            
            if (!fitted) {
                var tryDeltas = deltasSquare(-1, -1, 1, 1)
                
                for (var n=0; n < tryDeltas.length; n++) {
                    var dx = agent.pos.x + tryDeltas[n][0]
                    var dy = agent.pos.y + tryDeltas[n][1]
                    
                    if ((dy >= 0) && (dy < level.length)) {
                        var row = level[dy]
                        if ((dx >= 0) && (dx < row.length)) {
                            var tile = row[dx]
                            
                            if (passableFn(tile) == 1) {
                                if ((typeof(tile.item) == "undefined") || (tile.item == null) || !tile.item) {
                                    tile.item = item
                                    fitted = true
                                    
                                    break
                                }
                            }
                        }
                    }
                }
            }
            
            return fitted
        }
        
        if (typeof(index) == "undefined") {
            var itemsArray = agent.inventory
            
            if (agent.weapon && (agent.weapon != null)) {
                itemsArray = itemsArray.concat([agent.weapon])
            }
            
            for (var n=0; n < itemsArray.length; n++) {
                var item = itemsArray[n]
                
                tryDrop(item, gameDefs.dropProbability)
            }
        } else {
            var item = agent.inventory[index]
            var dropped = tryDrop(item)
                
            if (dropped) {
                agent.inventory.splice(index, 1)
            }
            
            return dropped
        }
    }
}
 
function processKnockback(agent, level, passableFn) {
    if (agent.knockback) {
        var dx = sign(agent.pos.x - agent.knockback.ox)
        var dy = sign(agent.pos.y - agent.knockback.oy)
        
        var x = Math.min(Math.max(0, agent.pos.x + dx), level[0].length)
        var y = Math.min(Math.max(0, agent.pos.y + dy), level.length)
        for (var i=0; i < agent.knockback.amount; i++) {
            var psbl = passableFn(level[y][x])
            if (psbl == 1) {
                level[agent.pos.y][agent.pos.x].character = null
                
                agent.pos.x = x
                agent.pos.y = y
                level[agent.pos.y][agent.pos.x].character = agent
            } else if (psbl == 2) {
                level[agent.pos.y][agent.pos.x].character.knockback = {
                    ox: agent.pos.x,
                    oy: agent.pos.y,
                    amount: agent.knockback - i
                }
            }
        }
        
        delete agent.knockback
    }
 }
 
 module.exports = {
     dropInventory: dropInventory,
     processKnockback: processKnockback,
     sign: sign
 }