var renderSimpleClassJSXFn = function( /* props, children... */ ) {
    this.getInitialProps = function() { return {}; };
    this.getInitialState = function() { return {}; };
    this.foo = function() { return (React.createElement("div", null, "bar")); };
    this.bar = React.createElement("div", null, "foo");
    var children = [];
    this.props = r.merge(this.getInitialProps(), arguments[0]);
    this.state = this.getInitialState();
    for(var i = 1; i < arguments.length; i++)
        children[i] = arguments[i];
    return (
        React.createElement("div", null,  this.bar, " ",  this.foo() )
    );
}/**
 * Created by jcarnegie on 4/21/15.
 */
