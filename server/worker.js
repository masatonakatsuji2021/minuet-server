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
const minuet_load_balancer_1 = require("minuet-load-balancer");
const __1 = require("../");
const init = __1.Core.getInit();
const sectors = __1.Core.getSectors(init);
class Listener extends minuet_load_balancer_1.LoadBalancerListner {
    request() {
        return __awaiter(this, void 0, void 0, function* () {
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
                const modules = sector.modules;
                for (let n2 = 0; n2 < modules.length; n2++) {
                    const module = modules[n2];
                    if (!module)
                        continue;
                    let status;
                    if (module.onRequest) {
                        status = yield module.onRequest(req, res);
                    }
                    if (status)
                        break;
                }
            }
        });
    }
}
exports.default = Listener;
