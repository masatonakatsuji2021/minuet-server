"use strict";
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
let sectors;
class Listener extends minuet_load_balancer_1.LoadBalancerListner {
    begin() {
        if (this.option) {
            if (this.option.rootDir) {
                __1.Core.setRootDir(this.option.rootDir);
            }
        }
        const init = __1.Core.getInit();
        sectors = __1.Core.getSectors(init);
    }
    listen(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    if (module.onListen) {
                        status = yield module.onListen(req, res);
                    }
                    if (status)
                        break;
                }
            }
        });
    }
}
exports.default = Listener;
