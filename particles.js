/*
 * particles.js - Particle system for Ganymede Gate
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
var gameDefs = require('./conf/gamedefs.js')

function Manager(w, h) {
    this.w = w
    this.h = h
    this.particles = []
}

// Taken from http://jsperf.com/circle-line-collisions
function testCP(circleX,circleY,radius,lineX1,lineY1,lineX2,lineY2,returnPoints) {
    //modified from: http://stackoverflow.com/questions/1073336/circle-line-collision-detection
    var dlineX2lineX1 = (lineX2-lineX1);
    var dlineY2lineY1 = (lineY2-lineY1);
    var LAB = Math.sqrt( dlineX2lineX1*dlineX2lineX1+dlineY2lineY1*dlineY2lineY1 );

    var Dx = (lineX2-lineX1)/LAB;
    var Dy = (lineY2-lineY1)/LAB;

    var t = Dx*(circleX-lineX1) + Dy*(circleY-lineY1);

    var Ex = t*Dx+lineX1;
    var Ey = t*Dy+lineY1;

    //check to see if Ex is on the line
    if ((lineX2>lineX1 && Ex>=lineX1 && Ex<=lineX2) || (lineX2<lineX1 && Ex>=lineX2 && Ex<=lineX1)) {
            if ((lineY2>lineY1 && Ey>=lineY1 && Ey<=lineY2) || (lineY2<lineY1 && Ey>=lineY2 && Ey<=lineY1)) {
                    //on segment
            }
            else {return returnPoints?-1:false;}
    }
    else {return returnPoints?-1:false;}

    var dEycircleY = (Ey-circleY);
    var LEC = Math.sqrt( (Ex-circleX)+dEycircleY*dEycircleY );

    if( LEC < radius ) {
            if (returnPoints) {
                var dt = Math.sqrt( radius*radius - LEC*LEC);

                var Fx = (t-dt)*Dx + lineX1;
                var Fy = (t-dt)*Dy + lineY1;

                var Gx = (t+dt)*Dx + lineX1;
                var Gy = (t+dt)*Dy + lineY1;

                return [Fx,Fy,Gx,Gy];
            }
            else {return true;}
    }

    else if( LEC == radius ) {
            return returnPoints?1:true;
    }

    else {
            return returnPoints?-1:false;
    }
}

Manager.prototype.getParticlesInScope = function(x, y, fov, label) {
    var ret = []
    var fov2 = fov*fov
    for (var i=0; i < this.particles.length; i++) {
        var part = this.particles[i]
        
        if (testCP(x, y, fov, part.ox, part.oy, part.dx, part.dy, false)) {
            ret.push({
                ox: part.ox,
                oy: part.oy,
                dx: part.dx,
                dy: part.dy,
                ttl: part.ttl * Math.max(gameDefs.continuousThresholdMillis, 100),
                trail: part.trail || false,
                pix: asciiMapping[part.pix],
                cssClass: part.cssClass,
                movType: part.movType,
                delay: part.delay
            })
        }
    }
    
    return ret
}

Manager.prototype.spawnParticle = function(ox, oy, dx, dy, ttl, pix, cssClass, movType, ondie, delay, trail) {
    this.particles.push({
        ox: ox,
        oy: oy,
        dx: dx,
        dy: dy,
        ttl: ttl,
        trail: trail,
        pix: pix,
        movType: movType,
        cssClass: cssClass,
        ondie: ondie,
        delay: delay
    })
}

Manager.prototype.processTurn = function() {
    var i = 0
    while (i < this.particles.length) {
        var part = this.particles[i]
        part.ttl--
        if (part.ttl <= 0) {
            if (this.ondie) {
                this.ondie(part)
            }
            this.particles.splice(i, 1)
        } else {
            i++
        }
    }
}

var globalParticleManager
function singleton(w, h) {
    if (!globalParticleManager) {
        if (!(w && h)) {
            throw "First instance of particle manager singleton without level sizes!"
        }
        globalParticleManager = new Manager(w, h)
    }
    return globalParticleManager
}

module.exports = {
    Manager: Manager,
    Singleton: singleton
}