var renderSimpleProps = function( /* props, children... */ ) {
    this.getInitialProps = function() {
        return {
            greeting: "hi, "
        }
    }
    this.getInitialState = function() { return {}; };
    var children = [];
    this.props = r.merge(this.getInitialProps(), arguments[0]);
    this.state = this.getInitialState();
    for(var i = 1; i < arguments.length; i++)
        children[i] = arguments[i];
    return (
        React.createElement("div", null, this.props.greeting, ", ", this.props.name, "!")
    );
}