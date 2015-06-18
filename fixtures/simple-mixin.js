/**
 * @jsx React.DOM
 */

var React = require("react");
var SimpleMixin = null;
var mixin = require ("mixin");

module.exports = SimpleMixin = React.createClass({displayName: "SimpleMixin",
    render: function() {
        return (
            React.createElement("div", null, mixin.foo)
        );
    }
});
