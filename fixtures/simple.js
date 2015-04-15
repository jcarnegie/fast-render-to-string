/**
 * @jsx React.DOM
 */

var React = require("react");
var Simple = null;

module.exports = Simple = React.createClass({displayName: "Simple",
    render: function() {
        return (
            React.createElement("div", null, this.props.name)
        );
    }
});
