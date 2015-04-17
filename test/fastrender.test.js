var fs         = require("fs");
var pp         = require("../lib/pp");
var chai       = require("chai");
var recast     = require("recast");
var formatter  = require("esformatter");
var fastrender = require("../lib/fastrender");
var uglifyjs   = require("uglify-js");

chai.should();

var format = function(code) {
    return formatter.format(code);
};

var minify = function(code) {
    return uglifyjs.minify(code, {
        fromString: true,
        output: { beautify: true }
    }).code;
}

describe("fastrender", function() {
    var ast = null;

    beforeEach(function() {
        var fixture = "./fixtures/simple-with-child.js";
        ast = recast.parse(fs.readFileSync(fixture, "utf8"));
    });

    // do not remove: used for testing JQL queries
    xit ("should match", function() {
        ast = recast.parse(fs.readFileSync("./fixtures/simple-with-child.js"));
        console.log(fastrender.matchTest(ast));
    });

    it ("should get the requires", function() {
        fastrender.requires(ast).should.eql({ React: "react", Simple: "./simple.jsx" });
    });

    it ("should get the components", function() {
        var requires = fastrender.requires(ast);
        fastrender.components(requires, ast).should.eql({ Simple: "./simple.jsx" });
    });

    it ("should convert a component to a function", function() {
        var fixture = "./fixtures/simple.js";
        var fn = format(fs.readFileSync("./fixtures/simple-fn.js", "utf8"));
        ast = recast.parse(fs.readFileSync(fixture, "utf8"));
        var compFn = fastrender.componentFn(null, "./fixtures/simple.jsx", "Simple");
        minify(compFn).should.eql(minify(fn));
    });

    it ("should insert a component function into the parent ast", function() {
        var fixture = "./fixtures/simple.js";
        var fn = format(fs.readFileSync("./fixtures/simple-fn.js", "utf8"));
        ast = recast.parse(fs.readFileSync(fixture, "utf8"));
        var compFn = fastrender.componentFn(null, "./fixtures/simple.jsx", "Simple");
        var expected = format(fs.readFileSync("./fixtures/insert-fn-test.js", "utf8"));
        ast = recast.parse(fs.readFileSync("./fixtures/simple-with-child.js"));
        var result   = fastrender.insertFn(ast, compFn);
        minify(result).should.eql(minify(expected));
    });

    it ("should collapse a component", function() {
        var expected = format(fs.readFileSync("./fixtures/simple-with-child-collapsed.js", "utf8"));
        var collapsed = fastrender.collapse("./fixtures/simple-with-child.jsx");
        minify(collapsed).should.eql(minify(expected));
    });
});