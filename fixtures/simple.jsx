/**
 * @jsx React.DOM
 */

var React = require("react");
var Simple = null;

module.exports = Simple = React.createClass({
    render: function() {
        return (
            <div>{this.props.name}</div>
        );
    }
});