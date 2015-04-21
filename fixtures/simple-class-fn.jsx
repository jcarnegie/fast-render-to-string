/**
 * @jsx React.DOM
 */

var React = require("react");
var SimpleClassFn = null;

module.exports = SimpleClassFn = React.createClass({
    foo: function() {
        return "bar";
    },

    bar: "foo",

    render: function() {
        return (
            <div>{ this.bar } { this.foo() }</div>
        );
    }
});