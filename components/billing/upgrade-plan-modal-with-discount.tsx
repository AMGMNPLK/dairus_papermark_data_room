import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function UpgradePlanModalWithDiscount({children,open,setOpen,...props}: any) {
 const [local,update] = useState(false); const visible=open??local; const change=setOpen??update;
 return <Dialog open={visible} onOpenChange={change}>{children&&<DialogTrigger asChild>{children}</DialogTrigger>}<DialogContent><DialogTitle>Feature unavailable on this installation</DialogTitle><DialogDescription>This is the free self-hosted installation. This feature requires services or a commercial module that is not enabled. No purchase, invitation or automatic notification will be made.</DialogDescription><Button onClick={()=>change(false)}>Close</Button></DialogContent></Dialog>;
}
export const UpgradePlanModal = UpgradePlanModalWithDiscount;
export default UpgradePlanModalWithDiscount;
