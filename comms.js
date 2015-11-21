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
    this.numTicks = 0
    this.amntTicksPop = 1
    this.callbacks = []
    this.lastTxd = false
    
    channels[name] = this
}

MessageQueue.prototype.transmit = function(agent, x, y, msg) {
    // Check that there's not a duplicate message
    /*for (var i=0; i < this.queue.length; i++) {
        var opkg = this.queue[i]
        
        if (opkg.agent == agent) {
            for (p in msg) {
                if (msg.hasOwnProperty(p) && opkg.msg.hasOwnProperty(p)) {
                    return false
                }
            }
        }
    }*/
    
    // Now check if the message is being txd on an intereference zone
    for (var i=0; i < interferences.length; i++) {
        var intf = interferences[i]
        
        if ((typeof(intf.name) === "undefined") || (intf.name == this.name)) {
            var dx = intf.x - x
            var dy = intf.y - y
            var d2 = dx * dx + dy * dy
            
            if (d2 < intf.r2) {
                return false
            }
        }
    }

    // Everything seems ok, transmit the packet
    var pkt = {x: x, y: y, msg: msg, msgNum: this.msgNum++/*, agent: agent*/}
    this.pendingMsgNums[pkt.msgNum] = true
    this.queue.push(pkt)
    
    return pkt.msgNum
}
    
MessageQueue.prototype._priv_transmit = function(pkt) {
    for (var i=0; i < this.callbacks.length; i++) {
        var cb = this.callbacks[i]
        cb.callback.call(cb.callbackContext, pkt)
    }
}

MessageQueue.prototype.peek = function() {
    /*if (this.queue.length > 0) {
        return this.queue[0]
    }*/
    return this.lastTxd
}

MessageQueue.prototype.tick = function() {
    
    /*for (agent in this.rateLimit) {
        if (this.rateLimit.hasOwnProperty(agent)) {
            this.rateLimit[agent]--
            
            if (this.rateLimit[agent] <= 0) {
                delete this.rateLimit[agent]
            }
        }
    }*/
    
    if (this.numTicks >= this.amntTicksPop) {
        this.numTicks = 0
        if (this.queue.length > 0) {
            this.lastTransmittedMsg = this.queue[0].msgNum
            delete this.pendingMsgNums[this.lastTransmittedMsg]
            this.lastTxd = this.queue.shift()
            this._priv_transmit(this.lastTxd)
        }
    } else {
        this.numTicks++
    }
}

MessageQueue.prototype.pktOk = function(num) {
    return (num in this.pendingMsgNums) || (num == this.lastTransmittedMsg)
}

MessageQueue.prototype.registerCallback = function(callback) {
    this.callbacks.push(callback)
}

function createInterference(x, y, radius, ttl, name) {
    interferences.push({
        name: name,
        x: x,
        y: y,
        r2: radius * radius,
        ttl: ttl
    })
}

function findChannel(name, createIfNotFound, callback) {
    var ret
    if (name in channels) {
        ret = channels[name]
    } else if (createIfNotFound) {
        ret = new MessageQueue(name)
    }
    
    ret.registerCallback(callback)
    
    return ret
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
                var msglen = JSON.stringify(pkt.msg).length/4
                
                if (d2 <= (msglen * msglen)) {
                    peekedChannels.push(channel.name)
                    break
                }
            }
        }
    }
    
    return peekedChannels
}

MessageQueue.prototype.collectMessages = function(x, y, radius) {
    var msgs = []
    var r2 = radius * radius
    
    for (var i=0; i < this.queue.length; i++) {
        var msg = this.queue[i]
        var dx = msg.x - x
        var dy = msg.y - y
        
        if ((dx * dx + dy * dy) <= r2) {
            msgs.push(msg)
        }
    }
    
    return msgs
}

function tick() {
    for (x in channels) {
        if (channels.hasOwnProperty(x)) {
            channels[x].tick()
        }
    }
    
    var i = 0
    while (i < interferences.length) {
        interferences[i].ttl--
        if (interferences[i].ttl <= 0) {
            interferences.splice(i, 1)
        } else {
            i++
        }
    }
}

function collectAllMessages(x, y, radius) {
    var msgs = []
    for (n in channels) {
        if (channels.hasOwnProperty(n)) {
            var ms = channels[n].collectMessages(x, y, radius)
            msgs = msgs.concat(ms)
        }
    }
    
    return msgs
}

module.exports = {
    findChannel: findChannel,
    peekChannels: peekChannels,
    MessageQueue: MessageQueue,
    createInterference: createInterference,
    tick: tick,
    collectAllMessages: collectAllMessages
}