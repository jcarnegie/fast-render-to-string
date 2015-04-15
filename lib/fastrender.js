var r          = require("ramda");
var fs         = require("fs");
var ejs        = require("ejs")
var JQL        = require("jsonquerylanguage");
var recast     = require("recast");
var formatter  = require("esformatter");

var jql            = new JQL();
var compFnTemplate = fs.readFileSync("./templates/componentfn.ejs", "utf8");

var REQUIRES_QUERY   = "$.~.declarations.*[?(@.type=='VariableDeclarator')].init.callee[?(@.type=='Identifier')].^.^";
var COMPONENTS_QUERY = "$.~.callee.object[?(@.type=='Identifier' && @.name=='React')].^.property[?(@.name=='createElement')].^.^.arguments";
var RENDER_FN_QUERY  = "$.~.callee.property[?(@.type=='Identifier' && @.name=='createClass')].^.^.arguments.*.properties.*.key[?(@.name=='render')].^.value.body";

var find = r.curry(function(q, obj) {
    return jql.searchAndGetValues(obj, q);
});

var format = function(code) {
    return formatter.format(code);
};

var findRequires   = find(REQUIRES_QUERY);
var findComponents = find(COMPONENTS_QUERY);
var findRenderBody = find(RENDER_FN_QUERY);

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
    return ejs.render(template, {
        componentName: name,
        renderBody: recast.print(body).code
    }).replace(/&#34;/g, '"');
}

var componentFn = function(componentName, componentPath, ast) {
    var renderBody = findRenderBody(ast)[0].body[0];
    return format(renderComponentFn(compFnTemplate, componentName, renderBody));
};

module.exports = {
    requires: requires,
    components: components,
    componentFn: componentFn
};