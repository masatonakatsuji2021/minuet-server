"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinuetServerModuleBase = exports.MinuetServer = exports.Core = void 0;
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
            let sectorInit = Core.readFile(sectorInitPath);
            if (sectorInit.name != sectorName) {
                throw Error("Sector \"" + sectorName + "\"  contents are invalid.");
            }
            if (sectorInit.enable == undefined) {
                sectorInit.enable = true;
            }
            let protocol;
            let url;
            let defaultPort;
            if (sectorInit.type == MinuetServerListenType.http) {
                protocol = "http://";
                defaultPort = 80;
            }
            else if (sectorInit.type == MinuetServerListenType.https) {
                protocol = "https://";
                defaultPort = 443;
            }
            else if (sectorInit.type == MinuetServerListenType.webSocket) {
                protocol = "ws://";
                defaultPort = 80;
            }
            else if (sectorInit.type == MinuetServerListenType.webSocketSSL) {
                protocol = "wss://";
                defaultPort = 443;
            }
            if (sectorInit.port == undefined) {
                sectorInit.port = defaultPort;
            }
            url = protocol + sectorInit.host;
            if (sectorInit.port != defaultPort) {
                url += ":" + sectorInit.port;
            }
            let moduleInits = [];
            if (sectorInit.modules) {
                for (let n2 = 0; n2 < sectorInit.modules.length; n2++) {
                    const moduleName = sectorInit.modules[n2];
                    const moduleInitPath = sectorPath + "/module." + moduleName + ".yaml";
                    let moduleInit = {};
                    if (fs.existsSync(moduleInitPath)) {
                        moduleInit = Core.readFile(moduleInitPath);
                    }
                    const buffer = {
                        name: moduleName,
                        init: moduleInit,
                    };
                    moduleInits.push(buffer);
                }
            }
            let sector = {
                name: sectorName,
                root: sectorPath,
                enable: sectorInit.enable,
                type: sectorInit.type,
                host: sectorInit.host,
                port: sectorInit.port,
                moduleInit: moduleInits,
                modules: [],
                url: url,
            };
            if (sector.moduleInit) {
                for (let n2 = 0; n2 < sector.moduleInit.length; n2++) {
                    const moduleInit = sector.moduleInit[n2];
                    const module = Core.getModle(moduleInit, sector);
                    sector.modules.push(module);
                }
            }
            res[sectorName] = sector;
        }
        return res;
    }
    static getLbServers(init) {
        let res = [];
        let usePorts = {
            http: [],
            webSocket: [],
        };
        const sectors = this.getSectors(init);
        const sc = Object.keys(sectors);
        for (let n = 0; n < sc.length; n++) {
            const name = sc[n];
            const sector = sectors[name];
            if (sector.type == MinuetServerListenType.http) {
                if (usePorts.http.indexOf(sector.port) > -1) {
                    continue;
                }
                usePorts.http.push(sector.port);
                res.push({
                    type: minuet_load_balancer_1.LoadBalancerServerType.http,
                    port: sector.port,
                });
            }
            else if (sector.type == MinuetServerListenType.https) {
                res.push({
                    type: minuet_load_balancer_1.LoadBalancerServerType.https,
                    port: sector.port,
                    ssl: {
                        domain: sector.host,
                        key: sector.ssl.key,
                        cert: sector.ssl.cert,
                        ca: sector.ssl.ca,
                    },
                });
            }
            else if (sector.type == MinuetServerListenType.webSocket) {
                if (usePorts.webSocket.indexOf(sector.port) > -1) {
                    continue;
                }
                res.push({
                    type: minuet_load_balancer_1.LoadBalancerServerType.webSocket,
                    port: sector.port,
                });
            }
            else if (sector.type == MinuetServerListenType.webSocketSSL) {
                res.push({
                    type: minuet_load_balancer_1.LoadBalancerServerType.webSocketSSL,
                    port: sector.port,
                    ssl: {
                        domain: sector.host,
                        key: sector.ssl.key,
                        cert: sector.ssl.cert,
                        ca: sector.ssl.ca,
                    },
                });
            }
        }
        return res;
    }
    static getModle(moduleInit, sector) {
        let fullModuleNames = [
            "minuet-server-" + moduleInit.name,
            moduleInit.name,
        ];
        if (moduleInit.init.formalModuleName) {
            fullModuleNames.push(moduleInit.init.formalModuleName);
        }
        let module;
        for (let n = 0; n < fullModuleNames.length; n++) {
            const fullModuleName = fullModuleNames[n];
            const moduleClassname = "MinuetServerModule" + moduleInit.name.substring(0, 1).toUpperCase() + moduleInit.name.substring(1);
            try {
                const moduleClass = require(fullModuleName)[moduleClassname];
                module = new moduleClass();
                module.sector = sector;
                module.name = moduleInit.name;
                module.init = moduleInit.init;
                module.onBegin();
                break;
            }
            catch (err) {
                // console.log(err);
            }
        }
        if (!module) {
            return;
        }
        return module;
    }
    static cmdOutSectors(sectors) {
        let out = "\0<Listen Sector Server>\n";
        const sc = Object.keys(sectors);
        const head = " name".padEnd(10) + " | " + "type".padEnd(10) + " | " + "url".padEnd(40) + " | " + "ssl".padEnd(8) + " | " + "enable".padEnd(10);
        let line = "";
        for (let n = 0; n < head.length; n++) {
            line += "-";
        }
        out += head + "\n";
        out += line + "\n";
        for (let n = 0; n < sc.length; n++) {
            const name = sc[n];
            const sector = sectors[name];
            let ssl = false;
            if (sector.ssl)
                ssl = true;
            const td = (" " + sector.name).padEnd(10) + " | " + sector.type.padEnd(10) + " | " + sector.url.padEnd(40) + " | " + ssl.toString().padEnd(8) + " | " + sector.enable.toString().padEnd(10);
            out += td + "\n";
            let line = "";
            for (let n2 = 0; n2 < td.length; n2++) {
                line += "-";
            }
            out += line + "\n";
        }
        console.log(out);
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
class MinuetServer {
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
            console.log("# read init\n");
            // process title
            process.title = this.init.processTitle.toString();
            const sectors = Core.getSectors(this.init);
            const getLbServers = Core.getLbServers(this.init);
            Core.cmdOutSectors(sectors);
            new minuet_load_balancer_1.LoadBalancer({
                type: this.init.loadBalancer.type,
                maps: this.init.loadBalancer.maps,
                workPath: __dirname + "/server/worker",
                servers: getLbServers,
            });
            console.log("# Listen Start!");
        }
        catch (error) {
            console.log("[ERROR] : " + error.toString());
            console.log(error.stack);
        }
    }
    static getSector() {
    }
}
exports.MinuetServer = MinuetServer;
/**
 * ***Minuet Server Module Base*** : Third parties use this class to create modules that succeed.
 * The derived class name should be **MinuetServerModule{module name}**.
 *
 * Exp:  If your module name is ``m01``, put the following code in the ``index.ts`` file:.
 *
 * ```typescript
 * export class MinuetServerModuleM01 extends MinuetServerModuleBase {
 *      public onRequest(req, res) {
 *          // listen code...
 *      }
 * }
 * ```
 */
class MinuetServerModuleBase {
    /**
     * ***onBegin*** : For events after the module is instantiated.
     */
    onBegin() { }
    /**
     * ***onRequest*** : Event when listening for a request.
     * @param req
     * @param res
     */
    onRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return false;
        });
    }
}
exports.MinuetServerModuleBase = MinuetServerModuleBase;
