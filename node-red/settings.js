/**
 * Node-RED Settings for Payment Switch Application
 * 
 * This file configures Node-RED for payment processing workflows,
 * PSP integrations, and message transformations.
 */

module.exports = {
    // The TCP port that the Node-RED web server is listening on
    uiPort: process.env.PORT || 1880,

    // By default, the Node-RED UI accepts connections on all IPv4 interfaces.
    // To listen on all IPv6 addresses, set uiHost to "::",
    // The following property can be used to listen on a specific interface. For
    // example, the following would only allow connections from the local machine.
    //uiHost: "127.0.0.1",

    // Retry time in milliseconds for MQTT connections
    mqttReconnectTime: 15000,

    // Retry time in milliseconds for Serial port connections
    serialReconnectTime: 15000,

    // Retry time in milliseconds for TCP socket connections
    //socketReconnectTime: 10000,

    // Timeout in milliseconds for TCP server socket connections
    //socketTimeout: 120000,

    // Maximum number of messages to wait in queue while attempting to connect to TCP socket
    //tcpMsgQueueSize: 2000,

    // Maximum number of messages to wait in queue while attempting to connect to MQTT broker
    //internalMsgQueueSize: 5000,

    // The maximum length, in characters, of any message sent to the debug sidebar tab
    debugMaxLength: 1000,

    // Maximum buffer size for the exec node. Defaults to 10Mb
    //execMaxBufferSize: 10000000,

    // Timeout in milliseconds for HTTP request connections
    httpRequestTimeout: 120000,

    // The maximum size of HTTP request that will be accepted by the runtime api.
    // Default: 5mb
    //apiMaxLength: '5mb',

    // If you installed the optional node-red-dashboard you can set it's path
    // relative to httpRoot
    //ui: { path: "ui" },

    // Securing Node-RED
    // -----------------
    // To password protect the Node-RED editor and admin API, the following
    // property can be used. See http://nodered.org/docs/security.html for details.
    adminAuth: {
        type: "credentials",
        users: [{
            username: "admin",
            password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.", // password: admin123
            permissions: "*"
        }, {
            username: "operator",
            password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.", // password: operator123
            permissions: "read"
        }]
    },

    // To password protect the node-defined HTTP endpoints (httpNodeRoot), or
    // the static content (httpStatic), the following properties can be used.
    // The pass field is a bcrypt hash of the password.
    // See http://nodered.org/docs/security.html#generating-the-password-hash
    //httpNodeAuth: {user:"user",pass:"$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN."},
    //httpStaticAuth: {user:"user",pass:"$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN."},

    // The following property can be used to enable HTTPS
    // See http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener
    // for details on its contents.
    // This property can be either an object, containing both a (private) key
    // and a (public) certificate, or a function that returns such an object:
    //https: {
    //  key: require("fs").readFileSync('privkey.pem'),
    //  cert: require("fs").readFileSync('cert.pem')
    //},

    // The following property can be used to refresh the https settings at a
    // regular interval (in hours).
    // This requires httpsRefreshInterval to be set to a value > 0
    //httpsRefreshInterval : 12,

    // The following property can be used to cause insecure HTTP connections to
    // be redirected to HTTPS.
    //requireHttps: true,

    // The following property can be used to disable the editor. The admin API
    // is not affected by this option. To disable both the editor and the admin
    // API, use either the httpRoot or httpAdminRoot properties
    //disableEditor: false,

    // The following property can be used to configure cross-origin resource sharing
    // in the HTTP nodes.
    // See https://github.com/troygoode/node-cors#configuration-options for
    // details on its contents. The following is a basic permissive set of options:
    httpNodeCors: {
        origin: "*",
        methods: "GET,PUT,POST,DELETE"
    },

    // If you need to set an http proxy please set an environment variable
    // called http_proxy (or HTTP_PROXY) outside of Node-RED in the operating system.
    // For example - http_proxy=http://myproxy.com:8080
    // (Setting it here will have no effect)
    // You may also specify no_proxy (or NO_PROXY) to supply a comma separated
    // list of domains to not proxy, eg - no_proxy=.acme.co,.acme.co.uk

    // The following property can be used to add a custom middleware function
    // in front of the HTTP In node.
    //httpNodeMiddleware: function(req,res,next) {
    //    // Handle/reject the request, or pass it on to the http in node by calling next();
    //    // Optionally skip our rawBodyParser by setting this to true;
    //    //req.skipRawBodyParser = true;
    //    next();
    //},

    // The following property can be used to add a custom middleware function
    // in front of the HTTP Admin API.
    //httpAdminMiddleware: function(req,res,next) {
    //    // Handle/reject the request, or pass it on to the admin api by calling next();
    //    next();
    //},

    // Some nodes, such as HTTP In, can be used to listen for incoming http requests.
    // By default, these are served relative to '/'. The following property
    // can be used to specifiy a different root path. If set to false, this is
    // disabled.
    //httpNodeRoot: '/red-nodes',

    // The following property can be used in place of 'httpAdminRoot' and 'httpNodeRoot',
    // to apply the same root to both parts.
    //httpRoot: '/red',

    // When httpAdminRoot is used to move the UI to a different root path, the
    // following property can be used to identify a directory of static content
    // that should be served at http://localhost:1880/.
    //httpStatic: '/home/nol/node-red-static/',

    // The maximum size of HTTP request that will be accepted by the runtime api.
    // Default: 5mb
    //apiMaxLength: '5mb',

    // If you installed the optional node-red-dashboard you can set it's path
    // relative to httpRoot
    //ui: { path: "ui" },

    // Securing Node-RED
    // -----------------
    // To password protect the Node-RED editor and admin API, the following
    // property can be used. See http://nodered.org/docs/security.html for details.

    // The following property can be used to seed Global Context with predefined
    // values. This allows extra node modules to be made available with the
    // Function node.
    // For example,
    //    functionGlobalContext: { os:require('os') }
    // can be accessed in a function block as:
    //    global.get("os")
    functionGlobalContext: {
        // os:require('os'),
        // jfive:require("johnny-five"),
        // j5board:require("johnny-five").Board({repl:false})
        crypto: require('crypto'),
        moment: require('moment'),
        axios: require('axios'),
        lodash: require('lodash')
    },

    // `global.keys()` returns a list of all properties set in global context.
    // This allows them to be displayed in the Context Sidebar within the editor.
    // In some circumstances it is not desirable to expose them to the editor. The
    // following property can be used to hide any property set in `functionGlobalContext`
    // from being list by `global.keys()`.
    // By default, the property is set to false to avoid accidental exposure of
    // their values. Setting this to true will cause the keys to be listed.
    exportGlobalContextKeys: false,

    // Context Storage
    // The following property can be used to enable context storage. The configuration
    // provided here will enable file-based context that flushes to disk every 30 seconds.
    // Refer to the documentation for further options: https://nodered.org/docs/api/context/
    //contextStorage: {
    //    default: {
    //        module:"localfilesystem"
    //    },
    //},

    // The following property can be used to order the categories in the editor
    // palette. If a node's category is not in the list, the category will get
    // added to the end of the palette.
    // If not set, the following default order is used:
    //paletteCategories: ['subflows', 'common', 'function', 'network', 'sequence', 'parser', 'storage'],

    // Configure the logging output
    logging: {
        // Only console logging is currently supported
        console: {
            // Level of logging to be recorded. Options are:
            // fatal, error, warn, info, debug, trace
            level: "info",
            // Whether or not to include metric events in the log output
            metrics: false,
            // Whether or not to include audit events in the log output
            audit: false
        }
    },

    // Customising the editor
    editorTheme: {
        projects: {
            // To enable the Projects feature, set this value to true
            enabled: false,
            workflow: {
                // Set the default projects workflow mode.
                //  - manual - you must manually commit changes
                //  - auto - changes are automatically committed
                // This can be overridden per-user from the 'Git config'
                // section of 'User Settings' within the editor
                mode: "manual"
            }
        },
        palette: {
            // Enable/disable the Palette Manager
            editable: true,
            // Enable/disable the Catalogue
            catalogues: ['https://catalogue.nodered.org/catalogue.json'],
            // Theme for the palette
            theme: [
                {
                    category: ".*",
                    type: ".*",
                    color: "#f0f0f0"
                }
            ]
        },
        menu: {
            // Hide unwanted menu items by id. see packages/node_modules/@node-red/editor-client/src/js/red.js for complete list
            "menu-item-import-library": false,
            "menu-item-export-library": false,
            "menu-item-keyboard-shortcuts": false,
            "menu-item-help": {
                label: "Payment Switch Help",
                url: "http://localhost:8080/help"
            }
        },
        userMenu: false, // Hide the user-menu even if adminAuth is enabled
        login: {
            image: "/absolute/path/to/login/page/big-image.png" // a 256x256 image
        },
        header: {
            title: "Payment Switch - Node-RED",
            image: "/absolute/path/to/header/image.png", // or null to remove image
            url: "http://localhost:8080" // optional url to make the header text/image a link to this url
        },
        deployButton: {
            type: "simple",
            label: "Deploy",
            icon: "/absolute/path/to/deploy/button/image.png" // or null to remove image
        },
        userSettings: {
            languages: ['en-US']
        },
        codeEditor: {
            lib: "monaco",
            options: {
                theme: "vs-dark",
                fontSize: 14,
                fontFamily: "Cascadia, Fira Code, Consolas, 'Courier New', monospace",
                automaticLayout: true,
                scrollBeyondLastLine: false,
                minimap: {
                    enabled: false
                }
            }
        }
    },

    // Node-RED Dashboard (if installed)
    ui: {
        path: "ui",
        middleware: function (req, res, next) {
            // Add custom middleware for dashboard
            next();
        }
    },

    // Allow the Function node to load additional npm modules directly
    functionExternalModules: true,

    // The following property can be used to set predefined values in Global Context.
    // This allows extra node modules to be made available with the
    // Function node.
    // For example, the following:
    //    functionGlobalContext: { os:require('os') }
    // will allow the `os` module to be accessed in a Function node using:
    //    global.get("os")

    // Node-RED will, by default, honour the 'trust proxy' setting. If you wish to disable
    // this, the following property can be used
    //httpNodeTrustProxy: false,

    // The following property can be used to disable the runtime API.
    // When disabled, the editor will not be able to deploy flows, but the flows will
    // still be served at the httpNodeRoot path
    //runtimeAPI: false,

    // By default, all user data is stored in a directory called `.node-red` under
    // the user's home directory. To use a different location, the following
    // property can be used
    //userDir: '/home/nol/.node-red/',

    // Node-RED scans the `nodes` directory in the userDir to find local node files.
    // The following property can be used to specify an additional directory to scan.
    //nodesDir: '/home/nol/.node-red/nodes/',

    // By default, the Node-RED UI is available at http://localhost:1880/
    // The following property can be used to specify a different root path.
    // If set to false, this is disabled.
    //httpAdminRoot: '/admin',

    // Some nodes, such as HTTP In, can be used to listen for incoming http requests.
    // By default, these are served relative to '/'. The following property
    // can be used to specifiy a different root path. If set to false, this is
    // disabled.
    //httpNodeRoot: '/red-nodes',

    // The following property can be used in place of 'httpAdminRoot' and 'httpNodeRoot',
    // to apply the same root to both parts.
    //httpRoot: '/red',

    // When httpAdminRoot is used to move the UI to a different root path, the
    // following property can be used to identify a directory of static content
    // that should be served at http://localhost:1880/.
    //httpStatic: '/home/nol/node-red-static/',

    // Payment Switch specific settings
    paymentSwitch: {
        // MongoDB connection for storing flow data
        mongoUrl: process.env.MONGODB_URI || 'mongodb://admin:paymentswitch123@mongodb:27017/payment_switch?authSource=admin',
        
        // Redis connection for caching
        redisUrl: process.env.REDIS_URI || 'redis://redis:6379',
        
        // PSP endpoints
        pspEndpoints: {
            transactionProcessor: process.env.TRANSACTION_PROCESSOR_URL || 'http://transaction-processor:3001',
            routingEngine: process.env.ROUTING_ENGINE_URL || 'http://routing-engine:3002',
            pspGateway: process.env.PSP_GATEWAY_URL || 'http://psp-gateway:3003'
        },
        
        // Security settings
        security: {
            encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production',
            jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production'
        },
        
        // Message format settings
        messageFormats: {
            iso8583: {
                enabled: true,
                version: '1987'
            },
            iso20022: {
                enabled: true,
                version: '2013'
            }
        }
    }
};

