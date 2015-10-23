//var items = require('./items.js')
//console.log(items.generate('weapons/ranged/rifle', {score: 1000})) //, '1a236fb243b59037'))
//console.log(items.generate('ammo/9mm bullets', {score: 1000}))

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

/*var determinist = require('./determinist.js')
var a = new determinist.IdRandomizer()

for (var j=0; j < 10; j++) {
    var r = [0, 0, 0]
    
    for (var i=0; i < 100; i++) {
        var m = a.randomInt(3)
        r[m] = r[m]+1
    }

    console.log(r)
}*/

/*var crypto = require('crypto')
var hash = new crypto.createHash('sha512')
hash.update('1234')
var dg = hash.digest()
console.log(dg)

hash = new crypto.createHash('sha512')
hash.update(dg)
dg = hash.digest()
console.log(dg)*/

var a = new Buffer([1,2,3])
console.log(typeof(a))