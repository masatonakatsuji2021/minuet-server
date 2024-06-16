"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const minuet_load_balancer_1 = require("minuet-load-balancer");
const __1 = require("../");
const init = __1.Core.getInit();
const sectors = __1.Core.getSectors(init);
class Listener extends minuet_load_balancer_1.LoadBalancerListner {
    request() {
        const req = this.req;
        const res = this.res;
        const sc = Object.keys(sectors);
        for (let n = 0; n < sc.length; n++) {
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
exports.default = Listener;
