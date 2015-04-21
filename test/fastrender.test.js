// allows us to load jsx/cjsx files for testing purposes
require("jsx-require-extension");
require("coffee-react/register");

var fs         = require("fs");
var pp         = require("../lib/pp");
var chai       = require("chai");
var react      = require("react");
var recast     = require("recast");
var uglifyjs   = require("uglify-js");
var formatter  = require("esformatter");
var fastrender = require("../lib/fastrender");
var htmlminify = require("html-minify");
//var ReactElement         = require("react/lib/ReactElement");
var ReactInstanceHandles = require("react/lib/ReactInstanceHandles");
var ReactMarkupChecksum  = require("react/lib/ReactMarkupChecksum");
var instantiateReactComponent = require("react/lib/instantiateReactComponent");
var ReactServerRenderingTransaction = require("react/lib/ReactServerRenderingTransaction");

chai.should();

var format = function(code) {
    return formatter.format(code);
};

var minify = function(code) {
    return uglifyjs.minify(code, {
        fromString: true,
        output: { beautify: true }
    }).code;
};

var hminify = function(html) {
    return htmlminify.minify(html);
};

var renderComponent = function(modulePath, id, props) {
    var component = require(modulePath);
    var element = react.createFactory(component)(props);
    var transaction;
    try {
        if (!id) id = ReactInstanceHandles.createReactRootID();
        transaction = ReactServerRenderingTransaction.getPooled(false);

        return transaction.perform(function () {
            var componentInstance = instantiateReactComponent(element, null);
            var markup = componentInstance.mountComponent(id, transaction, 0);
            return ReactMarkupChecksum.addChecksumToMarkup(markup);
        }, null);
    } finally {
        ReactServerRenderingTransaction.release(transaction);
    }
};

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

    it ("should insert a component function into the parent ast", function() {
        var fn       = format(fs.readFileSync("./fixtures/simple-fn.js", "utf8"));
        var compFn   = fastrender.componentFn(null, "./fixtures/simple.jsx", "Simple");
        var expected = format(fs.readFileSync("./fixtures/insert-fn-test.js", "utf8"));
        var ast      = recast.parse(fs.readFileSync("./fixtures/simple-with-child.js"));
        var result   = fastrender.insertFn(ast, compFn);
        minify(result).should.eql(minify(expected));
    });

    it ("should collapse a component", function() {
        var expected = format(fs.readFileSync("./fixtures/simple-with-child-collapsed.js", "utf8"));
        var collapsed = fastrender.collapse("./fixtures/simple-with-child.jsx");
        minify(collapsed).should.eql(minify(expected));
    });

    describe("Component Function Transform", function() {
        it ("should convert a component to a function", function() {
            var fixture = "./fixtures/simple.js";
            var fn = format(fs.readFileSync("./fixtures/simple-fn.js", "utf8"));
            ast = recast.parse(fs.readFileSync(fixture, "utf8"));
            var compFn = fastrender.componentFn(null, "./fixtures/simple.jsx", "Simple");
            minify(compFn).should.eql(minify(fn));
        });

        it ("should handle getInitialProps", function() {
            var fixture = "./fixtures/simple-props.js";
            var fn = format(fs.readFileSync("./fixtures/simple-props-fn.js", "utf8"));
            ast = recast.parse(fs.readFileSync(fixture, "utf8"));
            var compFn = fastrender.componentFn(null, "./fixtures/simple-props.jsx", "SimpleProps");
            minify(compFn).should.eql(minify(fn));
        });

        it ("should handle getInitialState", function() {
            var fixture = "./fixtures/simple-state.js";
            var fn = format(fs.readFileSync("./fixtures/simple-state-fn.js", "utf8"));
            ast = recast.parse(fs.readFileSync(fixture, "utf8"));
            var compFn = fastrender.componentFn(null, "./fixtures/simple-state.jsx", "SimpleState");
            minify(compFn).should.eql(minify(fn));
        });
    });

    describe("Render", function() {
        it ("should render simple", function() {
            var renderId = ReactInstanceHandles.createReactRootID();
            var normal = renderComponent("../fixtures/simple.jsx", renderId);
            var collapsed = fastrender.render("./fixtures/simple.jsx", null, renderId);
            hminify(collapsed).should.eql(hminify(normal));
        });

        it("should render simple with child", function() {
            var renderId = ReactInstanceHandles.createReactRootID();
            var normal = renderComponent("../fixtures/simple-with-child.jsx", renderId);
            var collapsed = fastrender.render("./fixtures/simple-with-child.jsx", null, renderId);
            hminify(collapsed).should.eql(hminify(normal));
        });
    });
});