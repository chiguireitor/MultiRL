/*
 * ASCIITerminal.js - Javascript canvas renderer for bitmap font buffers
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
 
function ASCIITerminal(options) {
    if (!options) {
        throw "ASCIITerminal needs an options object as first parameter"
    }
    
    if (!options.font) {
        throw "ASCIITerminal needs a font image"
    }
    
    if (!options.target) {
        throw "ASCIITerminal needs a target to insert the canvas"
    }
    
    this.events = {
        ready: [],
        mousemove: [],
        click: []
    }
    
    var img = new Image()
    img.onload = (function(terminal) {
        return function() {
            terminal.font = this
            this.fw = this.width / 16
            this.fh = this.height / 16
            
            var cnv = document.createElement("canvas")
            var cw, ch
            if (options.console) {
                cw = options.console.width || 80
                ch = options.console.height || 40
            } else {
                cw = 80
                ch = 40
            }
            terminal.console = {}
            terminal.console.width = cw
            terminal.console.height = ch
            terminal.console.numchars = cw * ch
            
            terminal.console.pxWidth = this.fw * cw
            terminal.console.pxHeight = this.fh * ch
            
            cnv.width = terminal.console.pxWidth * (options.consoleScale || 1)
            cnv.height = terminal.console.pxHeight *  (options.consoleScale || 1)
            terminal.canvas = cnv
            
            if (!(options.forceCanvas || false)) {
                terminal.gl = cnv.getContext("experimental-webgl")
            }
            
            if (!terminal.gl) {
                terminal.ctx = cnv.getContext("2d")
                terminal.bgcolor = Array(cw * ch)
                terminal.fgcolor = Array(cw * ch)
                terminal.character = Array(cw * ch)
                terminal.texw = terminal.console.width
            } else {
                terminal.gl.viewportWidth = terminal.console.pxWidth
                terminal.gl.viewportHeight = terminal.console.pxHeight
                ASCIITerminal.util.initGl(terminal, cw, ch, this.fw, this.fh, options.use2xsai || false)
                terminal.gl.fontTexture = ASCIITerminal.util.createTexture(terminal.gl, this)

                var texw = Math.pow(2, Math.ceil(Math.log2(cw)))
                var texh = Math.pow(2, Math.ceil(Math.log2(ch)))
                
                terminal.texw = texw
                
                terminal.gl.texw = texw
                terminal.gl.texh = texh
                
                terminal.console.numchars = texw * texh
                
                terminal.gl.glyphTextureData = new Uint8Array(texw * texh * 3)
                terminal.gl.foreTextureData = new Uint8Array(texw * texh * 3)
                terminal.gl.backTextureData = new Uint8Array(texw * texh * 3)
                
                terminal.gl.glyphTexture = ASCIITerminal.util.createEmptyRGBTexture(terminal.gl, texw, texh, terminal.gl.glyphTextureData)
                terminal.gl.foreTexture = ASCIITerminal.util.createEmptyRGBTexture(terminal.gl, texw, texh, terminal.gl.foreTextureData)
                terminal.gl.backTexture = ASCIITerminal.util.createEmptyRGBTexture(terminal.gl, texw, texh, terminal.gl.backTextureData)
            }
            document.getElementById(options.target).appendChild(cnv)
            
            cnv.onmousemove = (function(term) {
                return function(evt) {
                    var event = window.event || evt
                    var px = Math.floor(event.offsetX / (term.font.fw * options.consoleScale))
                    var py = Math.floor(event.offsetY / (term.font.fh * options.consoleScale))
                    
                    for (var i=0; i < term.events.mousemove.length; i++) {
                        term.events.mousemove[i].call(term, px, py)
                    }
                }
            })(terminal)
            
            cnv.onclick = (function(term) {
                return function(evt) {
                    var event = window.event || evt
                    var px = Math.floor(event.offsetX / (term.font.fw * options.consoleScale))
                    var py = Math.floor(event.offsetY / (term.font.fh * options.consoleScale))
                    
                    for (var i=0; i < term.events.click.length; i++) {
                        term.events.click[i].call(term, px, py)
                    }
                }
            })(terminal)
            
            for (var i=0; i < terminal.events.ready.length; i++) {
                var fn = terminal.events.ready[i]
                
                fn.call(terminal)
            }
        }
    })(this)
    img.src = options.font
}

ASCIITerminal.prototype.on = function(evt, fn) {
    if (evt == "mousemove") {
        this.events.mousemove.push(fn)
    } else if (evt == "click") {
        this.events.click.push(fn)
    } else if (evt == "ready") {
        this.events.ready.push(fn)
    }
}

ASCIITerminal.prototype._sub_render_ = function(op, arr, fn) {
    this.ctx.globalCompositeOperation = op
    var x = 0
    var y = 0
    var fx = 0
    var fy = 0
    for (var i=0; i < arr.length; i++) {
        var itm = arr[i]
        
        if (itm) {
            fn.call(this, itm, fx, fy)
        }
        
        fx += this.font.fw
        x++
        if (x >= this.console.width) {
            x = 0
            y++
            fx = 0
            fy += this.font.fh
        }
    }
}

function min2Digits(a) {
    if (a.length == 1) {
        return "0" + a
    } else {
        return a
    }
}

function colToStyle(c) {
    if (c instanceof Array) {
        return '#' + min2Digits(c[0].toString(16))+
            min2Digits(c[0].toString(16))+
            min2Digits(c[0].toString(16))
    } else {
        return c
    }
}

ASCIITerminal.prototype.render_canvas = function() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this._sub_render_("source-over", this.fgcolor, function(col, fx, fy) {
        this.ctx.fillStyle = colToStyle(col)
        this.ctx.fillRect(fx, fy, this.font.fw, this.font.fh)
    })

    this._sub_render_("xor", this.character, function(n, fx, fy) {
        var cx = (n & 0x0F) * this.font.fw
        var cy = ((n & 0xF0) >> 4) * this.font.fh
        
        this.ctx.drawImage(this.font, cx, cy, this.font.fw, this.font.fh, fx, fy, this.font.fw, this.font.fh)
    })
    
    this._sub_render_("destination-over", this.bgcolor, function(col, fx, fy) {
        this.ctx.fillStyle = colToStyle(col)
        this.ctx.fillRect(fx, fy, this.font.fw, this.font.fh)
    })
}

ASCIITerminal.prototype.update_textures = function() {
    var cw = this.gl.texw //this.console.width
    var ch = this.gl.texh //this.console.height
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gl.glyphTexture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, cw, ch, 0, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.gl.glyphTextureData);
    //this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, cw, ch, 0, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, this.gl.glyphTextureData);
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gl.foreTexture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, cw, ch, 0, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.gl.foreTextureData);
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gl.backTexture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, cw, ch, 0, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.gl.backTextureData);
}

ASCIITerminal.prototype.render_gl = function(damage) {
    this.update_textures()
    
    // Bind the rtt framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.gl.rttFramebuffer)
    
    this.gl.useProgram(this.gl.shaderProgram)
    
    this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)

    mat4.ortho(this.gl.pMatrix, -1, 1, -1, 1, -1, 1)

    mat4.identity(this.gl.mvMatrix)

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.squareVertexPositionBuffer)
    this.gl.vertexAttribPointer(this.gl.shaderProgram.vertexPositionAttribute, this.gl.squareVertexPositionBuffer.itemSize, this.gl.FLOAT, false, 0, 0)
    
    this.gl.uniformMatrix4fv(this.gl.shaderProgram.pMatrixUniform, false, this.gl.pMatrix)
    this.gl.uniformMatrix4fv(this.gl.shaderProgram.mvMatrixUniform, false, this.gl.mvMatrix)
    this.gl.uniform2fv(this.gl.shaderProgram.fontSize, this.gl.fontSize)
    
    this.gl.uniform1f(this.gl.shaderProgram.damageRadius, damage)
    
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gl.fontTexture)
    this.gl.activeTexture(this.gl.TEXTURE1)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gl.glyphTexture)
    this.gl.activeTexture(this.gl.TEXTURE2)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gl.foreTexture)
    this.gl.activeTexture(this.gl.TEXTURE3)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gl.backTexture)
    
    this.gl.uniform1i(this.gl.shaderProgram.uFont, 0)
    this.gl.uniform1i(this.gl.shaderProgram.uGlyphs, 1)
    this.gl.uniform1i(this.gl.shaderProgram.uForeground, 2)
    this.gl.uniform1i(this.gl.shaderProgram.uBackground, 3)
    this.gl.uniform1f(this.gl.shaderProgram.uWidthDistort, this.console.widthDistort)
    this.gl.uniform1f(this.gl.shaderProgram.uConsoleCharWidth, this.console.width)
    
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.gl.squareVertexPositionBuffer.numItems)
    
    // Unbind the rtt framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    
    this.gl.useProgram(this.gl.rttShaderProgram)
    
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gl.rttTexture)
    
    this.gl.uniform1i(this.gl.rttShaderProgram.uTexture, 0)
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.rttSquareVertexPositionBuffer)
    this.gl.vertexAttribPointer(this.gl.rttShaderProgram.vertexPositionAttribute, this.gl.rttSquareVertexPositionBuffer.itemSize, this.gl.FLOAT, false, 0, 0)
    this.gl.uniform1f(this.gl.rttShaderProgram.uViewportWidth, this.canvas.width)
    this.gl.uniform1f(this.gl.rttShaderProgram.uViewportHeight, this.canvas.height)
    this.gl.uniform1f(this.gl.rttShaderProgram.uWidthDistort, this.console.widthDistort)
    
    this.gl.uniformMatrix4fv(this.gl.rttShaderProgram.pMatrixUniform, false, this.gl.pMatrix)
    this.gl.uniformMatrix4fv(this.gl.rttShaderProgram.mvMatrixUniform, false, this.gl.mvMatrix)
    
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.gl.rttSquareVertexPositionBuffer.numItems)
}

ASCIITerminal.prototype.render = function(damage) {
    if (this.gl) {
        this.render_gl(damage)
    } else {
        this.render_canvas()
    }
}

ASCIITerminal.prototype.ready = function(fn) {
    this.on("ready", fn)
}

function hexToColor(h) {
    if (Array.isArray(h)) {
        return (h[0] << 16) | (h[1] << 8) | (h[2])
    }
    
    if (h.length <= 4) {
        if (h[0] == "#") {
            h = h.slice(1)
        }
        
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    }
    
    if (h[0] == "#") {
        return parseInt(h.slice(1), 16)
    } else {
        return parseInt(h, 16)
    }
}

ASCIITerminal.prototype.setPixel = function(x, y, glyph, fgcol, bgcol) {
    var p = x + y * this.texw //this.gl.texw // this.console.width
    
    if (!((p >= 0) && (p < this.console.numchars))) {
        //throw "Invalid position on ASCIITerminal: (" + x + ", " + y + ")"
        return
    }
    
    if (this.gl) {
        // This fills the buffers for the WebGL path
        p = p * 3
        
        // Decompose the glyph data into two channels to account for
        // low precision texture data on some devices
        this.gl.glyphTextureData[p] = glyph & 0x0000000F
        this.gl.glyphTextureData[p + 1] = (glyph & 0x000000F0) >> 4
        
        if (fgcol) {
            fgcol = hexToColor(fgcol)
            this.gl.foreTextureData[p] = ((fgcol & 0x00FF0000) >> 16) & 0xFF
            this.gl.foreTextureData[p + 1] = ((fgcol & 0x0000FF00) >> 8) & 0xFF
            this.gl.foreTextureData[p + 2] = ((fgcol & 0x000000FF)) & 0xFF
        } else if (glyph) {
            this.gl.foreTextureData[p] = 255
            this.gl.foreTextureData[p + 1] = 255
            this.gl.foreTextureData[p + 2] = 255
        }

        if (bgcol) {
            bgcol = hexToColor(bgcol)
            this.gl.backTextureData[p] = (bgcol & 0x00FF0000) >> 16
            this.gl.backTextureData[p + 1] = (bgcol & 0x0000FF00) >> 8
            this.gl.backTextureData[p + 2] = (bgcol & 0x000000FF)
        } else {
            this.gl.backTextureData[p] = 0
            this.gl.backTextureData[p + 1] = 0
            this.gl.backTextureData[p + 2] = 0
        }
    } else {
        // This fills the arrays for the canvas path
        this.character[p] = glyph
        
        if (glyph) {
            this.fgcolor[p] = fgcol || [255, 255, 255]
        } else {
            this.fgcolor[p] = undefined
        }
        
        this.bgcolor[p] = bgcol
    }
}

ASCIITerminal.prototype.setPixelBg = function(x, y, bgcol) {
    var p = x + y * this.texw //this.gl.texw // this.console.width
    
    if (!((p >= 0) && (p < this.console.numchars))) {
        return
    }
    
    if (this.gl) {
        // This fills the buffers for the WebGL path
        p = p * 3

        if (bgcol) {
            bgcol = hexToColor(bgcol)
            this.gl.backTextureData[p] = (bgcol & 0x00FF0000) >> 16
            this.gl.backTextureData[p + 1] = (bgcol & 0x0000FF00) >> 8
            this.gl.backTextureData[p + 2] = (bgcol & 0x000000FF)
        } else {
            this.gl.backTextureData[p] = 0
            this.gl.backTextureData[p + 1] = 0
            this.gl.backTextureData[p + 2] = 0
        }
    } else {
        // This fills the arrays for the canvas path
        this.bgcolor[p] = bgcol
    }
}


ASCIITerminal.prototype.clear = function(glyph, fgcol, bgcol) {
    if (this.gl) {
        for (var i=0; i < this.console.numchars; i++) {
            this.gl.glyphTextureData[i] = 0
            var p = i * 3
            this.gl.foreTextureData[p] = 0
            this.gl.foreTextureData[p + 1] = 0
            this.gl.foreTextureData[p + 2] = 0
            this.gl.backTextureData[p] = 0
            this.gl.backTextureData[p + 1] = 0
            this.gl.backTextureData[p + 2] = 0
        }
    } else if (this.character) {
        for (var i=0; i < this.character.length; i++) {
            this.character[i] = glyph
            this.fgcolor[i] = fgcol
            this.bgcolor[i] = bgcol
        }
    }
}

function getShaderText(id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }
    
    return str
}

ASCIITerminal.util = {
    fragmentShaders: {
        "default": getShaderText("default-fs"),
        "rtt": getShaderText("rtt-fs"),
        "2xsai": getShaderText("rtt-2xsai-fs")
    },
    vertexShaders: {
        "default": getShaderText("default-vs")
    },
    compileShader: function(gl, name, type) {
        var shader
        var data
        type = type.toLowerCase()
        if (type == "fragment") {
            shader = gl.createShader(gl.FRAGMENT_SHADER)
            data = ASCIITerminal.util.fragmentShaders[name]
        } else if (type == "vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER)
            data = ASCIITerminal.util.vertexShaders[name]
        } else {
            return null
        }

        gl.shaderSource(shader, data)
        gl.compileShader(shader)

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.log(gl.getShaderInfoLog(shader))
            return null
        }

        return shader
    },
    initShaders: function(gl, use2xsai) {
        var fragmentShader = ASCIITerminal.util.compileShader(gl, "default", "fragment")
        var vertexShader = ASCIITerminal.util.compileShader(gl, "default", "vertex")

        var shaderProgram = gl.createProgram()
        gl.attachShader(shaderProgram, vertexShader)
        gl.attachShader(shaderProgram, fragmentShader)
        gl.linkProgram(shaderProgram)

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.log("Could not initialise shaders")
            return false
        }

        gl.useProgram(shaderProgram)

        shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition")
        gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute)

        shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix")
        shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix")
        
        shaderProgram.fontSize = gl.getUniformLocation(shaderProgram, "fontSize")
        shaderProgram.uGlyphs = gl.getUniformLocation(shaderProgram, "uGlyphs")
        shaderProgram.uForeground = gl.getUniformLocation(shaderProgram, "uForeground")
        shaderProgram.uBackground = gl.getUniformLocation(shaderProgram, "uBackground")
        shaderProgram.uFont = gl.getUniformLocation(shaderProgram, "uFont")
        shaderProgram.damageRadius = gl.getUniformLocation(shaderProgram, "damageRadius")
        shaderProgram.uWidthDistort = gl.getUniformLocation(shaderProgram, "uWidthDistort")
        shaderProgram.uConsoleCharWidth = gl.getUniformLocation(shaderProgram, "uConsoleCharWidth")
        
        var rttShaderProgram = gl.createProgram()
        var rttFragmentShader = ASCIITerminal.util.compileShader(gl, use2xsai?"2xsai":"rtt", "fragment")
        
        gl.attachShader(rttShaderProgram, vertexShader)
        gl.attachShader(rttShaderProgram, rttFragmentShader)
        gl.linkProgram(rttShaderProgram)
        
        if (!gl.getProgramParameter(rttShaderProgram, gl.LINK_STATUS)) {
            console.log("Could not initialise rtt shaders")
            return false
        }
        
        rttShaderProgram.vertexPositionAttribute = gl.getAttribLocation(rttShaderProgram, "aVertexPosition")
        gl.enableVertexAttribArray(rttShaderProgram.vertexPositionAttribute)

        rttShaderProgram.pMatrixUniform = gl.getUniformLocation(rttShaderProgram, "uPMatrix")
        rttShaderProgram.mvMatrixUniform = gl.getUniformLocation(rttShaderProgram, "uMVMatrix")
        
        rttShaderProgram.uTexture = gl.getUniformLocation(rttShaderProgram, "uTexture")
        
        rttShaderProgram.uViewportWidth = gl.getUniformLocation(rttShaderProgram, "uViewportWidth")
        rttShaderProgram.uViewportHeight = gl.getUniformLocation(rttShaderProgram, "uViewportHeight")
        rttShaderProgram.uWidthDistort = gl.getUniformLocation(rttShaderProgram, "uWidthDistort")
        
        return [shaderProgram, rttShaderProgram]
    },
    initGl: function(terminal, cw, ch, fw, fh, use2xsai) {
        var shps = ASCIITerminal.util.initShaders(terminal.gl, use2xsai)
        terminal.gl.shaderProgram = shps[0]
        terminal.gl.rttShaderProgram = shps[1]
        terminal.gl.mvMatrix = mat4.create()
        terminal.gl.pMatrix = mat4.create()
        terminal.gl.fontSize = vec2.fromValues(fw, fh)
        
        var rttFramebuffer = terminal.gl.createFramebuffer()
        terminal.gl.bindFramebuffer(terminal.gl.FRAMEBUFFER, rttFramebuffer)
        
        var rttw = Math.pow(2, Math.ceil(Math.log2(cw * fw)))
        var rtth = Math.pow(2, Math.ceil(Math.log2(ch * fh)))
        
        rttFramebuffer.width = rttw
        rttFramebuffer.height = rtth
        
        var rttTexture = terminal.gl.createTexture()
        terminal.gl.bindTexture(terminal.gl.TEXTURE_2D, rttTexture)
        terminal.gl.texParameteri(terminal.gl.TEXTURE_2D, terminal.gl.TEXTURE_MAG_FILTER, terminal.gl.NEAREST)
        terminal.gl.texParameteri(terminal.gl.TEXTURE_2D, terminal.gl.TEXTURE_MIN_FILTER, terminal.gl.NEAREST)
        //terminal.gl.generateMipmap(terminal.gl.TEXTURE_2D)
        
        terminal.gl.texImage2D(
            terminal.gl.TEXTURE_2D,
            0, 
            terminal.gl.RGBA, 
            rttFramebuffer.width,
            rttFramebuffer.height, 
            0,
            terminal.gl.RGBA,
            terminal.gl.UNSIGNED_BYTE,
            null)
        
        var rttRenderBuffer = terminal.gl.createRenderbuffer()
        terminal.gl.bindRenderbuffer(terminal.gl.RENDERBUFFER, rttRenderBuffer)
        terminal.gl.renderbufferStorage(
            terminal.gl.RENDERBUFFER, 
            terminal.gl.DEPTH_COMPONENT16, 
            rttFramebuffer.width, 
            rttFramebuffer.height)

        
        terminal.gl.rttFramebuffer = rttFramebuffer
        terminal.gl.rttTexture = rttTexture
        terminal.gl.rttRenderBuffer = rttRenderBuffer
        
        terminal.gl.framebufferTexture2D(
            terminal.gl.FRAMEBUFFER, 
            terminal.gl.COLOR_ATTACHMENT0, 
            terminal.gl.TEXTURE_2D, 
            rttTexture, 
            0)
        terminal.gl.framebufferRenderbuffer(
            terminal.gl.FRAMEBUFFER, 
            terminal.gl.DEPTH_ATTACHMENT, 
            terminal.gl.RENDERBUFFER, 
            rttRenderBuffer)
            
        terminal.gl.bindTexture(terminal.gl.TEXTURE_2D, null)
        terminal.gl.bindRenderbuffer(terminal.gl.RENDERBUFFER, null)
        terminal.gl.bindFramebuffer(terminal.gl.FRAMEBUFFER, null)

        
        terminal.gl.squareVertexPositionBuffer = terminal.gl.createBuffer()
        terminal.gl.bindBuffer(terminal.gl.ARRAY_BUFFER, terminal.gl.squareVertexPositionBuffer)
        var vertices = [
             1.0,  1.0,  0.0,
            -1.0,  1.0,  0.0,
             1.0, -1.0,  0.0,
            -1.0, -1.0,  0.0
        ]
        terminal.gl.bufferData(terminal.gl.ARRAY_BUFFER, new Float32Array(vertices), terminal.gl.STATIC_DRAW)
        terminal.gl.squareVertexPositionBuffer.itemSize = 3
        terminal.gl.squareVertexPositionBuffer.numItems = 4
        
        terminal.gl.rttSquareVertexPositionBuffer = terminal.gl.createBuffer()
        terminal.gl.bindBuffer(terminal.gl.ARRAY_BUFFER, terminal.gl.rttSquareVertexPositionBuffer)
        
        var cwfw = Math.pow(2, Math.ceil(Math.log2(cw*fw)))
        var ar = (cw * fw) / cwfw
        terminal.console.widthDistort = ar
        
        vertices = [
             1.0,  1.0,  0.0,
            -1.0,  1.0,  0.0,
             1.0, -1.0,  0.0,
            -1.0, -1.0,  0.0
        ]
        terminal.gl.bufferData(terminal.gl.ARRAY_BUFFER, new Float32Array(vertices), terminal.gl.STATIC_DRAW)
        terminal.gl.rttSquareVertexPositionBuffer.itemSize = 3
        terminal.gl.rttSquareVertexPositionBuffer.numItems = 4
        
        terminal.gl.clearColor(0.0, 0.0, 0.0, 1.0)
        terminal.gl.enable(terminal.gl.DEPTH_TEST)
        terminal.gl.disable(terminal.gl.CULL_FACE)
    },
    createTexture: function(gl, texture) {
        var tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.bindTexture(gl.TEXTURE_2D, null)
        return tex
    },
    createEmptyRGBTexture: function(gl, cw, ch, dataArray) {
        var tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, cw, ch, 0, gl.RGB, gl.UNSIGNED_BYTE, dataArray);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.bindTexture(gl.TEXTURE_2D, null)
        return tex
    },
    createEmptyLTexture: function(gl, cw, ch, dataArray) {
        var tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cw, ch, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, dataArray);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.bindTexture(gl.TEXTURE_2D, null)
        return tex
    }
}
