var items = require('./items.js')

console.log(items.generate('weapons/ranged/rifle', {score: 1000})) //, '1a236fb243b59037'))

/*var determinist = require('./determinist.js')

console.log(determinist.getSessionId())

var fr = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

for (var j=0; j < 1000; j++) {
	var cid = new determinist.IdRandomizer()
	for (var i=0; i < 1000; i++) {
		var n = cid.randomIntRange(0, 10)
		fr[n] = fr[n] + 1
	}
}
console.log(fr)*/