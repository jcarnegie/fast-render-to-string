/**
 * @jsx React.DOM
 */

var React = require("react");
var ComplexNoChildren = null;

module.exports = ComplexNoChildren = React.createClass({displayName: "ComplexNoChildren",
    render: function() {
        return (
            React.createElement("div", null, 
                React.createElement("header", null, "This is where I put some title and maybe an image"), 
                React.createElement("section", null, 
                    "Blah", 
                    React.createElement("div", {className: "foo"}, "Bar")
                ), 
                React.createElement("aside", null, 
                    React.createElement("img", {src: "/path/to/image.jpg"})
                )
            )
        );
    }
});
