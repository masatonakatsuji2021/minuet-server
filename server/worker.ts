import { LoadBalancerListner } from "minuet-load-balancer";

export default class Listener extends LoadBalancerListner {

    public request(){
        const req = this.req;
        const res = this.res;

        res.write("...............OK!!");
        res.end();
    }

}
