"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

export default function UploadZone({ onFile, loading }) {
  const [dragError, setDragError] = useState(null);

  const onDrop = useCallback(
    (accepted, rejected) => {
      setDragError(null);
      if (rejected.length > 0) {
        setDragError("Only PDF files are accepted.");
        return;
      }
      if (accepted.length > 0) {
        onFile(accepted[0]);
      }
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: loading,
  });

  const borderColor = isDragReject
    ? "border-red-400 bg-red-50"
    : isDragActive
    ? "border-blue-500 bg-blue-50"
    : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50";

  return (
    <div className="w-full max-w-lg">
      <div
        {...getRootProps()}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-14 text-center cursor-pointer transition-all duration-200 shadow-sm ${borderColor} ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />

        {loading ? (
          <>
            <div className="w-14 h-14 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            <div>
              <p className="text-base font-semibold text-slate-700">Analysing your statement…</p>
              <p className="text-sm text-slate-500 mt-1">This usually takes just a second</p>
            </div>
          </>
        ) : isDragActive && !isDragReject ? (
          <>
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-base font-semibold text-blue-600">Drop it here!</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-700">
                Drop your PDF here, or{" "}
                <span className="text-blue-600 underline underline-offset-2">browse</span>
              </p>
              <p className="text-sm text-slate-500 mt-1">Supports PDF bank statements · Max 20 MB</p>
            </div>
          </>
        )}
      </div>

      {dragError && (
        <p className="mt-3 text-sm text-red-600 text-center">{dragError}</p>
      )}
    </div>
  );
}
