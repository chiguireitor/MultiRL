//var items = require('./items.js')
//console.log(items.generate('weapons/ranged/rifle', {score: 1000})) //, '1a236fb243b59037'))
//console.log(items.generate('ammo/9mm bullets', {score: 1000}))

var fsm = require('./FSM.js')

/*var e = new fsm.FSM()

e.newState('start')
e.newState('camina')
e.newState('caga')

e.newVariable('desespero', 0)
e.newVariable('desesperoMax', 10)
e.newVariable('nombre', 'pillo')

e.linkStates('start', 'camina', function(vars) {
    if (vars.desespero > vars.desesperoMax) {
        return 1
    } else {
        vars.desespero++
        return 0
    }
})

e.linkStates('camina', 'caga', function(vars) {
    if (vars.desespero > 0) {
        vars.desespero--
        return 0
    } else {
        return 1
    }
})

e.linkStates('caga', 'start', function(vars) {
    return 1
})

e.enterState('camina', function(state, vars) {
    console.log('Empezando a caminar ' + vars.nombre)
})

e.exitState('camina', function(state, vars) {
    console.log('Golpe tuyero ' + vars.nombre)
})

e.enterState('caga', function(state, vars) {
    console.log('Echando una cagadilla ' + vars.nombre)
})

e.exitState('caga', function(state, vars) {
    console.log('No hay papel tuale!! ' + vars.nombre)
})

e.enterState('start', function(state, vars) {
    console.log('Calmado ' + vars.nombre)
})

e.exitState('start', function(state, vars) {
    console.log('Ya no aguanto ' + vars.nombre)
})

var agentes = [e.cloneVars({nombre: 'bicho'}), e.cloneVars({nombre: 'memo', desesperoMax: 45})]

for (var i=0; i < 100; i++) {
    for (var j=0; j < agentes.length; j++) {
        e.process(agentes[j])
    }
}*/



var st = fsm.loadStateMachine('./test.fzm', {}, 
function() {
    st.newVariable('energy', 10)
    var idleProc = function() {
        st.newVariable('t', st.getVariable('t') + 1)
    }
    
    var spendProc = function() {
        st.newVariable('t', st.getVariable('t') - 1)
    }
    
    st.setStateProcFn('corre', spendProc)
    st.setStateProcFn('start', idleProc)
    
    st.enterState('respira', function(state, vars) {
        console.log('Breathing!')
        st.newVariable('energy', st.getVariable('energy') + 1)
    })
    
    for (var i=0; i < 100; i++) {
        st.process()
        
        console.log(st.getVariable('t'))
    }
})