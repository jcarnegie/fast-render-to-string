/**
 * @jsx React.DOM
 */

var React  = require("react");
var Simple = require("./simple.jsx");

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
