/*
 * comms.js - Ganymede Gate AI's communication channels
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

var interferences = []
var channels = {}

var commandTypes = {
    'spottedHostile': {
        'x': 0, 'y': 0,
        'faction': ''
    },
    'imHit': {
        'x': 0, 'y': 0,
        'faction': ''
    },
    'needBackup': {
        'x': 0, 'y': 0
    },
    'holdFormation': {
        'x': 0, 'y': 0,
        'leader': ''
    },
    'holdPosition': {
        'x': 0, 'y': 0
    },
    'seekLeader': {
        'squad': '',
    },
    'openFire': {
        'x': 0, 'y': 0
    },
    'needSquad': {
        'x': 0, 'y': 0
    },
    'haveSquad': {
        'squad': '',
        'x': 0, 'y': 0
    }
}

function MessageQueue(name) {
    this.queue = []
    
    this.name = name
    this.msgNum = 1
    this.lastTransmittedMsg = 0
    this.pendingMsgNums = {}
    
    channels[name] = this
}

MessageQueue.prototype.transmit = function(x, y, msg) {
    for (var i=0; i < interferences.length; i++) {
        var intf = interferences[i]
        
        if (intf.name == this.name) {
            var dx = intf.x - x
            var dy = intf.y - y
            var d2 = dx * dx + dy * dy
            
            if (d2 < intf.r2) {
                return false
            }
        }
    }
    
    var pkt = {x: x, y: y, msg: msg, msgNum: this.msgNum++}
    this.pendingMsgNums[pkt.msgNum] = true
    this.queue.push(pkt)
    
    return pkt.msgNum
}

MessageQueue.prototype.peek = function() {
    if (this.queue.length > 0) {
        return this.queue[0]
    }
}

MessageQueue.prototype.tick = function() {
    if (this.queue.length > 0) {
        this.lastTransmittedMsg = this.queue[0].msgNum
        delete this.pendingMsgNums[this.lastTransmittedMsg]
        this.queue.splice(0, 1)
    }
    //console.log(this.name, '->', this.lastTransmittedMsg)
}

MessageQueue.prototype.pktOk = function(num) {
    return (num in this.pendingMsgNums) || (num == this.lastTransmittedMsg)
}

function createInterference(name, x, y, radius, ttl) {
    interferences.push({
        name: name,
        x: x,
        y: y,
        r2: radius * radius,
        ttl: ttl
    })
}

function findChannel(name, createIfNotFound) {
    if (name in channels) {
        return channels[name]
    } else if (createIfNotFound) {
        return new MessageQueue(name)
    }
}

function peekChannels(x, y) {
    var peekedChannels = []
    
    for (x in channels) {
        if (channels.hasOwnProperty(x)) {
            var channel = channels[x]
            
            for (var j=0; j < channel.queue.length; j++) {
                var pkt = channel.queue[j]
                
                var dx = pkt.x - x
                var dy = pkt.y - y
                var d2 = dx * dx + dy * dy
                var msglen = JSON.stringify(pkt.msg)
                
                if (d2 <= msglen * msglen) {
                    peekedChannels.push(channel.name)
                    break
                }
            }
        }
    }
    
    return peekedChannels
}

function tick() {
    for (x in channels) {
        if (channels.hasOwnProperty(x)) {
            channels[x].tick()
        }
    }
}

module.exports = {
    findChannel: findChannel,
    peekChannels: peekChannels,
    MessageQueue: MessageQueue,
    createInterference: createInterference,
    tick: tick
}