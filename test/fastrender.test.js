var fs         = require("fs");
var pp         = require("../lib/pp");
var chai       = require("chai");
var recast     = require("recast");
var formatter  = require("esformatter");
var fastrender = require("../lib/fastrender");

chai.should();

var format = function(code) {
    return formatter.format(code);
};

describe("fastrender", function() {
    var ast = null;

    beforeEach(function() {
        var fixture = "./fixtures/simple-with-child.js";
        ast = recast.parse(fs.readFileSync(fixture, "utf8"));
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
        fastrender.componentFn(null, "./fixtures/simple.jsx", "Simple").should.eql(fn);
    });

    it ("should insert a component function into the parent ast", function() {
        var fixture = "./fixtures/simple.js";
        var fn = format(fs.readFileSync("./fixtures/simple-fn.js", "utf8"));
        ast = recast.parse(fs.readFileSync(fixture, "utf8"));
        var compFn = fastrender.componentFn(null, "./fixtures/simple.jsx", "Simple");
        var expected = format(fs.readFileSync("./fixtures/insert-fn-test.js", "utf8"));
        ast = recast.parse(fs.readFileSync("./fixtures/simple-with-child.js"));
        var result   = fastrender.insertFn(ast, compFn);
        result.should.eql(expected);
    });

    it ("should collapse a component", function() {
        var expected = format(fs.readFileSync("./fixtures/simple-with-child-collapsed.js", "utf8"));
        var collapsed = fastrender.collapse("./fixtures/simple-with-child.jsx");
        //pp(collapsed);
        collapsed.should.eql(expected);
    });
});