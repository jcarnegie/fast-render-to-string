/**
 * @jsx React.DOM
 */

var React = require("react");
var ComplexNoChildren = null;

module.exports = ComplexNoChildren = React.createClass({
    render: function() {
        return (
            <div>
                <header>This is where I put some title and maybe an image</header>
                <section>
                    Blah
                    <div className="foo">Bar</div>
                </section>
                <aside>
                    <img src="/path/to/image.jpg"/>
                </aside>
            </div>
        );
    }
});