/**
 * @jsx React.DOM
 */

var React = require("react");
var SimpleProps = null;

module.exports = SimpleProps = React.createClass({
    getInitialProps: function() {
        return {
            greeting: "hi, "
        }
    },

    render: function() {
        return (
            <div>{this.props.greeting}, {this.props.name}!</div>
        );
    }
});