/**
 * @jsx React.DOM
 */

var React = require("react");
var SimpleState = null;

module.exports = SimpleState = React.createClass({
    getInitialState: function() {
        return {
            greeting: "hi, "
        }
    },

    render: function() {
        return (
            <div>{this.state.greeting}, {this.props.name}!</div>
        );
    }
});