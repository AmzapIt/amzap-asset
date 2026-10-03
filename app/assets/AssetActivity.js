"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QuickPhotoUpload from './QuickPhotoUpload';
import AssetHistory from './AssetHistory';

export default function AssetActivity({ assetId, canWrite }) {
  const [revision,setRevision] = useState(0);
  const router = useRouter();
  return <>
    {canWrite && <details id="asset-photos" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white shadow-sm"><summary className="cursor-pointer p-4 font-semibold sm:p-6">ถ่ายรูป / เพิ่มรูป Asset</summary><div className="border-t p-4 sm:p-6"><QuickPhotoUpload assetId={assetId} onUploaded={() => {setRevision((n) => n+1);router.refresh();}} /></div></details>}
    <AssetHistory key={`${assetId}:${revision}`} assetId={assetId} />
  </>;
}
