module.exports = function () {
    return {
        testFramework: "mocha@2.1.0",
        files: [
            "lib/**/*.js",
            { pattern: "fixtures/*.js*", instrument: false },
            { pattern: "templates/*.*js*", instrument: false }
        ],
        tests: ["test/**/*.test.js"],
        env: { type: "node" },
        preprocessors: {
            "**/*.jsx": file => require('babel').transform(file.content, {sourceMap: true})
        }
    }
}