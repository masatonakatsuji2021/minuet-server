"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const minuet_load_balancer_1 = require("minuet-load-balancer");
class Listener extends minuet_load_balancer_1.LoadBalancerListner {
    request() {
        const req = this.req;
        const res = this.res;
        res.write("...............OK!!");
        res.end();
    }
}
exports.default = Listener;
