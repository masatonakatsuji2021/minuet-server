import { LoadBalancerListner } from "minuet-load-balancer";
import { Core, MinuetServerModuleBase } from "../";

let sectors;

export default class Listener extends LoadBalancerListner {

    public static begin() {
        if (this.option) {
            if (this.option.rootDir) {
                Core.setRootDir(this.option.rootDir);
            }
        }

        const init = Core.getInit();
        sectors = Core.getSectors(init);
    }

    public async request(){
        const req = this.req;
        const res = this.res;

        const sc = Object.keys(sectors);
        for (let n = 0 ; n < sc.length ; n++) {
            const sectorName = sc[n];
            const sector = sectors[sectorName];

            const host = sector.host + ":" + sector.port;
            if (req.headers.host != host) {
                continue;
            }

            const modules : Array<MinuetServerModuleBase> = sector.modules;
            for (let n2 = 0 ; n2 < modules.length ; n2++){
                const module : MinuetServerModuleBase = modules[n2];

                if (!module) continue;

                let status : boolean;
                if (module.onRequest){
                    status = await module.onRequest(req, res);
                }
                if (status) break;
            }
        }
    }

}
