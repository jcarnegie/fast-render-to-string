/**
 * @jsx React.DOM
 */
var React  = require("react");

var renderSimple = function() {
    var children = [];
    this.props = arguments[0] || {};
    for(var i = 1; i < arguments.length; i++)
        children[i] = arguments[i];
    return (
    React.createElement("div", this.props.name, children)
);
}

var SimpleWithChild = React.createClass({
    displayName: "SimpleWithChild", 

    render: function() {
        return (
            React.createElement("div", null, 
                renderSimple({name: "Bob"})
            )
        );
    }
});

module.exports = SimpleWithChild;