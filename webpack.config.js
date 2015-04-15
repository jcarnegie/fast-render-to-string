module.exports = {
    module: {
        loaders: [
            { test: /.json$/, loader: "json", exclude: "node_modules" },
            { test: /.jsx$/,  loader: "jsx", exclude: "node_modules" }
        ]
    },
}