/**
 * @jsx React.DOM
 */

var React = require("react");
var SimpleClassFn = null;

module.exports = SimpleClassFn = React.createClass({displayName: "SimpleClassFn",
    foo: function() {
        return "bar";
    },

    bar: "foo",

    render: function() {
        return (
            React.createElement("div", null,  this.bar, " ",  this.foo() )
        );
    }
});
