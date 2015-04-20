var renderSimple = function( /* props, children... */ ) {
    this.getInitialProps = function() { return {}; };
    var children = [];
    this.props = r.merge(this.getInitialProps(), arguments[0]);
    for(var i = 1; i < arguments.length; i++)
        children[i] = arguments[i];
    return (
        React.createElement("div", null, this.props.name)
    );
}