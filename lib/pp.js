
module.exports = function () {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        if (i === 0) arg = JSON.stringify(arg, null, 2);
        args.push(arg);
    }
    console.log.apply(console, args);
};