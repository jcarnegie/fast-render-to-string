var renderSimple = function( /* props, children... */ ) {
    var children = [];
    this.props = arguments[0] || null;
    for(var i = 1; i < arguments.length; i++)
        children[i] = arguments[i];
    return (
        React.createElement("div", null, this.props.name)
    );
}