"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { masterConfig } from "@/lib/master-config";

export default function MasterPage() {
  const {kind}=useParams(); const config=Object.hasOwn(masterConfig,kind)?masterConfig[kind]:null;
  const [rows,setRows]=useState([]); const [editor,setEditor]=useState(null); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  useEffect(()=>{ const controller=new AbortController(); fetch(`/api/master/${kind}`,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setRows(d.rows);setEditor(null);}).catch(e=>{if(e.name!=="AbortError")setMessage(e.message);});return()=>controller.abort(); },[kind]);
  if(!config)return <p>Not found</p>;
  async function save(e) {
    e.preventDefault();setBusy(true);setMessage("");
    try{const response=await fetch(`/api/master/${kind}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editor)});const d=await response.json();if(!response.ok)throw new Error(d.error);setRows(previous=>[...previous.filter(r=>r.id!==d.row.id),d.row].sort((a,b)=>a.name.localeCompare(b.name)));setEditor(null);setMessage("บันทึกเรียบร้อย");}catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  return <main className="p-8 space-y-5"><h1 className="text-2xl font-bold">{config.label}</h1><p role="status">{message}</p>
    <button className="border rounded p-2" onClick={()=>setEditor({is_active:true,...Object.fromEntries(Object.keys(config.fields).map(f=>[f,""]))})}>Add</button>
    {editor && <form onSubmit={save} className="space-y-3 rounded border p-4"><h2>{editor.id?"Edit":"Add"}</h2>{Object.entries(config.fields).map(([field,max])=><label key={field} className="block">{field}<input className="block w-full border p-2" required={field==="name"} maxLength={max} value={editor[field]??""} onChange={e=>setEditor({...editor,[field]:e.target.value})}/></label>)}<label className="block"><input type="checkbox" checked={editor.is_active} onChange={e=>setEditor({...editor,is_active:e.target.checked})}/> Active</label><button disabled={busy} className="bg-black text-white rounded p-2">Save</button> <button type="button" onClick={()=>setEditor(null)}>Cancel</button></form>}
    <table className="w-full text-left"><thead><tr><th>Name</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b"><td className="py-3">{row.name}</td><td>{row.is_active?"Active":"Inactive"}</td><td><button className="underline" onClick={()=>setEditor(row)}>Edit</button></td></tr>)}</tbody></table>
  </main>;
}
