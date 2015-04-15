// allows us to load jsx/cjsx files
require("jsx-require-extension");
require("coffee-react/register");

var r                    = require("ramda");
var fs                   = require("fs");
var JQL                  = require("jsonquerylanguage");
var path                 = require("path");
var chai                 = require("chai").should();
var react                = require("react");
var recast               = require("recast");
var reactTools           = require("react-tools");
var fastrender           = require("./../lib/index");
var htmlminify           = require("html-minify");
var ReactElement         = require("react/lib/ReactElement");
var ReactInstanceHandles = require("react/lib/ReactInstanceHandles");
var ReactMarkupChecksum  = require("react/lib/ReactMarkupChecksum");
var instantiateReactComponent = require("react/lib/instantiateReactComponent");
var ReactServerRenderingTransaction = require("react/lib/ReactServerRenderingTransaction");

var jql = new JQL();

var minify = function(html) {
    return htmlminify.minify(html);
}

// .jsx --> .js
// reads .jsx file, transforms it to .js and returns the contents
var jsxToJsSource = function(filepath) {
    var contents = fs.readFileSync(filepath, "utf8");
    return reactTools.transform(contents);
}

var renderJSXModule = function(modulePath, id, props) {
    var component = require(modulePath);
    var element   = react.createFactory(component)(props);

    var transaction;
    try {
        if (!id) id = ReactInstanceHandles.createReactRootID();
        transaction = ReactServerRenderingTransaction.getPooled(false);

        return transaction.perform(function() {
            var componentInstance = instantiateReactComponent(element, null);
            var markup = componentInstance.mountComponent(id, transaction, 0);
            return ReactMarkupChecksum.addChecksumToMarkup(markup);
        }, null);
    } finally {
        ReactServerRenderingTransaction.release(transaction);
    }
}

describe("fastrender", function() {

    describe("valueAt", function() {
        it("should get a value for a key in an object", function() {
            var obj = { foo: "bar" };
            fastrender.valueAt("foo", obj).should.eql("bar");
        });

        it("should get a value for a nested object", function() {
            var obj = { foo: { bar: "baz" } };
            fastrender.valueAt("foo.bar", obj).should.eql("baz");
        });

        it("should handle arrays properly", function() {
            var obj = {
                foo: [
                    {meep: "blu"},
                    {bar: "baz"}
                ]
            };
            fastrender.valueAt("foo.1.bar", obj).should.eql("baz");
        });

        it("should handle wildcards properly", function() {
            var obj = {
                foo: [
                    {meep: "blu"},
                    {bar: "baz"}
                ]
            };
            fastrender.valueAt("foo.*.bar", obj).should.eql("baz");
        });
    });

    describe("Paths", function() {
        var ast = null;

        beforeEach(function() {
            ast = JSON.parse(fs.readFileSync("./fixtures/simple.ast.json", "utf8"));
        });

        it ("should find a react render function", function() {
            // requires
            var requiresQ = "$.~.declarations.*[?(@.type=='VariableDeclarator')].init.callee[?(@.type=='Identifier')].^.^";
            console.log(jql.searchAndGetValues(ast, requiresQ));
            // components
            var componentsQ = "$.~.callee.object[?(@.type=='Identifier' && @.name=='React')].^.property[?(@.name=='createElement')].^.^.arguments";
            console.log(jql.searchAndGetValues(ast, componentsQ));
            // react render fn
            var renderQ = "$.~.callee.property[?(@.type=='Identifier' && @.name=='createClass')].^.^.arguments.*.properties.*.key[?(@.name=='render')].^.value.body"
            console.log(jql.searchAndGetValues(ast, renderQ));
        });
    });

    it("should get the requires", function() {
        var ast = recast.parse(fs.readFileSync("./fixtures/simple.js", "utf8"));
        var requires = fastrender.getRequires(ast);
        requires.should.eql({ "React": "react" });
    });

    it("should get the child components", function() {
        var ast         = recast.parse(fs.readFileSync("./fixtures/simple-with-child.js", "utf8"));
        var rootCompDir = path.dirname(require.resolve("./fixtures/simple-with-child.jsx"));
        var requires    = fastrender.getRequires(ast);
        var components  = fastrender.getComponents(ast, rootCompDir, requires);
        components.should.eql({Simple: rootCompDir + "/simple.jsx"});
    });

    it("should convert a simple child component to a function", function() {
        var fnOut = fastrender.componentToFn("Simple", "./fixtures/simple.js");
        console.log(fnOut);
        fnOut.should.eql(fs.readFileSync("./fixtures/simple-with-child-collapsed.js"));
    });

    xdescribe("JSX", function() {
        beforeEach(function() {

        });

        it("should collapse a simple component with child component", function() {
            var out = fastrender.collapse("./fixtures/simple-with-child.jsx");
            console.log(out);
        });

        xit("should render a simple component", function() {
            var id       = ReactInstanceHandles.createReactRootID();
            var compPath = "./fixtures/simple.jsx";
            var source   = jsxToJsSource(compPath);
            var render   = fastrender.renderFn(source);
            var markup   = render({id: id});
            minify(markup).should.eql(minify(renderJSXModule(compPath, id)));
        });

        xit("should render a simple child component", function() {
            var id       = ReactInstanceHandles.createReactRootID();
            var compPath = "./fixtures/simple-with-child.jsx"
            var source   = jsxToJsSource(compPath);
            var render   = fastrender.renderFn(source);
            var markup   = render({id: id});
            minify(markup).should.eql(minify(renderJSXModule(compPath, id)));
        });
    });


    xit("should render a simple react component", function() {

    });

    xit("should render a simple cjsx component", function() {

    });
})
