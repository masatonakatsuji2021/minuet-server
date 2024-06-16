import { LoadBalancerListner } from "minuet-load-balancer";
import { MinuetServer, Core } from "../";

const init = Core.getInit();
const sectors = Core.getSectors(init);

export default class Listener extends LoadBalancerListner {

    public request(){
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

            

            res.write("...............OK!!");
            res.write("\n sector = " + sector.name);
            res.end();
        }
    }

}
