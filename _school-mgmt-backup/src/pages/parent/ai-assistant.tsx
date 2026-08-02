import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { getToken, parentApi, isAuthError } from "@/lib/jwt-api";
import AiChatInterface, { type AiToolGroup } from "@/components/AiChatInterface";
import { Loader2 } from "lucide-react";

const STUDENT_TOOL_GROUPS: AiToolGroup[] = [
  {
    title: "Homework Help",
    tools: [
      { label: "Solve a Problem", icon: "🔍", prompt: "Help me solve this problem: " },
      { label: "Check My Answer", icon: "✅", prompt: "Check if my answer is correct: Question: " },
      { label: "Step-by-Step Help", icon: "📝", prompt: "Explain step-by-step how to solve: " },
    ],
  },
  {
    title: "Chapter Help",
    tools: [
      { label: "Explain a Topic", icon: "📖", prompt: "Explain the following topic in simple language: " },
      { label: "Summarize Chapter", icon: "📋", prompt: "Summarize the chapter: " },
      { label: "Key Points", icon: "💡", prompt: "Give me the key points from: " },
    ],
  },
  {
    title: "Practice",
    tools: [
      { label: "Practice Questions", icon: "❓", prompt: "Give me 5 practice questions on the topic: " },
      { label: "Revision Notes", icon: "📚", prompt: "Create revision notes for the topic: " },
      { label: "Maths Solution", icon: "🔢", prompt: "Solve this maths problem step by step: " },
    ],
  },
  {
    title: "School Info",
    tools: [
      { label: "Fee Query Help", icon: "💰", prompt: "I have a question about school fees: " },
      { label: "Attendance Info", icon: "📅", prompt: "I want to understand my attendance. " },
      { label: "Report Card Help", icon: "📊", prompt: "Help me understand my report card. " },
    ],
  },
];

const PARENT_TOOL_GROUPS: AiToolGroup[] = [
  {
    title: "Attendance",
    tools: [
      { label: "Attendance Query", icon: "📅", prompt: "I have a query about my child's attendance: " },
      { label: "Leave Application", icon: "✉️", prompt: "Help me write a leave application for my child for " },
    ],
  },
  {
    title: "Fees",
    tools: [
      { label: "Fee Query", icon: "💰", prompt: "I have a query about school fees: " },
      { label: "Fee Structure Help", icon: "📋", prompt: "Explain the school fee structure for " },
    ],
  },
  {
    title: "Academics",
    tools: [
      { label: "Report Card Help", icon: "📊", prompt: "Help me understand my child's report card results. " },
      { label: "How to Help at Home", icon: "🏠", prompt: "How can I help my child with " },
    ],
  },
  {
    title: "School Info",
    tools: [
      { label: "School Policies", icon: "📜", prompt: "Explain the school policy on " },
      { label: "Academic Calendar", icon: "📅", prompt: "I need information about the school's academic schedule for " },
    ],
  },
];

export default function ParentAiAssistant() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [isStudent, setIsStudent] = useState(false);
  const token = getToken("parent");

  useEffect(() => {
    if (!token) { navigate("/parent/login"); return; }
    parentApi.get<{ fatherName?: string; students?: unknown[] }>("/auth/parent/me")
      .then((user) => {
        // Detect if logged in user is a parent or student by checking for student list
        setIsStudent(!user.fatherName && !(user.students?.length));
      })
      .catch((err) => { if (isAuthError(err)) navigate("/parent/login"); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ParentLayout title="AI Assistant">
        <div className="flex justify-center h-64 items-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout title="AI Assistant">
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="hidden md:block">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">AI Assistant</h2>
          <p className="text-sm text-slate-500">
            {isStudent
              ? "Student AI — Homework help, chapter explanations, practice questions & revision notes"
              : "Parent AI — Attendance, fees, report card, and school information help"}
          </p>
        </div>
        <AiChatInterface
          toolGroups={isStudent ? STUDENT_TOOL_GROUPS : PARENT_TOOL_GROUPS}
          apiPath="/ai/chat"
          authToken={token}
          placeholder={isStudent
            ? "Ask me anything about your homework, a chapter, or practice questions…"
            : "Ask me about attendance, fees, report cards, or school information…"}
        />
      </div>
    </ParentLayout>
  );
}
