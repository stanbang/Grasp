import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
export function IconButton({icon:Icon,label,onClick,disabled=false,pressed}:{icon:LucideIcon;label:string;onClick:()=>void;disabled?:boolean;pressed?:boolean}) {
 const id=useId();return <span className="preview-icon-wrap"><button type="button" className="preview-icon" aria-label={label} aria-describedby={id} aria-pressed={pressed} disabled={disabled} onClick={onClick}><Icon size={18}/></button><span className="preview-tooltip" role="tooltip" id={id}>{label}</span></span>;
}
