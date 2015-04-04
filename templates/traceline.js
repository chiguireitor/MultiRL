function TraceLine(x0, y0, x1, y1) {
    var dx = x1 - x0
    var dy = y1 - y0

    var ret = []
    if ((dx == 0) && (dy == 0)) {
        ret.push([x0, y0])
        ret.push([x0, y0-1]) // TODO: Fix this kludge
    } else if (dy == 0) {
        // Horizontal line, easiest
        var ix = (dx > 0)?1:-1
        dx = Math.abs(dx)
        
        var x = x0
        for (var i = 1; i < dx; i++) {
            x += ix
            ret.push([x, y0])
        }
    } else if (dx == 0) {
        // Vertical line, easy
        var iy = (dy > 0)?1:-1
        dy = Math.abs(dy)
        
        var y = y0
        for (var i = 1; i < dy; i++) {
            y += iy
            ret.push([x0, y])
        }
    } else {
        // Run the algorithm
        var ix = (dx > 0)?1:-1
        var iy = (dy > 0)?1:-1
        var error = 0
        
        if (Math.abs(dx) > Math.abs(dy)) {
            var derror = Math.abs(dy/dx)
            var y = y0
            
            for (var x=x0+ix; x != x1; x+=ix) {
                ret.push([x, y])
                error += derror
                if (error > 0.5) {
                    y += iy
                    error -= 1.0
                }
            }
        } else if (Math.abs(dx) < Math.abs(dy)) {
            var derror = Math.abs(dx/dy)
            var x = x0
            
            for (var y=y0+iy; y != y1; y+=iy) {
                ret.push([x, y])
                
                error += derror
                if (error > 0.5) {
                    x += ix
                    error -= 1.0
                }
            }
        } else if (Math.abs(dx) == Math.abs(dy)) {
            var x = x0+ix
            var y = y0+iy
            while ((y != y1) && (x != x1)) {
                ret.push([x, y])
                x += ix
                y += iy
            }
        }
    }
    
    return ret
}

if (typeof(module) != "undefined") {
    module.exports = TraceLine
}