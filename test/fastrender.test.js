var fs         = require("fs");
var chai       = require("chai");
var recast     = require("recast");
var fastrender = require("../lib/fastrender");

chai.should();

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
        var fn = fs.readFileSync("./fixtures/simple-fn.js", "utf8");
        ast = recast.parse(fs.readFileSync(fixture, "utf8"));
        fastrender.componentFn("Simple", "./fixtures/simple.jsx", ast).should.eql(fn);
    });
});