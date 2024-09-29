/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
    ignoredRouteFiles: ["**/.*"],
    serverModuleFormat: "cjs",
    tailwind: true,
    postcss: true,
    browserNodeBuiltinsPolyfill: {
        modules: {
            events: true,
            fs: true,
            stream: true,
            zlib: true,
            buffer: true,
            string_decoder: true,
            async_hooks: true,
            path: true,
            querystring: true,
            url: true,
            http: true,
            crypto: true,
            util: true,
            net: true,
        },
    },
};
