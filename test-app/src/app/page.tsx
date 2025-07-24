import ContractUploader from "./components/ContractUploader";

export default function Home() {
  return (
    <div className="font-sans flex w-full items-center justify-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <ContractUploader />
      </main>
    </div>
  );
}
