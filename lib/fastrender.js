var r          = require("ramda");
var fs         = require("fs");
var pp         = require("./pp");
var ejs        = require("ejs");
var JQL        = require("jsonquerylanguage");
var recast     = require("recast");
var Entities   = require("html-entities").XmlEntities;
var pathutil   = require("path");
var formatter  = require("esformatter");
var reactTools = require("react-tools");

var jql            = new JQL();
var entities       = new Entities();
var compFnTemplate = fs.readFileSync("./templates/componentfn.ejs", "utf8");

var REQUIRES_QUERY          = "$.~.declarations.*[?(@.type=='VariableDeclarator')].init.callee[?(@.type=='Identifier')].^.^";
var COMPONENTS_QUERY        = "$.~.callee.object[?(@.type=='Identifier' && @.name=='React')].^.property[?(@.name=='createElement')].^.^.arguments";
var RENDER_FN_QUERY         = "$.~.callee.property[?(@.type=='Identifier' && @.name=='createClass')].^.^.arguments.*.properties.*.key[?(@.name=='render')].^.value.body";
var COMPONENT_REPLACE_QUERY = "$.~.callee.object[?(@.type=='Identifier' && @.name=='React')].^.property[?(@.name=='createElement')].^.^.arguments[?(@.type=='Identifier')].^.^";

var find = r.curry(function(q, obj) {
    return jql.searchAndGetValues(obj, q);
});

var pathsOf = r.curry(function(q, obj) {
    return jql.searchAndGetPaths(obj, q);
})

var findRequires               = find(REQUIRES_QUERY);
var findComponents             = find(COMPONENTS_QUERY);
var findRenderBody             = find(RENDER_FN_QUERY);
var findComponentsToReplace    = find(COMPONENT_REPLACE_QUERY);
var pathsOfComponentsToReplace = pathsOf(COMPONENT_REPLACE_QUERY);

var format = function(code) {
    return formatter.format(code);
};

var accumulateRequireData = function(accumulator, requireData) {
    var varName = requireData.id.name;
    var reqPath = requireData.init.arguments[0].value;
    accumulator[varName] = reqPath;
    return accumulator;
};

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

var accumulateComponents = r.curry(function(requires, acc, componentData) {
    var compName = componentData[0].name;
    acc[compName] = requires[compName];
    return acc;
});

var components = function(requires, ast) {
    return r.compose(
        r.reduce(accumulateComponents(requires), {}),
        r.filter(filterComponents),
        findComponents
    )(ast);
};

var renderComponentFn = function(template, name, body) {
    return entities.decode(ejs.render(template, {
        componentName: name,
        renderBody: recast.print(body).code
    }));
};

var componentFn = r.curry(function(componentParentDir, componentPath, componentName) {
    //console.log(componentParentDir);
    //console.log(componentPath);
    //console.log(componentName);
    var ast = loadComponentAst(componentPath, componentParentDir);
    var renderBody = findRenderBody(ast)[0].body[0];
    //pp(renderBody);
    return format(renderComponentFn(compFnTemplate, componentName, renderBody));
});

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

var firstRequireIndex = function(ast) {
    var statements = ast.program.body;

    return r.findIndex(function(statement) {
        return statement.type === "VariableDeclaration"
            && find("$.declarations.*.init.callee[?(@.name=='require')]", statement).length > 0
    }, statements.slice(0,1));
}

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

var insertFn = function(ast, fnCode) {
    var fnAst = recast.parse(fnCode).program.body[0];
    var index = lastRequireIndex(ast);
    ast.program.body = r.insert(index, fnAst, ast.program.body);
    return format(recast.print(ast).code);
};

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

var removeRequire = function(ast, reqVar, reqPath) {

};

var collapse = function(modulePath) {
    var ast     = loadComponentAst(modulePath);
    var req     = requires(ast);
    var comps    = components(req, ast);
    var dir     = pathutil.dirname(modulePath);
    var compFns = r.mapObjIndexed(componentFn(dir), comps);

    // foreach component:
    //   1) insert function below the last require
    //   2) replace React.createElement calls with the function call
    r.mapObjIndexed(function(compFn, compName) {
        replaceChildComponents(ast, compName);
        //pp(compFn);
        insertFn(ast, compFn);
    }, compFns);

    return format(recast.print(ast).code);
};

module.exports = {
    requires: requires,
    components: components,
    componentFn: componentFn,
    insertFn: insertFn,
    collapse: collapse
};