/**
 * @jsx React.DOM
 */

var React = require("react");
var SimpleState = null;

module.exports = SimpleState = React.createClass({displayName: "SimpleState",
    getInitialState: function() {
        return {
            greeting: "hi, "
        }
    },

    render: function() {
        return (
            React.createElement("div", null, this.state.greeting, ", ", this.props.name, "!")
        );
    }
});
