/**
 * @jsx React.DOM
 */

var React  = require("react");
var Simple = require("./simple.jsx");

var SimpleWithChild = React.createClass({
    render: function() {
        return (
            <div>
                <Simple name="Bob"/>
            </div>
        );
    }
});

module.exports = SimpleWithChild;