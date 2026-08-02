import { getAdminToken } from "@/lib/auth";
import AiChatInterface, { type AiToolGroup } from "@/components/AiChatInterface";

const ADMIN_TOOL_GROUPS: AiToolGroup[] = [
  {
    title: "Notices & Letters",
    tools: [
      { label: "Write a Notice", icon: "📢", prompt: "Write a formal school notice for parents about " },
      { label: "Draft a Circular", icon: "📋", prompt: "Draft an official circular for " },
      { label: "Write a Letter", icon: "✉️", prompt: "Write a formal letter from the school to parents regarding " },
      { label: "Announcement", icon: "📣", prompt: "Write a school announcement about " },
    ],
  },
  {
    title: "School Management",
    tools: [
      { label: "Fee Reminder", icon: "💰", prompt: "Write a polite fee reminder notice for parents. The last date is " },
      { label: "Event Notice", icon: "🎉", prompt: "Write a notice for an upcoming school event: " },
      { label: "Holiday Notice", icon: "📅", prompt: "Write a holiday notice for " },
      { label: "Meeting Notice", icon: "🤝", prompt: "Write a parent-teacher meeting notice for " },
    ],
  },
  {
    title: "General Help",
    tools: [
      { label: "Translate to Hindi", icon: "🌐", prompt: "Translate the following school notice to Hindi: " },
      { label: "Summarize Text", icon: "📝", prompt: "Summarize this text in simple language: " },
      { label: "Improvement Tips", icon: "💡", prompt: "Give me tips to improve school management in the area of " },
    ],
  },
];

export default function AdminAiAssistantTab() {
  const token = getAdminToken();

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="hidden md:block">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">AI Assistant</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Admin AI — Notices, circulars, letters, and school management help
        </p>
      </div>
      <AiChatInterface
        toolGroups={ADMIN_TOOL_GROUPS}
        apiPath="/ai/chat"
        authToken={token}
        placeholder="Ask me to write a notice, draft a circular, or help with school management…"
      />
    </div>
  );
}
