import SupportChat from "./components/SupportChat";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Claude Platform
        </h1>
        <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
          Need help? Click the chat bubble in the bottom-right corner to talk to our
          Claude-powered support assistant.
        </p>
      </main>
      <SupportChat />
    </div>
  );
}
