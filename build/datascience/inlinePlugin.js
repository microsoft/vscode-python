class HelloWorldPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('Hello World Plugin', (
      stats /* stats is passed as argument when done hook is tapped.  */
    ) => {
      console.log('Hello World!');
    });
  }
}

//module.exports = HelloWorldPlugin;

class InlineResolverPlugin {
    constructor(regex) {
        this.source = 'described-resolve'; // Before plugin
        this.target = 'resolve'; // After plugin
        this.regex = regex;
    }

    apply(resolver) {
        const normal = resolver.ensureHook(this.target)
        const skip = resolver.ensureHook('resolved');
        resolver.getHook(this.source).tapAsync('InlineResolverPlugin', (request, resolveContext, callback) => {
            const parsed = resolver.parse(request.request);
            if (parsed.request == './block-elements.json') {
                const source = {
                    foo: 'bar'
                };
                console.log(`Skipping request for ${parsed.request}\n`);
                return callback(null, `${JSON.stringify(source)}`);
            }

            resolver.doResolve(normal, request, null, resolveContext, callback);
        });
    }
}

// module.exports = InlineResolverPlugin;

class InlineCompilerPlugin {
    constructor(regex) {
        this.regex = regex;
    }

    apply(compiler) {
        compiler.plugin("after-emit", function(compilation) {
            console.log('Done emitting');
        });
    }
}

module.exports = InlineCompilerPlugin;
