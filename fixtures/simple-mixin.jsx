/**
 * @jsx React.DOM
 */

var React = require("react");
var SimpleMixin = null;
var mixin = require ("mixin");

module.exports = SimpleMixin = React.createClass({
    mixins: [mixin]

    render: function() {
        return (
            <div>{mixin.foo}</div>
        );
    }
});