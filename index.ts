import * as os from "os";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as yaml from "js-yaml";
import { LoadBalancer, LoadBalancerOption, LoadBalancerType, LoadBalancerMap, LoadBalancerServer, LoadBalancerServerType } from "minuet-load-balancer";

export class Core {

    public static get rootDir() : string {
        /*
        if (os.platform() == "win32"){
            return "/user/minuet";
        }
        else if (os.platform() == "linux") {
            return "/home/minuet";
        }
        */
        return "test/minuet";
    }

    public static get initDir() : string {
        return this.rootDir + "/conf";
    }

    public static get initPath() : string {
        return this.initDir + "/init.yaml";
    }  

    public static get sectorDir() : string {
        return this.rootDir + "/sectors";
    }

    public static readFile(filePath : string) : any {
        const content = fs.readFileSync(filePath).toString();
        return yaml.load(content);
    }

    public static read(text : string){
        return yaml.load(text);
    }

    public static dump(data: Object) :string {
        return yaml.dump(data);
    }


    public static getInit() : MineutServerInit{
        const content = fs.readFileSync(this.initPath).toString();
        const init : MineutServerInit =  this.read(content);
        this.initCheck(init);
        return init;
    }

    private static initCheck(init : MineutServerInit){
        if (typeof init.processTitle != "string") {
            throw Error("\"ProcessTitle\" is invalid in Core Init.");
        }
        this.initLoadbalancerCheck(init.loadBalancer);
    }

    private static initLoadbalancerCheck(loadBalancer : LoadBalancerOption) {
        if (!loadBalancer){
            throw Error("\"loadBalancer\" is invalid in Core Init.");
        }
        if (!(
            loadBalancer.type == LoadBalancerType.RoundRobin || 
            loadBalancer.type == LoadBalancerType.RandomRobin || 
            loadBalancer.type == LoadBalancerType.Manual
        )) {
            throw Error("\"loadBalancer.type\" is invalid in Core Init.");
        }

        if (!loadBalancer.maps || !Array.isArray(loadBalancer.maps)){
            throw Error("\"loadBalancer.maps\" is invalid in Core Init.");
        }

        this.initLoadBalancerMapsCheck(loadBalancer.maps);
    }

    private static initLoadBalancerMapsCheck(maps : Array<LoadBalancerMap>) {


    }

    public static getSectors(init : MineutServerInit) {
        let res : MinuetServerSectors = {};
        const spc = Object.keys(init.sectorPaths);
        for (let n = 0 ; n < spc.length ; n++){
            const sectorName = spc[n];
            const sectorPath = init.sectorPaths[sectorName];
            if (!fs.existsSync(sectorPath)){
                throw Error("Sector \"" + sectorName + "\" is not exists.");
            }

            const sectorInitPath = sectorPath + "/sector.yaml";
            if (!fs.existsSync(sectorInitPath)){
                throw Error("Sector \"" + sectorName + "\" is configre not exists.");
            }
            let sectorInit : MinuetServerSectorInit = Core.readFile(sectorInitPath);
            
            if (sectorInit.name != sectorName){
                throw Error("Sector \"" + sectorName + "\"  contents are invalid.");
            }

            if (sectorInit.enable == undefined){
                sectorInit.enable = true;
            }

            let protocol;
            let url;
            let defaultPort;
            if (sectorInit.type == MinuetServerListenType.http){
                protocol = "http://";
                defaultPort = 80;
            }
            else if (sectorInit.type == MinuetServerListenType.https){
                protocol = "https://";
                defaultPort = 443;
            }
            else if (sectorInit.type == MinuetServerListenType.webSocket){
                protocol = "ws://";
                defaultPort = 80;
            }
            else if (sectorInit.type == MinuetServerListenType.webSocketSSL){
                protocol = "wss://";
                defaultPort = 443;
            }

            if (sectorInit.port == undefined){
                sectorInit.port = defaultPort;
            }
            url = protocol + sectorInit.host;
            if (sectorInit.port != defaultPort){
                url += ":" + sectorInit.port;
            }

            let moduleInits = [];
            if (sectorInit.modules){
                for (let n2 = 0 ; n2 < sectorInit.modules.length ; n2++){
                    const moduleName = sectorInit.modules[n2];
                    const moduleInitPath = sectorPath + "/module." + moduleName + ".yaml";
                    let moduleInit = {};
                    if (fs.existsSync(moduleInitPath)) {
                        const init = Core.readFile(moduleInitPath);
                        if (init) moduleInit = init;
                    }

                    const buffer = {
                        name: moduleName,
                        init: moduleInit,
                    };

                    moduleInits.push(buffer);
                }
            }


            let sector : MinuetServerSector = {
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

            if (sector.moduleInit){
                for (let n2 = 0 ; n2 < sector.moduleInit.length ; n2++){
                    const moduleInit = sector.moduleInit[n2];
                    const module = Core.getModle(moduleInit, sector);
                    sector.modules.push(module);
                }
            }

            res[sectorName] = sector;
        }
        return res;
    }

    public static getLbServers(init: MineutServerInit) : Array<LoadBalancerServer> {
        let res : Array<LoadBalancerServer> = [];
        let usePorts = {
            http: [],
            webSocket: [],
        };
        const sectors = this.getSectors(init);
        const sc = Object.keys(sectors);
        for (let n = 0 ; n < sc.length ; n++){
            const name = sc[n];
            const sector = sectors[name];

            if (sector.type == MinuetServerListenType.http) {
                if (usePorts.http.indexOf(sector.port) > -1){
                    continue;
                }                
                usePorts.http.push(sector.port);
                res.push({
                    type: LoadBalancerServerType.http,
                    port: sector.port,
                });
            }
            else if (sector.type == MinuetServerListenType.https) {
                res.push({
                    type: LoadBalancerServerType.https,
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
                if (usePorts.webSocket.indexOf(sector.port) >-1){
                    continue;
                }
                res.push({
                    type: LoadBalancerServerType.webSocket,
                    port: sector.port,
                });
            }
            else if (sector.type == MinuetServerListenType.webSocketSSL) {
                res.push({
                    type: LoadBalancerServerType.webSocketSSL,
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

    public static getModle(moduleInit : any, sector: MinuetServerSector) : MinuetServerModuleBase{

        let fullModuleNames : Array<string> = [
            "minuet-server-" + moduleInit.name,
            moduleInit.name,
        ];

        if (moduleInit.init) {
            if (moduleInit.init.formalModuleName) {
                fullModuleNames.push(moduleInit.init.formalModuleName);
            }    
        }

        let module;
        for(let n=0; n < fullModuleNames.length ; n++){
            const fullModuleName : string = fullModuleNames[n];
            const moduleClassname : string = "MinuetServerModule" + moduleInit.name.substring(0,1).toUpperCase() + moduleInit.name.substring(1);
            try{
                let moduleClassBase;
                try{
                    moduleClassBase = require(fullModuleName);
                }catch(err){
//                    console.log("# [WARM] not found = " + fullModuleName);
                    throw Error("");
                }

                let moduleClass;
                try {
                    moduleClass = moduleClassBase[moduleClassname];
                }catch(err){
                    console.log(err);
                    throw Error("");
                }
                module = new moduleClass();
                module.sector = sector;
                module.name = moduleInit.name;
                module.init = moduleInit.init;
                module.onBegin();
                break;
            }catch(err){
                // console.log(err);
            }               
        }


        if (!module){
            return;
        }

        return module;
    }

    public static cmdOutSectors(sectors : MinuetServerSectors) {
        let out : string = "\0<Listen Sector Server>\n";
        const sc = Object.keys(sectors);
        const head =  " name".padEnd(10) + " | " + "type".padEnd(10) + " | " + "url".padEnd(40) + " | " +  "ssl".padEnd(8) + " | " + "enable".padEnd(10);
        let line = "";
        for (let n = 0 ; n < head.length ; n++){
            line += "-";
        }
        out += head + "\n";
        out += line + "\n";
        for (let n = 0 ; n < sc.length ; n++) {
            const name = sc[n];
            const sector = sectors[name];
            let ssl = false;
            if (sector.ssl) ssl = true;
            const td = (" " + sector.name).padEnd(10) + " | " + sector.type.padEnd(10) + " | "+ sector.url.padEnd(40) + " | " + ssl.toString().padEnd(8) + " | " + sector.enable.toString().padEnd(10);
            out += td + "\n";
            let line = "";
            for (let n2 = 0 ; n2 < td.length ; n2++){
                line += "-";
            }
            out += line + "\n";
        }

        console.log(out);
    }

    public static cmdOutLoadBalancer (loadBalancer : LoadBalancerOption) {
        let out : string = "\n";
        out += "<LoadBalancer>\n";
        out += "type = " + loadBalancer.type;
        out += "\n";
        const head = " " + "number".padEnd(9) + " | " + "mode".padEnd(20) +  " | " + "proxy".padEnd(20);
        let line = "";
        for (let n = 0 ; n < head.length ; n++){
            line += "-";
        }
        out += head + "\n";
        out += line + "\n";

        let number = 0;
        for (let n = 0 ; n < loadBalancer.maps.length ; n++){
            let map = loadBalancer.maps[n];
            if (!map.clone) {
                map.clone = 1;
            }
            else {
                if (map.clone == "auto"){
                    map.clone = os.cpus().length;
                }
            }
            if (!map.proxy){
                map.proxy = "";
            }
            for (let n2 = 0 ; n2 < map.clone ; n2++){
                const td = " " + number.toString().padEnd(9) + " | " + map.mode.padEnd(20) + " | " + map.proxy.toString().padEnd(20);

                let line = "";
                for (let n = 0 ; n < td.length ; n++){
                    line += "-";
                }
                out += td + "\n";
                out += line + "\n";
                number++;
            }
            number++;
        }
        console.log(out);
    }
}

interface MineutServerInit {
    processTitle : string,
    loadBalancer: LoadBalancerOption,
    sectorPaths: MineutServerInitSectorPaths,
}

interface MineutServerInitSectorPaths {
    [key: string] : string,
}

interface MinuetServerSectorInit {
    name: string,
    enable: boolean,
    type?: MinuetServerListenType,
    host: string,
    port?: number,
    ssl?: MinuetServerSectorInitSSL,
    modules?: Array<string>,
}

interface MinuetServerSectorInitSSL {
    key: string,
    cert: string,
    ca: Array<string>,
}

interface MinuetServerSectors {
    [x: string] : MinuetServerSector,
}

export interface MinuetServerSector {
    name: string,
    root: string,
    enable: boolean,
    type?: MinuetServerListenType,
    host: string,
    port?: number,
    ssl?: MinuetServerSectorInitSSL,
    moduleInit: Array<any>,
    modules: Array<MinuetServerModuleBase>,
    url: string,
}

enum MinuetServerListenType {
    http = "http",
    https = "https",
    webSocket = "webSocket",
    webSocketSSL = "webSocketSSL",
}

export class MinuetServer {

    private init : MineutServerInit;

    public constructor() {

        try{

            console.log("#### Minuet Server Start!");
            console.log("");

            this.begin();
        
            this.init = Core.getInit();
            console.log("# read init\n");

            // process title
            process.title = this.init.processTitle.toString();

            const sectors = Core.getSectors(this.init);

            const getLbServers = Core.getLbServers(this.init);
        
            Core.cmdOutLoadBalancer(this.init.loadBalancer);
            console.log("");
            Core.cmdOutSectors(sectors);

            new LoadBalancer({
                type: this.init.loadBalancer.type,
                maps: this.init.loadBalancer.maps,
                workPath:  __dirname + "/server/worker",
                servers: getLbServers,
            });
            console.log("\n# Listen Start!");

        }catch(error){
            console.log("[ERROR] : " + error.toString());
            console.log(error.stack);
        }
    }

    private begin() {
        if (!fs.existsSync(Core.rootDir)){
            fs.mkdirSync(Core.rootDir);
            console.log("# mkdir " + Core.rootDir);
        }
    }
}

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
export class MinuetServerModuleBase {

    /**
     * ***name*`** : Module name
     */
    public name : string;

    /**
     * ***sector*** : Sector information at the time of request.
     */
    public sector : MinuetServerSector;

    /**
     * ***init*** : Module initial setting information by sector.
     */
    public init : any;

    /**
     * ***onBegin*** : For events after the module is instantiated.
     */
    public onBegin() {}

    /**
     * ***onRequest*** : Event when listening for a request.
     * @param req 
     * @param res 
     */
    public async onRequest(req : http.IncomingMessage, res : http.ServerResponse) :  Promise<boolean> {
        return false;
    }

    public getModule(moduleName) : MinuetServerModuleBase {
        const moduleList = this.sector.modules;
        let res : MinuetServerModuleBase;
        for (let n = 0 ; n < moduleList.length ; n++){
            const module = moduleList[n];
            if (module.name == moduleName){
                res = module;
                break;
            }            
        }
        return res;
    }

}