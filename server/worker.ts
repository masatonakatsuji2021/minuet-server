import { LoadBalancerListner } from "minuet-load-balancer";
import { MinuetServer, Core, MinuetServerModuleBase } from "../";

const init = Core.getInit();
const sectors = Core.getSectors(init);

export default class Listener extends LoadBalancerListner {

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
                const status = await module.onRequest(req, res);
                if (status) break;
            }
        }
    }

}
