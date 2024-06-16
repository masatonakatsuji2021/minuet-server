import { exec, execSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { LoadBalancer, LoadBalancerOption, LoadBalancerType, LoadBalancerServerType, LoadBalancerMap } from "minuet-load-balancer";
import { error } from "console";

export class Core {

//    private static root: string = "/home";
    private static root: string = "test";

    public static get rootDir() : string {
        return this.root + "/" + os.userInfo().username + "/minuet";
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
            if (sectorInit.type == MinuetServerListenType.http){
                protocol = "http://";
                if (sectorInit.port == undefined){
                    sectorInit.port = 80;
                }
                url = protocol + sectorInit.host;
                if (sectorInit.port != 80){
                    url += ":" + sectorInit.port;
                }
            }
            else if (sectorInit.type == MinuetServerListenType.https){
                protocol = "https://";
                if (sectorInit.port == undefined){
                    sectorInit.port = 443;
                }


            }
            else if (sectorInit.type == MinuetServerListenType.webSocket){
                protocol = "ws://";
                if (sectorInit.port == undefined){
                    sectorInit.port = 80;
                }


            }
            else if (sectorInit.type == MinuetServerListenType.webSocketSSL){
                protocol = "wss://";
                if (sectorInit.port == undefined){
                    sectorInit.port = 443;
                }


            }



            const sector : MinuetServerSector = {
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

    modules: Array<string>,
}

interface MinuetServerSectorInitSSL {
    key: string,
    
    cert: string,

    ca: Array<string>,
}

interface MinuetServerSectors {
    [x: string] : MinuetServerSector,
}

interface MinuetServerSector {
    name: string,
    root: string,
    initialize: MinuetServerSectorInit,
    url: string,
}

interface MinuetServerOption {


}

enum MinuetServerListenType {
    http = "http",
    https = "https",
    webSocket = "webSocket",
    webSocketSSL = "webSocketSSL",
}

class MineutServer {

    private init : MineutServerInit;

    public constructor() {

        try{

            console.log("#### Minuet Server Start!");
            console.log("");

            if (!fs.existsSync(Core.rootDir)){
                fs.mkdirSync(Core.rootDir, {
                    recursive: true,
                });    
                console.log("# mkdir " + Core.rootDir);
            }

            if (!fs.existsSync(Core.initDir)){
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

        }catch(error){
            console.log("[ERROR] : " + error.toString());
        }

    }

    public static getSector() {

    }
}

new MineutServer();