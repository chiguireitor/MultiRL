/*
 * FSM.js - Ganymede Gate Finite-State-Machine implementation
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

var fs = require('fs')
var xml2js = require('xml2js')
var jsep = require("jsep")

function FSM() {
    this.states = {}
    this.variables = {}
    this.currentState = undefined
}

FSM.prototype.newState = function(name) {
    this.states[name] = {
        name: name,
        onEnterObservers: [],
        onExitObservers: [],
        outgoingLinks: {},
        processFn: undefined
    }
}

FSM.prototype.setStateProcFn = function(name, fn) {
    this.states[name].processFn = fn
}

FSM.prototype.setStateProcessors = function(procs) {
    for (x in procs) {
        if (procs.hasOwnProperty(x)) {
            this.states[x].processFn = procs[x]
        }
    }
}

FSM.prototype.newVariable = function(name, value) {
    this.variables[name] = value
}

FSM.prototype.getVariable = function(name) {
    return this.variables[name]
}

FSM.prototype.linkStates = function(origin, destination, func, params) {
    var state = this.states[origin]
    var dirState = this.states[destination]
    
    if ((typeof(state) !== "undefined")&&(typeof(dirState) !== "undefined")) {
        state.outgoingLinks[destination] = function() {
            return { 
                "condition": func(this.variables, params),
                "go": function () {
                    for (var i=0; i < this.currentState.onExitObservers.length; i++) {
                        this.currentState.onExitObservers[i](this.currentState, this.variables, params)
                    }
                    
                    this.currentState = dirState
                    
                    for (var i=0; i < this.currentState.onEnterObservers.length; i++) {
                        this.currentState.onEnterObservers[i](this.currentState, this.variables, params)
                    }
                }
            }
        }
    }
}

FSM.prototype.enterState = function(name, func) {
    var state = this.states[name]
    
    if (typeof(state) !== "undefined") {
        state.onEnterObservers.push(func)
    }
}

FSM.prototype.exitState = function(name, func) {
    var state = this.states[name]
    
    if (typeof(state) !== "undefined") {
        state.onExitObservers.push(func)
    }
}

FSM.prototype.cloneVars = function(replacements) {
    var vars = {}
    
    if (typeof(replacements) === "undefined") {
        replacements = {}
    }
    
    for (x in this.variables) {
        if (this.variables.hasOwnProperty(x)) {
            if (x in replacements) {
                vars[x] = replacements[x]
            } else {
                vars[x] = this.variables[x]
            }
        }
    }
    
    for (x in replacements) {
        if (replacements.hasOwnProperty(x)) {
            if (!(x in this.variables)) {
                vars[x] = replacements[x]
            }
        }
    }
    
    return {
        currentState: this.currentState,
        variables: vars
    }
}

FSM.prototype.process = function(tmpVars) {
    
    var tmp
    if (typeof(tmpVars) !== "undefined") {
        tmp = {
            currentState: this.currentState,
            variables: this.variables
        }
        
        this.currentState = tmpVars.currentState
        this.variables = tmpVars.variables
    }
    
    if (typeof(this.currentState) === "undefined") {
        this.currentState = this.states.start // "start" is the default name for the first state
    }
    
    var ret
    if (typeof(this.currentState.processFn) !== "undefined") {
        ret = this.currentState.processFn(this.variables)
    }
    
    var exitConditions = []
    var addCondition = function(cond, name) {
        var i = 0
        
        if (isNaN(cond.condition)) {
            return
        }
        
        while (i < exitConditions.length) {
            if (exitConditions[i].condition < cond.condition) {
                break
            }
            i++
        }
        
        exitConditions = exitConditions.slice(0, i).concat([cond]).concat(exitConditions.slice(i))
    }
    
    for (ol in this.currentState.outgoingLinks) {
        if (this.currentState.outgoingLinks.hasOwnProperty(ol)) {
            var cond = this.currentState.outgoingLinks[ol].call(this)
            if (typeof(cond) !== "undefined") {
                addCondition(cond, ol)
            }
        }
    }
    
    if ((exitConditions.length > 0) && (exitConditions[0].condition > 0)) {
        // Positive exit condition, execute it
        exitConditions[0].go.call(this)
    }
    
    if (typeof(tmpVars) !== "undefined") {
        tmpVars.currentState = this.currentState
        
        this.currentState = tmp.currentState
        this.variables = tmp.variables
    }
    
    return ret
}

function evaluate(evalExpr, vars) {
    if (evalExpr.type === 'BinaryExpression') {
        var lft = evaluate(evalExpr.left, vars)
        var rgt = evaluate(evalExpr.right, vars)
        
        if (evalExpr.operator === '==') {
            return lft == rgt
        } else if (evalExpr.operator === '>=') {
            return lft >= rgt
        } else if (evalExpr.operator === '<=') {
            return lft <= rgt
        } else if (evalExpr.operator === '>') {
            return lft > rgt
        } else if (evalExpr.operator === '<') {
            return lft < rgt
        } else if (evalExpr.operator === '!=') {
            return lft != rgt
        } else if (evalExpr.operator === '+') {
            return lft + rgt
        } else if (evalExpr.operator === '-') {
            return lft - rgt
        } else if (evalExpr.operator === '*') {
            return lft * rgt
        } else if (evalExpr.operator === '/') {
            return lft / rgt
        } else if (evalExpr.operator === '%') {
            return lft % rgt
        } else if (evalExpr.operator === '|') {
            return lft | rgt
        } else if (evalExpr.operator === '&') {
            return lft & rgt
        } else if (evalExpr.operator === '^') {
            return lft ^ rgt
        } else if (evalExpr.operator === '===') {
            return lft === rgt
        } else if (evalExpr.operator === '!==') {
            return lft !== rgt
        } else if (evalExpr.operator === '>>') {
            return lft >> rgt
        } else if (evalExpr.operator === '<<') {
            return lft << rgt
        } else if (evalExpr.operator === '>>>') {
            return lft >>> rgt
        }
    } else if (evalExpr.type === 'LogicalExpression') {
        var lft = evaluate(evalExpr.left, vars)
        var rgt = evaluate(evalExpr.right, vars)
        
        if (evalExpr.operator === '||') {
            return lft || rgt
        } else if (evalExpr.operator === '&&') {
            return lft && rgt
        }
    } else if (evalExpr.type === 'UnaryExpression') {
        var argument = evaluate(evalExpr.argument, vars)
        
        if (evalExpr.operator === '!') {
            return !argument
        } else if (evalExpr.operator === '~') {
            return ~argument
        } else if (evalExpr.operator === '-') {
            return -argument
        } else if (evalExpr.operator === '+') {
            return +argument
        }
    } else if (evalExpr.type === 'CallExpression') {
        var callee = evaluate(evalExpr.callee, vars)
        
        return callee.apply(vars, evalExpr.arguments.map(function(x) { return evaluate(x, vars) } ))
    } else if (evalExpr.type === 'Identifier') {
        return vars[evalExpr.name]
    } else if (evalExpr.type === 'Literal') {
        return evalExpr.value
    } else if (evalExpr.type === 'ConditionalExpression') {
        var tst = evaluate(evalExpr.test, vars)
        
        if (tst) {
            return evaluate(evalExpr.consequent, vars)
        } else {
            return evaluate(evalExpr.alternate, vars)
        }
    } else if (evalExpr.type === 'MemberExpression') {
        var obj = evaluate(evalExpr.object)
        if (evalExpr.computed) {
            return obj[evaluate(evalExpr.property, vars)]
        } else {
            if (evalExpr.property.type == 'Literal') {
                return obj[evalExpr.property.value]
            } else if (evalExpr.property.type == 'Identifier') {
                return obj[evalExpr.property.name]
            }
        }
    } else if (evalExpr.type === 'ThisExpression') {
        return this
    }
}

function extractIdentifiers(tree) {
    var extractQueue = [tree]
    var idents = []
    
    while (extractQueue.length > 0) {
        var elem = extractQueue[0]
        extractQueue = extractQueue.slice(1)
        
        if (elem.type === 'Identifier') {
            if (idents.indexOf(elem.name) < 0) {
                idents.push(elem.name)
            }
        } else {
            for (x in elem) {
                if (elem.hasOwnProperty(x) && (typeof(elem[x]) == 'object')) {
                    extractQueue.push(elem[x])
                }
            }
        }
    }
    
    return idents
}

function loadStateMachine(filename, params, cback) {
    var e = new FSM()
    
    fs.readFile(filename, 'utf8', function(err,data){
        var parseString = xml2js.parseString
        var doc = parseString('<fsm>' + data + '</fsm>', function(err, res) {
            if (!err) {
                var states = res.fsm.state
                var transitions = res.fsm.transition
                
                states.map(function(x) {
                    e.newState(x.attributes[0].name[0].value[0]._.trim())
                })
                
                var accumIdents = []
                transitions.map(function(x){
                    var weight = 1
                    
                    var uatts = x.attributes[0].equation[0].useratts[0]._
                    if (typeof(uatts) !== "undefined") {
                        weight = parseFloat(uatts.trim())
                    }

                    var fn = (function(equation, w) {
                            var evalExpr = jsep(equation)
                            
                            extractIdentifiers(evalExpr).map(function(x){
                                if (accumIdents.indexOf(x) < 0) {
                                    accumIdents.push(x)
                                }
                            })
                            return function(vars, prms) {
                                    var tmpVars = {}
                                    for (x in vars) {
                                        if (vars.hasOwnProperty(x)) {
                                            tmpVars[x] = vars[x]
                                        }
                                    }
                                    
                                    if (typeof(prms) !== "undefined") {
                                        for (x in prms) {
                                            if (prms.hasOwnProperty(x)) {
                                                tmpVars[x] = prms[x]
                                            }
                                        }
                                    }
                                    
                                    return evaluate(evalExpr, tmpVars) * w
                                }
                        })(x.attributes[0].equation[0].value[0]._.trim(), weight)
                    
                    e.linkStates(x.startState[0].trim(), x.endState[0].trim(), fn, params)
                })
                
                accumIdents.map(function(x) { e.newVariable(x, false) })
            } else {
                throw err
            }
            
            if (cback) {
                cback()
            }
        })
    })
    
    return e
}

module.exports = {
    FSM: FSM,
    loadStateMachine: loadStateMachine
}