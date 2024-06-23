/**
 * MIT License
 * 
 * Copyright (c) 2024 Masato Nakatsuji
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */

import { LoadBalancerListner } from "minuet-load-balancer";
import { Core, MinuetServerModuleBase } from "../";
import { IncomingMessage, ServerResponse } from "http";

let sectors;

export default class Listener extends LoadBalancerListner {

    public begin() {
        if (this.option) {
            if (this.option.rootDir) {
                Core.setRootDir(this.option.rootDir);
            }
        }

        const init = Core.getInit();
        sectors = Core.getSectors(init);
    }

    public async listen(req : IncomingMessage, res : ServerResponse){

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
