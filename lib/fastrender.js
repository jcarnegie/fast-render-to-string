var r          = require("ramda");
var fs         = require("fs");
var pp         = require("./pp");
var ejs        = require("ejs");
var JQL        = require("jsonquerylanguage");
var react      = require("react");
var recast     = require("recast");
var Entities   = require("html-entities").XmlEntities;
var pathutil   = require("path");
var formatter  = require("esformatter");
var reactTools = require("react-tools");
var ReactInstanceHandles = require("react/lib/ReactInstanceHandles");
var ReactMarkupChecksum  = require("react/lib/ReactMarkupChecksum");
var instantiateReactComponent = require("react/lib/instantiateReactComponent");
var ReactServerRenderingTransaction = require("react/lib/ReactServerRenderingTransaction");

var jql            = new JQL();
var entities       = new Entities();
var compFnTemplate = fs.readFileSync("./templates/componentfn.ejs", "utf8");

var REQUIRES_QUERY          = "$.~.declarations.*[?(@.type=='VariableDeclarator')].init.callee[?(@.type=='Identifier')].^.^";
var COMPONENTS_QUERY        = "$.~.callee.object[?(@.type=='Identifier' && @.name=='React')].^.property[?(@.name=='createElement')].^.^.arguments";
var INIT_PROPS_QUERY        = "$.~.callee.property[?(@.type=='Identifier' && @.name=='createClass')].^.^.arguments.*.properties.*.key[?(@.name=='getInitialProps')].^.value"
var INIT_STATE_QUERY        = "$.~.callee.property[?(@.type=='Identifier' && @.name=='createClass')].^.^.arguments.*.properties.*.key[?(@.name=='getInitialState')].^.value"
var RENDER_FN_QUERY         = "$.~.callee.property[?(@.type=='Identifier' && @.name=='createClass')].^.^.arguments.*.properties.*.key[?(@.name=='render')].^.value.body";
var COMPONENT_REPLACE_QUERY = "$.~.callee.object[?(@.type=='Identifier' && @.name=='React')].^.property[?(@.name=='createElement')].^.^.arguments[?(@.type=='Identifier')].^.^";
var DELETE_REQUIRE_QUERY    = "$.~.declarations.*[?(@.type=='VariableDeclarator')].id[?(@.name=='#{reqVar}')].^.init.arguments[0][?(@.value=='#{reqPath}')].^.^.^.^.^";

function requireFromString(src, filename) {
    var Module = module.constructor;
    var m = new Module();
    m.paths = module.paths;
    m._compile(src, filename);
    return m.exports;
}

/**
 * Find values in a JSON object given a JQL query string.
 *
 * @param q
 * @param obj
 * @returns {Array}
 */
var find = r.curry(function(q, obj) {
    return jql.searchAndGetValues(obj, q);
});

/**
 * Get the paths in a JSON object given a JQL query string.
 *
 * @param q
 * @param obj
 * @returns {Array}
 */
var pathsOf = r.curry(function(q, obj) {
    return jql.searchAndGetPaths(obj, q);
});

var findRequires               = find(REQUIRES_QUERY);
var findComponents             = find(COMPONENTS_QUERY);
var findRenderBody             = find(RENDER_FN_QUERY);
var findInitialPropsFn         = find(INIT_PROPS_QUERY);
var findInitialStateFn         = find(INIT_STATE_QUERY);
var findComponentsToReplace    = find(COMPONENT_REPLACE_QUERY);
var removeRequire              = function(ast, reqVar, reqPath) {
    var q = DELETE_REQUIRE_QUERY
        .replace("#{reqVar}", reqVar)
        .replace("#{reqPath}", reqPath);
    jql.remove(ast, q);
};

/**
 * Accumulator for tracking requires statements in a JavaScript file.
 *
 * @param accumulator - an object such that { <variable name>: <require path> }
 * @param requireData - AST representation of the require statement
 * @returns {*}
 */
var accumulateRequireData = function(accumulator, requireData) {
    var varName = requireData.id.name;
    var reqPath = requireData.init.arguments[0].value;
    accumulator[varName] = reqPath;
    return accumulator;
};

/**
 * Gathers 'var <moduleName> = require("<modulePath>")' statements and returns
 * them as an object where <moduleName> is the key and <modulePath> is the value
 * (i.e. { <moduleName>: <modulePath> }).
 *
 * @param ast
 * @returns {*}
 */
var requires = function(ast) {
    return r.reduce(
        accumulateRequireData,
        {},
        findRequires(ast)
    );
};

var filterComponents = function(componentData) {
    return componentData[0].type === "Identifier";
};

/**
 *
 * @param requires
 * @param acc
 * @param componentData
 * @returns {*}
 */
var accumulateComponents = r.curry(function(requires, acc, componentData) {
    var compName = componentData[0].name;
    acc[compName] = requires[compName];
    return acc;
});

/**
 * Extracts a list of React components referenced in a react component module.
 *
 * @param requires
 * @param ast
 * @returns {*}
 */
var components = function(requires, ast) {
    return r.compose(
        r.reduce(accumulateComponents(requires), {}),
        r.filter(filterComponents),
        findComponents
    )(ast);
};

/**
 * Transforms a React component module into a function for fast rendering.
 *
 * @param componentParentDir
 * @param componentPath
 * @param componentName
 * @returns {String|{value, rest}}
 */
var componentFn = r.curry(function(componentParentDir, componentPath, componentName) {
    var ast = loadComponentAst(componentPath, componentParentDir);

    // render
    var body = findRenderBody(ast)[0].body[0];
    var renderBody = recast.print(body).code;

    // getInitialProps
    var initialPropsFn = findInitialPropsFn(ast)[0];
    initialPropsFn = initialPropsFn
        ? recast.print(initialPropsFn).code
        : "function() { return {}; };";

    // getInitialState
    var initialStateFn = findInitialStateFn(ast)[0];
    initialStateFn = initialStateFn
        ? recast.print(initialStateFn).code
        : "function() { return {}; };";

    var fn = entities.decode(ejs.render(compFnTemplate, {
        componentName: componentName,
        renderBody: renderBody,
        getInitialPropsFn: initialPropsFn,
        getInitialStateFn: initialStateFn
    }));

    return fn;
});

/**
 * Loads a React component and parses it into its AST representation.
 *
 * @param compPath
 * @param parentDir
 * @returns {number|Command|*|{enumerable, value}}
 */
var loadComponentAst = function(compPath, parentDir) {
    compPath = pathutil.normalize(compPath);
    if (!parentDir) parentDir = ".";

    compPath     = [parentDir, compPath].join("/");
    var contents = fs.readFileSync(compPath, "utf8");
    var extname  = pathutil.extname(compPath);

    switch(extname) {
        case ".jsx":
            contents = reactTools.transform(contents);
        // case "cjsx"
    }

    return recast.parse(contents);
};

/**
 * Returns the index of the first top-level require
 * statement in a JavaScript file.
 *
 * @param ast
 * @returns {*}
 */
var firstRequireIndex = function(ast) {
    var statements = ast.program.body;

    return r.findIndex(function(statement) {
        return statement.type === "VariableDeclaration"
            && find("$.declarations.*.init.callee[?(@.name=='require')]", statement).length > 0
    }, statements.slice(0,1));
};

/**
 * Returns the index of the last top-level require
 * statement in a JavaScript file.
 *
 * @param ast
 * @returns {*}
 */
var lastRequireIndex = function(ast) {
    var start = firstRequireIndex(ast);
    if (start === -1) return -1;
    var statements = r.slice(start, ast.program.body);

    return r.findIndex(function(statement) {
        return statement
            && statement.type !== "VariableDeclaration"
            || find("$.declarations.*.init.callee[?(@.name=='require')]", statement).length === 0
    }, statements) + (start + 2);
};

/**
 * Inserts a component function into another React component file.
 *
 * @param ast
 * @param fnCode
 * @returns {*|boolean|code}
 */
var insertFn = function(ast, fnCode) {
    var fnAst = recast.parse(fnCode).program.body[0];
    var index = lastRequireIndex(ast);
    ast.program.body = r.insert(index, fnAst, ast.program.body);
    return recast.print(ast).code;
};

var insertR = function(ast, code) {
    var fnAst = recast.parse(code).program.body[0];
    var index = lastRequireIndex(ast);
    ast.program.body = r.insert(index, fnAst, ast.program.body);
    return recast.print(ast).code;
}

/**
 * Replaces child component function calls (via React.createElement) with the
 * fast render function equivalent.
 *
 * @param ast
 * @param compName
 */
var replaceChildComponents = function(ast, compName) {
    var componentCalls = findComponentsToReplace(ast);
    var callTemplate   = "render#{compName}(#{props})";

    r.map(function(componentCall) {
        var props = componentCall.arguments[1];
        var call  = callTemplate
            .replace("#{compName}", compName)
            .replace("#{props}", recast.print(props).code);
        var callAst = recast.parse(call).program.body[0].expression;
        jql.update(ast, COMPONENT_REPLACE_QUERY, callAst);
    }, componentCalls);
};

/**
 * Collapses a React component tree into a single
 * component for fast server side rendering.
 *
 * @param modulePath
 * @returns {*|boolean|code}
 */
var collapse = function(modulePath) {
    var ast     = loadComponentAst(modulePath);
    var req     = requires(ast);
    var comps   = components(req, ast);
    var dir     = pathutil.dirname(modulePath);
    var compFns = r.mapObjIndexed(componentFn(dir), comps);

    // foreach component:
    //   1) replace React.createElement calls with the function call
    //   2) insert function below the last require
    //   3) remove require statements
    r.mapObjIndexed(function(compFn, compName) {
        replaceChildComponents(ast, compName);
        insertFn(ast, compFn);
        removeRequire(ast, compName, comps[compName]);
    }, compFns);

    insertR(ast, "var r = require(\"ramda\");");


    //console.log(recast.print(ast).code);

    return recast.print(ast).code;
};

var render = function(modulePath, props, id) {
    var code = collapse(modulePath);
    var component = requireFromString(code, modulePath);
    var element   = react.createFactory(component)(props);
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

module.exports = {
    requires:    requires,
    components:  components,
    componentFn: componentFn,
    insertFn:    insertFn,
    collapse:    collapse,
    render:      render,

    matchTest: function(ast) {
        return jql.searchAndGetValues(ast, DELETE_REQUIRE_QUERY
            .replace("#{reqVar}", "Simple")
            .replace("#{reqPath}", "./simple.jsx")
        );
    }
};