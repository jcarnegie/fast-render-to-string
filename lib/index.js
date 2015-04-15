/**
 * Component tree collapse steps:
 *
 * 1) Get require statements (so we know which child component files to load)
 * 2) Get list of child components (so we know what to replace in the body of the file)
 *     - name of component
 *     - absolute path to child component file
 * 3) Generate child component functions
 * 4) Remove old child component requires
 * 5) Add child component functions to ast
 * 6) Replace React.createElements for child
 *    components with their rendered function
 *    replacements
 *
 * Pipeline looks like this:
 *
 * gatherRequires({ ast: ast })
 * gatherChildComponents({ ast: ast, requires: requires })
 * collapseChildComponents({ ast: ast, requires: requires, childComponents: childComponents })
 * removeChildRequires({ ast: ast, requires: requires, childComponents: childComponents })
 *
 */

var r                    = require("ramda");
var fs                   = require("fs");
var JQL                  = require("jsonquerylanguage");
var ejs                  = require("ejs");
var recast               = require("recast");
var pathutil             = require("path");
var reactTools           = require("react-tools");
var ReactInstanceHandles = require("react/lib/ReactInstanceHandles");
var ReactMarkupChecksum  = require("react/lib/ReactMarkupChecksum");

var jql   = new JQL();
var types = recast.types;
var b     = types.builders;

/**
 * Returns the value at the given property path. A property path
 * is a dot-separated string representing a path of properties in a
 * nested object.
 *
 * @param propPath
 * @param obj
 * @returns {*}
 */
var valueAt = function(propPath, obj) {
    return jql.searchAndGetValues(obj, propPath)[0];
};

/**
 * Returns true if the value at propPath in obj equals val.
 *
 * @param propPath
 * @param val
 * @param obj
 * @returns {boolean}
 */
var isSetTo = r.curry(function(propPath, val, obj) {
    return val === valueAt(propPath, obj);
});

var isRequireAssignment = function(node) {
    return isSetTo("declarations.0.type", "VariableDeclarator", node)
        && isSetTo("declarations.0.init.type", "CallExpression", node)
        && isSetTo("declarations.0.init.callee.name", "require", node);
};

var isComponent = function(node) {
    // Todo: instead of React.createElement, it could be pellet.createElement
    return isSetTo("callee.object.name", "React", node)
        && isSetTo("callee.property.name", "createElement", node)
        && isSetTo("arguments.0.type", "Identifier", node);
};

var isReactRender = function(node) {
    return isSetTo("callee.property.name", "createClass", node)
        && isSetTo("arguments.0.*.key.name", "render", node);
}

var getRequires = function(ast) {
    var requires = {};

    var result = recast.visit(ast, {
        visitVariableDeclaration: function(path) {
            if (!isRequireAssignment(path.value)) return this.traverse(path);

            var node       = path.value;
            var varName    = valueAt("declarations.0.id.name", node);
            var modulePath = valueAt("declarations.0.init.arguments.0.value", node);

            requires[varName] = modulePath;

            this.traverse(path);
        }
    });

    return requires;
};

var getComponents = r.curry(function(ast ,parentCompDir, requires) {
    var components = {};

    var result = recast.visit(ast, {
        visitCallExpression: function(path) {
            if (!isComponent(path.value)) return this.traverse(path);

            var node         = path.value;
            var compName     = valueAt("arguments.0.name", node);
            var modulePath   = requires[compName];

            components[compName] = pathutil.join(parentCompDir, modulePath);

            this.traverse(path);
        }
    });

    return components;
});

var COMP_FN_TEMPLATE = function(componentName, renderBody) {
    var template = fs.readFileSync("templates/componentfn.ejs", "utf8");
    return ejs.render(template, {
        componentName: componentName,
        renderBody: renderBody
    });
}

var extractRenderBody = function(ast) {
    var q = "$.~.callee.property[?(@.type=='Identifier' && @.name=='createClass')].^.^.arguments.*.properties.*.key[?(@.name=='render')].^.value.body";
    return jql.searchAndGetValues(ast, q);
}

var loadComponentSource = function(compPath, parentDir) {
    if (!parentDir) parentDir = ".";

    compPath     = [parentDir, compPath].join("/");
    var contents = fs.readFileSync(compPath, "utf8");
    var extname  = pathutil.extname(compPath);

    switch(extname) {
        case ".js":  return contents;
        case ".jsx": return reactTools.transform(contents);
        // case "cjsx"
    }
}

var componentToFn = function(componentName, modulePath) {
    var src = loadComponentSource(modulePath);
    var ast = recast.parse(src);
    var renderBody = extractRenderBody(ast);
    return COMP_FN_TEMPLATE(componentName, renderBody);
};

var requires = {};

var trackRequires = function(path) {
    var node = path.value;

    var isRequireAssignment =
        isSetTo("declarations.0.type", "VariableDeclarator", node) &&
        isSetTo("declarations.0.init.type", "CallExpression", node) &&
        isSetTo("declarations.0.init.callee.name", "require", node);

    if (!isRequireAssignment) return this.traverse(path);

    var varName = valueAt("declarations.0.id.name", node);
    var modulePath = valueAt("declarations.0.init.arguments.0.value", node);

    requires[varName] = modulePath;

    this.traverse(path);
}

/**
 * [replaceChildComponents description]
 * @param  {[type]} parentCompDir [description]
 * @param  {[type]} path          [description]
 * @return {[type]}               [description]
 */
var replaceChildComponents = r.curry(function(parentCompDir, path) {
    var node = path.value;

    var isChildComponent =
        // Todo: instead of React.createElement, it could be pellet.createElement
        isSetTo("callee.object.name", "React", node) &&
        isSetTo("callee.property.name", "createElement", node) &&
        isSetTo("arguments.0.type", "Identifier", node);

    if (!isChildComponent) return this.traverse(path);

    var compName = valueAt("arguments.0.name", node);
    var props    = valueAt("arguments.1", node);
    // Todo: handle children
    var children = valueAt("arguments.2", node);
    //var children = null;

    // Load the child comp source
    var modulePath = requires[compName];
    var source = loadComponentSource(modulePath, parentCompDir);
    var componentFn = componentToFn(compName, source, props, children);

    console.log(componentFn);

    path.replace(componentFn);

    this.traverse(path);
});

//var componentToFn = function(compName, source, props, children) {
//    var ast       = recast.parse(source);
//    var renderAst = null;
//
//    // find the render method
//    var result = recast.visit(ast, {
//        // Todo: Need to see if there are cases where
//        // it's not an assignment expression
//        visitAssignmentExpression: function(path) {
//            var node = path.value;
//
//            var isCreateClassFn =
//                isSetTo("right.callee.object.name", "React", node) &&
//                isSetTo("right.callee.property.name", "createClass", node);
//
//            if (!isCreateClassFn) return this.traverse(path);
//
//            // find the render function
//            var properties = valueAt("right.arguments.0.properties", node);
//
//            if (!properties) return this.traverse(path);
//            // Todo: add message logging here?
//
//            var renderProp = r.find(isSetTo("key.name", "render"), properties);
//
//            // ok, cherry pick the body of the render function, not the enclosing
//            // statement itself.
//            var renderBody  = valueAt("value.body", renderProp);
//
//            // now create a new function to embed in the top-level component
//            var id = b.identifier("render" + compName);
//            renderFn = b.variableDeclaration("var", [
//                b.variableDeclarator(id, b.functionExpression(
//                    null,
//                    [props],
//                    renderBody
//                ))
//            ]);
//
//            console.log(renderFn);
//
//            return false;
//        }
//    });
//
//    return renderAst;
//}

/**
 * Collapses a React component tree into a single component.
 *
 * @param source
 * @param props
 */
var collapse = function(componentPath) {
    var source = loadComponentSource(componentPath);
    var ast    = recast.parse(source);
    var dir    = path.dirname(componentPath);

    var result = recast.visit(ast, {
        visitVariableDeclaration: trackRequires,
        visitCallExpression: replaceChildComponents(dir)
    });

    // return function(opts) {
    //     // var id     = opts.id || ReactInstanceHandles.createReactRootID();
    //     // var tag    = tags[0];
    //     // var markup = "<" + tag + " data-reactid=\"" + id + "\"></" + tag + ">";
    //     // return ReactMarkupChecksum.addChecksumToMarkup(markup);
    // }

    return recast.print(ast).code;    
}

module.exports = {
    valueAt: valueAt,
    isSetTo: isSetTo,
    loadComponentSource: loadComponentSource,
    getRequires: getRequires,
    getComponents: getComponents,
    componentToFn: componentToFn,
    collapse: collapse
}