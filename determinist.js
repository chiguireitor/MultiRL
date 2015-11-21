/*
 * determinist.js - Determinist random functions
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
 * Copyright (c) 2015 John Villar
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
var crypto = require('crypto')
var hashAlgo = 'sha512'
var hashBytes = 64
var session

function IdRandomizer(id) {
	if (!id) {
		id = session.randomId()
	} if (Buffer.isBuffer(id)) {
        id = id.toString('hex')
    }
	this.id = id
	this.hash = new crypto.createHash(hashAlgo)
	 
	this.hash.update(id)
	this.randBuffer = this.hash.digest()
    
    if (this.randBuffer.length != hashBytes) {
        throw "Hash length different as expected " + this.randBuffer.length
    }
    
	this.availableBytes = hashBytes
	this.curOffset = 0
    this.reserved = {}
}
 
IdRandomizer.prototype.getBytes = function(n) {
	if (this.availableBytes < n) {
		this.hash = new crypto.createHash(hashAlgo)
		this.hash.update(this.randBuffer)

		this.randBuffer = Buffer.concat([this.randBuffer.slice(this.curOffset), this.hash.digest()])
        
		this.availableBytes += hashBytes
		this.curOffset = 0
	}
	
	var res = this.randBuffer.slice(this.curOffset, this.curOffset + n)
	this.curOffset += n
	this.availableBytes -= n
	
	return res
}

IdRandomizer.prototype.nextInt32 = function() {
    return this.getBytes(4).readUInt32LE(0)
}
 
IdRandomizer.prototype.random = function() {
	return (this.nextInt32() * 1.0)/0xFFFFFFFF
}

IdRandomizer.prototype.eventOccurs = function(treshold) {
	return treshold > ((this.nextInt32() * 1.0)/0xFFFFFFFF)
}

IdRandomizer.prototype.randomInt = function(a, b) {
    var udef_a = typeof(a) == "undefined"
    var udef_b = typeof(b) == "undefined"
    
    if (udef_a && udef_b) {
        return this.nextInt32()
    } else {
        return this.randomIntRange(a, b)
    }
}

IdRandomizer.prototype.pickRandom = function(lst) {
    return lst[this.randomInt(0, lst.length)]
}

IdRandomizer.prototype.randomIntRange = function(a, b) {
    if (typeof(b) == "undefined") {
        b = a
        a = 0
    }
    
	var d = b-a
	return (this.nextInt32() % d) + a
}
 
IdRandomizer.prototype.randomId = function() {
	return this.getBytes(8).toString('hex')
}
 
IdRandomizer.prototype.clone = function() {
	var newIR = new IdRandomizer(this.id)
	
	newIR.randBuffer = this.randBuffer.slice()
	newIR.availableBytes = this.availableBytes
	newIR.curOffset = this.curOffset
	
	return newIR
}

IdRandomizer.prototype.child = function(name) {
    if (!name) {
        var newIR = new IdRandomizer(this.getBytes(8))
        
        return newIR
    } else {
        if (!(name in this.reserved)) {
            this.reserved[name] = this.child()
        }
        
        return this.reserved[name]
    }
}

IdRandomizer.prototype.reserve = function(names) {
    for (var i=0; i < names.length; i++) {
        this.reserved[names[i]] = this.child()
    }
}

function newSession(id) {
	if (id) {
		session = new IdRandomizer(id)
	} else {
		id = crypto.randomBytes(8)
		session = new IdRandomizer(id)
	}
	
	return id
}

function getSessionId() {
	return session.id.toString('hex')
}

newSession()
 
module.exports = {
	IdRandomizer: IdRandomizer,
	newSession: newSession,
	getSessionId: getSessionId
}