/**
 * @jsx React.DOM
 */

var React = require("react");
var SimpleProps = null;

module.exports = SimpleProps = React.createClass({displayName: "SimpleProps",
    getInitialProps: function() {
        return {
            greeting: "hi, "
        }
    },

    render: function() {
        return (
            React.createElement("div", null, this.props.greeting, ", ", this.props.name, "!")
        );
    }
});
