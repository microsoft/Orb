const Q = require('q')
const debug = require('./debug')

function $call(registry, fn, ...args){
    let deferred = Q.defer();
    registry[fn](...args, function(err) {
        if (err) {
            debug(err)
            deferred.reject(new Error(err))
        } else {
            let result = Array.prototype.splice.apply(arguments, [1])
            deferred.resolve(...result)
        }
    })
    return deferred.promise
}

exports.$create = function(registry, ...args) {
    return $call(registry, 'create', ...args)
}

exports.$set = function(registry, ...args) {
    return $call(registry, 'set', ...args)
}

exports.$destroy = function(registry, ...args) {
    return $call(registry, 'destroy', ...args)
}
