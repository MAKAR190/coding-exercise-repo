"use client";
import React, { useState, useRef, useEffect } from "react";

export default function ContractUploader() {
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [instruction, setInstruction] = useState("");
  const [clause, setClause] = useState("");
  const [uploading, setUploading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (resultUrl && downloadRef.current) {
      downloadRef.current.click();
    }
  }, [resultUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setContractFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setResultUrl(null);
    if (!contractFile || !instruction.trim() || !clause.trim()) {
      setError(
        "Please upload a contract and enter both instruction and clause."
      );
      setUploading(false);
      return;
    }
    const formData = new FormData();
    formData.append("contract", contractFile);
    formData.append(
      "instruction",
      new Blob([instruction], { type: "text/plain" })
    );
    formData.append("clause", new Blob([clause], { type: "text/plain" }));
    try {
      const res = await fetch("/api/process-docx", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to process document");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setResultUrl(url);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-between p-8">
      <h1 className="text-2xl font-bold mb-12">Contract Clause Inserter</h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-md"
      >
        <label>
          Contract (.docx):
          <input type="file" accept=".docx" onChange={handleFileChange} />
        </label>
        <label>
          Instruction:
          <textarea
            className="w-full border rounded p-2"
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Insert this clause as section 1A, directly after the 'Definitions' heading."
          />
        </label>
        <label>
          Clause:
          <textarea
            className="w-full border rounded p-2"
            rows={4}
            value={clause}
            onChange={(e) => setClause(e.target.value)}
            placeholder="Paste the clause text here."
          />
        </label>
        <button
          type="submit"
          disabled={uploading}
          className="bg-blue-600 text-white py-2 rounded"
        >
          {uploading ? "Processing..." : "Insert Clause"}
        </button>
        {error && <div className="text-red-600">{error}</div>}
        {/* Hidden anchor for auto-download */}
        {resultUrl && (
          <a
            href={resultUrl}
            download="updated_contract.docx"
            ref={downloadRef}
            style={{ display: "none" }}
          >
            Download Updated Contract
          </a>
        )}
      </form>
    </main>
  );
}
