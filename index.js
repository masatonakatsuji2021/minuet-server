"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Core = void 0;
const os = require("os");
const fs = require("fs");
const yaml = require("js-yaml");
const minuet_load_balancer_1 = require("minuet-load-balancer");
class Core {
    static get rootDir() {
        return this.root + "/" + os.userInfo().username + "/minuet";
    }
    static get initDir() {
        return this.rootDir + "/conf";
    }
    static get initPath() {
        return this.initDir + "/init.yaml";
    }
    static get sectorDir() {
        return this.rootDir + "/sectors";
    }
    static readFile(filePath) {
        const content = fs.readFileSync(filePath).toString();
        return yaml.load(content);
    }
    static read(text) {
        return yaml.load(text);
    }
    static dump(data) {
        return yaml.dump(data);
    }
    static getInit() {
        const content = fs.readFileSync(this.initPath).toString();
        const init = this.read(content);
        this.initCheck(init);
        return init;
    }
    static initCheck(init) {
        if (typeof init.processTitle != "string") {
            throw Error("\"ProcessTitle\" is invalid in Core Init.");
        }
        this.initLoadbalancerCheck(init.loadBalancer);
    }
    static initLoadbalancerCheck(loadBalancer) {
        if (!loadBalancer) {
            throw Error("\"loadBalancer\" is invalid in Core Init.");
        }
        if (!(loadBalancer.type == minuet_load_balancer_1.LoadBalancerType.RoundRobin ||
            loadBalancer.type == minuet_load_balancer_1.LoadBalancerType.RandomRobin ||
            loadBalancer.type == minuet_load_balancer_1.LoadBalancerType.Manual)) {
            throw Error("\"loadBalancer.type\" is invalid in Core Init.");
        }
        if (!loadBalancer.maps || !Array.isArray(loadBalancer.maps)) {
            throw Error("\"loadBalancer.maps\" is invalid in Core Init.");
        }
        this.initLoadBalancerMapsCheck(loadBalancer.maps);
    }
    static initLoadBalancerMapsCheck(maps) {
    }
    static getSectors(init) {
        let res = {};
        const spc = Object.keys(init.sectorPaths);
        for (let n = 0; n < spc.length; n++) {
            const sectorName = spc[n];
            const sectorPath = init.sectorPaths[sectorName];
            if (!fs.existsSync(sectorPath)) {
                throw Error("Sector \"" + sectorName + "\" is not exists.");
            }
            const sectorInitPath = sectorPath + "/sector.yaml";
            if (!fs.existsSync(sectorInitPath)) {
                throw Error("Sector \"" + sectorName + "\" is configre not exists.");
            }
            const sectorInit = Core.readFile(sectorInitPath);
            if (sectorInit.name != sectorName) {
                throw Error("Sector \"" + sectorName + "\"  contents are invalid.");
            }
            let protocol;
            let url;
            if (sectorInit.type == MinuetServerListenType.http) {
                protocol = "http://";
                url = protocol + sectorInit.host;
                if (sectorInit.port != 80) {
                    url += ":" + sectorInit.port;
                }
            }
            else if (sectorInit.type == MinuetServerListenType.https) {
                protocol = "https://";
            }
            else if (sectorInit.type == MinuetServerListenType.webSocket) {
                protocol = "ws://";
            }
            else if (sectorInit.type == MinuetServerListenType.webSocketSSL) {
                protocol = "wss://";
            }
            const sector = {
                name: sectorName,
                root: sectorPath,
                initialize: sectorInit,
                url: url,
            };
            res[sectorName] = sector;
        }
        return res;
    }
}
exports.Core = Core;
//    private static root: string = "/home";
Core.root = "test";
var MinuetServerListenType;
(function (MinuetServerListenType) {
    MinuetServerListenType["http"] = "http";
    MinuetServerListenType["https"] = "https";
    MinuetServerListenType["webSocket"] = "webSocket";
    MinuetServerListenType["webSocketSSL"] = "webSocketSSL";
})(MinuetServerListenType || (MinuetServerListenType = {}));
class MineutServer {
    constructor() {
        try {
            console.log("#### Minuet Server Start!");
            console.log("");
            if (!fs.existsSync(Core.rootDir)) {
                fs.mkdirSync(Core.rootDir, {
                    recursive: true,
                });
                console.log("# mkdir " + Core.rootDir);
            }
            if (!fs.existsSync(Core.initDir)) {
                fs.mkdirSync(Core.initDir, {
                    recursive: true,
                });
                console.log("# mkdir " + Core.initDir);
            }
            //        if (!fs.existsSync(MinuetServerCore.initDir)){
            fs.copyFileSync(__dirname + "/template/init.yaml", Core.initPath);
            console.log("# make  init.yaml " + Core.initPath);
            //      }
            this.init = Core.getInit();
            console.log("# read init");
            // process title
            process.title = this.init.processTitle.toString();
            const sectors = Core.getSectors(this.init);
            console.log(sectors);
            /*
                        new LoadBalancer({
                            type: this.init.loadBalancer.type,
                            maps: this.init.loadBalancer.maps,
                            workPath:  __dirname + "/server/worker",
                            servers: [
                                { type: LoadBalancerServerType.http, port: 8000 },
                            ],
                        });
                        console.log("# Listen http://localhost:8000");
                        */
        }
        catch (error) {
            console.log("[ERROR] : " + error.toString());
        }
    }
    static getSector() {
    }
}
new MineutServer();
