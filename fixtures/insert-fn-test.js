/**
 * @jsx React.DOM
 */

var React  = require("react");
var Simple = require("./simple.jsx");

var renderSimple = function( /* props, children... */ ) {
    var children = [];
    this.props = arguments[0] || null;
    for(var i = 1; i < arguments.length; i++)
        children[i] = arguments[i];
    return (
        React.createElement("div", null, this.props.name)
    );
}

var SimpleWithChild = React.createClass({displayName: "SimpleWithChild",
    render: function() {
        return (
            React.createElement("div", null,
                React.createElement(Simple, {name: "Bob"})
            )
        );
    }
});

module.exports = SimpleWithChild;
